<script setup>
import { ref, reactive, computed } from "vue";
import { loginUser, registerUser, errorMessage } from "../services/api.js";

const emit = defineEmits(["authenticated"]);

const mode = ref("login");
const loading = ref(false);
const error = ref("");

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
      <h2>{{ isRegister ? "Naya account banayein" : "Login karein" }}</h2>

      <template v-if="isRegister">
        <input v-model="form.name" placeholder="Aap ka naam" required />
        <input v-model="form.shopName" placeholder="Dukaan ka naam" />
      </template>

      <input
        v-model="form.email"
        type="email"
        placeholder="Email"
        autocomplete="email"
        required
      />
      <input
        v-model="form.password"
        type="password"
        :placeholder="isRegister ? 'Password (kam az kam 8 characters)' : 'Password'"
        :autocomplete="isRegister ? 'new-password' : 'current-password'"
        required
      />

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? "Intezar karein..." : isRegister ? "Account banayein" : "Login" }}
      </button>

      <p class="switch">
        {{ isRegister ? "Pehle se account hai?" : "Naya account chahiye?" }}
        <a href="#" @click.prevent="switchMode">
          {{ isRegister ? "Login karein" : "Register karein" }}
        </a>
      </p>
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
  margin: 0 0 6px 0;
  color: #b5651d;
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
</style>
