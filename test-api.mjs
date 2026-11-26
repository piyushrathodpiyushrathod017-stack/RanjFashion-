const base = "http://localhost:3001";

async function get(path) {
  const res = await fetch(base + path);
  const text = await res.text();
  return { status: res.status, body: text };
}

async function post(path, body) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

(async () => {
  console.log("=== GET /api/settings ===");
  console.log(await get("/api/settings"));

  console.log("=== GET /api/categories ===");
  console.log(await get("/api/categories"));

  console.log("=== GET /api/collections ===");
  console.log(await get("/api/collections"));

  console.log("=== POST /api/auth/login ===");
  console.log(await post("/api/auth/login", { email: "owner@ranjfashion.com", password: "RanjFashion@2026" }));

  console.log("=== GET /api/products ===");
  console.log(await get("/api/products"));

  console.log("=== DONE ===");
})();
