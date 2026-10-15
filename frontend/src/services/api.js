import axios from "axios";

const TOKEN_KEY = "shopstock_token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    return;
  }
}

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function errorMessage(error) {
  return error?.response?.data?.message || "Server se rabta nahi ho saka";
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isAuthRequest = url.startsWith("/auth/login") || url.startsWith("/auth/register");

    if (error.response?.status === 401 && !isAuthRequest && unauthorizedHandler) {
      unauthorizedHandler();
    }

    return Promise.reject(error);
  }
);

export async function registerUser(details) {
  const res = await api.post("/auth/register", details);
  return res.data;
}

export async function loginUser(details) {
  const res = await api.post("/auth/login", details);
  return res.data;
}

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function getProducts() {
  const res = await api.get("/products");
  return res.data;
}

export async function addProduct(product) {
  const res = await api.post("/products", product);
  return res.data;
}

export async function updateProduct(id, updates) {
  const res = await api.put(`/products/${id}`, updates);
  return res.data;
}

export async function deleteProduct(id) {
  const res = await api.delete(`/products/${id}`);
  return res.data;
}

export async function placeOrder(items) {
  const res = await api.post("/orders", { items });
  return res.data;
}

export async function getOrders() {
  const res = await api.get("/orders");
  return res.data;
}

export async function getDashboard() {
  const res = await api.get("/dashboard");
  return res.data;
}
