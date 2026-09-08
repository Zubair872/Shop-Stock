// ===== IMPORTS =====
// express: hamara web server framework
import express from "express";
// cors: browser ko allow karta hai ke frontend (alag port) backend ko call kar sake
import cors from "cors";
// fs: file system - JSON files read/write karne ke liye
import fs from "fs";
// path + url: file paths sahi tarike se banane ke liye (ES modules mein __dirname nahi hota)
import path from "path";
import { fileURLToPath } from "url";

// __dirname manually banate hain kyunke ES modules ("type":"module") mein ye by default nahi milta
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data files ke path
const PRODUCTS_FILE = path.join(__dirname, "data", "products.json");
const ORDERS_FILE = path.join(__dirname, "data", "orders.json");

// ===== APP SETUP =====
const app = express();
const PORT = 3001; // backend is port par chalega

app.use(cors());           // sab origins se requests allow (learning ke liye theek hai)
app.use(express.json());   // incoming JSON body ko parse karne ke liye (POST/PUT data)

// ===== HELPER FUNCTIONS =====
// File se data padhna (read)
function readData(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8"); // file ko text ke tor par parho
  return JSON.parse(raw);                          // text ko JS array/object mein badlo
}

// File mein data likhna (write)
function writeData(filePath, data) {
  // JSON.stringify(data, null, 2) -> data ko readable format mein file mein save karta hai
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ===================================================================
// ROUTES - ye hamari API hai. Har route ek URL + HTTP method hai.
// ===================================================================

// ---- 1) GET all products ----
// Jab frontend GET request bheje /api/products par, sab products wapis bhejo
app.get("/api/products", (req, res) => {
  const products = readData(PRODUCTS_FILE); // file se data uthao
  res.json(products);                       // JSON format mein wapis bhejo
});

// ---- 2) POST a new product ----
// Naya product add karne ke liye (shop owner ka feature)
app.post("/api/products", (req, res) => {
  const products = readData(PRODUCTS_FILE);

  // req.body mein frontend se bheja gaya data hai: { name, category, price, stock }
  const newProduct = {
    id: Date.now(),           // unique ID banane ka simple tarika (current timestamp)
    name: req.body.name,
    category: req.body.category,
    price: Number(req.body.price),
    stock: Number(req.body.stock),
  };

  products.push(newProduct);       // naya product array mein daalo
  writeData(PRODUCTS_FILE, products); // file mein wapis save karo

  res.status(201).json(newProduct); // 201 = "successfully created"
});

// ---- 3) PUT (update) a product by id ----
app.put("/api/products/:id", (req, res) => {
  const products = readData(PRODUCTS_FILE);
  const id = Number(req.params.id); // URL se id nikalo, e.g. /api/products/5 -> 5

  // is id wale product ka index dhoondo
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) {
    // agar product mila hi nahi
    return res.status(404).json({ error: "Product not found" });
  }

  // purane product ko naye data ke sath merge karo
  products[index] = { ...products[index], ...req.body, id };
  writeData(PRODUCTS_FILE, products);

  res.json(products[index]);
});

// ---- 4) DELETE a product ----
app.delete("/api/products/:id", (req, res) => {
  const products = readData(PRODUCTS_FILE);
  const id = Number(req.params.id);

  // us id ke ilawa baaki sab products rakho (yani id wala hata do)
  const filtered = products.filter((p) => p.id !== id);
  writeData(PRODUCTS_FILE, filtered);

  res.json({ message: "Deleted successfully" });
});

// ---- 5) GET all orders ----
app.get("/api/orders", (req, res) => {
  const orders = readData(ORDERS_FILE);
  res.json(orders);
});

// ---- 6) POST a new order (checkout) ----
app.post("/api/orders", (req, res) => {
  const orders = readData(ORDERS_FILE);
  const products = readData(PRODUCTS_FILE);

  const { items } = req.body; // items = [{ id, name, price, qty }, ...]

  // total price calculate karo
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const newOrder = {
    id: Date.now(),
    items,
    total,
    date: new Date().toISOString(),
  };

  // har product ka stock kam karo (jitna order hua)
  items.forEach((item) => {
    const product = products.find((p) => p.id === item.id);
    if (product) {
      product.stock = Math.max(0, product.stock - item.qty);
    }
  });

  orders.push(newOrder);
  writeData(ORDERS_FILE, orders);
  writeData(PRODUCTS_FILE, products); // updated stock save karo

  res.status(201).json(newOrder);
});

// ---- 7) GET dashboard stats ----
// Total revenue, total orders, aur best-selling product calculate karo
app.get("/api/dashboard", (req, res) => {
  const orders = readData(ORDERS_FILE);
  const products = readData(PRODUCTS_FILE);

  // total revenue: sab orders ke total ko jorh do
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);

  // har product ki total quantity becha gaya - object mein count karo
  const salesCount = {};
  orders.forEach((order) => {
    order.items.forEach((item) => {
      salesCount[item.name] = (salesCount[item.name] || 0) + item.qty;
    });
  });

  // salesCount object ko array mein badlo aur sabse zyada bikne wala dhoondo
  let bestSeller = null;
  let maxQty = 0;
  for (const name in salesCount) {
    if (salesCount[name] > maxQty) {
      maxQty = salesCount[name];
      bestSeller = name;
    }
  }

  // low stock products (5 se kam)
  const lowStockItems = products.filter((p) => p.stock < 5);

  res.json({
    totalOrders: orders.length,
    totalRevenue,
    bestSeller: bestSeller ? { name: bestSeller, qty: maxQty } : null,
    lowStockItems,
  });
});

// ===== SERVER START =====
app.listen(PORT, () => {
  console.log(`✅ Bakery backend chal raha hai: http://localhost:${PORT}`);
});