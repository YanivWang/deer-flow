<script setup lang="ts">
import type { SettingsMemoryController } from "../../../features/settings/memory/use-settings-memory";

const props = defineProps<{
  memory: SettingsMemoryController;
}>();

function eventTargetValue(event: Event): string {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return event.target.value;
  }
  return "";
}

function updateValue(setter: (value: string) => void, event: Event) {
  setter(eventTargetValue(event));
}
</script>

<template>
  <h2>记忆</h2>
  <p data-testid="vue-settings-memory-anchor">
    通过 Gateway `/api/memory` 契约管理已保存的记忆事实。
  </p>
  <p v-if="props.memory.query.isLoading.value" data-testid="vue-settings-memory-loading">
    正在加载记忆...
  </p>
  <p
    v-else-if="props.memory.memoryLoadErrorMessage.value"
    class="workspace-error"
    data-testid="vue-settings-memory-error"
  >
    {{ props.memory.memoryLoadErrorMessage.value }}
  </p>
  <template v-else>
    <dl class="settings-memory-summary" data-testid="vue-settings-memory-summary">
      <dt>最后更新</dt>
      <dd>{{ props.memory.memory?.value?.lastUpdated || "-" }}</dd>
      <dt>记忆条数</dt>
      <dd>{{ props.memory.facts.value.length }}</dd>
    </dl>
    <div class="settings-memory-actions">
      <button
        class="workspace-button"
        data-testid="vue-settings-memory-export"
        :disabled="props.memory.isMutationPending.value"
        type="button"
        @click="props.memory.exportMemoryJson"
      >
        导出 JSON
      </button>
      <button
        class="workspace-button"
        data-testid="vue-settings-memory-clear"
        :disabled="props.memory.isMutationPending.value"
        type="button"
        @click="props.memory.clearMemoryFacts"
      >
        清空记忆
      </button>
    </div>
    <form
      class="settings-memory-form"
      data-testid="vue-settings-memory-form"
      @submit.prevent="props.memory.submitMemoryFact"
    >
      <textarea
        :value="props.memory.memoryFactContent.value"
        data-testid="vue-settings-memory-content"
        placeholder="添加一条记忆事实"
        @input="updateValue(props.memory.setMemoryFactContent, $event)"
      />
      <div class="settings-memory-form__row">
        <input
          :value="props.memory.memoryFactCategory.value"
          data-testid="vue-settings-memory-category"
          placeholder="分类"
          @input="updateValue(props.memory.setMemoryFactCategory, $event)"
        >
        <input
          :value="props.memory.memoryFactConfidence.value"
          data-testid="vue-settings-memory-confidence"
          max="1"
          min="0"
          step="0.01"
          type="number"
          @input="updateValue(props.memory.setMemoryFactConfidence, $event)"
        >
        <button
          class="workspace-button workspace-button--primary"
          :disabled="props.memory.isMutationPending.value"
          type="submit"
          data-testid="vue-settings-memory-create"
        >
          添加事实
        </button>
      </div>
    </form>
    <form
      v-if="props.memory.memoryEditFactId.value"
      class="settings-memory-form"
      data-testid="vue-settings-memory-edit-form"
      @submit.prevent="props.memory.submitMemoryFactEdit"
    >
      <textarea
        :value="props.memory.memoryEditContent.value"
        data-testid="vue-settings-memory-edit-content"
        placeholder="更新记忆事实"
        @input="updateValue(props.memory.setMemoryEditContent, $event)"
      />
      <div class="settings-memory-form__row">
        <input
          :value="props.memory.memoryEditCategory.value"
          data-testid="vue-settings-memory-edit-category"
          placeholder="分类"
          @input="updateValue(props.memory.setMemoryEditCategory, $event)"
        >
        <input
          :value="props.memory.memoryEditConfidence.value"
          data-testid="vue-settings-memory-edit-confidence"
          max="1"
          min="0"
          step="0.01"
          type="number"
          @input="updateValue(props.memory.setMemoryEditConfidence, $event)"
        >
        <div class="settings-memory-form__buttons">
          <button
            class="workspace-button workspace-button--primary"
            :disabled="props.memory.isMutationPending.value"
            type="submit"
            data-testid="vue-settings-memory-edit-submit"
          >
            保存
          </button>
          <button
            class="workspace-button"
            type="button"
            data-testid="vue-settings-memory-edit-cancel"
            @click="props.memory.cancelMemoryFactEdit"
          >
            取消
          </button>
        </div>
      </div>
    </form>
    <section class="settings-memory-transfer" data-testid="vue-settings-memory-transfer">
      <label class="workspace-field">
        <span>导入 JSON</span>
        <textarea
          :value="props.memory.memoryImportText.value"
          data-testid="vue-settings-memory-import-json"
          @input="updateValue(props.memory.setMemoryImportText, $event)"
        />
      </label>
      <button
        class="workspace-button"
        data-testid="vue-settings-memory-import"
        :disabled="props.memory.isMutationPending.value"
        type="button"
        @click="props.memory.importMemoryJson"
      >
        导入 JSON
      </button>
      <label class="workspace-field">
        <span>已导出的 JSON</span>
        <textarea
          :value="props.memory.memoryExportText.value"
          data-testid="vue-settings-memory-export-json"
          readonly
        />
      </label>
    </section>
    <p
      v-if="props.memory.memoryFormError.value || props.memory.mutationErrorMessage.value"
      class="workspace-error"
      data-testid="vue-settings-memory-form-error"
    >
      {{ props.memory.memoryFormError.value || props.memory.mutationErrorMessage.value }}
    </p>
    <a-empty
      v-if="props.memory.facts.value.length === 0"
      description="暂无已保存的记忆事实"
      data-testid="vue-settings-memory-empty"
    />
    <ul v-else class="settings-memory-facts" data-testid="vue-settings-memory-facts">
      <li v-for="fact in props.memory.facts.value" :key="fact.id" class="settings-memory-fact">
        <div>
          <strong>{{ fact.content }}</strong>
          <small>{{ fact.category }} · {{ fact.confidence }}</small>
        </div>
        <div class="settings-memory-fact__actions">
          <button
            class="workspace-button"
            :disabled="props.memory.isMutationPending.value"
            type="button"
            :data-testid="`vue-settings-memory-edit-${fact.id}`"
            @click="props.memory.startMemoryFactEdit(fact)"
          >
            编辑
          </button>
          <button
            class="workspace-button"
            :disabled="props.memory.isMutationPending.value"
            type="button"
            :data-testid="`vue-settings-memory-delete-${fact.id}`"
            @click="props.memory.deleteMemoryFactById(fact.id)"
          >
            删除
          </button>
        </div>
      </li>
    </ul>
  </template>
</template>
