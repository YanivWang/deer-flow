<script setup lang="ts">
import ReferenceAttachments from "./ReferenceAttachments.vue";

type SidecarReference = { label: string; messageId?: string; role: "user" | "assistant"; content: string };

const props = defineProps<{
  draft: string;
  mode: string;
  modeMenuOpen: boolean;
  model: string;
  modelMenuOpen: boolean;
  references: SidecarReference[];
}>();

const emit = defineEmits<{
  clearReferences: [];
  draft: [value: string];
  modeMenu: [];
  modelMenu: [];
  selectMode: [value: string];
  selectModel: [value: string];
  submit: [];
}>();

function updateDraft(event: Event): void {
  const target = event.target;
  emit("draft", target instanceof HTMLTextAreaElement ? target.value : "");
}
</script>

<template>
  <form class="workspace-sidecar__form" :style="{ height: props.references.length > 0 ? '272px' : '232px' }" @submit.prevent="emit('submit')">
    <ReferenceAttachments :references="props.references" @clear="emit('clearReferences')" />
    <textarea :value="props.draft" placeholder="Deeper follow-up" data-testid="sidecar-input" @input="updateDraft" @keydown.enter.exact.prevent="emit('submit')" />
    <div class="workspace-sidecar__controls">
      <button type="button" data-testid="sidecar-add-attachments-button">Attach</button>
      <span class="workspace-sidecar__menu-wrap">
        <button type="button" @click="emit('modeMenu')">{{ props.mode }}</button>
        <span v-if="props.modeMenuOpen" role="menu">
          <button role="menuitem" type="button" @click="emit('selectMode', 'Flash')">Flash</button>
          <button role="menuitem" type="button" @click="emit('selectMode', 'Pro')">Pro</button>
        </span>
      </span>
      <span class="workspace-sidecar__menu-wrap">
        <button class="workspace-sidecar__model-button" type="button" @click="emit('modelMenu')">{{ props.model }}</button>
        <span v-if="props.modelMenuOpen" role="menu">
          <button type="button" role="menuitem" @click="emit('selectModel', 'Fast Model')">Fast Model</button>
          <button type="button" role="menuitem" @click="emit('selectModel', 'DeepSeek V4 Pro')">DeepSeek V4 Pro</button>
        </span>
      </span>
      <button type="submit">Submit</button>
    </div>
  </form>
</template>
