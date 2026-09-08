import axios from "axios";

// Backend jahan chal raha hai uska base URL
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// api instance banao - taake baseURL har jagah dobara na likhna pare
const api = axios.create({
  baseURL: BASE_URL,
});

// Sab products fetch karo
export async function getProducts() {
  const res = await api.get("/products"); // GET request
  return res.data; // axios mein response.data mein hi JSON milta hai (res.json() ki zaroorat nahi)
}

// Naya product add karo
export async function addProduct(product) {
  const res = await api.post("/products", product); // axios mein seedha object bhej sakte hain
  return res.data;
}

// Product update karo (e.g. stock ya price change)
export async function updateProduct(id, updates) {
  const res = await api.put(`/products/${id}`, updates);
  return res.data;
}

// Product delete karo
export async function deleteProduct(id) {
  const res = await api.delete(`/products/${id}`);
  return res.data;
}

// Order place karo (checkout)
export async function placeOrder(items) {
  const res = await api.post("/orders", { items });
  return res.data;
}

// Sab orders fetch karo (Order History page ke liye)
export async function getOrders() {
  const res = await api.get("/orders");
  return res.data;
}

// Dashboard stats fetch karo
export async function getDashboard() {
  const res = await api.get("/dashboard");
  return res.data;
}