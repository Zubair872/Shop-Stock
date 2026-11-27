<script setup>
import { ref, computed, onMounted } from "vue";
import { getExpenses, createExpense, deleteExpense, errorMessage } from "../services/api.js";
import { t } from "../i18n.js";

const expenses = ref([]);
const total = ref(0);
const loading = ref(true);
const saving = ref(false);

const category = ref("kiraya");
const amount = ref("");
const note = ref("");
const dateKey = ref(new Date().toISOString().slice(0, 10));
const filterCat = ref("");

const categoryLabels = computed(() => ({
  kiraya: t("catKiraya"),
  bijli: t("catBijli"),
  tankhwah: t("catTankhwah"),
  transport: t("catTransport"),
  other: t("catOther"),
}));

const money = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

const filteredExpenses = computed(() => {
  if (!filterCat.value) return expenses.value;
  return expenses.value.filter((e) => e.category === filterCat.value);
});

const filteredTotal = computed(() =>
  filteredExpenses.value.reduce((sum, e) => sum + e.amount, 0)
);

async function load() {
  loading.value = true;
  try {
    const data = await getExpenses();
    expenses.value = data.expenses;
    total.value = data.total;
  } catch (e) {
    alert(errorMessage(e));
  } finally {
    loading.value = false;
  }
}

async function handleAdd() {
  const amt = Number(amount.value);
  if (!Number.isFinite(amt) || amt <= 0 || saving.value) return;
  saving.value = true;
  try {
    const created = await createExpense({
      category: category.value,
      amount: amt,
      note: note.value.trim(),
      dateKey: dateKey.value,
    });
    expenses.value.unshift(created);
    total.value += created.amount;
    amount.value = "";
    note.value = "";
  } catch (e) {
    alert(errorMessage(e));
  } finally {
    saving.value = false;
  }
}

async function handleDelete(id) {
  if (!confirm(t("confirmDeleteExpense"))) return;
  try {
    await deleteExpense(id);
    expenses.value = expenses.value.filter((e) => e.id !== id);
  } catch (e) {
    alert(errorMessage(e));
  }
}

onMounted(load);
</script>

<template>
  <div class="expenses">
    <div class="top-bar">
      <div>
        <h2>{{ t("expensesTitle") }}</h2>
        <p class="sub">{{ t("totalExpensesLabel") }}: <strong>{{ money(filteredTotal) }}</strong></p>
      </div>
    </div>

    <form class="card form-box" @submit.prevent="handleAdd">
      <h3>{{ t("addExpenseTitle") }}</h3>
      <div class="row">
        <select v-model="category">
          <option v-for="(label, key) in categoryLabels" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
        <input v-model.number="amount" type="number" step="0.01" min="0.01" :placeholder="t('amountRsReq')" required />
        <input v-model="dateKey" type="date" required />
        <input v-model="note" :placeholder="t('expenseNotePlaceholder')" />
      </div>
      <button class="btn primary" type="submit" :disabled="saving">
        {{ saving ? t("saving") : t("saveExpenseBtn") }}
      </button>
    </form>

    <div class="filter-row">
      <button :class="['chip', { active: filterCat === '' }]" @click="filterCat = ''">{{ t("all") }}</button>
      <button
        v-for="(label, key) in categoryLabels"
        :key="key"
        :class="['chip', { active: filterCat === key }]"
        @click="filterCat = key"
      >
        {{ label }}
      </button>
    </div>

    <p v-if="loading">{{ t("loading") }}</p>

    <div v-else class="list">
      <div v-for="e in filteredExpenses" :key="e.id" class="card exp-row">
        <div>
          <strong>{{ categoryLabels[e.category] || e.category }}</strong>
          <div class="meta">{{ e.dateKey }} <span v-if="e.note">· {{ e.note }}</span></div>
        </div>
        <div class="right-col">
          <strong class="amt">{{ money(e.amount) }}</strong>
          <button class="btn danger" @click="handleDelete(e.id)">{{ t("delBtn") }}</button>
        </div>
      </div>
      <p v-if="filteredExpenses.length === 0" class="meta">{{ t("noExpenseYet") }}</p>
    </div>
  </div>
</template>

<style scoped>
.expenses {
  max-width: 800px;
  margin: 0 auto;
}
.top-bar h2 {
  margin: 0;
}
.sub {
  margin: 4px 0 16px;
  color: #8a6d3b;
}
.card {
  background: white;
  border: 1px solid #e6d7c3;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
}
.form-box h3 {
  margin: 0 0 12px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.row input,
.row select {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 0.95rem;
  flex: 1;
  min-width: 140px;
}
.btn {
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #c8a97a;
  background: #fff3e0;
  cursor: pointer;
  font-size: 0.95rem;
}
.btn.primary {
  background: #b5651d;
  color: white;
  border-color: #b5651d;
  font-weight: bold;
}
.btn.danger {
  background: #fdecea;
  color: #b03a2e;
  border-color: #f5c6cb;
  min-height: 40px;
  padding: 6px 12px;
}
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.chip {
  min-height: 40px;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid #d5c3aa;
  background: #fffaf3;
  cursor: pointer;
}
.chip.active {
  background: #b5651d;
  color: white;
  border-color: #b5651d;
  font-weight: bold;
}
.exp-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.right-col {
  display: flex;
  align-items: center;
  gap: 12px;
}
.amt {
  font-size: 1.05rem;
  color: #b03a2e;
}
.meta {
  font-size: 0.82rem;
  color: #666;
}
</style>
