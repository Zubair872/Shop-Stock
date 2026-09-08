<script setup>
import { reactive } from "vue";
import { addProduct } from "../services/api.js";

const emit = defineEmits(["add-product"]);

// reactive: ek object banata hai jiske values change hone par UI khud-b-khud update ho
const form = reactive({
  name: "",
  category: "",
  price: "",
  stock: "",
});

async function handleSubmit() {
  // khaali form submit na hone do
  if (!form.name || !form.price) return;

  // backend ko data bhejo aur save karwao
  const savedProduct = await addProduct({ ...form });

  // parent (App.vue / ProductList) ko batao ke naya product save ho gaya
  emit("add-product", savedProduct);

  // form ko wapis khaali kar do
  form.name = "";
  form.category = "";
  form.price = "";
  form.stock = "";
}
</script>

<template>
  <!-- @submit.prevent: page refresh hone se roko (default HTML behavior) -->
  <form class="product-form" @submit.prevent="handleSubmit">
    <h3>Naya Product Add Karein</h3>

    <!-- v-model: input ki value seedha form.name se connect (two-way binding) -->
    <input v-model="form.name" placeholder="Product Name" required />
    <input v-model="form.category" placeholder="Category (e.g. Cake)" />
    <input v-model="form.price" type="number" placeholder="Price" required />
    <input v-model="form.stock" type="number" placeholder="Stock" />

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