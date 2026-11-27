<script setup>
import { ref, reactive, onMounted } from "vue";
import { t } from "../i18n.js";
import {
  getAdminShops,
  createAdminShop,
  updateAdminShop,
  getAdminLogs,
  errorMessage,
} from "../services/api.js";

const loading = ref(false);
const busy = ref(false);
const search = ref("");
const filter = ref("all");
const summary = ref({
  total: 0,
  active: 0,
  trial: 0,
  expired: 0,
  suspended: 0,
  newToday: 0,
  newYesterday: 0,
});
const shops = ref([]);
const logs = ref([]);
const showLogs = ref(false);
const noteDrafts = reactive({});

const form = reactive({
  name: "",
  shopName: "",
  email: "",
  password: "",
  plan: "trial",
  days: "",
});

async function loadData() {
  loading.value = true;
  try {
    const data = await getAdminShops({ q: search.value.trim(), filter: filter.value });
    summary.value = data.summary;
    shops.value = data.shops;
    for (const s of data.shops) {
      noteDrafts[s.id] = s.notes || "";
    }
  } catch (error) {
    alert(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

async function loadLogs() {
  try {
    logs.value = await getAdminLogs();
  } catch (error) {
    alert(errorMessage(error));
  }
}

function toggleLogs() {
  showLogs.value = !showLogs.value;
  if (showLogs.value) loadLogs();
}

async function handleCreate() {
  if (busy.value) return;
  busy.value = true;
  try {
    await createAdminShop({
      name: form.name.trim(),
      shopName: form.shopName.trim(),
      email: form.email.trim(),
      password: form.password,
      plan: form.plan,
      days: form.days ? Number(form.days) : undefined,
    });
    form.name = "";
    form.shopName = "";
    form.email = "";
    form.password = "";
    form.plan = "trial";
    form.days = "";
    await loadData();
    if (showLogs.value) loadLogs();
  } catch (error) {
    alert(errorMessage(error));
  } finally {
    busy.value = false;
  }
}

async function patchShop(id, payload) {
  if (busy.value) return;
  busy.value = true;
  try {
    const updated = await updateAdminShop(id, payload);
    const idx = shops.value.findIndex((s) => s.id === id);
    if (idx !== -1) {
      shops.value[idx] = updated;
      noteDrafts[id] = updated.notes || "";
    }
    await loadData();
    if (showLogs.value) loadLogs();
  } catch (error) {
    alert(errorMessage(error));
  } finally {
    busy.value = false;
  }
}

function formatDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString();
}

onMounted(loadData);
</script>

<template>
  <div class="admin-wrap">
    <h2>{{ t("adminTitle") }}</h2>

    <div class="summary-grid">
      <div class="stat-card">
        <small>{{ t("adminTotalShops") }}</small>
        <strong>{{ summary.total }}</strong>
      </div>
      <div class="stat-card ok">
        <small>{{ t("adminActive") }}</small>
        <strong>{{ summary.active }}</strong>
      </div>
      <div class="stat-card warn">
        <small>{{ t("adminTrial") }}</small>
        <strong>{{ summary.trial }}</strong>
      </div>
      <div class="stat-card bad">
        <small>{{ t("adminExpired") }}</small>
        <strong>{{ summary.expired }}</strong>
      </div>
      <div class="stat-card">
        <small>{{ t("adminSignups") }}</small>
        <strong>{{ summary.newToday }} / {{ summary.newYesterday }}</strong>
      </div>
    </div>

    <form class="create-box" @submit.prevent="handleCreate">
      <h3>{{ t("adminCreateTitle") }}</h3>
      <div class="form-grid">
        <input v-model="form.name" :placeholder="t('namePlaceholder')" required />
        <input v-model="form.shopName" :placeholder="t('shopNamePlaceholder')" />
        <input v-model="form.email" type="email" placeholder="Email" required />
        <input v-model="form.password" type="password" minlength="8" :placeholder="t('passwordPlaceholder')" required />
        <select v-model="form.plan">
          <option value="trial">{{ t("adminPlanTrial") }}</option>
          <option value="paid">{{ t("adminPlanPaid") }}</option>
        </select>
        <input v-model="form.days" type="number" min="1" :placeholder="t('adminDaysOptional')" />
      </div>
      <button type="submit" class="primary-btn" :disabled="busy">
        {{ busy ? t("saving") : t("adminCreateBtn") }}
      </button>
    </form>

    <div class="toolbar">
      <input
        v-model="search"
        :placeholder="t('adminSearchPlaceholder')"
        @keyup.enter="loadData"
      />
      <select v-model="filter" @change="loadData">
        <option value="all">{{ t("adminFilterAll") }}</option>
        <option value="active">{{ t("adminActive") }}</option>
        <option value="trial">{{ t("adminTrial") }}</option>
        <option value="expired">{{ t("adminExpired") }}</option>
        <option value="suspended">{{ t("adminSuspended") }}</option>
      </select>
      <button type="button" @click="loadData">{{ t("adminSearchBtn") }}</button>
      <button type="button" class="secondary" @click="toggleLogs">
        {{ t("adminLogsBtn") }}
      </button>
    </div>

    <div v-if="showLogs" class="logs-box">
      <h3>{{ t("adminLogsTitle") }}</h3>
      <p v-if="logs.length === 0">{{ t("adminNoLogs") }}</p>
      <div v-for="l in logs" :key="l.id" class="log-row">
        <span>{{ formatDate(l.createdAt) }} — <strong>{{ l.action }}</strong> ({{ l.adminEmail }})</span>
        <small>{{ JSON.stringify(l.details) }}</small>
      </div>
    </div>

    <p v-if="loading">{{ t("loading") }}</p>
    <p v-else-if="shops.length === 0" class="empty">{{ t("adminNoShops") }}</p>

    <div v-else class="shops-list">
      <div v-for="s in shops" :key="s.id" class="shop-card">
        <div class="shop-head">
          <div>
            <h3>{{ s.shopName || s.name }}</h3>
            <small>{{ s.name }} — {{ s.email }}</small>
          </div>
          <div class="badges">
            <span class="badge">{{ s.plan.toUpperCase() }}</span>
            <span :class="['badge', s.status === 'suspended' ? 'bad' : s.isExpired ? 'warn' : 'ok']">
              {{ s.status === 'suspended' ? t("adminSuspended") : s.isExpired ? t("adminExpired") : t("adminActive") }}
            </span>
          </div>
        </div>

        <div class="meta-grid">
          <span>{{ t("adminCreated") }}: {{ formatDate(s.createdAt) }}</span>
          <span>{{ t("adminLastLogin") }}: {{ formatDate(s.lastLoginAt) }}</span>
          <span>{{ t("adminExpiry") }}: {{ s.expiresAt ? formatDate(s.expiresAt) : t("adminUnlimited") }}</span>
          <span>{{ t("adminCounts") }}: {{ s.productsCount }} / {{ s.ordersCount }}</span>
        </div>

        <div class="actions-row">
          <button
            type="button"
            :class="s.status === 'suspended' ? 'ok-btn' : 'bad-btn'"
            :disabled="busy"
            @click="patchShop(s.id, { status: s.status === 'suspended' ? 'active' : 'suspended' })"
          >
            {{ s.status === 'suspended' ? t("adminActivateBtn") : t("adminSuspendBtn") }}
          </button>
          <button type="button" :disabled="busy" @click="patchShop(s.id, { extendDays: 7 })">+7d</button>
          <button type="button" :disabled="busy" @click="patchShop(s.id, { extendDays: 30 })">+30d</button>
          <button type="button" :disabled="busy" @click="patchShop(s.id, { extendDays: 365 })">+1y</button>
          <button
            type="button"
            :disabled="busy"
            @click="patchShop(s.id, { plan: s.plan === 'trial' ? 'paid' : 'trial' })"
          >
            {{ s.plan === 'trial' ? t("adminMakePaid") : t("adminMakeTrial") }}
          </button>
        </div>

        <div class="note-row">
          <input v-model="noteDrafts[s.id]" :placeholder="t('adminNotePlaceholder')" />
          <button type="button" :disabled="busy" @click="patchShop(s.id, { notes: noteDrafts[s.id] })">
            {{ t("saveBtn") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}
.stat-card {
  background: #fffaf3;
  border: 1px solid #e0d5c8;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-card strong {
  font-size: 1.3rem;
}
.stat-card.ok strong { color: #2e7d32; }
.stat-card.warn strong { color: #e65100; }
.stat-card.bad strong { color: #c62828; }
.create-box, .logs-box, .shop-card {
  background: #fffaf3;
  border: 1px solid #e0d5c8;
  border-radius: 10px;
  padding: 14px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}
input, select {
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.primary-btn {
  background: #b5651d;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  min-height: 44px;
}
.toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.toolbar input {
  flex: 1;
  min-width: 200px;
}
.toolbar button {
  min-height: 44px;
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: #b5651d;
  color: white;
  cursor: pointer;
}
.toolbar button.secondary {
  background: #555;
}
.shops-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.shop-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}
.shop-head h3 {
  margin: 0;
}
.badges {
  display: flex;
  gap: 6px;
}
.badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: bold;
  background: #eee;
}
.badge.ok { background: #e8f5e9; color: #2e7d32; }
.badge.warn { background: #fff3e0; color: #e65100; }
.badge.bad { background: #fdecea; color: #c62828; }
.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 6px;
  margin: 10px 0;
  font-size: 0.88rem;
  color: #555;
}
.actions-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.actions-row button {
  min-height: 40px;
  padding: 6px 12px;
  border: 1px solid #d5c7b8;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}
.actions-row button.ok-btn { background: #2e7d32; color: white; border: none; }
.actions-row button.bad-btn { background: #c62828; color: white; border: none; }
.note-row {
  display: flex;
  gap: 8px;
}
.note-row input {
  flex: 1;
}
.note-row button {
  min-height: 44px;
  padding: 8px 14px;
  background: #b5651d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.log-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #eee;
  flex-wrap: wrap;
  font-size: 0.85rem;
}
</style>
