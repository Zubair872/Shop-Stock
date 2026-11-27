<script setup>
import { computed } from "vue";
import { t } from "../i18n.js";

const props = defineProps({
  order: { type: Object, required: true },
  shopName: { type: String, default: "Shop-Stock" },
});

const emit = defineEmits(["close"]);

const shortOrderId = computed(() =>
  String(props.order.id || "").slice(-6).toUpperCase()
);

const paymentLabel = computed(() => {
  const labels = {
    cash: t("payCash"),
    card: t("payCard"),
    wallet: t("payWallet"),
    udhaar: t("payUdhaar"),
  };
  return labels[props.order.paymentMethod] || props.order.paymentMethod;
});

function formatDate(iso) {
  return new Date(iso || Date.now()).toLocaleString();
}

function cleanPhoneForWhatsApp(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("03") && digits.length === 11) {
    return `92${digits.slice(1)}`;
  }
  return digits;
}

const whatsappUrl = computed(() => {
  const lines = [
    `*${props.shopName || "Shop-Stock"}*`,
    `Receipt #${shortOrderId.value}`,
    `Tareekh: ${formatDate(props.order.date)}`,
    props.order.customerName ? `Customer: ${props.order.customerName}` : "",
    "",
    ...props.order.items.map(
      (i) => `- ${i.name} x${i.qty} ${i.unit || "pcs"} = Rs. ${i.price * i.qty}`
    ),
    "",
    props.order.discount > 0 ? `Subtotal: Rs. ${props.order.subtotal}` : "",
    props.order.discount > 0 ? `Discount: Rs. ${props.order.discount}` : "",
    `*Total: Rs. ${props.order.total}*`,
    `Payment: ${paymentLabel.value}`,
    "Shukriya!",
  ].filter(Boolean);

  const phone = cleanPhoneForWhatsApp(props.order.customerPhone);
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(lines.join("\n"))}`;
});

function printReceipt() {
  window.print();
}
</script>

<template>
  <div class="receipt-backdrop" @click.self="emit('close')">
    <div class="receipt-box">
      <div class="receipt-sheet" id="printable-receipt">
        <h3>{{ shopName || "Shop-Stock" }}</h3>
        <p class="meta">Receipt #{{ shortOrderId }}</p>
        <p class="meta">{{ formatDate(order.date) }}</p>
        <p v-if="order.customerName || order.customerPhone" class="meta">
          Customer: {{ order.customerName }} {{ order.customerPhone }}
        </p>

        <div class="divider"></div>

        <div class="row head">
          <span>{{ t("item") }}</span>
          <span>{{ t("qty") }}</span>
          <span>{{ t("price") }}</span>
        </div>

        <div class="row" v-for="item in order.items" :key="item.id">
          <span>{{ item.name }}</span>
          <span>{{ item.qty }} {{ item.unit || "pcs" }}</span>
          <span>Rs. {{ item.price * item.qty }}</span>
        </div>

        <div class="divider"></div>

        <div v-if="order.discount > 0" class="summary-row">
          <span>{{ t("subtotal") }}</span>
          <span>Rs. {{ order.subtotal }}</span>
        </div>
        <div v-if="order.discount > 0" class="summary-row">
          <span>{{ t("discountLabel") }}</span>
          <span>Rs. {{ order.discount }}</span>
        </div>
        <div class="summary-row total">
          <span>{{ t("total") }}</span>
          <span>Rs. {{ order.total }}</span>
        </div>
        <div class="summary-row">
          <span>{{ t("payment") }}</span>
          <span>{{ paymentLabel }}</span>
        </div>
      </div>

      <div class="receipt-actions no-print">
        <button class="print-btn" @click="printReceipt">{{ t("printReceipt") }}</button>
        <a
          class="wa-btn"
          :href="whatsappUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t("waShare") }}
        </a>
        <button class="close-btn" @click="emit('close')">{{ t("closeBtn") }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.receipt-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  z-index: 1000;
}
.receipt-box {
  background: white;
  border-radius: 12px;
  padding: 20px;
  width: 100%;
  max-width: 380px;
  max-height: 90vh;
  overflow-y: auto;
}
.receipt-sheet h3 {
  margin: 0 0 4px;
  text-align: center;
  color: #b5651d;
}
.meta {
  margin: 2px 0;
  text-align: center;
  font-size: 0.85rem;
  color: #555;
}
.divider {
  border-top: 1px dashed #ccc;
  margin: 10px 0;
}
.row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px;
  font-size: 0.9rem;
  padding: 4px 0;
}
.row.head {
  font-weight: bold;
  color: #555;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 0.95rem;
}
.summary-row.total {
  font-size: 1.15rem;
  font-weight: bold;
  margin-top: 4px;
}
.receipt-actions {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}
.print-btn,
.wa-btn,
.close-btn {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  text-align: center;
  text-decoration: none;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
.print-btn {
  background: #b5651d;
  color: white;
}
.wa-btn {
  background: #25d366;
  color: white;
  line-height: 24px;
}
.close-btn {
  background: #eee;
  color: #333;
}
@media print {
  .no-print {
    display: none !important;
  }
  .receipt-backdrop {
    position: static;
    background: none;
    padding: 0;
  }
  .receipt-box {
    box-shadow: none;
    max-width: 100%;
    padding: 0;
  }
}
</style>
