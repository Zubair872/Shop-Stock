<script setup>
import { ref, onMounted } from "vue";
import { getDashboard } from "../services/api.js";

const stats = ref(null); // shuru mein khali - data aane tak

onMounted(async () => {
  stats.value = await getDashboard();
});
</script>

<template>
  <div class="dashboard" v-if="stats">
    <h2>📊 Sales Dashboard</h2>

    <div class="stat-grid">
      <div class="stat-card">
        <p class="label">Total Orders</p>
        <p class="value">{{ stats.totalOrders }}</p>
      </div>

      <div class="stat-card">
        <p class="label">Total Revenue</p>
        <p class="value">Rs. {{ stats.totalRevenue }}</p>
      </div>

      <div class="stat-card">
        <p class="label">Best Seller</p>
        <!-- v-if/v-else: agar best seller mojood hai to naam dikhao warna "N/A" -->
        <p class="value" v-if="stats.bestSeller">
          {{ stats.bestSeller.name }} ({{ stats.bestSeller.qty }})
        </p>
        <p class="value" v-else>N/A</p>
      </div>
    </div>

    <!-- Low stock warning section -->
    <div v-if="stats.lowStockItems.length > 0" class="low-stock-box">
      <h3>⚠️ Kam Stock Wale Products</h3>
      <ul>
        <li v-for="item in stats.lowStockItems" :key="item.id">
          {{ item.name }} — sirf {{ item.stock }} bache hain
        </li>
      </ul>
    </div>
  </div>

  <p v-else>Loading...</p>
</template>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.stat-card {
  background: #fff3e0;
  border-radius: 10px;
  padding: 16px;
  text-align: center;
}
.label {
  font-size: 0.85rem;
  color: #8a6d3b;
  margin: 0 0 6px 0;
}
.value {
  font-size: 1.3rem;
  font-weight: bold;
  margin: 0;
}
.low-stock-box {
  background: #fdecea;
  border: 1px solid #f5c6cb;
  border-radius: 10px;
  padding: 14px;
}
.low-stock-box h3 {
  margin-top: 0;
  color: #b03a2e;
}
</style>