<script setup>
import { ref, computed, onMounted } from "vue";
import { getDashboard, downloadReport, errorMessage } from "../services/api.js";

const stats = ref(null);
const loading = ref(true);
const error = ref("");
const range = ref("7d");

const ranges = [
  { value: "today", label: "Aaj" },
  { value: "7d", label: "7 din" },
  { value: "30d", label: "30 din" },
  { value: "90d", label: "90 din" },
  { value: "all", label: "Sab" },
];

const maxRevenue = computed(() =>
  Math.max(1, ...(stats.value?.daily || []).map((d) => d.revenue))
);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    stats.value = await getDashboard(range.value);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

function pick(value) {
  range.value = value;
  load();
}

async function exportProducts() {
  try {
    await downloadReport("products");
  } catch (e) {
    alert(errorMessage(e));
  }
}

const money = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

onMounted(load);
</script>

<template>
  <div class="dashboard">
    <h2>📊 Sales Dashboard</h2>

    <div class="ranges">
      <button
        v-for="r in ranges"
        :key="r.value"
        :class="{ active: range === r.value }"
        @click="pick(r.value)"
      >
        {{ r.label }}
      </button>
      <button @click="exportProducts">⬇ Stock CSV</button>
    </div>

    <p v-if="error" class="error">{{ error }} <button @click="load">Dobara try</button></p>
    <p v-else-if="loading && !stats">Loading...</p>

    <template v-if="stats">
      <div class="stat-grid">
        <div class="stat-card"><p class="label">Aaj ki sale</p><p class="value">{{ money(stats.today.revenue) }}</p><p class="sub">{{ stats.today.orders }} orders</p></div>
        <div class="stat-card"><p class="label">Revenue</p><p class="value">{{ money(stats.summary.revenue) }}</p><p class="sub">{{ stats.summary.orders }} orders</p></div>
        <div class="stat-card"><p class="label">Munafa (profit)</p><p class="value">{{ money(stats.summary.profit) }}</p><p class="sub">Average order {{ money(stats.summary.averageOrder) }}</p></div>
        <div class="stat-card">
          <p class="label">Best Seller</p>
          <p class="value" v-if="stats.bestSeller">{{ stats.bestSeller.name }}</p>
          <p class="value" v-else>N/A</p>
          <p class="sub" v-if="stats.bestSeller">{{ stats.bestSeller.qty }} {{ stats.bestSeller.unit }}</p>
        </div>
      </div>

      <p v-if="stats.inventory.missingCostCount > 0" class="note">
        ℹ️ {{ stats.inventory.missingCostCount }} products ki cost price nahi hai, isliye un ka munafa asal se zyada dikhega.
      </p>

      <h3>Roz ki sale</h3>
      <div class="chart" role="img" aria-label="Daily revenue chart">
        <div v-for="d in stats.daily" :key="d.date" class="bar-wrap" :title="`${d.date}: ${money(d.revenue)} (${d.orders} orders)`">
          <div class="bar" :style="{ height: (d.revenue / maxRevenue) * 100 + '%' }"></div>
        </div>
      </div>
      <p class="sub">{{ stats.daily[0]?.date }} → {{ stats.daily[stats.daily.length - 1]?.date }}</p>

      <div class="two-col">
        <div>
          <h3>Top products</h3>
          <p v-if="stats.topProducts.length === 0" class="sub">Abhi koi sale nahi.</p>
          <ol>
            <li v-for="p in stats.topProducts" :key="p.id">{{ p.name }} — {{ p.qty }} {{ p.unit }} ({{ money(p.sales) }})</li>
          </ol>
        </div>
        <div>
          <h3>Payment ka tareeqa</h3>
          <ul>
            <li v-for="p in stats.payments" :key="p.method">{{ p.method }} — {{ p.orders }} orders ({{ money(p.revenue) }})</li>
          </ul>
          <h3>Stock ki value</h3>
          <p class="sub">Cost: {{ money(stats.inventory.stockCostValue) }}<br />Bechne par: {{ money(stats.inventory.stockRetailValue) }}</p>
        </div>
      </div>

      <div v-if="stats.outOfStockItems.length > 0" class="alert-box">
        <h3>⛔ Khatam ho chuka</h3>
        <ul><li v-for="i in stats.outOfStockItems" :key="i.id">{{ i.name }}</li></ul>
      </div>

      <div v-if="stats.lowStockItems.length > 0" class="alert-box">
        <h3>⚠️ Kam Stock</h3>
        <ul><li v-for="i in stats.lowStockItems" :key="i.id">{{ i.name }} — sirf {{ i.stock }} {{ i.unit }} bache hain</li></ul>
      </div>

      <div v-if="stats.expiringItems.length > 0" class="alert-box">
        <h3>📅 Expiry</h3>
        <ul>
          <li v-for="i in stats.expiringItems" :key="i.id">
            {{ i.name }} — {{ i.expiryStatus === "expired" ? "expire ho gaya" : "jaldi expire hoga" }}
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ranges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.ranges .active {
  font-weight: bold;
  outline: 2px solid #8a6d3b;
}
.error {
  color: #b03a2e;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
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
  font-size: 1.2rem;
  font-weight: bold;
  margin: 0;
}
.sub {
  font-size: 0.8rem;
  color: #777;
  margin: 4px 0 0;
}
.note {
  background: #fff8e1;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.9rem;
}
.chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 140px;
  padding: 8px;
  background: #fffaf3;
  border: 1px solid #e0d5c8;
  border-radius: 10px;
}
.bar-wrap {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
}
.bar {
  width: 100%;
  background: #c8943e;
  border-radius: 3px 3px 0 0;
  min-height: 2px;
}
.two-col {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
.alert-box {
  background: #fdecea;
  border: 1px solid #f5c6cb;
  border-radius: 10px;
  padding: 10px 14px;
  margin-top: 12px;
}
.alert-box h3 {
  margin: 0 0 6px;
  color: #b03a2e;
}
</style>
