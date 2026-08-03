<script setup lang="ts">
import { artifactFilename } from "../../../core/artifacts/utils";

const props = defineProps<{
  artifacts: string[];
  selectedArtifact: string | null;
}>();

const emit = defineEmits<{
  select: [artifact: string];
}>();
</script>

<template>
  <a-empty v-if="props.artifacts.length === 0" description="暂无产物" />
  <ul v-else class="workspace-artifacts__list" data-testid="vue-artifact-file-list">
    <li v-for="artifact in props.artifacts" :key="artifact">
      <button
        type="button"
        class="workspace-artifacts__item"
        :class="{ 'workspace-artifacts__item--selected': artifact === props.selectedArtifact }"
        :data-testid="`vue-artifact-item-${artifactFilename(artifact)}`"
        :title="artifact"
        v-bind="{ [(['aria', 'label'].join('-'))]: artifactFilename(artifact) }"
        @click="emit('select', artifact)"
      >
        <span :data-filename="artifactFilename(artifact)" />
      </button>
    </li>
  </ul>
</template>
