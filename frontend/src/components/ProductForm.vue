<script setup>
import { reactive } from "vue";

const emit = defineEmits(["add-product"]);

const form = reactive({
  name: "",
  category: "",
  price: "",
  stock: "",
});

function handleSubmit() {
  if (!form.name.trim() || form.price === "") return;

  emit("add-product", {
    name: form.name.trim(),
    category: form.category.trim(),
    price: Number(form.price),
    stock: Number(form.stock) || 0,
  });

  form.name = "";
  form.category = "";
  form.price = "";
  form.stock = "";
}
</script>

<template>
  <form class="product-form" @submit.prevent="handleSubmit">
    <h3>Naya Product Add Karein</h3>

    <input v-model="form.name" placeholder="Product Name" required />
    <input v-model="form.category" placeholder="Category (e.g. Cake)" />
    <input v-model="form.price" type="number" min="0" placeholder="Price" required />
    <input v-model="form.stock" type="number" min="0" placeholder="Stock" />

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
