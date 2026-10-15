<script setup>
import { ref, onMounted } from "vue";
import ProductList from "./components/ProductList.vue";
import ProductForm from "./components/ProductForm.vue";
import Cart from "./components/Cart.vue";
import OrderHistory from "./components/OrderHistory.vue";
import Dashboard from "./components/Dashboard.vue";
import AuthForm from "./components/AuthForm.vue";
import {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  placeOrder,
  getMe,
  getToken,
  setToken,
  setUnauthorizedHandler,
  errorMessage,
} from "./services/api.js";

const activeTab = ref("shop");
const user = ref(null);
const checking = ref(true);
const products = ref([]);
const cart = ref([]);

function resetData() {
  products.value = [];
  cart.value = [];
  activeTab.value = "shop";
}

function handleLogout() {
  setToken("");
  user.value = null;
  resetData();
}

async function handleAuthenticated({ token, user: loggedInUser }) {
  setToken(token);
  user.value = loggedInUser;
  resetData();

  try {
    products.value = await getProducts();
  } catch (error) {
    alert(errorMessage(error));
  }
}

onMounted(async () => {
  setUnauthorizedHandler(handleLogout);

  if (getToken()) {
    try {
      const data = await getMe();
      user.value = data.user;
      products.value = await getProducts();
    } catch {
      setToken("");
      user.value = null;
    }
  }

  checking.value = false;
});

async function handleAddProduct(newProduct) {
  try {
    const saved = await addProduct(newProduct);
    products.value.push(saved);
  } catch (error) {
    alert(errorMessage(error));
  }
}

async function handleDeleteProduct(id) {
  try {
    await deleteProduct(id);
    products.value = products.value.filter((p) => p.id !== id);
    cart.value = cart.value.filter((item) => item.id !== id);
  } catch (error) {
    alert(errorMessage(error));
  }
}

async function handleUpdateProduct(updates) {
  const { id, ...rest } = updates;

  try {
    const updated = await updateProduct(id, rest);
    const index = products.value.findIndex((p) => p.id === id);
    if (index !== -1) {
      products.value[index] = updated;
    }
  } catch (error) {
    alert(errorMessage(error));
  }
}

function handleAddToCart(product) {
  const existing = cart.value.find((item) => item.id === product.id);

  if (existing) {
    if (existing.qty < product.stock) {
      existing.qty++;
    }
  } else {
    cart.value.push({ ...product, qty: 1 });
  }
}

function handleRemoveFromCart(id) {
  cart.value = cart.value.filter((item) => item.id !== id);
}

async function handleCheckout() {
  try {
    await placeOrder(cart.value);
    cart.value = [];
    products.value = await getProducts();
    alert("✅ Order confirm ho gaya!");
  } catch (error) {
    alert(errorMessage(error));
    try {
      products.value = await getProducts();
    } catch {
      return;
    }
  }
}
</script>

<template>
  <div class="app">
    <p v-if="checking" class="loading">Loading...</p>

    <AuthForm v-else-if="!user" @authenticated="handleAuthenticated" />

    <template v-else>
      <header>
        <h1>{{ user.shopName || "Stock management" }}</h1>

        <nav class="tabs">
          <button
            :class="{ active: activeTab === 'shop' }"
            @click="activeTab = 'shop'"
          >
            Shop
          </button>
          <button
            :class="{ active: activeTab === 'orders' }"
            @click="activeTab = 'orders'"
          >
            Orders
          </button>
          <button
            :class="{ active: activeTab === 'dashboard' }"
            @click="activeTab = 'dashboard'"
          >
            Dashboard
          </button>
          <button class="logout" @click="handleLogout">Logout</button>
        </nav>
      </header>

      <main v-if="activeTab === 'shop'" class="layout">
        <section class="left">
          <ProductForm @add-product="handleAddProduct" />

          <ProductList
            :products="products"
            @add-to-cart="handleAddToCart"
            @delete-product="handleDeleteProduct"
            @update-product="handleUpdateProduct"
          />
        </section>

        <aside class="right">
          <Cart
            :cart-items="cart"
            @checkout="handleCheckout"
            @remove-item="handleRemoveFromCart"
          />
        </aside>
      </main>

      <main v-else-if="activeTab === 'orders'" class="layout single">
        <OrderHistory />
      </main>

      <main v-else class="layout single">
        <Dashboard />
      </main>
    </template>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  font-family: "Segoe UI", sans-serif;
}
body {
  margin: 0;
  background: #fffdf9;
}
.loading {
  padding: 24px;
  color: #8a6d3b;
}
.app header {
  background: #b5651d;
  color: white;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tabs button {
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: white;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.tabs button.active {
  background: white;
  color: #b5651d;
  font-weight: bold;
}
.tabs button.logout {
  background: rgba(0, 0, 0, 0.25);
}
.layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  padding: 20px;
}
.layout.single {
  grid-template-columns: 1fr;
}
@media (max-width: 700px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
