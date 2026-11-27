<script setup>
import { ref, onMounted } from "vue";
import { useRegisterSW } from "virtual:pwa-register/vue";
import { t } from "../i18n.js";

const deferredPrompt = ref(null);
const showInstall = ref(false);

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW() {},
  onNeedRefresh() {},
});

onMounted(() => {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt.value = e;
    showInstall.value = true;
  });
  window.addEventListener("appinstalled", () => {
    showInstall.value = false;
    deferredPrompt.value = null;
  });
});

async function installApp() {
  if (!deferredPrompt.value) return;
  deferredPrompt.value.prompt();
  const { outcome } = await deferredPrompt.value.userChoice;
  if (outcome === "accepted") {
    showInstall.value = false;
  }
  deferredPrompt.value = null;
}
</script>

<template>
  <div v-if="needRefresh" class="pwa-banner update">
    <span>{{ t("pwaUpdateReady") }}</span>
    <button @click="updateServiceWorker(true)">{{ t("pwaRefresh") }}</button>
  </div>
  <div v-if="showInstall" class="pwa-banner install">
    <button @click="installApp">{{ t("pwaInstall") }}</button>
  </div>
</template>

<style scoped>
.pwa-banner {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0);
  left: 0;
  right: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  font-size: 0.9rem;
  flex-wrap: wrap;
  gap: 8px;
}
.pwa-banner.update {
  background: #2e7d32;
  color: white;
}
.pwa-banner.install {
  background: #b5651d;
  color: white;
  justify-content: center;
}
.pwa-banner button {
  background: white;
  color: #333;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  min-height: 44px;
}
</style>
