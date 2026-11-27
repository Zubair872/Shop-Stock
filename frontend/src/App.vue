<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import AuthForm from "./components/AuthForm.vue";
import ProductForm from "./components/ProductForm.vue";
import ProductList from "./components/ProductList.vue";
import Cart from "./components/Cart.vue";
import OrderHistory from "./components/OrderHistory.vue";
import Dashboard from "./components/Dashboard.vue";
import Team from "./components/Team.vue";
import ReceiptModal from "./components/ReceiptModal.vue";
import Khata from "./components/Khata.vue";
import DailyClosing from "./components/DailyClosing.vue";
import Suppliers from "./components/Suppliers.vue";
import Expenses from "./components/Expenses.vue";
import LangSwitcher from "./components/LangSwitcher.vue";
import PwaPrompt from "./components/PwaPrompt.vue";
import SuperAdmin from "./components/SuperAdmin.vue";
import { t } from "./i18n.js";
import {
  saveCachedProducts,
  getCachedProducts,
  enqueueOrder,
  getOrders,
  removeOrder,
  offlineDbStore,
} from "./services/offlineDb.js";
import {
  applyLocalStockDeduction,
  buildOfflineOrderRecord,
  toReceiptOrder,
  syncOrderQueue,
} from "./services/offlineQueue.js";
import {
  getMe,
  getToken,
  setToken,
  setUnauthorizedHandler,
  startDemoSession,
  getProducts,
  getCustomers,
  addProduct,
  updateProduct,
  deleteProduct,
  restockProduct,
  recordWastage,
  placeOrder,
  errorMessage,
} from "./services/api.js";

const USER_STORAGE_KEY = "shopstock_user";

const activeTab = ref("shop");
const user = ref(null);
const checking = ref(true);
const demoLoading = ref(false);
const authInitialMode = ref("login");
const products = ref([]);
const customers = ref([]);
const cart = ref([]);
const checkoutBusy = ref(false);
const lastReceiptOrder = ref(null);
const isOnline = ref(typeof navigator !== "undefined" ? navigator.onLine : true);
const syncing = ref(false);
const queuedOrders = ref([]);
let retryTimer = null;

const accountKey = computed(() => user.value?.owner || user.value?.id || "");
const pendingCount = computed(() => queuedOrders.value.filter((o) => o.status === "pending").length);
const conflictOrders = computed(() => queuedOrders.value.filter((o) => o.status === "conflict"));
const netState = computed(() => (syncing.value ? "syncing" : isOnline.value ? "online" : "offline"));
const netLabel = computed(() =>
  syncing.value ? t("netSyncing") : isOnline.value ? t("netOnline") : t("netOffline")
);

function saveCachedUser(u) {
  try {
    if (u) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    return;
  }
}

function loadCachedUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const isSuperAdmin = computed(() => user.value?.role === "superadmin");
const canSell = computed(() =>
  ["owner", "admin", "manager", "cashier"].includes(user.value?.role)
);
const canManage = computed(() =>
  ["owner", "admin", "manager"].includes(user.value?.role)
);
const canManageTeam = computed(() =>
  ["owner", "admin"].includes(user.value?.role)
);

function resetState() {
  products.value = [];
  customers.value = [];
  cart.value = [];
  activeTab.value = isSuperAdmin.value ? "superadmin" : "shop";
}

function handleLogout() {
  setToken("");
  saveCachedUser(null);
  user.value = null;
  queuedOrders.value = [];
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  resetState();
}

async function handleStartDemo() {
  if (demoLoading.value) return;
  demoLoading.value = true;
  try {
    const result = await startDemoSession();
    setToken(result.token);
    user.value = result.user;
    resetState();
    await loadProducts();
    if (window.location.pathname !== "/demo") {
      window.history.pushState(null, "", "/demo");
    }
  } catch (error) {
    alert(errorMessage(error));
  } finally {
    demoLoading.value = false;
  }
}

function handleExitDemoToRegister() {
  authInitialMode.value = "register";
  handleLogout();
  if (window.location.pathname === "/demo") {
    window.history.pushState(null, "", "/");
  }
}

async function refreshQueue() {
  if (!accountKey.value) return;
  queuedOrders.value = await getOrders(accountKey.value);
}

async function runSync() {
  if (!isOnline.value || syncing.value || !accountKey.value) return;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  syncing.value = true;
  try {
    const result = await syncOrderQueue({
      accountId: accountKey.value,
      store: offlineDbStore,
      submitOrder: placeOrder,
      extractError: errorMessage,
    });
    await refreshQueue();
    if (result.syncedCount > 0) {
      await loadProducts();
    }
    if (result.networkStopped && isOnline.value) {
      retryTimer = setTimeout(runSync, 15000);
    }
  } finally {
    syncing.value = false;
  }
}

async function dismissConflict(idempotencyKey) {
  await removeOrder(idempotencyKey);
  await refreshQueue();
}

function handleOnline() {
  isOnline.value = true;
  if (user.value) {
    loadProducts().catch(() => {});
    runSync();
  }
}

function handleOffline() {
  isOnline.value = false;
  if (activeTab.value !== "shop") {
    activeTab.value = "shop";
  }
}

async function loadProducts() {
  try {
    const [loadedProducts, loadedCustomers] = await Promise.all([
      getProducts(),
      getCustomers(),
    ]);
    products.value = loadedProducts;
    customers.value = loadedCustomers;
    await saveCachedProducts(accountKey.value, loadedProducts);
  } catch (error) {
    if (!error?.response) {
      products.value = await getCachedProducts(accountKey.value);
      return;
    }
    throw error;
  }
}

async function handleAuthenticated({ token, user: loggedInUser }) {
  setToken(token);
  user.value = loggedInUser;
  saveCachedUser(loggedInUser);
  resetState();
  if (loggedInUser?.role === "superadmin") return;
  try {
    await loadProducts();
    await refreshQueue();
    if (isOnline.value) runSync();
  } catch (error) {
    alert(errorMessage(error));
  }
}

onMounted(async () => {
  setUnauthorizedHandler(handleLogout);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  const isDemoPath = window.location.pathname === "/demo";
  if (getToken()) {
    try {
      const data = await getMe();
      if (!isDemoPath || data.user?.isDemo) {
        user.value = data.user;
        saveCachedUser(data.user);
        if (data.user?.role === "superadmin") {
          activeTab.value = "superadmin";
          checking.value = false;
          return;
        }
        await loadProducts();
        await refreshQueue();
        if (isOnline.value) runSync();
        checking.value = false;
        return;
      }
    } catch (error) {
      if (!error?.response) {
        const cached = loadCachedUser();
        if (cached) {
          user.value = cached;
          isOnline.value = false;
          products.value = await getCachedProducts(accountKey.value);
          await refreshQueue();
          checking.value = false;
          return;
        }
      }
      setToken("");
      saveCachedUser(null);
      user.value = null;
    }
  }
  if (isDemoPath) {
    await handleStartDemo();
  }
  checking.value = false;
});

onBeforeUnmount(() => {
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  if (retryTimer) clearTimeout(retryTimer);
});

async function handleAddProduct(newProduct) {
  try {
    const saved = await addProduct(newProduct);
    products.value.push(saved);
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

async function handleDeleteProduct(id) {
  try {
    await deleteProduct(id);
    products.value = products.value.filter((p) => p.id !== id);
    cart.value = cart.value.filter((item) => item.id !== id);
  } catch (error) {
    alert(errorMessage(error));
  }
}

async function handleStockAction({ id, type, quantity }) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    alert("Sahi quantity likhein");
    return;
  }
  try {
    const updated =
      type === "restock"
        ? await restockProduct(id, { quantity })
        : await recordWastage(id, { quantity });
    const index = products.value.findIndex((p) => p.id === id);
    if (index !== -1) {
      products.value[index] = updated;
    }
  } catch (error) {
    alert(errorMessage(error));
  }
}

function handleAddToCart(product) {
  const step = ["kg", "litre"].includes(product.unit) ? 0.5 : 1;
  const existing = cart.value.find((item) => item.id === product.id);
  if (existing) {
    const nextQty = Math.round((existing.qty + step) * 1000) / 1000;
    if (nextQty <= product.stock) {
      existing.qty = nextQty;
    }
  } else if (product.stock > 0) {
    const qty = Math.min(step, product.stock);
    cart.value.push({ ...product, qty });
  }
}

function handleRemoveFromCart(id) {
  cart.value = cart.value.filter((item) => item.id !== id);
}

function handleUpdateCartQty({ id, qty }) {
  const item = cart.value.find((entry) => entry.id === id);
  if (!item) return;
  if (qty <= 0) {
    handleRemoveFromCart(id);
    return;
  }
  if (qty <= item.stock) {
    item.qty = qty;
  }
}

async function queueOfflineCheckout(details, idempotencyKey) {
  const record = buildOfflineOrderRecord({
    accountId: accountKey.value,
    cartItems: cart.value,
    details,
    idempotencyKey,
  });
  await enqueueOrder(record);
  products.value = applyLocalStockDeduction(products.value, cart.value);
  await saveCachedProducts(accountKey.value, products.value);
  cart.value = [];
  await refreshQueue();
  lastReceiptOrder.value = toReceiptOrder(record);
}

async function handleCheckout(details) {
  if (checkoutBusy.value || cart.value.length === 0) return;
  checkoutBusy.value = true;
  const idempotencyKey =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  try {
    if (!isOnline.value) {
      if (details.paymentMethod === "udhaar") {
        alert(t("offlineUdhaarDisabled"));
        return;
      }
      await queueOfflineCheckout(details, idempotencyKey);
      return;
    }
    const createdOrder = await placeOrder(cart.value, details, idempotencyKey);
    cart.value = [];
    await loadProducts();
    lastReceiptOrder.value = createdOrder;
  } catch (error) {
    if (!error?.response && details.paymentMethod !== "udhaar") {
      isOnline.value = false;
      await queueOfflineCheckout(details, idempotencyKey);
      return;
    }
    alert(errorMessage(error));
    try {
      await loadProducts();
    } catch {
      return;
    }
  } finally {
    checkoutBusy.value = false;
  }
}
</script>

<template>
  <div class="app">
    <PwaPrompt />
    <p v-if="checking || demoLoading" class="loading">
      {{ demoLoading ? t("demoLoading") : t("loading") }}
    </p>

    <AuthForm
      v-else-if="!user"
      :initial-mode="authInitialMode"
      @authenticated="handleAuthenticated"
      @start-demo="handleStartDemo"
    />

    <template v-else>
      <div v-if="user.isDemo" class="demo-banner">
        <span>{{ t("demoBanner") }}</span>
        <button type="button" class="demo-cta" @click="handleExitDemoToRegister">
          {{ t("demoCreateAccount") }} →
        </button>
      </div>
      <header>
        <div>
          <div class="header-title-row">
            <h1>{{ user.shopName || "Shop-Stock" }}</h1>
            <span :class="['net-badge', netState]">{{ netLabel }}</span>
          </div>
          <small class="user-meta">{{ user.name }} ({{ user.role }})</small>
        </div>

        <nav class="tabs">
          <LangSwitcher />
          <button
            v-if="isSuperAdmin"
            :class="{ active: activeTab === 'superadmin' }"
            @click="activeTab = 'superadmin'"
          >
            {{ t("tabSuperAdmin") }}
          </button>
          <template v-else>
            <button
              :class="{ active: activeTab === 'shop' }"
              @click="activeTab = 'shop'"
            >
              {{ t("tabShop") }}
            </button>
            <button
              :class="{ active: activeTab === 'khata' }"
              :disabled="!isOnline"
              :title="!isOnline ? t('offlineNeedsInternet') : ''"
              @click="activeTab = 'khata'"
            >
              {{ t("tabKhata") }}
            </button>
            <button
              v-if="canManage"
              :class="{ active: activeTab === 'hisaab' }"
              :disabled="!isOnline"
              :title="!isOnline ? t('offlineNeedsInternet') : ''"
              @click="activeTab = 'hisaab'"
            >
              {{ t("tabHisaab") }}
            </button>
            <button
              v-if="canManage"
              :class="{ active: activeTab === 'suppliers' }"
              :disabled="!isOnline"
              :title="!isOnline ? t('offlineNeedsInternet') : ''"
              @click="activeTab = 'suppliers'"
            >
              {{ t("tabSuppliers") }}
            </button>
            <button
              v-if="canManage"
              :class="{ active: activeTab === 'expenses' }"
              :disabled="!isOnline"
              :title="!isOnline ? t('offlineNeedsInternet') : ''"
              @click="activeTab = 'expenses'"
            >
              {{ t("tabExpenses") }}
            </button>
            <button
              :class="{ active: activeTab === 'orders' }"
              :disabled="!isOnline"
              :title="!isOnline ? t('offlineNeedsInternet') : ''"
              @click="activeTab = 'orders'"
            >
              {{ t("tabOrders") }}
            </button>
            <button
              :class="{ active: activeTab === 'dashboard' }"
              :disabled="!isOnline"
              :title="!isOnline ? t('offlineNeedsInternet') : ''"
              @click="activeTab = 'dashboard'"
            >
              {{ t("tabDashboard") }}
            </button>
            <button
              v-if="canManageTeam"
              :class="{ active: activeTab === 'team' }"
              :disabled="!isOnline"
              :title="!isOnline ? t('offlineNeedsInternet') : ''"
              @click="activeTab = 'team'"
            >
              {{ t("tabTeam") }}
            </button>
          </template>
          <button class="logout" @click="handleLogout">{{ t("logout") }}</button>
        </nav>
      </header>

      <div v-if="!isOnline" class="offline-notice">
        {{ t("offlinePosNotice") }}
      </div>

      <div v-if="pendingCount > 0" class="sync-banner">
        <span>{{ t("offlinePendingCount", { count: pendingCount }) }}</span>
        <button v-if="isOnline && !syncing" type="button" @click="runSync">
          {{ t("offlineSyncNow") }}
        </button>
      </div>

      <div v-if="conflictOrders.length > 0" class="conflict-banner">
        <div v-for="c in conflictOrders" :key="c.idempotencyKey" class="conflict-row">
          <span>
            <strong>{{ t("offlineConflictTitle") }}</strong>
            Rs. {{ c.total }} — {{ c.error }}
          </span>
          <button type="button" @click="dismissConflict(c.idempotencyKey)">
            {{ t("offlineDismiss") }}
          </button>
        </div>
      </div>

      <main v-if="isSuperAdmin && activeTab === 'superadmin'" class="layout single">
        <SuperAdmin />
      </main>

      <main v-else-if="activeTab === 'shop'" :class="['layout', { single: !canSell }]">
        <section class="left">
          <ProductForm v-if="canManage && isOnline" @add-product="handleAddProduct" />

          <ProductList
            :products="products"
            :role="user.role"
            :offline="!isOnline"
            @add-to-cart="handleAddToCart"
            @delete-product="handleDeleteProduct"
            @update-product="handleUpdateProduct"
            @stock-action="handleStockAction"
          />
        </section>

        <aside v-if="canSell" class="right">
          <Cart
            :cart-items="cart"
            :customers="customers"
            :busy="checkoutBusy"
            :offline="!isOnline"
            @checkout="handleCheckout"
            @remove-item="handleRemoveFromCart"
            @update-qty="handleUpdateCartQty"
          />
        </aside>
      </main>

      <main v-else-if="activeTab === 'khata'" class="layout single">
        <Khata
          :shop-name="user.shopName || 'Shop-Stock'"
          :role="user.role"
          @customers-changed="customers = $event"
        />
      </main>

      <main v-else-if="activeTab === 'hisaab' && canManage" class="layout single">
        <DailyClosing />
      </main>

      <main v-else-if="activeTab === 'suppliers' && canManage" class="layout single">
        <Suppliers :products="products" @purchase-saved="loadProducts" />
      </main>

      <main v-else-if="activeTab === 'expenses' && canManage" class="layout single">
        <Expenses />
      </main>

      <main v-else-if="activeTab === 'orders'" class="layout single">
        <OrderHistory :shop-name="user.shopName || 'Shop-Stock'" />
      </main>

      <main v-else-if="activeTab === 'dashboard'" class="layout single">
        <Dashboard />
      </main>

      <main v-else-if="activeTab === 'team' && canManageTeam" class="layout single">
        <Team :current-role="user.role" :is-demo="Boolean(user.isDemo)" />
      </main>

      <footer v-if="!user.isDemo" class="app-footer">
        <a href="/demo" @click.prevent="handleStartDemo">{{ t("demoLiveLink") }}</a>
      </footer>

      <ReceiptModal
        v-if="lastReceiptOrder"
        :order="lastReceiptOrder"
        :shop-name="user.shopName || 'Shop-Stock'"
        @close="lastReceiptOrder = null"
      />
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
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
.loading {
  padding: 24px;
  color: #8a6d3b;
}
.demo-banner {
  background: #fff3cd;
  color: #664d03;
  border-bottom: 1px solid #ffecb5;
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.92rem;
}
.demo-cta {
  background: #b5651d;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
}
.app-footer {
  text-align: center;
  padding: 16px;
  font-size: 0.9rem;
  border-top: 1px solid #f0e4d4;
}
.app-footer a {
  color: #b5651d;
  font-weight: 600;
  text-decoration: none;
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
.app header h1 {
  margin: 0;
  font-size: 1.4rem;
}
.user-meta {
  opacity: 0.85;
  font-size: 0.82rem;
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
  padding: 10px 14px;
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
.tabs button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.header-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.net-badge {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
}
.net-badge.online {
  background: #2e7d32;
  color: white;
}
.net-badge.offline {
  background: #c62828;
  color: white;
}
.net-badge.syncing {
  background: #1565c0;
  color: white;
}
.offline-notice {
  background: #fdecea;
  color: #7f1d1d;
  border-bottom: 1px solid #f5c6cb;
  padding: 8px 20px;
  font-size: 0.9rem;
}
.sync-banner {
  background: #e3f2fd;
  color: #0d47a1;
  border-bottom: 1px solid #bbdefb;
  padding: 8px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.9rem;
}
.sync-banner button {
  background: #1565c0;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
.conflict-banner {
  background: #fff3e0;
  color: #e65100;
  border-bottom: 1px solid #ffe0b2;
  padding: 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.9rem;
}
.conflict-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.conflict-row button {
  background: #e65100;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 20px;
  padding: 20px;
}
.layout.single {
  grid-template-columns: 1fr;
}
@media (max-width: 768px) {
  .layout {
    grid-template-columns: 1fr;
    padding: 12px;
  }
}
</style>
