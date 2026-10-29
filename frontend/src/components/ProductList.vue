<script setup>
import { ref, computed, reactive } from "vue";

const props = defineProps({
  products: {
    type: Array,
    required: true,
  },
  role: { type: String, default: "viewer" },
});

// emit: jab user "Add to Cart" click kare, parent ko batao "yeh product add karo"
const emit = defineEmits(["add-to-cart", "delete-product", "update-product", "stock-action"]);
const canSell = computed(() => ["owner", "admin", "manager", "cashier"].includes(props.role));
const canManage = computed(() => ["owner", "admin", "manager"].includes(props.role));
const canDelete = computed(() => ["owner", "admin"].includes(props.role));

// ===== SEARCH / FILTER state =====
const searchQuery = ref("");      // search box ki value
const selectedCategory = ref(""); // dropdown se select ki gayi category

// categories: products se unique categories nikal lo (dropdown banane ke liye)
const categories = computed(() => {
  const all = props.products.map((p) => p.category).filter(Boolean);
  return [...new Set(all)]; // Set duplicate hata deta hai
});

// filteredProducts: search + category dono conditions lagao
const filteredProducts = computed(() => {
  return props.products.filter((p) => {
    const matchesSearch = p.name
      .toLowerCase()
      .includes(searchQuery.value.toLowerCase());
    const matchesCategory =
      selectedCategory.value === "" || p.category === selectedCategory.value;
    return matchesSearch && matchesCategory;
  });
});

// ===== LOW STOCK threshold =====
// ===== EDIT state =====
const editingId = ref(null);       // abhi kaunsa product edit ho raha hai (null = koi nahi)
const editForm = reactive({ price: "", costPrice: "", stock: "", lowStockLevel: "", expiryDate: "" });

function startEdit(product) {
  editingId.value = product.id;
  editForm.price = product.price;
  editForm.costPrice = product.costPrice;
  editForm.stock = product.stock;
  editForm.lowStockLevel = product.lowStockLevel;
  editForm.expiryDate = product.expiryDate ? product.expiryDate.slice(0, 10) : "";
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
  });
  editingId.value = null;
}

function handleAdd(product) {
  emit("add-to-cart", product); // parent (App.vue) ka function chalega
}

function handleDelete(id) {
  emit("delete-product", id);
}

function handleStockAction(product, type) {
  const label = type === "restock" ? "kitna stock add karna hai?" : "kitna stock waste hua?";
  const quantity = window.prompt(`${product.name}: ${label} (${product.unit})`);
  if (quantity === null || quantity.trim() === "") return;
  emit("stock-action", { id: product.id, type, quantity: Number(quantity) });
}
</script>

<template>
  <div>
    <!-- ===== Search + Filter bar ===== -->
    <div class="filter-bar">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="🔍 Product dhoondein..."
      />
      <select v-model="selectedCategory">
        <option value="">Sab Categories</option>
        <!-- v-for se dropdown options banao -->
        <option v-for="cat in categories" :key="cat" :value="cat">
          {{ cat }}
        </option>
      </select>
    </div>

    <div class="product-grid">
      <!-- v-for: products array ke har item par loop chalao -->
      <!-- :key="p.id" Vue ko batata hai har card unique kaise pehchane -->
      <div class="card" v-for="p in filteredProducts" :key="p.id">
        <h3>{{ p.name }}</h3>
        <p class="category">{{ p.category }}</p>
        <p class="unit">Unit: {{ p.unit }}</p>
        <p v-if="p.expiryStatus === 'expired'" class="out">Expired</p>
        <p v-else-if="p.expiryStatus === 'soon'" class="low">Expiry qareeb hai</p>

        <!-- ===== NORMAL VIEW (jab edit nahi ho raha) ===== -->
        <template v-if="editingId !== p.id">
          <p class="price">Rs. {{ p.price }}</p>

          <!-- v-if/v-else-if/v-else: teen halaton mein se ek dikhao -->
          <p v-if="p.stock === 0" class="out">Out of Stock</p>
          <p v-else-if="p.stock <= p.lowStockLevel" class="low">
            ⚠️ Kam Stock: {{ p.stock }}
          </p>
          <p v-else class="stock">Stock: {{ p.stock }}</p>

          <div class="card-actions">
            <button v-if="canSell" :disabled="p.stock === 0" @click="handleAdd(p)">
              Add to Cart
            </button>
            <button v-if="canManage" class="stock-btn" @click="handleStockAction(p, 'restock')">+ Stock</button>
            <button v-if="canManage" class="waste-btn" :disabled="p.stock === 0" @click="handleStockAction(p, 'wastage')">Waste</button>
            <button v-if="canManage" class="edit-btn" @click="startEdit(p)">✏️</button>
            <button v-if="canDelete" class="delete-btn" @click="handleDelete(p.id)">🗑</button>
          </div>
        </template>

        <!-- ===== EDIT VIEW (jab is card ka edit mode on hai) ===== -->
        <template v-else>
          <label>Price</label>
          <input v-model="editForm.price" type="number" />
          <label>Cost price</label>
          <input v-model="editForm.costPrice" type="number" min="0" />
          <label>Stock</label>
          <input v-model="editForm.stock" type="number" min="0" :step="['kg', 'litre'].includes(p.unit) ? '0.001' : '1'" />
          <label>Low stock alert</label>
          <input v-model="editForm.lowStockLevel" type="number" min="0" :step="['kg', 'litre'].includes(p.unit) ? '0.001' : '1'" />
          <label>Expiry</label>
          <input v-model="editForm.expiryDate" type="date" />

          <div class="card-actions">
            <button class="save-btn" @click="saveEdit(p.id)">Save</button>
            <button class="cancel-btn" @click="cancelEdit">Cancel</button>
          </div>
        </template>
      </div>

      <!-- agar filter ke baad kuch na mile -->
      <p v-if="filteredProducts.length === 0" class="no-results">
        Koi product nahi mila.
      </p>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.filter-bar input,
.filter-bar select {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.filter-bar input {
  flex: 1;
}
.no-results {
  color: #999;
  grid-column: 1 / -1;
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.card {
  border: 1px solid #e0d5c8;
  border-radius: 10px;
  padding: 14px;
  background: #fffaf3;
}
.category {
  color: #8a6d3b;
  font-size: 0.85rem;
}
.unit {
  color: #777;
  font-size: 0.8rem;
  margin: 4px 0;
}
.price {
  font-weight: bold;
  font-size: 1.1rem;
}
.out {
  color: #c0392b;
  font-size: 0.85rem;
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
  padding: 6px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.save-btn {
  background: #2e7d32;
}
.cancel-btn {
  background: #999;
}
.edit-btn {
  flex: 0 0 40px;
  background: #8a6d3b;
}
.stock-btn {
  background: #2e7d32;
}
.waste-btn {
  background: #8a6d3b;
}
.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
button {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 6px;
  background: #b5651d;
  color: white;
  cursor: pointer;
}
button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.delete-btn {
  flex: 0 0 40px;
  background: #b03a2e;
}
</style>