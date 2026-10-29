import axios from "axios";

const TOKEN_KEY = "shopstock_token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 20000,
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
  if (error?.response) {
    return error.response.data?.message || "Server mein masla aa gaya, dobara koshish karein";
  }
  if (error?.code === "ECONNABORTED") {
    return "Server ne jawab dene mein bohat der lagayi, dobara koshish karein";
  }
  if (error?.request) {
    return "Server se rabta nahi ho saka, internet check karein";
  }
  return error?.message || "Kuch masla aa gaya";
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

export async function placeOrder(items, details = {}, idempotencyKey = "") {
  const res = await api.post(
    "/orders",
    { items, ...details },
    idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined
  );
  return res.data;
}

export async function getOrders(params = {}) {
  const res = await api.get("/orders", { params });
  return res.data;
}

export async function cancelOrder(id, reason = "") {
  const res = await api.post(`/orders/${id}/cancel`, { reason });
  return res.data;
}

export async function restockProduct(id, payload) {
  const res = await api.post(`/products/${id}/restock`, payload);
  return res.data;
}

export async function recordWastage(id, payload) {
  const res = await api.post(`/products/${id}/wastage`, payload);
  return res.data;
}

export async function getMovements(id) {
  const res = await api.get(`/products/${id}/movements`);
  return res.data;
}

export async function getDashboard(range = "7d") {
  const res = await api.get("/dashboard", { params: { range } });
  return res.data;
}

export async function getAuthConfig() {
  const res = await api.get("/auth/config");
  return res.data;
}

export async function updateProfile(details) {
  const res = await api.patch("/auth/me", details);
  return res.data;
}

export async function changePassword(details) {
  const res = await api.post("/auth/change-password", details);
  return res.data;
}

export async function getTeamMembers() {
  const res = await api.get("/auth/team");
  return res.data;
}

export async function createTeamMember(details) {
  const res = await api.post("/auth/team", details);
  return res.data;
}

export async function updateTeamMember(id, updates) {
  const res = await api.patch(`/auth/team/${id}`, updates);
  return res.data;
}

// CSV file download (kind: "orders" ya "products")
export async function downloadReport(kind, params = {}) {
  try {
    const res = await api.get(`/reports/${kind}.csv`, { params, responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${kind}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error?.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      try {
        throw new Error(JSON.parse(text).message);
      } catch (inner) {
        if (inner instanceof SyntaxError) throw error;
        throw inner;
      }
    }
    throw error;
  }
}
