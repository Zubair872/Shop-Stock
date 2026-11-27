<script setup>
import { ref, reactive, computed, watch } from "vue";
import { loginUser, registerUser, errorMessage } from "../services/api.js";
import LangSwitcher from "./LangSwitcher.vue";
import { t } from "../i18n.js";

const props = defineProps({
  initialMode: { type: String, default: "login" },
});

const emit = defineEmits(["authenticated", "start-demo"]);

const mode = ref(props.initialMode);
const loading = ref(false);
const error = ref("");

watch(
  () => props.initialMode,
  (val) => {
    mode.value = val;
  }
);

const form = reactive({
  name: "",
  shopName: "",
  email: "",
  password: "",
});

const isRegister = computed(() => mode.value === "register");

function switchMode() {
  mode.value = isRegister.value ? "login" : "register";
  error.value = "";
}

async function handleSubmit() {
  error.value = "";
  loading.value = true;

  try {
    const result = isRegister.value
      ? await registerUser({ ...form })
      : await loginUser({ email: form.email, password: form.password });

    emit("authenticated", result);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-wrap">
    <form class="auth-card" @submit.prevent="handleSubmit">
      <div class="auth-top">
        <h2>{{ isRegister ? t("authRegisterTitle") : t("authLoginTitle") }}</h2>
        <div class="auth-lang"><LangSwitcher /></div>
      </div>

      <template v-if="isRegister">
        <input v-model="form.name" :placeholder="t('authName')" required />
        <input v-model="form.shopName" :placeholder="t('authShopName')" />
      </template>

      <input
        v-model="form.email"
        type="email"
        :placeholder="t('authEmail')"
        autocomplete="email"
        required
      />
      <input
        v-model="form.password"
        type="password"
        :placeholder="isRegister ? t('authPasswordReg') : t('authPassword')"
        :autocomplete="isRegister ? 'new-password' : 'current-password'"
        required
      />

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? t("authWait") : isRegister ? t("authCreateBtn") : t("authLoginBtn") }}
      </button>

      <p class="switch">
        {{ isRegister ? t("authHaveAccount") : t("authNeedAccount") }}
        <a href="#" @click.prevent="switchMode">
          {{ isRegister ? t("authSwitchLogin") : t("authSwitchReg") }}
        </a>
      </p>

      <div class="demo-link-box">
        <a href="/demo" class="demo-link" @click.prevent="emit('start-demo')">
          {{ t("demoLiveLink") }} →
        </a>
      </div>
    </form>
  </div>
</template>

<style scoped>
.auth-wrap {
  display: flex;
  justify-content: center;
  padding: 40px 16px;
}
.auth-card {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fff3e0;
  padding: 24px;
  border-radius: 12px;
}
.auth-card h2 {
  margin: 0;
  color: #b5651d;
}
.auth-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.auth-lang {
  background: #b5651d;
  color: white;
  border-radius: 8px;
}
input {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
button {
  padding: 10px;
  background: #b5651d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.error {
  margin: 0;
  color: #b03a2e;
  font-size: 0.9rem;
}
.switch {
  margin: 4px 0 0 0;
  font-size: 0.9rem;
  text-align: center;
}
.switch a {
  color: #b5651d;
  font-weight: bold;
}
.demo-link-box {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px dashed #e0cbb0;
  text-align: center;
}
.demo-link {
  display: inline-block;
  padding: 8px 14px;
  background: white;
  border: 1px solid #b5651d;
  border-radius: 8px;
  color: #b5651d;
  font-weight: bold;
  text-decoration: none;
}
</style>
