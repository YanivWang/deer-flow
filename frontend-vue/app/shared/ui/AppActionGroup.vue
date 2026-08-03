<template>
  <div class="app-action-group" role="group"><slot /></div>
</template>

<style scoped lang="scss">
.app-action-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--df-space-2);
  align-items: center;
}

@media (width <= 768px) {
  .app-action-group {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
