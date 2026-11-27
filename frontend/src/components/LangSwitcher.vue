<script setup>
import { lang, setLang } from "../i18n.js";

const options = [
  { code: "roman", label: "Roman" },
  { code: "ur", label: "اردو" },
  { code: "en", label: "EN" },
];
</script>

<template>
  <div class="lang-switch" dir="ltr">
    <button
      v-for="opt in options"
      :key="opt.code"
      type="button"
      :class="['lang-btn', { active: lang === opt.code }]"
      @click="setLang(opt.code)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.lang-switch {
  display: inline-flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(0, 0, 0, 0.15);
}
.lang-btn {
  border: none;
  background: transparent;
  color: inherit;
  padding: 6px 10px;
  min-height: 36px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.lang-btn.active {
  background: white;
  color: #b5651d;
}
</style>
