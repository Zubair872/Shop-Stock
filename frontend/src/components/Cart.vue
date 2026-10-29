<script setup>
import { computed, reactive } from "vue";

const props = defineProps({
  cartItems: {
    type: Array,
    required: true,
  },
  busy: { type: Boolean, default: false },
});

const details = reactive({ customerName: "", customerPhone: "", paymentMethod: "cash", discount: "" });

const emit = defineEmits(["checkout", "remove-item"]);

// computed: total automatically recalculate hota hai jab bhi cartItems badle
const subtotal = computed(() =>
  props.cartItems.reduce((sum, item) => sum + item.price * item.qty, 0)
);
const discountValue = computed(() => Math.max(Number(details.discount) || 0, 0));
const total = computed(() => Math.max(subtotal.value - discountValue.value, 0));

function handleCheckout() {
  if (props.cartItems.length === 0 || props.busy) return;
  if (discountValue.value > subtotal.value) {
    alert("Discount total se zyada nahi ho sakta");
    return;
  }
  emit("checkout", { ...details, discount: discountValue.value });
}
</script>

<template>
  <div class="cart">
    <h3>🛒 Cart</h3>

    <!-- agar cart khaali hai -->
    <p v-if="cartItems.length === 0" class="empty">Cart khaali hai</p>

    <!-- warna har item dikhao -->
    <div v-else>
      <div class="cart-item" v-for="item in cartItems" :key="item.id">
        <span>{{ item.name }} x{{ item.qty }}</span>
        <span>Rs. {{ item.price * item.qty }}</span>
        <button @click="emit('remove-item', item.id)">✕</button>
      </div>

      <div class="details">
        <input v-model="details.customerName" placeholder="Customer ka naam (optional)" maxlength="100" />
        <input v-model="details.customerPhone" placeholder="Phone (optional)" maxlength="30" />
        <select v-model="details.paymentMethod">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="wallet">Easypaisa / JazzCash</option>
        </select>
        <input v-model="details.discount" type="number" min="0" placeholder="Discount (Rs.)" />
      </div>

      <div class="total">
        <span v-if="discountValue > 0">Subtotal: Rs. {{ subtotal }}<br /></span>
        <strong>Total: Rs. {{ total }}</strong>
      </div>

      <button class="checkout-btn" :disabled="busy" @click="handleCheckout">
        {{ busy ? "Ho raha hai..." : "Order Confirm Karein" }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.details {
  display: grid;
  gap: 6px;
  margin: 10px 0;
}
.details input,
.details select {
  padding: 6px 8px;
  border: 1px solid #e0d5c8;
  border-radius: 6px;
}
.checkout-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.cart {
  background: #fdf5e6;
  padding: 16px;
  border-radius: 10px;
  position: sticky;
  top: 16px;
}
.empty {
  color: #999;
}
.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #eee;
  gap: 8px;
}
.cart-item button {
  background: transparent;
  border: none;
  color: #c0392b;
  cursor: pointer;
}
.total {
  margin-top: 10px;
  font-size: 1.1rem;
}
.checkout-btn {
  width: 100%;
  margin-top: 10px;
  padding: 10px;
  background: #b5651d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
</style>
