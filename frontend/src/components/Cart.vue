<script setup>
import { computed } from "vue";

const props = defineProps({
  cartItems: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["checkout", "remove-item"]);

// computed: total automatically recalculate hota hai jab bhi cartItems badle
const total = computed(() =>
  props.cartItems.reduce((sum, item) => sum + item.price * item.qty, 0)
);

function handleCheckout() {
  if (props.cartItems.length === 0) return;
  emit("checkout");
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

      <div class="total">
        <strong>Total: Rs. {{ total }}</strong>
      </div>

      <button class="checkout-btn" @click="handleCheckout">
        Order Confirm Karein
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
