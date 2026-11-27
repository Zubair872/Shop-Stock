<script setup>
import { reactive, computed } from "vue";
import { t } from "../i18n.js";

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
  barcode: "",
});

const stockStep = computed(() => (["kg", "litre"].includes(form.unit) ? "0.001" : "1"));

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
    barcode: form.barcode.trim(),
  });

  form.name = "";
  form.category = "";
  form.price = "";
  form.costPrice = "";
  form.stock = "";
  form.unit = "pcs";
  form.lowStockLevel = 5;
  form.expiryDate = "";
  form.barcode = "";
}
</script>

<template>
  <form class="product-form" @submit.prevent="handleSubmit">
    <h3>{{ t("addProductTitle") }}</h3>

    <input v-model="form.name" :placeholder="t('productName')" required />
    <input v-model="form.category" :placeholder="t('categoryPlaceholder')" />
    <input
      v-model="form.barcode"
      :placeholder="t('barcodePlaceholder')"
      maxlength="60"
      @keydown.enter.prevent
    />
    <input
      v-model="form.costPrice"
      type="number"
      min="0"
      :placeholder="t('costPrice')"
    />
    <input
      v-model="form.price"
      type="number"
      min="0"
      :placeholder="t('sellPrice')"
      required
    />
    <select v-model="form.unit" :aria-label="t('unitLabel')">
      <option value="pcs">Pieces</option>
      <option value="kg">Kilogram</option>
      <option value="g">Gram</option>
      <option value="litre">Litre</option>
      <option value="dozen">Dozen</option>
      <option value="packet">Packet</option>
      <option value="box">Box</option>
    </select>
    <input
      v-model="form.stock"
      type="number"
      min="0"
      :step="stockStep"
      :placeholder="t('stock')"
    />
    <input
      v-model="form.lowStockLevel"
      type="number"
      min="0"
      :step="stockStep"
      :placeholder="t('lowStockLevel')"
    />
    <label class="date-field">{{ t("expiry") }} <input v-model="form.expiryDate" type="date" /></label>

    <button type="submit">{{ t("addProductBtn") }}</button>
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
.product-form h3 {
  width: 100%;
  margin: 0 0 4px;
}
input,
select {
  flex: 1;
  min-width: 130px;
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.date-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #555;
}
button {
  min-height: 44px;
  padding: 10px 18px;
  background: #2e7d32;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
</style>
