<script setup>
import { reactive, computed } from "vue";

const emit = defineEmits(["add-product"]);

const form = reactive({
  name: "",
  category: "",
  price: "",
  costPrice: "",
  stock: "",
  unit: "pcs",
  lowStockLevel: 5,
  expiryDate: "",
});

const stockStep = computed(() => ["kg", "litre"].includes(form.unit) ? "0.001" : "1");

function handleSubmit() {
  if (!form.name.trim() || form.price === "") return;

  emit("add-product", {
    name: form.name.trim(),
    category: form.category.trim(),
    price: Number(form.price),
    costPrice: form.costPrice === "" ? undefined : Number(form.costPrice),
    stock: Number(form.stock) || 0,
    unit: form.unit,
    lowStockLevel: Number(form.lowStockLevel),
    expiryDate: form.expiryDate || null,
  });

  form.name = "";
  form.category = "";
  form.price = "";
  form.costPrice = "";
  form.stock = "";
  form.unit = "pcs";
  form.lowStockLevel = 5;
  form.expiryDate = "";
}
</script>

<template>
  <form class="product-form" @submit.prevent="handleSubmit">
    <h3>Naya Product Add Karein</h3>

    <input v-model="form.name" placeholder="Product Name" required />
    <input v-model="form.category" placeholder="Category (e.g. Cake)" />
    <input v-model="form.price" type="number" min="0" placeholder="Price" required />
    <input v-model="form.costPrice" type="number" min="0" placeholder="Cost price" />
    <select v-model="form.unit" aria-label="Unit">
      <option value="pcs">Pieces</option>
      <option value="kg">Kilogram</option>
      <option value="g">Gram</option>
      <option value="litre">Litre</option>
      <option value="dozen">Dozen</option>
      <option value="packet">Packet</option>
      <option value="box">Box</option>
    </select>
    <input v-model="form.stock" type="number" min="0" :step="stockStep" placeholder="Stock" />
    <input v-model="form.lowStockLevel" type="number" min="0" :step="stockStep" placeholder="Low stock alert" />
    <label class="date-field">Expiry <input v-model="form.expiryDate" type="date" /></label>

    <button type="submit">Add Product</button>
  </form>
</template>

<style scoped>
.product-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: #fff3e0;
  padding: 14px;
  border-radius: 10px;
  margin-bottom: 20px;
}
input {
  flex: 1;
  min-width: 120px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
button {
  padding: 8px 16px;
  background: #2e7d32;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
</style>
