<script setup>
import { ref, onMounted } from "vue";
import ProductList from "./components/ProductList.vue";
import ProductForm from "./components/ProductForm.vue";
import Cart from "./components/Cart.vue";
import OrderHistory from "./components/OrderHistory.vue";
import Dashboard from "./components/Dashboard.vue";
import {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  placeOrder,
} from "./services/api.js";

// activeTab: batata hai abhi kaunsa page dikh raha hai ("shop", "orders", "dashboard")
const activeTab = ref("shop");

// ref: ek reactive variable banata hai (single value ke liye reactive() ki jagah ref() use hota hai)
const products = ref([]); // sab products yahan store honge
const cart = ref([]);     // cart mein jo items hain

// onMounted: component screen par aane ke turant baad ye chalta hai
onMounted(async () => {
  products.value = await getProducts(); // backend se products mangwao
});

// ---- Product management ----
async function handleAddProduct(newProduct) {
  const saved = await addProduct(newProduct); // backend ko bhejo
  products.value.push(saved);                  // list mein bhi add karo (UI update)
}

async function handleDeleteProduct(id) {
  await deleteProduct(id);
  products.value = products.value.filter((p) => p.id !== id);
}

// Edit se aane wala update handle karo
async function handleUpdateProduct(updates) {
  const { id, ...rest } = updates;
  const updated = await updateProduct(id, rest); // backend ko bhejo

  // local list mein bhi us product ko naye data se replace karo
  const index = products.value.findIndex((p) => p.id === id);
  if (index !== -1) {
    products.value[index] = updated;
  }
}

// ---- Cart management ----
function handleAddToCart(product) {
  // check karo agar ye product cart mein pehle se hai
  const existing = cart.value.find((item) => item.id === product.id);

  if (existing) {
    existing.qty++; // agar hai to quantity barhao
  } else {
    cart.value.push({ ...product, qty: 1 }); // warna naya item add karo
  }
}

function handleRemoveFromCart(id) {
  cart.value = cart.value.filter((item) => item.id !== id);
}

// ---- Checkout ----
async function handleCheckout() {
  await placeOrder(cart.value);      // backend ko order bhejo
  cart.value = [];                    // cart khaali karo
  products.value = await getProducts(); // stock update dikhane ke liye products dobara mangwao
  alert("✅ Order confirm ho gaya!");
}
</script>

<template>
  <div class="app">
    <header>
      <h1>Stock management</h1>

      <!-- Tabs: click kar ke activeTab ki value badal dete hain -->
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
      </nav>
    </header>

    <!-- ===== SHOP TAB ===== -->
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

    <!-- ===== ORDERS TAB ===== -->
    <main v-else-if="activeTab === 'orders'" class="layout single">
      <OrderHistory />
    </main>

    <!-- ===== DASHBOARD TAB ===== -->
    <main v-else class="layout single">
      <Dashboard />
    </main>
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