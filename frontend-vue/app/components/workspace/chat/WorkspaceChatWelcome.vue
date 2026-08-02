<script setup lang="ts">
const { t } = useAppI18n();
</script>

<template>
  <section class="workspace-chat__welcome">
    <h2>👋 {{ t("welcome.greeting") }}</h2>
    <p>{{ t("welcome.description") }}</p>
  </section>
</template>
