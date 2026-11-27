<script setup>
import { ref, computed, onMounted } from "vue";
import { t } from "../i18n.js";
import {
  getSuppliers,
  createSupplier,
  getSupplierLedger,
  paySupplier,
  getPurchases,
  createPurchase,
  errorMessage,
} from "../services/api.js";

const props = defineProps({
  products: { type: Array, default: () => [] },
});

const emit = defineEmits(["purchase-saved"]);

const suppliers = ref([]);
const purchases = ref([]);
const loading = ref(true);
const search = ref("");
const onlyDue = ref(false);

const showAddForm = ref(false);
const sName = ref("");
const sPhone = ref("");
const sAddress = ref("");
const savingSupplier = ref(false);

const showPurchaseForm = ref(false);
const pSupplierId = ref("");
const pItems = ref([{ productId: "", name: "", unit: "pcs", qty: 1, costPrice: 0 }]);
const pPaid = ref(0);
const pNote = ref("");
const pAddToStock = ref(true);
const savingPurchase = ref(false);

const activeSupplier = ref(null);
const ledgerEntries = ref([]);
const ledgerLoading = ref(false);
const payAmount = ref("");
const payNote = ref("");
const paying = ref(false);

const money = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

const totalPayable = computed(() =>
  suppliers.value.reduce((sum, s) => sum + (s.balance || 0), 0)
);

const filteredSuppliers = computed(() => {
  const q = search.value.trim().toLowerCase();
  return suppliers.value.filter((s) => {
    if (onlyDue.value && s.balance <= 0) return false;
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone && s.phone.toLowerCase().includes(q))
    );
  });
});

const purchaseTotal = computed(() =>
  pItems.value.reduce((sum, item) => {
    const qty = Number(item.qty) || 0;
    const cost = Number(item.costPrice) || 0;
    return sum + qty * cost;
  }, 0)
);

async function load() {
  loading.value = true;
  try {
    const [loadedSuppliers, loadedPurchases] = await Promise.all([
      getSuppliers(),
      getPurchases(),
    ]);
    suppliers.value = loadedSuppliers;
    purchases.value = loadedPurchases;
  } catch (e) {
    alert(errorMessage(e));
  } finally {
    loading.value = false;
  }
}

async function handleAddSupplier() {
  if (!sName.value.trim() || savingSupplier.value) return;
  savingSupplier.value = true;
  try {
    const created = await createSupplier({
      name: sName.value.trim(),
      phone: sPhone.value.trim(),
      address: sAddress.value.trim(),
    });
    suppliers.value.unshift(created);
    sName.value = "";
    sPhone.value = "";
    sAddress.value = "";
    showAddForm.value = false;
  } catch (e) {
    alert(errorMessage(e));
  } finally {
    savingSupplier.value = false;
  }
}

function addPurchaseRow() {
  pItems.value.push({ productId: "", name: "", unit: "pcs", qty: 1, costPrice: 0 });
}

function removePurchaseRow(index) {
  if (pItems.value.length > 1) {
    pItems.value.splice(index, 1);
  }
}

function onSelectProduct(row) {
  const prod = props.products.find((p) => p.id === row.productId);
  if (prod) {
    row.name = prod.name;
    row.unit = prod.unit;
    if (prod.costPrice > 0) {
      row.costPrice = prod.costPrice;
    }
  }
}

async function handleCreatePurchase() {
  if (!pSupplierId.value || savingPurchase.value) return;
  savingPurchase.value = true;
  try {
    const items = pItems.value.map((r) => ({
      productId: r.productId || undefined,
      name: r.name,
      unit: r.unit,
      qty: Number(r.qty),
      costPrice: Number(r.costPrice),
    }));
    await createPurchase({
      supplierId: pSupplierId.value,
      items,
      paid: Number(pPaid.value) || 0,
      note: pNote.value.trim(),
      addToStock: pAddToStock.value,
    });
    pItems.value = [{ productId: "", name: "", unit: "pcs", qty: 1, costPrice: 0 }];
    pPaid.value = 0;
    pNote.value = "";
    showPurchaseForm.value = false;
    await load();
    emit("purchase-saved");
  } catch (e) {
    alert(errorMessage(e));
  } finally {
    savingPurchase.value = false;
  }
}

async function openLedger(supplier) {
  activeSupplier.value = supplier;
  ledgerLoading.value = true;
  payAmount.value = "";
  payNote.value = "";
  try {
    const data = await getSupplierLedger(supplier.id);
    activeSupplier.value = data.supplier;
    ledgerEntries.value = data.entries;
  } catch (e) {
    alert(errorMessage(e));
  } finally {
    ledgerLoading.value = false;
  }
}

async function handlePaySupplier() {
  if (!activeSupplier.value || paying.value) return;
  const amount = Number(payAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    alert(t("validAmountMsg"));
    return;
  }
  paying.value = true;
  try {
    const data = await paySupplier(activeSupplier.value.id, {
      amount,
      note: payNote.value.trim(),
    });
    activeSupplier.value = data.supplier;
    ledgerEntries.value.unshift(data.entry);
    const idx = suppliers.value.findIndex((s) => s.id === data.supplier.id);
    if (idx !== -1) {
      suppliers.value[idx] = data.supplier;
    }
    payAmount.value = "";
    payNote.value = "";
  } catch (e) {
    alert(errorMessage(e));
  } finally {
    paying.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="suppliers">
    <div class="top-bar">
      <div>
        <h2>{{ t("suppliersTitle") }}</h2>
        <p class="total-due">{{ t("totalPayable") }}: <strong>{{ money(totalPayable) }}</strong></p>
      </div>
      <div class="actions">
        <button class="btn primary" @click="showPurchaseForm = !showPurchaseForm; showAddForm = false">
          {{ showPurchaseForm ? t("closeBtn") : t("newPurchaseBtn") }}
        </button>
        <button class="btn" @click="showAddForm = !showAddForm; showPurchaseForm = false">
          {{ showAddForm ? t("closeBtn") : t("newSupplierBtn") }}
        </button>
      </div>
    </div>

    <form v-if="showAddForm" class="card form-box" @submit.prevent="handleAddSupplier">
      <h3>{{ t("newSupplierTitle") }}</h3>
      <div class="row">
        <input v-model="sName" :placeholder="t('supplierNameReq')" required />
        <input v-model="sPhone" :placeholder="t('phonePlaceholder')" />
        <input v-model="sAddress" :placeholder="t('addressPlaceholder')" />
      </div>
      <button class="btn primary" type="submit" :disabled="savingSupplier">
        {{ savingSupplier ? t("saving") : t("saveSupplierBtn") }}
      </button>
    </form>

    <form v-if="showPurchaseForm" class="card form-box" @submit.prevent="handleCreatePurchase">
      <h3>{{ t("purchaseTitle") }}</h3>
      <div class="row">
        <select v-model="pSupplierId" required>
          <option value="" disabled>{{ t("chooseSupplier") }}</option>
          <option v-for="s in suppliers" :key="s.id" :value="s.id">
            {{ s.name }} ({{ money(s.balance) }})
          </option>
        </select>
        <label class="checkbox-label">
          <input type="checkbox" v-model="pAddToStock" />
          {{ t("autoAddStock") }}
        </label>
      </div>

      <div v-for="(row, idx) in pItems" :key="idx" class="item-row">
        <select v-model="row.productId" @change="onSelectProduct(row)">
          <option value="">{{ t("customItemOption") }}</option>
          <option v-for="p in products" :key="p.id" :value="p.id">
            {{ p.name }} ({{ p.unit }})
          </option>
        </select>
        <input v-if="!row.productId" v-model="row.name" :placeholder="t('itemNameReq')" required />
        <input v-model.number="row.qty" type="number" step="0.001" min="0.001" :placeholder="t('qtyPlaceholder')" required />
        <input v-model.number="row.costPrice" type="number" step="0.01" min="0" :placeholder="t('costPrice')" required />
        <button type="button" class="btn danger" @click="removePurchaseRow(idx)">X</button>
      </div>

      <button type="button" class="btn" @click="addPurchaseRow">{{ t("addMoreItem") }}</button>

      <div class="row summary-row">
        <div>{{ t("totalBill") }}: <strong>{{ money(purchaseTotal) }}</strong></div>
        <div>
          <label>{{ t("paidAmountLabel") }}:</label>
          <input v-model.number="pPaid" type="number" step="0.01" min="0" />
        </div>
        <input v-model="pNote" :placeholder="t('billNotePlaceholder')" />
      </div>

      <button class="btn primary" type="submit" :disabled="savingPurchase || !pSupplierId">
        {{ savingPurchase ? t("saving") : t("savePurchaseBtn") }}
      </button>
    </form>

    <div class="filter-bar">
      <input v-model="search" :placeholder="t('searchSupplierPlaceholder')" />
      <label class="checkbox-label">
        <input type="checkbox" v-model="onlyDue" />
        {{ t("onlyDueSuppliers") }}
      </label>
    </div>

    <p v-if="loading">{{ t("loading") }}</p>

    <div v-else class="list">
      <div v-for="s in filteredSuppliers" :key="s.id" class="card supplier-card">
        <div>
          <strong>{{ s.name }}</strong>
          <div class="meta">{{ s.phone || t("noPhone") }} <span v-if="s.address">· {{ s.address }}</span></div>
        </div>
        <div class="right-col">
          <div :class="['bal', { due: s.balance > 0 }]">{{ money(s.balance) }}</div>
          <button class="btn" @click="openLedger(s)">{{ t("ledgerBtn") }}</button>
        </div>
      </div>
      <p v-if="filteredSuppliers.length === 0" class="meta">{{ t("noSupplierFound") }}</p>
    </div>

    <div v-if="purchases.length > 0" class="history-box">
      <h3>{{ t("recentPurchases") }}</h3>
      <div v-for="p in purchases.slice(0, 15)" :key="p.id" class="card purchase-row">
        <div>
          <strong>{{ p.supplierName }}</strong> — {{ p.items.map(i => `${i.name} x${i.qty}`).join(", ") }}
          <div class="meta">{{ new Date(p.date).toLocaleString("en-PK") }} <span v-if="p.note">· {{ p.note }}</span></div>
        </div>
        <div class="right-col">
          <div>{{ t("total") }}: <strong>{{ money(p.total) }}</strong></div>
          <div class="meta">{{ money(p.paid) }} | {{ money(p.due) }}</div>
        </div>
      </div>
    </div>

    <div v-if="activeSupplier" class="modal-backdrop" @click.self="activeSupplier = null">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ activeSupplier.name }} — {{ t("tabKhata") }}</h3>
          <button class="btn" @click="activeSupplier = null">{{ t("closeBtn") }}</button>
        </div>
        <p class="total-due">{{ t("totalPayable") }}: <strong>{{ money(activeSupplier.balance) }}</strong></p>

        <form v-if="activeSupplier.balance > 0" class="pay-form" @submit.prevent="handlePaySupplier">
          <input v-model.number="payAmount" type="number" step="0.01" min="0.01" :placeholder="t('payAmountPlaceholder')" required />
          <input v-model="payNote" :placeholder="t('payNotePlaceholder')" />
          <button class="btn primary" type="submit" :disabled="paying">
            {{ paying ? t("saving") : t("payBtn") }}
          </button>
        </form>

        <p v-if="ledgerLoading">{{ t("loading") }}</p>
        <div v-else class="ledger-list">
          <div v-for="e in ledgerEntries" :key="e.id" class="ledger-row">
            <div>
              <strong>{{ e.type === "purchase" ? t("purchaseTitle") : t("payBtn") }}</strong>
              <div class="meta">{{ new Date(e.date).toLocaleString("en-PK") }} · {{ e.note }}</div>
            </div>
            <div class="right-col">
              <div :class="e.delta > 0 ? 'due' : 'paid-txt'">
                {{ e.delta > 0 ? `+${money(e.delta)}` : money(e.delta) }}
              </div>
              <div class="meta">Balance: {{ money(e.balanceAfter) }}</div>
            </div>
          </div>
          <p v-if="ledgerEntries.length === 0" class="meta">{{ t("noEntryYet") }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.suppliers {
  max-width: 900px;
  margin: 0 auto;
}
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.top-bar h2 {
  margin: 0;
}
.total-due {
  margin: 4px 0 0;
  color: #8a6d3b;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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
  margin-bottom: 10px;
  align-items: center;
}
.row input,
.row select,
.item-row input,
.item-row select,
.filter-bar input,
.pay-form input {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 0.95rem;
  flex: 1;
  min-width: 140px;
}
.item-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.summary-row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.92rem;
  cursor: pointer;
}
.checkbox-label input {
  width: 20px;
  height: 20px;
  flex: none;
  min-width: auto;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
  align-items: center;
}
.supplier-card,
.purchase-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.right-col {
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.bal {
  font-size: 1.1rem;
  font-weight: bold;
}
.due {
  color: #c0392b;
  font-weight: bold;
}
.paid-txt {
  color: #1e8449;
  font-weight: bold;
}
.meta {
  font-size: 0.82rem;
  color: #666;
}
.history-box {
  margin-top: 24px;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 50;
}
.modal {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 20px;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.pay-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
}
.ledger-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}
</style>
