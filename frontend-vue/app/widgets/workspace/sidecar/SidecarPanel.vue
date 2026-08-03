<script setup lang="ts">
import SidecarComposer from "./SidecarComposer.vue";
import SidecarMessageList from "./SidecarMessageList.vue";

type SidecarMessage = { role: string; content: string; id?: string };
type SidecarReference = { label: string; messageId?: string; role: "user" | "assistant"; content: string };

const props = defineProps<{
  deleting: boolean;
  deleteOpen: boolean;
  draft: string;
  messages: SidecarMessage[];
  mode: string;
  modeMenuOpen: boolean;
  model: string;
  modelMenuOpen: boolean;
  references: SidecarReference[];
  selectionMessageId?: string;
  selectionText: string;
  threadExists: boolean;
}>();

const emit = defineEmits<{
  addSelectedReference: [];
  close: [];
  clearReferences: [];
  confirmDelete: [];
  deleteOpen: [];
  draft: [value: string];
  modeMenu: [];
  modelMenu: [];
  selectMode: [value: string];
  selectModel: [value: string];
  selection: [message: SidecarMessage];
  submit: [];
}>();
</script>

<template>
  <section class="workspace-sidecar" :style="{ bottom: props.references.length > 0 ? '-64px' : '-24px' }" data-testid="sidecar-panel" role="dialog">
    <header class="workspace-sidecar__header">
      <h2>Ask a follow-up</h2>
      <div>
        <button v-if="props.threadExists" type="button" data-testid="sidecar-delete-button" @click="emit('deleteOpen')">Delete</button>
        <button type="button" data-testid="sidecar-close-button" @click="emit('close')">Close</button>
      </div>
    </header>
    <SidecarMessageList :messages="props.messages" :selection-text="props.selectionText" @add-selected-reference="emit('addSelectedReference')" @selection="emit('selection', $event)" />
    <SidecarComposer
      :draft="props.draft"
      :mode="props.mode"
      :mode-menu-open="props.modeMenuOpen"
      :model="props.model"
      :model-menu-open="props.modelMenuOpen"
      :references="props.references"
      @clear-references="emit('clearReferences')"
      @draft="emit('draft', $event)"
      @mode-menu="emit('modeMenu')"
      @model-menu="emit('modelMenu')"
      @select-mode="emit('selectMode', $event)"
      @select-model="emit('selectModel', $event)"
      @submit="emit('submit')"
    />
    <button v-if="props.deleteOpen" class="workspace-sidecar__delete-overlay" data-slot="dialog-overlay" type="button" @click="!props.deleting && emit('close')" />
    <div v-if="props.deleteOpen" class="workspace-sidecar__delete-dialog" role="dialog" data-slot="dialog-content">
      <h2>Delete side chat</h2>
      <p>This action cannot be undone</p>
      <button v-if="!props.deleting" type="button" data-slot="dialog-close" :disabled="props.deleting" @click="emit('close')">Close</button>
      <button type="button" :disabled="props.deleting" @click="emit('close')">Cancel</button>
      <button type="button" data-testid="sidecar-delete-confirm-button" :disabled="props.deleting" @click="emit('confirmDelete')">{{ props.deleting ? 'Deleting...' : 'Delete' }}</button>
    </div>
  </section>
</template>
