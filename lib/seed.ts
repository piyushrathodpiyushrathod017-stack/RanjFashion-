import crypto from "node:crypto";
import { getDb, persistDb, queryAll, queryOne, run } from "./db";
import { SCHEMA } from "./schema";
import { ROLE_PERMISSIONS, PERMISSION_KEYS } from "./permissions";
import { hashPassword } from "./crypto";

const OWNER_EMAIL = "owner@ranjfashion.com";
const OWNER_PASSWORD = "RanjFashion@2026"; // must be changed on first login
const OWNER_FULL_NAME = "RANJ FASHION Owner";

const DEFAULT_ROLES = [
  "Owner / Super Admin",
  "Manager",
  "Product Staff",
  "Content Staff",
  "Viewer",
];

const DEFAULT_CATEGORIES = [
  { name_en: "Men's Fashion", name_gu: "પુરુષોનો ફેશન", slug: "mens-fashion", description_en: "Clothing for men", description_gu: "પુરુષો માટેના કપડાં" },
  { name_en: "Women's Fashion", name_gu: "મહિલાઓનો ફેશન", slug: "womens-fashion", description_en: "Clothing for women", description_gu: "મહિલાઓ માટેના કપડાં" },
  { name_en: "Kids Fashion", name_gu: "બાળકોનું ફેશન", slug: "kids-fashion", description_en: "Clothing for kids", description_gu: "બાળકો માટેના કપડાં" },
  { name_en: "Innerwear", name_gu: "આંતરવસ્ત્ર", slug: "innerwear", description_en: "Innerwear", description_gu: "આંતરવસ્ત્ર" },
  { name_en: "Traditional Wear", name_gu: "પરંપરાગત પોશાક", slug: "traditional-wear", description_en: "Traditional clothing", description_gu: "પરંપરાગત કપડાં" },
  { name_en: "Seasonal Collection", name_gu: "મૌસમી કલેક્શન", slug: "seasonal-collection", description_en: "Seasonal clothing", description_gu: "મૌસમી કપડાં" },
];

/** Initialize the database schema and seed default data. Safe to re-run. */
export async function initDatabase(): Promise<void> {
  const db = await getDb();
  db.exec(SCHEMA);

  // Seed roles
  for (const name of DEFAULT_ROLES) {
    const id = crypto.randomUUID();
    run(db, "INSERT OR IGNORE INTO roles (id, name, description) VALUES (?, ?, ?)", [id, name, `${name} role`]);
  }

  // Seed permissions
  for (const key of PERMISSION_KEYS) {
    const id = crypto.randomUUID();
    run(db, "INSERT OR IGNORE INTO permissions (id, permission_key, description) VALUES (?, ?, ?)", [id, key, `Permission: ${key}`]);
  }

  // Map role name -> id, permission key -> id
  const roleRows = queryAll(db, "SELECT id, name FROM roles", []) as { id: string; name: string }[];
  const permRows = queryAll(db, "SELECT id, permission_key FROM permissions", []) as { id: string; permission_key: string }[];
  const roleByName = new Map(roleRows.map((r) => [r.name, r.id]));
  const permByKey = new Map(permRows.map((r) => [r.permission_key, r.id]));

  // Seed role_permissions
  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleByName.get(roleName);
    if (!roleId) continue;
    for (const key of keys) {
      const permId = permByKey.get(key);
      if (!permId) continue;
      run(db, "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [roleId, permId]);
    }
  }

  // Seed owner account
  const ownerRoleId = roleByName.get("Owner / Super Admin");
  if (ownerRoleId) {
    const existing = queryOne(db, "SELECT id FROM profiles WHERE email = ?", [OWNER_EMAIL]);
    if (!existing) {
      const id = crypto.randomUUID();
      run(db,
        "INSERT INTO profiles (id, full_name, email, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, ?, 1)",
        [id, OWNER_FULL_NAME, OWNER_EMAIL, hashPassword(OWNER_PASSWORD), ownerRoleId]);
    }
  }

  // Seed default categories
  const CATEGORY_IMAGES: Record<string, string> = {
    "mens-fashion": "/images/cat-men.jpg",
    "womens-fashion": "/images/cat-women.jpg",
    "kids-fashion": "/images/cat-kids.jpg",
    "innerwear": "/images/cat-innerwear.jpg",
    "traditional-wear": "/images/cat-traditional.jpg",
    "seasonal-collection": "/images/cat-seasonal.jpg",
  };
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const cat = DEFAULT_CATEGORIES[i];
    const id = crypto.randomUUID();
    run(db,
      `INSERT OR IGNORE INTO categories (id, name_en, name_gu, slug, description_en, description_gu, image_url, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, cat.name_en, cat.name_gu, cat.slug, cat.description_en, cat.description_gu, CATEGORY_IMAGES[cat.slug] ?? null, i]);
  }

  // Seed curated collections
  const DEMO_COLLECTIONS = [
    { slug: "festive-edit", nameEn: "Festive Edit", nameGu: "ઉત્સવી સંગ્રહ", descriptionEn: "Dress up for the celebrations with pieces that feel special.", descriptionGu: "ઉજવણીઓ માટે ખાસ પસંદગી.", banner: "/images/cat-traditional.jpg", codes: ["RF-T-001", "RF-M-001", "RF-W-001"] },
    { slug: "everyday-essentials", nameEn: "Everyday Essentials", nameGu: "રોજિંદા આવશ્યક", descriptionEn: "Comfortable favourites you will reach for again and again.", descriptionGu: "વારંવાર પહેરવાના આરામદાયક પસંદગીઓ.", banner: "/images/hero-model.jpg", codes: ["RF-I-001", "RF-W-002", "RF-M-002"] },
    { slug: "seasonal-picks", nameEn: "Seasonal Picks", nameGu: "મૌસમી પસંદગી", descriptionEn: "Layer up and step out in style, whatever the weather.", descriptionGu: "દરેક ઋતુમાં સ્ટાઇલ સાથે બહાર નીકળો.", banner: "/images/cat-seasonal.jpg", codes: ["RF-S-001", "RF-K-001", "RF-M-001"] },
  ];
  for (let i = 0; i < DEMO_COLLECTIONS.length; i++) {
    const c = DEMO_COLLECTIONS[i];
    run(db,
      `INSERT OR IGNORE INTO collections (id, name_en, name_gu, slug, description_en, description_gu, banner_url, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [crypto.randomUUID(), c.nameEn, c.nameGu, c.slug, c.descriptionEn, c.descriptionGu, c.banner, i]);
  }

  // Seed site settings
  const settings: [string, string][] = [
    ["brand_name", "RANJ FASHION"],
    ["whatsapp_number", "919999999999"],
    ["shop_address", "RANJ FASHION, Main Market, Gujarat, India"],
    ["opening_hours", "10:00 AM - 9:00 PM"],
    ["email", "contact@ranjfashion.com"],
    ["instagram", "https://instagram.com/ranjfashion"],
    ["facebook", "https://facebook.com/ranjfashion"],
    ["youtube", "https://youtube.com/@ranjfashion"],
    ["default_language", "en"],
    ["supported_languages", "en,gu"],
  ];
  for (const [key, value] of settings) {
    run(db, "INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)", [key, value]);
  }

  // Demo catalogue so a fresh install has a storefront to browse.
  seedDemoProducts(db);

  persistDb(db);
}

type DemoProduct = {
  code: string;
  nameEn: string;
  nameGu: string;
  slug: string;
  categorySlug: string;
  descriptionEn: string;
  descriptionGu: string;
  selling: string;
  original: string;
  image: string;
  sizes: string[];
  colors: { name: string; code: string }[];
  featured?: boolean;
  bestSeller?: boolean;
  newArrival?: boolean;
};

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    code: "RF-M-001", nameEn: "Classic Cotton Kurta", nameGu: "ક્લાસિક કોટન કુર્તા",
    slug: "classic-cotton-kurta", categorySlug: "mens-fashion",
    descriptionEn: "A breathable cotton kurta with a relaxed fit, finished with subtle hand stitching. Made for everyday comfort and festive evenings alike.",
    descriptionGu: "હવાદાર કોટનનો કુર્તા, આરામદાયક ફિટ અને નાજુક હાથની ભરતકામ સાથે.",
    selling: "1299", original: "1899", image: "/images/product-5.jpg",
    sizes: ["S", "M", "L", "XL"], colors: [{ name: "Ivory", code: "#F2EBDD" }, { name: "Charcoal", code: "#3A3A3A" }],
    featured: true, bestSeller: true,
  },
  {
    code: "RF-W-001", nameEn: "Floral Wrap Dress", nameGu: "ફ્લોરલ રેપ ડ્રેસ",
    slug: "floral-wrap-dress", categorySlug: "womens-fashion",
    descriptionEn: "Lightweight georgette with a flattering wrap silhouette and a soft floral print. Perfect for brunches and weekend getaways.",
    descriptionGu: "હળવા જ્યોર્જેટ ફેબ્રિક, સુંદર રેપ ફિટ અને ફૂલોની છપાઈ.",
    selling: "1899", original: "2499", image: "/images/product-2.jpg",
    sizes: ["XS", "S", "M", "L"], colors: [{ name: "Floral Ivory", code: "#EFE6D6" }],
    featured: true, newArrival: true,
  },
  {
    code: "RF-W-002", nameEn: "Everyday Linen Shirt", nameGu: "રોજિંદુ લિનન શર્ટ",
    slug: "everyday-linen-shirt", categorySlug: "womens-fashion",
    descriptionEn: "An effortless linen shirt that gets softer with every wash. Wear it open over a tee or buttoned up for a clean, easy look.",
    descriptionGu: "રોજિંદા વપરાશ માટેનું લિનન શર્ટ, ધોવા સાથે વધુ નરમ બને છે.",
    selling: "1099", original: "1499", image: "/images/hero-model.jpg",
    sizes: ["S", "M", "L", "XL"], colors: [{ name: "Oat", code: "#D9C9B0" }, { name: "Rust", code: "#A6553A" }],
    bestSeller: true,
  },
  {
    code: "RF-K-001", nameEn: "Little Explorer Jacket", nameGu: "નાના સાહસિકનું જેકેટ",
    slug: "little-explorer-jacket", categorySlug: "kids-fashion",
    descriptionEn: "A cosy, easy-to-wear jacket for little adventurers. Durable stitching and a warm lining for breezy days out.",
    descriptionGu: "નાના સાહસિકો માટે આરામદાયક અને ટકાઉ જેકેટ.",
    selling: "899", original: "1199", image: "/images/cat-kids.jpg",
    sizes: ["2-3Y", "4-5Y", "6-7Y"], colors: [{ name: "Amber", code: "#B96E33" }],
    newArrival: true,
  },
  {
    code: "RF-T-001", nameEn: "Festive Silk Saree", nameGu: "ઉત્સવની સિલ્ક સાડી",
    slug: "festive-silk-saree", categorySlug: "traditional-wear",
    descriptionEn: "A rich silk saree with a soft sheen and traditional border detailing. A timeless pick for weddings and festivals.",
    descriptionGu: "પરંપરાગત બોર્ડર સાથેની ભવ્ય સિલ્ક સાડી, લગ્ન અને તહેવારો માટે યોગ્ય.",
    selling: "3499", original: "4999", image: "/images/cat-traditional.jpg",
    sizes: ["Free Size"], colors: [{ name: "Powder Blue", code: "#9FBFDB" }, { name: "Maroon", code: "#6E2733" }],
    featured: true,
  },
  {
    code: "RF-S-001", nameEn: "Winter Wool Coat", nameGu: "શિયાળુ ઊનનો કોટ",
    slug: "winter-wool-coat", categorySlug: "seasonal-collection",
    descriptionEn: "A tailored wool-blend coat with a generous collar. Warm, polished and made to layer through the colder months.",
    descriptionGu: "ઠંડા મહિનાઓ માટે હૂંફાળો અને સ્ટાઇલિશ ઊનનો કોટ.",
    selling: "2999", original: "3999", image: "/images/hero-editorial.jpg",
    sizes: ["S", "M", "L", "XL"], colors: [{ name: "Wine", code: "#6B2230" }, { name: "Camel", code: "#B08A5B" }],
    featured: true,
  },
  {
    code: "RF-I-001", nameEn: "Essential Cotton Tee", nameGu: "આવશ્યક કોટન ટી-શર્ટ",
    slug: "essential-cotton-tee", categorySlug: "innerwear",
    descriptionEn: "The everyday base layer: soft combed cotton, a comfortable neckline and a fit that stays put all day.",
    descriptionGu: "રોજિંદા વપરાશ માટે નરમ કોટન ટી-શર્ટ.",
    selling: "499", original: "699", image: "/images/cat-innerwear.jpg",
    sizes: ["S", "M", "L", "XL"], colors: [{ name: "White", code: "#F5F3EF" }, { name: "Black", code: "#222222" }, { name: "Mustard", code: "#C89B2E" }],
    bestSeller: true,
  },
  {
    code: "RF-M-002", nameEn: "Smart Casual Set", nameGu: "સ્માર્ટ કેઝ્યુઅલ સેટ",
    slug: "smart-casual-set", categorySlug: "mens-fashion",
    descriptionEn: "A coordinated shirt and trouser set that looks put-together without trying too hard. Great for dinners and celebrations.",
    descriptionGu: "શર્ટ અને ટ્રાઉઝરનો સમન્વિત સેટ, ખાસ પ્રસંગો માટે યોગ્ય.",
    selling: "2199", original: "2899", image: "/images/product-1.jpg",
    sizes: ["M", "L", "XL"], colors: [{ name: "Deep Navy", code: "#253044" }],
    newArrival: true,
  },
];

function seedDemoProducts(db: ReturnType<typeof getDb> extends Promise<infer T> ? T : never): void {
  const categories = queryAll(db, "SELECT id, slug FROM categories", []) as { id: string; slug: string }[];
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  for (const p of DEMO_PRODUCTS) {
    if (queryOne(db, "SELECT id FROM products WHERE product_code = ?", [p.code])) continue;

    const id = crypto.randomUUID();
    const now = "datetime('now')";
    run(db,
      `INSERT INTO products (id, product_code, name_en, name_gu, slug, description_en, description_gu,
        category_id, original_price, selling_price, discount_percentage, overall_availability, status,
        is_new_arrival, is_best_seller, is_featured, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'In Stock', 'active', ?, ?, ?, ${now}, ${now})`,
      [id, p.code, p.nameEn, p.nameGu, p.slug, p.descriptionEn, p.descriptionGu,
        categoryIdBySlug.get(p.categorySlug) ?? null, p.original, p.selling,
        String(Math.round((1 - Number(p.selling) / Number(p.original)) * 100)),
        p.newArrival ? 1 : 0, p.bestSeller ? 1 : 0, p.featured ? 1 : 0]);

    run(db,
      "INSERT INTO product_images (id, product_id, image_url, alt_text, display_order, is_main, created_at) VALUES (?, ?, ?, ?, 0, 1, datetime('now'))",
      [crypto.randomUUID(), id, p.image, p.nameEn]);

    for (const size of p.sizes) {
      run(db,
        "INSERT INTO product_variants (id, product_id, size, availability, is_active, created_at) VALUES (?, ?, ?, 'In Stock', 1, datetime('now'))",
        [crypto.randomUUID(), id, size]);
    }
    for (const color of p.colors) {
      run(db,
        "INSERT INTO product_variants (id, product_id, color, color_code, availability, is_active, created_at) VALUES (?, ?, ?, ?, 'In Stock', 1, datetime('now'))",
        [crypto.randomUUID(), id, color.name, color.code]);
    }
  }

  const productRows = queryAll(db, "SELECT id, product_code FROM products", []) as { id: string; product_code: string }[];
  const collectionRows = queryAll(db, "SELECT id, slug FROM collections", []) as { id: string; slug: string }[];
  const collectionIdBySlug = new Map(collectionRows.map((c) => [c.slug, c.id]));
  const collectionMemberships: [string, string[]][] = [
    ["festive-edit", ["RF-T-001", "RF-M-001", "RF-W-001"]],
    ["everyday-essentials", ["RF-I-001", "RF-W-002", "RF-M-002"]],
    ["seasonal-picks", ["RF-S-001", "RF-K-001", "RF-M-001"]],
  ];
  for (const [collectionSlug, codes] of collectionMemberships) {
    const collectionId = collectionIdBySlug.get(collectionSlug);
    if (!collectionId) continue;
    for (const product of productRows.filter((p) => codes.includes(p.product_code))) {
      run(db,
        "INSERT OR IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)",
        [product.id, collectionId]);
    }
  }
}

