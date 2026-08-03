<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getWorkspaceChanges, type WorkspaceChanges } from "../../../core/api/workspace-changes/client";

const props = defineProps<{ threadId: string; runId: string }>();
const open = ref(false);
const loading = ref(false);
const data = ref<WorkspaceChanges | null>(null);
const error = ref<string | null>(null);

const changedCount = computed(() => {
  const summary = data.value?.summary;
  return summary ? summary.created + summary.modified + summary.deleted + summary.symlink_created : 0;
});

const editedLabel = computed(() => `Edited ${changedCount.value} file${changedCount.value === 1 ? "" : "s"}`);

async function load(includeDiff: boolean) {
  loading.value = true;
  error.value = null;
  try {
    data.value = await getWorkspaceChanges(props.threadId, props.runId, includeDiff);
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : "Unable to load workspace changes";
  } finally {
    loading.value = false;
  }
}

async function openPanel() {
  open.value = true;
  await load(true);
}

onMounted(() => {
  void load(false);
});

function formatPath(path: string) {
  return path
    .replace(/^\/mnt\/user-data\/workspace\//, "")
    .replace(/^\/mnt\/user-data\/outputs\//, "outputs/");
}
</script>

<template>
  <section v-if="data?.available && changedCount > 0" class="workspace-change-badge" data-testid="workspace-change-badge">
    <div class="workspace-change-badge__header">
      <div>
        <strong>{{ editedLabel }}</strong>
        <button type="button" @click="openPanel">View changes</button>
      </div>
      <span class="workspace-change-badge__delta">+{{ data.summary.additions }} -{{ data.summary.deletions }}</span>
    </div>
    <div v-if="loading" role="status">Loading workspace changes...</div>
    <div v-else class="workspace-change-badge__files">
      <div v-for="file in data.files" :key="`${file.status}:${file.path}`">
        <span>{{ formatPath(file.path) }}</span>
        <span>+{{ file.additions }} -{{ file.deletions }}</span>
      </div>
    </div>
    <span v-if="error" role="alert">{{ error }}</span>
    <section v-if="open" class="workspace-change-badge__panel" role="dialog">
      <header>
        <strong>Workspace changes</strong>
        <button type="button" @click="open = false">Close</button>
      </header>
      <p v-if="loading" role="status">Loading workspace changes...</p>
      <p v-else-if="!data?.files.length">No workspace changes recorded.</p>
      <article v-for="file in data?.files ?? []" :key="`panel:${file.status}:${file.path}`" class="workspace-change-badge__file">
        <button type="button" class="workspace-change-badge__file-title">
          {{ file.path }}
        </button>
        <div class="workspace-change-badge__file-meta">{{ file.status }} · +{{ file.additions }} -{{ file.deletions }}</div>
        <pre v-if="file.diff">{{ file.diff }}</pre>
      </article>
    </section>
  </section>
</template>
