<script setup>
import { onMounted, reactive, ref } from "vue";
import { t } from "../i18n.js";
import {
  createTeamMember,
  getTeamMembers,
  updateTeamMember,
  errorMessage,
} from "../services/api.js";

const props = defineProps({
  currentRole: { type: String, required: true },
  isDemo: { type: Boolean, default: false },
});
const members = ref([]);
const error = ref("");
const loading = ref(true);
const saving = ref(false);
const form = reactive({ name: "", email: "", password: "", role: "cashier" });
const roles = props.currentRole === "owner"
  ? ["admin", "manager", "cashier", "viewer"]
  : ["manager", "cashier", "viewer"];

async function load() {
  loading.value = true;
  error.value = "";
  try {
    members.value = await getTeamMembers();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function addMember() {
  saving.value = true;
  error.value = "";
  try {
    await createTeamMember({ ...form });
    form.name = "";
    form.email = "";
    form.password = "";
    form.role = "cashier";
    await load();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}

async function changeRole(member, event) {
  try {
    const updated = await updateTeamMember(member.id, { role: event.target.value });
    Object.assign(member, updated);
  } catch (e) {
    error.value = errorMessage(e);
    await load();
  }
}

async function toggleMember(member) {
  try {
    const updated = await updateTeamMember(member.id, { isActive: !member.isActive });
    Object.assign(member, updated);
  } catch (e) {
    error.value = errorMessage(e);
  }
}

onMounted(load);
</script>

<template>
  <section class="team">
    <h2>{{ t("teamTitle") }}</h2>
    <p class="muted">{{ t("teamSub") }}</p>

    <p v-if="isDemo" class="error">{{ t("demoTeamBlocked") }}</p>

    <form v-else class="team-form" @submit.prevent="addMember">
      <input v-model="form.name" :placeholder="t('namePlaceholder')" required maxlength="100" />
      <input v-model="form.email" type="email" :placeholder="t('authEmail')" required maxlength="200" />
      <input v-model="form.password" type="password" :placeholder="t('tempPassPlaceholder')" required minlength="8" />
      <select v-model="form.role">
        <option v-for="role in roles" :key="role" :value="role">{{ role }}</option>
      </select>
      <button :disabled="saving">{{ saving ? t("addingBtn") : t("addMemberBtn") }}</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="muted">{{ t("loading") }}</p>
    <div v-else class="members">
      <div v-for="member in members" :key="member.id" class="member">
        <div>
          <strong>{{ member.name }}</strong>
          <span class="muted">{{ member.email }}</span>
        </div>
        <select
          v-if="member.role !== 'owner'"
          :value="member.role"
          @change="changeRole(member, $event)"
        >
          <option v-for="role in roles" :key="role" :value="role">{{ role }}</option>
        </select>
        <span v-else class="badge">owner</span>
        <button v-if="member.role !== 'owner'" class="secondary" @click="toggleMember(member)">
          {{ member.isActive ? t("disableBtn") : t("enableBtn") }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.team { max-width: 900px; }
.team-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin: 16px 0; }
.team-form input, .team-form select, .team-form button, .member select, .member button { padding: 8px; border: 1px solid #e0d5c8; border-radius: 6px; }
.team-form button { background: #2e7d32; color: white; border: 0; cursor: pointer; }
.team-form button:disabled { opacity: .6; }
.members { display: grid; gap: 8px; }
.member { display: grid; grid-template-columns: 1fr 140px 90px; gap: 8px; align-items: center; padding: 12px; background: #fffaf3; border: 1px solid #e0d5c8; border-radius: 8px; }
.member strong, .member .muted { display: block; }
.muted { color: #777; font-size: .9rem; }
.error { color: #b03a2e; }
.badge { color: #2e7d32; font-weight: bold; }
.secondary { background: #8a6d3b; color: white; cursor: pointer; }
@media (max-width: 600px) { .member { grid-template-columns: 1fr; } }
</style>
