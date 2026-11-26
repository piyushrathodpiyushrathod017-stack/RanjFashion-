const base = "http://localhost:3001";
let cookie = "";

async function request(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(base + path, { headers, ...opts });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  return { status: res.status, body: text, headers: res.headers };
}

(async () => {
  // 1. Login
  const loginRes = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "owner@ranjfashion.com", password: "RanjFashion@2026" }),
  });
  console.log("Login:", loginRes.status, loginRes.body);

  // 2. Me with cookie
  const meRes = await request("/api/auth/me");
  console.log("Me:", meRes.status, meRes.body);

  // 3. Product detail - purchase_price should be hidden for public
  const detailRes = await request("/api/products/14090281-140f-42df-92ba-ba960ea518ad");
  const detail = JSON.parse(detailRes.body);
  console.log("Product detail public has purchase_price:", "purchase_price" in detail.product);
  console.log("Product detail public selling_price:", detail.product.selling_price);

  // 4. Create product via staff API (without cookie - should fail)
  const createRes = await request("/api/products", {
    method: "POST",
    body: JSON.stringify({
      product_code: "RF-TEST-001",
      name_en: "Test Product",
      slug: "test-product",
      category_id: detail.products[0].category_id,
      purchase_price: "500",
      original_price: "999",
      selling_price: "799",
      overall_availability: "In Stock",
      status: "active",
    }),
  });
  console.log("Create product (no auth):", createRes.status, createRes.body);

  // 5. Create product WITH auth
  const createRes2 = await request("/api/products", {
    method: "POST",
    body: JSON.stringify({
      product_code: "RF-TEST-001",
      name_en: "Test Product",
      slug: "test-product",
      category_id: detail.products[0].category_id,
      purchase_price: "500",
      original_price: "999",
      selling_price: "799",
      overall_availability: "In Stock",
      status: "active",
    }),
  });
  console.log("Create product (with auth):", createRes2.status, createRes2.body);

  // 6. WhatsApp inquiry
  const inquiryRes = await request("/api/inquiries", {
    method: "POST",
    body: JSON.stringify({
      product_id: detail.products[0].id,
      product_name_snapshot: "Classic Cotton Kurta",
      selected_size: "M",
      selected_color: "Pink",
      displayed_price: "1299",
      event_id: "evt-test-123",
    }),
  });
  console.log("Inquiry:", inquiryRes.status, inquiryRes.body);

  // 7. Duplicate inquiry should fail
  const dupRes = await request("/api/inquiries", {
    method: "POST",
    body: JSON.stringify({
      product_id: detail.products[0].id,
      product_name_snapshot: "Classic Cotton Kurta",
      event_id: "evt-test-123",
    }),
  });
  console.log("Duplicate inquiry:", dupRes.status, dupRes.body);

  // 8. List inquiries (auth)
  const listInq = await request("/api/inquiries");
  console.log("List inquiries:", listInq.status, listInq.body);

  console.log("DONE");
})();
