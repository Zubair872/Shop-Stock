<script setup>
import { ref, onMounted } from "vue";
import {
  getDailyClosing,
  saveDailyClosing,
  getClosingHistory,
  errorMessage,
} from "../services/api.js";
import { t } from "../i18n.js";

const today = ref(null);
const history = ref([]);
const loading = ref(true);
const saving = ref(false);
const showHistory = ref(false);
const note = ref("");
const error = ref("");

const money = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

async function load() {
  loading.value = true;
  error.value = "";
  try {
    today.value = await getDailyClosing();
    note.value = today.value.note || "";
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function loadHistory() {
  try {
    history.value = await getClosingHistory(30);
    showHistory.value = true;
  } catch (e) {
    alert(errorMessage(e));
  }
}

async function save() {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    today.value = await saveDailyClosing({ note: note.value });
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="closing">
    <h2>{{ t("closingTitle") }}</h2>

    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loading">{{ t("loading") }}</p>

    <template v-if="today">
      <div class="date-row">
        <span class="datekey">{{ today.dateKey }}</span>
        <span v-if="today.isClosed" class="badge closed">{{ t("closedBadge") }} ✓</span>
        <span v-else class="badge open">{{ t("openBadge") }}</span>
      </div>

      <div class="grid">
        <div class="card">
          <p class="label">{{ t("totalSale") }}</p>
          <p class="val">{{ money(today.summary.totalRevenue) }}</p>
          <p class="sub">{{ today.summary.totalOrders }} {{ t("ordersCol") }}</p>
        </div>
        <div class="card">
          <p class="label">{{ t("profitLabel") }}</p>
          <p class="val">{{ money(today.summary.totalProfit) }}</p>
          <p class="sub">{{ t("discountLabel") }}: {{ money(today.summary.totalDiscount) }}</p>
        </div>
        <div class="card">
          <p class="label">{{ t("payCash") }}</p>
          <p class="val">{{ money(today.summary.cashRevenue) }}</p>
        </div>
        <div class="card">
          <p class="label">{{ t("payCard") }}</p>
          <p class="val">{{ money(today.summary.cardRevenue) }}</p>
        </div>
        <div class="card">
          <p class="label">{{ t("payWallet") }}</p>
          <p class="val">{{ money(today.summary.walletRevenue) }}</p>
        </div>
        <div class="card">
          <p class="label">{{ t("payUdhaar") }}</p>
          <p class="val udhaar">{{ money(today.summary.udhaarRevenue) }}</p>
        </div>
      </div>

      <div class="form">
        <label>{{ t("noteOptional") }}</label>
        <textarea v-model="note" maxlength="500" rows="2" :placeholder="t('todayNotePlaceholder')" />
        <button class="btn-save" @click="save" :disabled="saving">
          {{ saving ? t("saving") : today.isClosed ? t("recloseTodayBtn") : `${t("closeTodayBtn")} ✓` }}
        </button>
      </div>

      <div v-if="today.isClosed" class="closed-at">
        {{ t("closedAtLabel") }}: {{ new Date(today.closedAt).toLocaleString("en-PK") }}
        <span v-if="today.note"> — {{ today.note }}</span>
      </div>
    </template>

    <div class="history-section">
      <button class="btn-history" @click="loadHistory">{{ t("viewHistoryBtn") }}</button>

      <div v-if="showHistory">
        <table>
          <thead>
            <tr>
              <th>{{ t("dayCol") }}</th>
              <th>{{ t("ordersCol") }}</th>
              <th>{{ t("saleCol") }}</th>
              <th>{{ t("payCash") }}</th>
              <th>{{ t("payUdhaar") }}</th>
              <th>{{ t("profitLabel") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in history" :key="row.dateKey">
              <td>{{ row.dateKey }}</td>
              <td>{{ row.summary.totalOrders }}</td>
              <td>{{ money(row.summary.totalRevenue) }}</td>
              <td>{{ money(row.summary.cashRevenue) }}</td>
              <td>{{ money(row.summary.udhaarRevenue) }}</td>
              <td>{{ money(row.summary.totalProfit) }}</td>
            </tr>
            <tr v-if="history.length === 0">
              <td colspan="6" class="sub">{{ t("noClosingYet") }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.closing {
  max-width: 700px;
  margin: 0 auto;
  padding: 16px;
}
.date-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.datekey {
  font-size: 1.1rem;
  font-weight: bold;
}
.badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.82rem;
}
.badge.closed {
  background: #d4edda;
  color: #155724;
}
.badge.open {
  background: #fff3cd;
  color: #856404;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}
.card {
  background: #fff3e0;
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}
.label {
  font-size: 0.8rem;
  color: #8a6d3b;
  margin: 0 0 4px;
}
.val {
  font-size: 1.1rem;
  font-weight: bold;
  margin: 0;
}
.val.udhaar {
  color: #c0392b;
}
.sub {
  font-size: 0.75rem;
  color: #777;
  margin: 2px 0 0;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.form label {
  font-size: 0.9rem;
  color: #555;
}
.form textarea {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 8px;
  font-size: 0.95rem;
  resize: vertical;
}
.btn-save {
  background: #b5651d;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  min-height: 44px;
}
.btn-save:disabled {
  opacity: 0.6;
}
.closed-at {
  font-size: 0.85rem;
  color: #555;
  margin-bottom: 16px;
}
.err {
  color: #b03a2e;
  margin-bottom: 10px;
}
.history-section {
  margin-top: 20px;
}
.btn-history {
  background: #f0e6d6;
  border: 1px solid #c8a97a;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  min-height: 44px;
  margin-bottom: 12px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}
th,
td {
  padding: 8px 10px;
  border-bottom: 1px solid #e0d5c8;
  text-align: right;
}
th:first-child,
td:first-child {
  text-align: left;
}
th {
  background: #fff3e0;
  font-weight: bold;
}
</style>
