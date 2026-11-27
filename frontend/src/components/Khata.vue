<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { t } from "../i18n.js";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  getCustomerLedger,
  recordCustomerPayment,
  reverseLedgerEntry,
  errorMessage,
} from "../services/api.js";

const props = defineProps({
  shopName: { type: String, default: "Shop-Stock" },
  role: { type: String, default: "viewer" },
});

const emit = defineEmits(["customers-changed"]);

const canWrite = computed(() =>
  ["owner", "admin", "manager", "cashier"].includes(props.role)
);
const canManage = computed(() =>
  ["owner", "admin", "manager"].includes(props.role)
);

const customers = ref([]);
const loading = ref(true);
const error = ref("");
const search = ref("");
const onlyUdhaar = ref(true);

const newForm = reactive({ name: "", phone: "", creditLimit: 5000 });
const adding = ref(false);

const activePaymentId = ref(null);
const paymentForm = reactive({ amount: "", note: "" });
const paymentBusy = ref(false);

const editingId = ref(null);
const editLimit = ref("");

const ledgerCustomer = ref(null);
const ledgerEntries = ref([]);
const ledgerLoading = ref(false);

const totalUdhaar = computed(() =>
  customers.value.reduce((sum, c) => sum + (c.balance || 0), 0)
);

const filteredCustomers = computed(() => {
  const q = search.value.trim().toLowerCase();
  return customers.value.filter((c) => {
    if (onlyUdhaar.value && c.balance <= 0) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);
  });
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    customers.value = await getCustomers();
    emit("customers-changed", customers.value);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  if (!newForm.name.trim() || !newForm.phone.trim()) return;
  adding.value = true;
  try {
    await createCustomer({
      name: newForm.name.trim(),
      phone: newForm.phone.trim(),
      creditLimit: Number(newForm.creditLimit) || 0,
    });
    newForm.name = "";
    newForm.phone = "";
    newForm.creditLimit = 5000;
    await load();
  } catch (e) {
    alert(errorMessage(e));
  } finally {
    adding.value = false;
  }
}

function openPayment(customer) {
  activePaymentId.value = customer.id;
  paymentForm.amount = customer.balance;
  paymentForm.note = "";
}

async function submitPayment(customer) {
  const amount = Number(paymentForm.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    alert(t("validReturnAmount"));
    return;
  }
  paymentBusy.value = true;
  try {
    await recordCustomerPayment(customer.id, {
      amount,
      note: paymentForm.note.trim(),
    });
    activePaymentId.value = null;
    await load();
    if (ledgerCustomer.value?.id === customer.id) {
      await openLedger(customer);
    }
  } catch (e) {
    alert(errorMessage(e));
  } finally {
    paymentBusy.value = false;
  }
}

function startEditLimit(customer) {
  editingId.value = customer.id;
  editLimit.value = customer.creditLimit;
}

async function saveLimit(customer) {
  try {
    await updateCustomer(customer.id, { creditLimit: Number(editLimit.value) });
    editingId.value = null;
    await load();
  } catch (e) {
    alert(errorMessage(e));
  }
}

async function openLedger(customer) {
  ledgerCustomer.value = customer;
  ledgerLoading.value = true;
  try {
    const data = await getCustomerLedger(customer.id);
    ledgerCustomer.value = data.customer;
    ledgerEntries.value = data.entries;
  } catch (e) {
    alert(errorMessage(e));
  } finally {
    ledgerLoading.value = false;
  }
}

async function handleReverse(entry) {
  if (!ledgerCustomer.value) return;
  if (!confirm(t("confirmReverse", { amount: entry.amount }))) return;
  try {
    await reverseLedgerEntry(ledgerCustomer.value.id, entry.id, "Ghalti ki wapsi");
    await load();
    await openLedger(ledgerCustomer.value);
  } catch (e) {
    alert(errorMessage(e));
  }
}

function whatsappReminderUrl(customer) {
  const digits = String(customer.phone || "").replace(/\D/g, "");
  const cleanPhone =
    digits.startsWith("03") && digits.length === 11 ? `92${digits.slice(1)}` : digits;
  const text = `Assalam-o-Alaikum ${customer.name}, ${props.shopName} par aap ka udhaar Rs. ${customer.balance} baqi hai. Meharbani farma kar ada kar dein. Shukriya!`;
  const base = cleanPhone ? `https://wa.me/${cleanPhone}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

function entryTypeLabel(type) {
  if (type === "udhaar_sale") return t("udhaarSaleLabel");
  if (type === "payment") return t("paymentWapsiBtn");
  return t("reverseBtn");
}

onMounted(load);
</script>

<template>
  <div class="khata">
    <div class="khata-head">
      <div>
        <h2>{{ t("khataTitle") }}</h2>
        <p class="summary">{{ t("totalUdhaarLabel") }}: <strong>Rs. {{ totalUdhaar }}</strong></p>
      </div>
      <div class="view-toggle">
        <button :class="{ active: onlyUdhaar }" @click="onlyUdhaar = true">
          {{ t("topUdhaarBtn") }}
        </button>
        <button :class="{ active: !onlyUdhaar }" @click="onlyUdhaar = false">
          {{ t("allCustomersBtn") }}
        </button>
      </div>
    </div>

    <form v-if="canWrite" class="customer-form" @submit.prevent="handleCreate">
      <input v-model="newForm.name" :placeholder="t('custName')" required maxlength="100" />
      <input v-model="newForm.phone" :placeholder="t('custPhone')" required maxlength="30" />
      <input
        v-model="newForm.creditLimit"
        type="number"
        min="0"
        :placeholder="t('creditLimit')"
        required
      />
      <button type="submit" :disabled="adding">
        {{ adding ? t("saving") : t("newCustomerBtn") }}
      </button>
    </form>

    <input
      v-model="search"
      class="search-input"
      :placeholder="t('searchCustomer')"
    />

    <p v-if="loading">{{ t("loading") }}</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="filteredCustomers.length === 0" class="empty">{{ t("noCustomerFound") }}</p>

    <div v-else class="customer-list">
      <div class="customer-card" v-for="c in filteredCustomers" :key="c.id">
        <div class="customer-top">
          <div>
            <h3>{{ c.name }}</h3>
            <p class="phone">{{ c.phone }}</p>
          </div>
          <div class="balance-box">
            <span class="bal-label">{{ t("dueBalance") }}</span>
            <strong :class="c.balance > 0 ? 'due' : 'clear'">Rs. {{ c.balance }}</strong>
            <small>{{ t("limitShort") }}: Rs. {{ c.creditLimit }}</small>
          </div>
        </div>

        <div v-if="editingId === c.id" class="inline-box">
          <input v-model="editLimit" type="number" min="0" :placeholder="t('newLimitPlaceholder')" />
          <button class="save-btn" @click="saveLimit(c)">{{ t("saveBtn") }}</button>
          <button class="cancel-btn" @click="editingId = null">{{ t("cancelBtn") }}</button>
        </div>

        <div v-if="activePaymentId === c.id" class="inline-box">
          <input
            v-model="paymentForm.amount"
            type="number"
            min="1"
            :max="c.balance"
            :placeholder="t('wapsiAmount')"
          />
          <input v-model="paymentForm.note" :placeholder="t('noteOpt')" maxlength="200" />
          <button class="save-btn" :disabled="paymentBusy" @click="submitPayment(c)">
            {{ paymentBusy ? t("saving") : t("saveWapsi") }}
          </button>
          <button class="cancel-btn" @click="activePaymentId = null">{{ t("cancelBtn") }}</button>
        </div>

        <div class="actions">
          <button
            v-if="canWrite && c.balance > 0"
            class="pay-btn"
            @click="openPayment(c)"
          >
            {{ t("paymentWapsiBtn") }}
          </button>
          <button class="ledger-btn" @click="openLedger(c)">{{ t("ledgerBtn") }}</button>
          <a
            v-if="c.balance > 0"
            class="wa-btn"
            :href="whatsappReminderUrl(c)"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t("waReminderBtn") }}
          </a>
          <button v-if="canManage" class="limit-btn" @click="startEditLimit(c)">
            {{ t("changeLimitBtn") }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="ledgerCustomer" class="ledger-backdrop" @click.self="ledgerCustomer = null">
      <div class="ledger-modal">
        <div class="ledger-head">
          <div>
            <h3>{{ ledgerCustomer.name }} — {{ t("tabKhata") }}</h3>
            <p class="phone">{{ ledgerCustomer.phone }} · {{ t("dueBalance") }}: Rs. {{ ledgerCustomer.balance }}</p>
          </div>
          <button class="close-btn" @click="ledgerCustomer = null">✕</button>
        </div>

        <p v-if="ledgerLoading">{{ t("loading") }}</p>
        <p v-else-if="ledgerEntries.length === 0" class="empty">{{ t("noEntryYet") }}</p>

        <div v-else class="entries">
          <div class="entry" v-for="entry in ledgerEntries" :key="entry.id">
            <div>
              <strong>{{ entryTypeLabel(entry.type) }}</strong>
              <span v-if="entry.isReversed" class="rev-badge">{{ t("reversedBadge") }}</span>
              <small class="entry-meta">
                {{ new Date(entry.date).toLocaleString() }}
                <span v-if="entry.note">· {{ entry.note }}</span>
              </small>
            </div>
            <div class="entry-right">
              <strong :class="entry.delta > 0 ? 'due' : 'clear'">
                {{ entry.delta > 0 ? `+Rs. ${entry.amount}` : `-Rs. ${entry.amount}` }}
              </strong>
              <small>Balance: Rs. {{ entry.balanceAfter }}</small>
              <button
                v-if="canManage && entry.type === 'payment' && !entry.isReversed"
                class="rev-btn"
                @click="handleReverse(entry)"
              >
                {{ t("reverseBtn") }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.khata {
  max-width: 900px;
}
.khata-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}
.khata-head h2 {
  margin: 0;
}
.summary {
  margin: 4px 0 0;
  color: #8a6d3b;
}
.view-toggle {
  display: flex;
  gap: 8px;
}
.view-toggle button {
  min-height: 42px;
  padding: 8px 14px;
  border: 1px solid #d5c3aa;
  background: white;
  border-radius: 8px;
  cursor: pointer;
}
.view-toggle button.active {
  background: #b5651d;
  color: white;
  border-color: #b5651d;
  font-weight: bold;
}
.customer-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: #fff3e0;
  padding: 14px;
  border-radius: 10px;
  margin-bottom: 14px;
}
.customer-form input {
  flex: 1;
  min-width: 150px;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.customer-form button {
  min-height: 44px;
  padding: 10px 16px;
  background: #2e7d32;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.search-input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  margin-bottom: 14px;
  font-size: 1rem;
}
.customer-list {
  display: grid;
  gap: 12px;
}
.customer-card {
  background: #fffaf3;
  border: 1px solid #e0d5c8;
  border-radius: 10px;
  padding: 14px;
}
.customer-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.customer-top h3 {
  margin: 0 0 4px;
}
.phone {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}
.balance-box {
  text-align: right;
}
.bal-label,
.balance-box small {
  display: block;
  font-size: 0.8rem;
  color: #777;
}
.due {
  color: #b03a2e;
}
.clear {
  color: #2e7d32;
}
.inline-box {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e0d5c8;
}
.inline-box input {
  flex: 1;
  min-width: 120px;
  min-height: 42px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.actions button,
.wa-btn,
.save-btn,
.cancel-btn {
  min-height: 44px;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.pay-btn,
.save-btn {
  background: #2e7d32;
}
.ledger-btn {
  background: #b5651d;
}
.wa-btn {
  background: #25d366;
}
.limit-btn {
  background: #8a6d3b;
}
.cancel-btn {
  background: #999;
}
.error {
  color: #b03a2e;
}
.empty {
  color: #999;
}
.ledger-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  z-index: 1000;
}
.ledger-modal {
  background: white;
  border-radius: 12px;
  padding: 18px;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
}
.ledger-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.ledger-head h3 {
  margin: 0 0 4px;
}
.close-btn {
  min-width: 38px;
  min-height: 38px;
  border: none;
  background: #eee;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
}
.entries {
  display: grid;
  gap: 8px;
}
.entry {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  background: #fffaf3;
  border: 1px solid #e0d5c8;
  border-radius: 8px;
}
.entry-meta {
  display: block;
  color: #777;
  font-size: 0.8rem;
  margin-top: 2px;
}
.entry-right {
  text-align: right;
}
.entry-right small {
  display: block;
  color: #666;
  font-size: 0.78rem;
}
.rev-badge {
  margin-left: 6px;
  background: #fdecea;
  color: #b03a2e;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
}
.rev-btn {
  margin-top: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  background: #b03a2e;
  color: white;
  font-size: 0.8rem;
  cursor: pointer;
}
</style>
