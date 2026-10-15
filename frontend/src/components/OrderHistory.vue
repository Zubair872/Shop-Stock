<script setup>
import { ref, onMounted } from "vue";
import { getOrders } from "../services/api.js";

const orders = ref([]);

onMounted(async () => {
  orders.value = await getOrders();
});

function formatDate(isoString) {
  return new Date(isoString).toLocaleString();
}

function shortId(id) {
  return String(id).slice(-6).toUpperCase();
}
</script>

<template>
  <div class="order-history">
    <h2>📋 Order History</h2>

    <p v-if="orders.length === 0" class="empty">Abhi tak koi order nahi hua.</p>

    <div
      class="order-card"
      v-for="order in [...orders].reverse()"
      :key="order.id"
    >
      <div class="order-header">
        <span>Order #{{ shortId(order.id) }}</span>
        <span>{{ formatDate(order.date) }}</span>
      </div>

      <ul>
        <li v-for="item in order.items" :key="item.id">
          {{ item.name }} x{{ item.qty }} — Rs. {{ item.price * item.qty }}
        </li>
      </ul>

      <div class="order-total">Total: Rs. {{ order.total }}</div>
    </div>
  </div>
</template>

<style scoped>
.order-history {
  max-width: 700px;
}
.empty {
  color: #999;
}
.order-card {
  background: #fffaf3;
  border: 1px solid #e0d5c8;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
}
.order-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #8a6d3b;
  margin-bottom: 8px;
}
ul {
  margin: 0;
  padding-left: 18px;
}
.order-total {
  margin-top: 8px;
  font-weight: bold;
  text-align: right;
}
</style>
