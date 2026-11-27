<script setup>
import { computed, reactive } from "vue";
import { t } from "../i18n.js";

const props = defineProps({
  cartItems: {
    type: Array,
    required: true,
  },
  customers: {
    type: Array,
    default: () => [],
  },
  busy: { type: Boolean, default: false },
  offline: { type: Boolean, default: false },
});

const details = reactive({
  customerId: "",
  customerName: "",
  customerPhone: "",
  paymentMethod: "cash",
  discount: "",
});

const emit = defineEmits(["checkout", "remove-item", "update-qty"]);

const subtotal = computed(() =>
  props.cartItems.reduce((sum, item) => sum + item.price * item.qty, 0)
);
const discountValue = computed(() => Math.max(Number(details.discount) || 0, 0));
const total = computed(() => Math.max(subtotal.value - discountValue.value, 0));

const selectedCustomer = computed(() =>
  props.customers.find((c) => c.id === details.customerId) || null
);

const limitExceeded = computed(() => {
  if (details.paymentMethod !== "udhaar" || !selectedCustomer.value) return false;
  return selectedCustomer.value.balance + total.value > selectedCustomer.value.creditLimit;
});

function changeQty(item, delta) {
  const step = ["kg", "litre"].includes(item.unit) ? 0.5 : 1;
  const next = Math.round((item.qty + delta * step) * 1000) / 1000;
  emit("update-qty", { id: item.id, qty: next });
}

function handleCheckout() {
  if (props.cartItems.length === 0 || props.busy) return;
  if (discountValue.value > subtotal.value) {
    alert(t("errDiscount"));
    return;
  }
  if (details.paymentMethod === "udhaar") {
    if (!details.customerId) {
      alert(t("errSelectCustomer"));
      return;
    }
    if (limitExceeded.value) {
      alert(t("errLimitCross"));
      return;
    }
  }
  emit("checkout", {
    customerId: details.paymentMethod === "udhaar" ? details.customerId : "",
    customerName: details.customerName.trim(),
    customerPhone: details.customerPhone.trim(),
    paymentMethod: details.paymentMethod,
    discount: discountValue.value,
  });
  details.customerId = "";
  details.customerName = "";
  details.customerPhone = "";
  details.paymentMethod = "cash";
  details.discount = "";
}
</script>

<template>
  <div class="cart">
    <h3>{{ t("cartTitle") }}</h3>

    <p v-if="cartItems.length === 0" class="empty">{{ t("cartEmpty") }}</p>

    <div v-else>
      <div class="cart-item" v-for="item in cartItems" :key="item.id">
        <div class="item-info">
          <strong>{{ item.name }}</strong>
          <small>Rs. {{ item.price }} / {{ item.unit || "pcs" }}</small>
        </div>

        <div class="qty-controls">
          <button type="button" class="qty-btn" @click="changeQty(item, -1)">-</button>
          <span>{{ item.qty }}</span>
          <button
            type="button"
            class="qty-btn"
            :disabled="item.qty >= item.stock"
            @click="changeQty(item, 1)"
          >
            +
          </button>
        </div>

        <span class="line-total">Rs. {{ Math.round(item.price * item.qty) }}</span>
        <button type="button" class="remove-btn" @click="emit('remove-item', item.id)">
          ✕
        </button>
      </div>

      <div class="details">
        <div class="payment-grid">
          <button
            type="button"
            :class="['pay-opt', { active: details.paymentMethod === 'cash' }]"
            @click="details.paymentMethod = 'cash'"
          >
            {{ t("payCash") }}
          </button>
          <button
            type="button"
            :class="['pay-opt', { active: details.paymentMethod === 'card' }]"
            @click="details.paymentMethod = 'card'"
          >
            {{ t("payCard") }}
          </button>
          <button
            type="button"
            :class="['pay-opt', { active: details.paymentMethod === 'wallet' }]"
            @click="details.paymentMethod = 'wallet'"
          >
            {{ t("payWallet") }}
          </button>
          <button
            type="button"
            :disabled="offline"
            :class="['pay-opt udhaar', { active: details.paymentMethod === 'udhaar' }]"
            @click="details.paymentMethod = 'udhaar'"
          >
            {{ t("payUdhaar") }}
          </button>
        </div>
        <p v-if="offline" class="warn">{{ t("offlineUdhaarDisabled") }}</p>

        <template v-if="details.paymentMethod === 'udhaar'">
          <select v-model="details.customerId" required>
            <option value="">{{ t("selectCustomer") }}</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">
              {{ c.name }} ({{ c.phone }}) — Rs. {{ c.balance }} / {{ c.creditLimit }}
            </option>
          </select>

          <p v-if="customers.length === 0" class="warn">
            {{ t("noCustomerYet") }}
          </p>
          <p v-else-if="limitExceeded" class="warn">
            {{ t("limitExceededWarn", { bal: selectedCustomer.balance, limit: selectedCustomer.creditLimit }) }}
          </p>
        </template>

        <template v-else>
          <input
            v-model="details.customerName"
            :placeholder="t('custNameOpt')"
            maxlength="100"
          />
          <input
            v-model="details.customerPhone"
            :placeholder="t('phoneOpt')"
            maxlength="30"
          />
        </template>

        <input v-model="details.discount" type="number" min="0" :placeholder="t('discountRs')" />
      </div>

      <div class="total">
        <span v-if="discountValue > 0">{{ t("subtotal") }}: Rs. {{ subtotal }}<br /></span>
        <strong>{{ t("total") }}: Rs. {{ total }}</strong>
      </div>

      <button
        class="checkout-btn"
        :disabled="busy || limitExceeded"
        @click="handleCheckout"
      >
        {{ busy ? t("processing") : t("confirmOrder") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.cart {
  background: #fdf5e6;
  padding: 16px;
  border-radius: 10px;
  position: sticky;
  top: 16px;
}
.cart h3 {
  margin: 0 0 10px;
}
.empty {
  color: #999;
}
.cart-item {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e6dac8;
  gap: 8px;
}
.item-info strong,
.item-info small {
  display: block;
}
.item-info small {
  color: #777;
  font-size: 0.78rem;
}
.qty-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}
.qty-btn {
  min-width: 34px;
  min-height: 34px;
  border: 1px solid #d5c3aa;
  background: white;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
}
.qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.line-total {
  font-weight: 600;
  font-size: 0.9rem;
}
.remove-btn {
  background: transparent;
  border: none;
  color: #c0392b;
  font-size: 1rem;
  min-width: 32px;
  min-height: 32px;
  cursor: pointer;
}
.details {
  display: grid;
  gap: 8px;
  margin: 12px 0;
}
.payment-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.pay-opt {
  min-height: 42px;
  border: 1px solid #d5c3aa;
  background: white;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.pay-opt.active {
  background: #b5651d;
  color: white;
  border-color: #b5651d;
}
.pay-opt.udhaar.active {
  background: #b03a2e;
  border-color: #b03a2e;
}
.details input,
.details select {
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid #e0d5c8;
  border-radius: 6px;
  width: 100%;
}
.warn {
  margin: 0;
  color: #b03a2e;
  font-size: 0.85rem;
  font-weight: 600;
}
.total {
  margin-top: 10px;
  font-size: 1.15rem;
}
.checkout-btn {
  width: 100%;
  min-height: 48px;
  margin-top: 12px;
  padding: 12px;
  background: #2e7d32;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
}
.checkout-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
