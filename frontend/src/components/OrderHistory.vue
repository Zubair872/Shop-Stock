<script setup>
import { ref, reactive, onMounted } from "vue";
import ReceiptModal from "./ReceiptModal.vue";
import { getOrders, cancelOrder, downloadReport, errorMessage } from "../services/api.js";
import { t } from "../i18n.js";

const props = defineProps({
  shopName: { type: String, default: "Shop-Stock" },
});

const orders = ref([]);
const selectedReceipt = ref(null);
const loading = ref(true);
const error = ref("");
const page = ref(1);
const pages = ref(1);
const total = ref(0);
const filters = reactive({ status: "all", from: "", to: "", q: "" });

async function load(targetPage = 1) {
  loading.value = true;
  error.value = "";
  try {
    const data = await getOrders({ ...filters, page: targetPage, limit: 20 });
    orders.value = data.items;
    page.value = data.page;
    pages.value = data.pages;
    total.value = data.total;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function handleCancel(order) {
  if (!confirm(t("confirmCancelOrder", { id: shortId(order.id) }))) return;
  try {
    await cancelOrder(order.id);
    await load(page.value);
  } catch (e) {
    alert(errorMessage(e));
  }
}

async function handleExport() {
  try {
    await downloadReport("orders", { from: filters.from, to: filters.to });
  } catch (e) {
    alert(errorMessage(e));
  }
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString();
}

function shortId(id) {
  return String(id).slice(-6).toUpperCase();
}

onMounted(() => load(1));
</script>

<template>
  <div class="order-history">
    <h2>{{ t("orderHistoryTitle") }}</h2>

    <form class="filters" @submit.prevent="load(1)">
      <select v-model="filters.status" aria-label="Status">
        <option value="all">{{ t("all") }}</option>
        <option value="completed">{{ t("completed") }}</option>
        <option value="cancelled">{{ t("cancelled") }}</option>
      </select>
      <input v-model="filters.from" type="date" />
      <input v-model="filters.to" type="date" />
      <input v-model="filters.q" :placeholder="t('custSearch')" maxlength="60" />
      <button type="submit">{{ t("searchBtn") }}</button>
      <button type="button" @click="handleExport">⬇ {{ t("csvBtn") }}</button>
    </form>

    <p v-if="loading" class="empty">{{ t("loading") }}</p>
    <p v-else-if="error" class="error">{{ error }} <button @click="load(page)">{{ t("retryBtn") }}</button></p>
    <p v-else-if="orders.length === 0" class="empty">{{ t("noOrdersFound") }}</p>

    <template v-else>
      <div
        class="order-card"
        :class="{ cancelled: order.status === 'cancelled' }"
        v-for="order in orders"
        :key="order.id"
      >
        <div class="order-header">
          <span>Order #{{ shortId(order.id) }} · {{ order.paymentMethod }}</span>
          <span>{{ formatDate(order.date) }}</span>
        </div>

        <p v-if="order.customerName || order.customerPhone" class="customer">
          👤 {{ order.customerName }} {{ order.customerPhone }}
        </p>

        <ul>
          <li v-for="item in order.items" :key="item.id">
            {{ item.name }} x{{ item.qty }} {{ item.unit }} — Rs. {{ item.price * item.qty }}
          </li>
        </ul>

        <div class="order-total">
          <span v-if="order.discount > 0">Discount: Rs. {{ order.discount }} · </span>
          Total: Rs. {{ order.total }}
          <span v-if="order.status === 'cancelled'" class="badge">CANCELLED</span>
        </div>

        <div class="order-actions">
          <button type="button" class="receipt-btn" @click="selectedReceipt = order">
            {{ t("receiptWaBtn") }}
          </button>
          <button v-if="order.status === 'completed'" class="cancel-btn" @click="handleCancel(order)">
            {{ t("cancelOrderBtn") }}
          </button>
        </div>
      </div>

      <div class="pager">
        <button :disabled="page <= 1" @click="load(page - 1)">← {{ t("prevPage") }}</button>
        <span>{{ page }} / {{ pages }} ({{ total }})</span>
        <button :disabled="page >= pages" @click="load(page + 1)">{{ t("nextPage") }} →</button>
      </div>
    </template>

    <ReceiptModal
      v-if="selectedReceipt"
      :order="selectedReceipt"
      :shop-name="props.shopName"
      @close="selectedReceipt = null"
    />
  </div>
</template>

<style scoped>
.order-history {
  max-width: 700px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.filters input,
.filters select {
  padding: 6px 8px;
  border: 1px solid #e0d5c8;
  border-radius: 6px;
}
.empty {
  color: #999;
}
.error {
  color: #b03a2e;
}
.order-card {
  background: #fffaf3;
  border: 1px solid #e0d5c8;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
}
.order-card.cancelled {
  opacity: 0.6;
}
.order-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #8a6d3b;
  margin-bottom: 8px;
}
.customer {
  margin: 0 0 6px;
  font-size: 0.9rem;
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
.badge {
  background: #fdecea;
  color: #b03a2e;
  border-radius: 6px;
  padding: 2px 6px;
  font-size: 0.75rem;
  margin-left: 6px;
}
.order-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.receipt-btn {
  min-height: 40px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: #b5651d;
  color: white;
  cursor: pointer;
}
.cancel-btn {
  min-height: 40px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: #b03a2e;
  color: white;
  cursor: pointer;
}
.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
