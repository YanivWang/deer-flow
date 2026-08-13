<script setup lang="ts">
/*
  【文件职责】     渲染并提交 free-text、choice 与 form human-input 请求。
  【对应 frontend/】 src/components/workspace/messages/human-input-card.tsx
  【架构位置】     L3 UI adapter
  【主要导出】     默认 HumanInputCard 组件
  【依赖关系】     core/messages/human-input · input/ime · MessageList
  【边界与注意】   保留 F1-F11；协议纯函数可复用，当前组件仍消费宿主请求类型。
*/
import { computed, ref } from "vue";

import { isImeComposing } from "@/core/input/ime";

import {
  buildHumanInputFormSubmissionValue,
  buildInitialHumanInputFormValues,
  createHumanInputOptionResponse,
  createHumanInputTextResponse,
  readHumanInputFormValue,
  type HumanInputFormValue,
  type HumanInputRequest,
  type HumanInputResponse,
} from "@/core/messages/human-input";

const props = defineProps<{
  request: HumanInputRequest;
  answered?: HumanInputResponse;
  active: boolean;
  pending: boolean;
}>();
const emit = defineEmits<{
  submit: [response: HumanInputResponse];
}>();

const text = ref("");
const other = ref("");
const form = ref<Record<string, HumanInputFormValue>>(
  buildInitialHumanInputFormValues(props.request.fields ?? []),
);
const error = ref("");
const compositionActive = ref(false);
const disabled = computed(
  () => !props.active || props.pending || !!props.answered,
);

function setFormValue(name: string, value: HumanInputFormValue) {
  form.value = { ...form.value, [name]: value };
}
function formValue(name: string) {
  return readHumanInputFormValue(form.value, name);
}
function selectedValues(event: Event) {
  return Array.from((event.target as HTMLSelectElement).selectedOptions).map(
    (option) => option.value,
  );
}
function submitText(value = text.value) {
  if (!value.trim()) {
    error.value = "Please provide an answer.";
    return;
  }
  error.value = "";
  emit("submit", createHumanInputTextResponse(props.request, value.trim()));
}
function onTextKeydown(event: KeyboardEvent, value?: string) {
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    isImeComposing(event, compositionActive.value)
  ) {
    return;
  }
  event.preventDefault();
  submitText(value);
}
function submitForm() {
  const invalid = (props.request.fields ?? []).some((field) => {
    if (!field.required) return false;
    const value = formValue(field.name);
    return (
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    );
  });
  if (invalid) {
    error.value = "Please complete all required fields.";
    return;
  }
  const value = buildHumanInputFormSubmissionValue(props.request, form.value);
  if (!value.trim()) {
    error.value = "Please provide an answer.";
    return;
  }
  error.value = "";
  emit("submit", createHumanInputTextResponse(props.request, value));
}
</script>

<template>
  <section class="border-border bg-muted/30 my-3 rounded-xl border p-4">
    <p class="text-xs font-medium tracking-wide text-gray-500 uppercase">
      {{ request.title ?? "Clarification" }}
    </p>
    <p class="mt-1 font-medium">{{ request.question }}</p>
    <p v-if="request.context" class="mt-1 text-sm text-gray-500">
      {{ request.context }}
    </p>
    <p v-if="answered" class="mt-3 text-sm">Answered: {{ answered.value }}</p>

    <template v-else-if="request.input_mode === 'form'">
      <div class="mt-3 space-y-3">
        <label
          v-for="field in request.fields ?? []"
          :key="field.name"
          class="block text-sm"
        >
          <span>{{ field.label }}</span>
          <span
            v-if="field.required"
            class="ml-1 text-red-600"
            aria-hidden="true"
            >*</span
          >
          <span v-if="field.required" class="sr-only">required</span>
          <input
            v-if="field.type === 'checkbox'"
            type="checkbox"
            class="ml-2"
            :checked="formValue(field.name) === true"
            :disabled="disabled"
            @change="
              setFormValue(
                field.name,
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          <select
            v-else-if="field.type === 'select' || field.type === 'multi_select'"
            class="border-input mt-1 block w-full rounded border p-2"
            :value="String(formValue(field.name) ?? '')"
            :multiple="field.type === 'multi_select'"
            :disabled="disabled"
            :aria-required="field.required"
            @change="
              setFormValue(
                field.name,
                field.type === 'multi_select'
                  ? selectedValues($event)
                  : ($event.target as HTMLSelectElement).value,
              )
            "
          >
            <option v-if="field.type === 'select'" value="">Select…</option>
            <option
              v-for="option in field.options ?? []"
              :key="option.id"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <textarea
            v-else-if="field.type === 'textarea'"
            class="border-input mt-1 block w-full rounded border p-2"
            :placeholder="field.placeholder"
            :value="String(formValue(field.name) ?? '')"
            :disabled="disabled"
            :aria-required="field.required"
            @input="
              setFormValue(
                field.name,
                ($event.target as HTMLTextAreaElement).value,
              )
            "
          />
          <input
            v-else
            :type="
              field.type === 'number'
                ? 'number'
                : field.type === 'date'
                  ? 'date'
                  : 'text'
            "
            class="border-input mt-1 block w-full rounded border p-2"
            :placeholder="field.placeholder"
            :value="String(formValue(field.name) ?? '')"
            :disabled="disabled"
            :aria-required="field.required"
            @input="
              setFormValue(
                field.name,
                ($event.target as HTMLInputElement).value,
              )
            "
          />
        </label>
      </div>
      <button
        type="button"
        class="bg-primary text-primary-foreground mt-3 rounded px-3 py-1.5 text-sm"
        :disabled="disabled"
        @click="submitForm"
      >
        Submit
      </button>
    </template>

    <template
      v-else-if="
        request.input_mode === 'single_choice' ||
        request.input_mode === 'choice_with_other'
      "
    >
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="option in request.options ?? []"
          :key="option.id"
          type="button"
          class="rounded border px-3 py-1.5 text-sm"
          :disabled="disabled"
          @click="
            emit('submit', createHumanInputOptionResponse(request, option))
          "
        >
          {{ option.label }}
        </button>
      </div>
      <div
        v-if="request.input_mode === 'choice_with_other'"
        class="mt-3 flex gap-2"
      >
        <input
          v-model="other"
          class="border-input min-w-0 flex-1 rounded border p-2 text-sm"
          placeholder="Other answer"
          :disabled="disabled"
          @keydown="onTextKeydown($event, other)"
          @compositionstart="compositionActive = true"
          @compositionend="compositionActive = false"
        />
        <button
          type="button"
          class="rounded border px-3 text-sm"
          :disabled="disabled"
          @click="submitText(other)"
        >
          Submit
        </button>
      </div>
    </template>

    <div v-else class="mt-3 flex gap-2">
      <textarea
        v-model="text"
        class="border-input min-w-0 flex-1 rounded border p-2 text-sm"
        :disabled="disabled"
        @keydown="onTextKeydown"
        @compositionstart="compositionActive = true"
        @compositionend="compositionActive = false"
      />
      <button
        type="button"
        class="rounded border px-3 text-sm"
        :disabled="disabled"
        @click="submitText()"
      >
        Submit
      </button>
    </div>
    <p v-if="pending" class="mt-2 text-xs text-gray-500">Submitting…</p>
    <p v-if="error" role="alert" class="mt-2 text-sm text-red-600">
      {{ error }}
    </p>
  </section>
</template>
