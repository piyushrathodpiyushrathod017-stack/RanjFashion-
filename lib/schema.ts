/**
 * Complete database schema for RANJ FASHION.
 *
 * Implements the logical design from PRD section 25 (recommended core tables)
 * plus the additional tables needed for sessions, settings, popups, backups
 * and audit logging. Uses UUID-like text primary keys and UTC timestamps.
 *
 * Money values (purchase_price, original_price, selling_price, price_override,
 * displayed_price) are stored as TEXT to preserve decimal precision (PRD §25
 * database rules: store money as precise decimal, not float).
 *
 * Timestamps are stored in UTC (ISO-8601 strings via datetime('now')) and
 * converted to Asia/Kolkata for display (PRD §25).
 */

export const SCHEMA = `
-- ============================================================
-- Roles & Permissions (RBAC foundation)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- ============================================================
-- Staff / admin profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ============================================================
-- Sessions (server-enforced, HttpOnly cookie backed)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- ============================================================
-- Site settings (brand info, WhatsApp number, address, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- Categories (PRD §6)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_gu TEXT,
  slug TEXT NOT NULL UNIQUE,
  description_en TEXT,
  description_gu TEXT,
  image_url TEXT,
  parent_id TEXT,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- ============================================================
-- Custom collections (independent of categories; PRD §6.3)
-- ============================================================
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_gu TEXT,
  slug TEXT NOT NULL UNIQUE,
  description_en TEXT,
  description_gu TEXT,
  banner_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- Products (PRD §6.4)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_gu TEXT,
  slug TEXT NOT NULL UNIQUE,
  description_en TEXT,
  description_gu TEXT,
  category_id TEXT,
  purchase_price TEXT,
  original_price TEXT,
  selling_price TEXT,
  discount_percentage TEXT,
  overall_availability TEXT DEFAULT 'In Stock',
  status TEXT DEFAULT 'active',
  is_new_arrival INTEGER DEFAULT 0,
  is_best_seller INTEGER DEFAULT 0,
  is_featured INTEGER DEFAULT 0,
  scheduled_publish_at TEXT,
  scheduled_unpublish_at TEXT,
  seo_title TEXT,
  seo_description TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS product_collections (
  product_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  PRIMARY KEY (product_id, collection_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- ============================================================
-- Product images
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  display_order INTEGER DEFAULT 0,
  is_main INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- Product variants (size / color / combined; PRD §6.4, §5.4)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  size TEXT,
  color TEXT,
  color_code TEXT,
  price_override TEXT,
  availability TEXT DEFAULT 'In Stock',
  image_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- Special offers (PRD §8.4)
-- ============================================================
CREATE TABLE IF NOT EXISTS special_offers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  start_at TEXT,
  end_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS special_offer_products (
  offer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  PRIMARY KEY (offer_id, product_id),
  FOREIGN KEY (offer_id) REFERENCES special_offers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- Related products (manual selection; PRD §7.7)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_relations (
  product_id TEXT NOT NULL,
  related_product_id TEXT NOT NULL,
  PRIMARY KEY (product_id, related_product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (related_product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- WhatsApp inquiry tracking (PRD §9, §25.14)
-- No customer name/phone stored in basic inquiry tracking.
-- ============================================================
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  product_name_snapshot TEXT NOT NULL,
  selected_size TEXT,
  selected_color TEXT,
  displayed_price TEXT,
  event_id TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- ============================================================
-- Product views (privacy-conscious, anonymous; PRD §25.15)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_views (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  anonymous_session_identifier TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- Product reviews (moderated; PRD §10)
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  review_text TEXT,
  reviewer_display_name TEXT,
  moderation_status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  moderated_by TEXT,
  moderated_at TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- Contact form messages (PRD §11.3)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- Notifications (PRD §17)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- Audit logs (PRD §16) - append-only, protected
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL
);

-- ============================================================
-- Promotional popups (PRD §13)
-- ============================================================
CREATE TABLE IF NOT EXISTS promotional_popups (
  id TEXT PRIMARY KEY,
  heading TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link TEXT,
  start_at TEXT,
  end_at TEXT,
  is_active INTEGER DEFAULT 1,
  frequency_control TEXT DEFAULT 'session',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- Backups metadata (PRD §23)
-- ============================================================
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now')),
  storage_ref TEXT,
  created_by TEXT
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_product ON inquiries(product_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_views_product ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`;
