<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount } from "vue";
import { t } from "../i18n.js";

const props = defineProps({
  products: {
    type: Array,
    required: true,
  },
  role: { type: String, default: "viewer" },
  offline: { type: Boolean, default: false },
});

const emit = defineEmits(["add-to-cart", "delete-product", "update-product", "stock-action"]);
const canSell = computed(() => ["owner", "admin", "manager", "cashier"].includes(props.role));
const canManage = computed(() => ["owner", "admin", "manager"].includes(props.role));
const canDelete = computed(() => ["owner", "admin"].includes(props.role));

const searchQuery = ref("");
const selectedCategory = ref("");
const scanMessage = ref("");

const categories = computed(() => {
  const all = props.products.map((p) => p.category).filter(Boolean);
  return [...new Set(all)];
});

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return props.products.filter((p) => {
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    const matchesCategory =
      selectedCategory.value === "" || p.category === selectedCategory.value;
    return matchesSearch && matchesCategory;
  });
});

function addByBarcode(code) {
  const clean = String(code || "").trim();
  if (!clean) return false;
  const match = props.products.find((p) => p.barcode && p.barcode === clean);
  if (!match) return false;
  if (match.stock <= 0) {
    scanMessage.value = t("scanOut", { name: match.name });
    return true;
  }
  if (canSell.value) {
    emit("add-to-cart", match);
    scanMessage.value = t("scanAdded", { name: match.name });
  }
  return true;
}

function handleSearchEnter() {
  const q = searchQuery.value.trim();
  if (addByBarcode(q)) {
    searchQuery.value = "";
  }
}

let scanBuffer = "";
let lastKeyTime = 0;

function handleGlobalKeydown(event) {
  const tag = event.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  const now = Date.now();
  if (now - lastKeyTime > 120) {
    scanBuffer = "";
  }
  lastKeyTime = now;

  if (event.key === "Enter") {
    if (scanBuffer.length >= 3) {
      if (!addByBarcode(scanBuffer)) {
        scanMessage.value = t("scanNotFound", { code: scanBuffer });
      }
    }
    scanBuffer = "";
    return;
  }

  if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
    scanBuffer += event.key;
  }
}

onMounted(() => window.addEventListener("keydown", handleGlobalKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", handleGlobalKeydown));

const editingId = ref(null);
const editForm = reactive({
  price: "",
  costPrice: "",
  stock: "",
  lowStockLevel: "",
  expiryDate: "",
  barcode: "",
});

function startEdit(product) {
  editingId.value = product.id;
  editForm.price = product.price;
  editForm.costPrice = product.costPrice;
  editForm.stock = product.stock;
  editForm.lowStockLevel = product.lowStockLevel;
  editForm.expiryDate = product.expiryDate ? product.expiryDate.slice(0, 10) : "";
  editForm.barcode = product.barcode || "";
}

function cancelEdit() {
  editingId.value = null;
}

function saveEdit(id) {
  emit("update-product", {
    id,
    price: Number(editForm.price),
    costPrice: editForm.costPrice === "" ? undefined : Number(editForm.costPrice),
    stock: Number(editForm.stock),
    lowStockLevel: Number(editForm.lowStockLevel),
    expiryDate: editForm.expiryDate || null,
    barcode: editForm.barcode.trim(),
  });
  editingId.value = null;
}

function handleAdd(product) {
  emit("add-to-cart", product);
}

function handleDelete(id) {
  emit("delete-product", id);
}

function handleStockAction(product, type) {
  const label = type === "restock" ? t("promptRestock") : t("promptWaste");
  const quantity = window.prompt(`${product.name}: ${label} (${product.unit})`);
  if (quantity === null || quantity.trim() === "") return;
  emit("stock-action", { id: product.id, type, quantity: Number(quantity) });
}
</script>

<template>
  <div>
    <div class="filter-bar">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="t('searchProduct')"
        @keydown.enter.prevent="handleSearchEnter"
      />
      <select v-model="selectedCategory">
        <option value="">{{ t("allCategories") }}</option>
        <option v-for="cat in categories" :key="cat" :value="cat">
          {{ cat }}
        </option>
      </select>
    </div>

    <p v-if="scanMessage" class="scan-info">{{ scanMessage }}</p>

    <div class="product-grid">
      <div class="card" v-for="p in filteredProducts" :key="p.id">
        <h3>{{ p.name }}</h3>
        <p class="category">{{ p.category }}</p>
        <p class="unit">{{ t("unitLabel") }}: {{ p.unit }}</p>
        <p v-if="p.barcode" class="barcode">{{ t("barcodeLabel") }}: {{ p.barcode }}</p>
        <p v-if="p.expiryStatus === 'expired'" class="out">{{ t("expired") }}</p>
        <p v-else-if="p.expiryStatus === 'soon'" class="low">{{ t("expiringSoon") }}</p>

        <template v-if="editingId !== p.id">
          <p class="price">Rs. {{ p.price }}</p>

          <p v-if="p.stock === 0" class="out">{{ t("outOfStock") }}</p>
          <p v-else-if="p.stock <= p.lowStockLevel" class="low">
            {{ t("lowStockLabel") }}: {{ p.stock }}
          </p>
          <p v-else class="stock">{{ t("stock") }}: {{ p.stock }}</p>

          <div class="card-actions">
            <button
              v-if="canSell"
              class="add-cart-btn"
              :disabled="p.stock === 0"
              @click="handleAdd(p)"
            >
              {{ t("addCartBtn") }}
            </button>
            <button
              v-if="canManage"
              class="stock-btn"
              :disabled="offline"
              :title="offline ? t('offlineNeedsInternet') : ''"
              @click="handleStockAction(p, 'restock')"
            >
              {{ t("addStockBtn") }}
            </button>
            <button
              v-if="canManage"
              class="waste-btn"
              :disabled="offline || p.stock === 0"
              :title="offline ? t('offlineNeedsInternet') : ''"
              @click="handleStockAction(p, 'wastage')"
            >
              {{ t("wasteBtn") }}
            </button>
            <button
              v-if="canManage"
              class="edit-btn"
              :disabled="offline"
              :title="offline ? t('offlineNeedsInternet') : ''"
              @click="startEdit(p)"
            >
              {{ t("editBtn") }}
            </button>
            <button
              v-if="canDelete"
              class="delete-btn"
              :disabled="offline"
              :title="offline ? t('offlineNeedsInternet') : ''"
              @click="handleDelete(p.id)"
            >
              {{ t("delBtn") }}
            </button>
          </div>
        </template>

        <template v-else>
          <label>{{ t("sellPrice") }}</label>
          <input v-model="editForm.price" type="number" />
          <label>{{ t("costPrice") }}</label>
          <input v-model="editForm.costPrice" type="number" min="0" />
          <label>{{ t("stock") }}</label>
          <input
            v-model="editForm.stock"
            type="number"
            min="0"
            :step="['kg', 'litre'].includes(p.unit) ? '0.001' : '1'"
          />
          <label>{{ t("lowStockLevel") }}</label>
          <input
            v-model="editForm.lowStockLevel"
            type="number"
            min="0"
            :step="['kg', 'litre'].includes(p.unit) ? '0.001' : '1'"
          />
          <label>{{ t("barcodeLabel") }}</label>
          <input v-model="editForm.barcode" type="text" maxlength="60" />
          <label>{{ t("expiry") }}</label>
          <input v-model="editForm.expiryDate" type="date" />

          <div class="card-actions">
            <button class="save-btn" @click="saveEdit(p.id)">{{ t("saveBtn") }}</button>
            <button class="cancel-btn" @click="cancelEdit">{{ t("cancelBtn") }}</button>
          </div>
        </template>
      </div>

      <p v-if="filteredProducts.length === 0" class="no-results">
        {{ t("noProductFound") }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.filter-bar input,
.filter-bar select {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1rem;
}
.filter-bar input {
  flex: 1;
  min-width: 200px;
}
.scan-info {
  margin: 0 0 12px;
  padding: 8px 12px;
  background: #e8f5e9;
  color: #1b5e20;
  border-radius: 6px;
  font-size: 0.9rem;
}
.no-results {
  color: #999;
  grid-column: 1 / -1;
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.card {
  border: 1px solid #e0d5c8;
  border-radius: 10px;
  padding: 14px;
  background: #fffaf3;
}
.card h3 {
  margin: 0 0 4px;
}
.category {
  color: #8a6d3b;
  font-size: 0.85rem;
  margin: 2px 0;
}
.unit,
.barcode {
  color: #777;
  font-size: 0.8rem;
  margin: 2px 0;
}
.price {
  font-weight: bold;
  font-size: 1.15rem;
  margin: 8px 0 4px;
}
.out {
  color: #c0392b;
  font-size: 0.85rem;
  font-weight: bold;
}
.stock {
  color: #2e7d32;
  font-size: 0.85rem;
}
.low {
  color: #b8860b;
  font-size: 0.85rem;
  font-weight: bold;
}
.card label {
  display: block;
  font-size: 0.8rem;
  margin-top: 6px;
  color: #666;
}
.card input {
  width: 100%;
  min-height: 38px;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
button {
  flex: 1;
  min-height: 44px;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: #b5651d;
  color: white;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}
.add-cart-btn {
  flex-basis: 100%;
}
button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.save-btn,
.stock-btn {
  background: #2e7d32;
}
.cancel-btn {
  background: #999;
}
.edit-btn,
.waste-btn {
  background: #8a6d3b;
}
.delete-btn {
  background: #b03a2e;
}
</style>
