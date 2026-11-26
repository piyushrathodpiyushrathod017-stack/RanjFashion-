const crypto = require("node:crypto");

const password = "RanjFashion@2026";
const salt = crypto.randomBytes(16).toString("hex");
const derived = crypto.scryptSync(password, salt, 32, { N: 4096 });
console.log("salt (hex):", salt);
console.log("derived length:", derived.length);
console.log("derived (hex):", derived.toString("hex"));
console.log("derived hex length:", derived.toString("hex").length);

// Now verify
const derived2 = crypto.scryptSync(password, salt, 32, { N: 4096 });
console.log("verify match:", derived.toString("hex") === derived2.toString("hex"));
