<script setup lang="ts">
import { computed, reactive, ref } from "vue";

import {
  buildHumanInputFormSubmissionValue,
  buildInitialHumanInputFormValues,
  createHumanInputOptionResponse,
  createHumanInputTextResponse,
  readHumanInputFormValue,
  type HumanInputField,
  type HumanInputFormValue,
  type HumanInputOption,
  type HumanInputRequest,
  type HumanInputResponse,
} from "../../../core/messages/human-input";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    request: HumanInputRequest;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  submit: [response: HumanInputResponse];
}>();

const text = ref("");
const errorMessage = ref<string | null>(null);
const formValues = reactive<Record<string, HumanInputFormValue>>(
  buildInitialHumanInputFormValues(props.request.fields ?? []),
);
const errorId = computed(() => `vue-human-input-error-${props.request.request_id}`);

const allowText =
  props.request.input_mode === "free_text" ||
  props.request.input_mode === "choice_with_other";
const isForm = props.request.input_mode === "form";

function submitOption(option: HumanInputOption) {
  if (props.disabled) {
    return;
  }
  errorMessage.value = null;
  emit("submit", createHumanInputOptionResponse(props.request, option));
}

function submitText() {
  if (props.disabled) {
    return;
  }
  const value = text.value.trim();
  if (!value) {
    errorMessage.value = "请填写答案。";
    return;
  }
  errorMessage.value = null;
  emit("submit", createHumanInputTextResponse(props.request, value));
  text.value = "";
}

function submitForm() {
  if (props.disabled) {
    return;
  }
  const missing = (props.request.fields ?? []).filter(
    (field) => field.required && isEmptyFieldValue(readHumanInputFormValue(formValues, field.name)),
  );
  if (missing.length > 0) {
    errorMessage.value = "请填写必填字段。";
    return;
  }
  const value = buildHumanInputFormSubmissionValue(props.request, formValues).trim();
  if (!value) {
    errorMessage.value = "请填写答案。";
    return;
  }
  errorMessage.value = null;
  emit("submit", createHumanInputTextResponse(props.request, value));
}

function setFormValue(field: HumanInputField, event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return;
  }
  if (field.type === "checkbox" && target instanceof HTMLInputElement) {
    formValues[field.name] = target.checked;
    return;
  }
  if (field.type === "number") {
    formValues[field.name] = target.value === "" ? "" : Number(target.value);
    return;
  }
  formValues[field.name] = target.value;
}

function toggleMultiSelect(field: HumanInputField, option: HumanInputOption, event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  const current = readHumanInputFormValue(formValues, field.name);
  const values = Array.isArray(current) ? current : [];
  formValues[field.name] = target.checked
    ? Array.from(new Set([...values, option.value]))
    : values.filter((value) => value !== option.value);
}

function formValue(field: HumanInputField): string | number | undefined {
  const value = readHumanInputFormValue(formValues, field.name);
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function isChecked(field: HumanInputField): boolean {
  return readHumanInputFormValue(formValues, field.name) === true;
}

function isMultiChecked(field: HumanInputField, option: HumanInputOption): boolean {
  const value = readHumanInputFormValue(formValues, field.name);
  return Array.isArray(value) && value.includes(option.value);
}

function isEmptyFieldValue(value: HumanInputFormValue | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}
</script>

<template>
  <section class="human-input-card" data-testid="vue-human-input-card">
    <p v-if="request.title" class="human-input-card__title">{{ request.title }}</p>
    <p class="human-input-card__question" data-testid="vue-human-input-question">
      {{ request.question }}
    </p>
    <p v-if="request.context" class="human-input-card__context">{{ request.context }}</p>
    <p
      v-if="errorMessage"
      :id="errorId"
      class="human-input-card__error"
      role="alert"
      data-testid="vue-human-input-error"
    >
      {{ errorMessage }}
    </p>

    <div v-if="request.options?.length" class="human-input-card__options">
      <a-button
        v-for="option in request.options"
        :key="option.id"
        :disabled="disabled"
        :data-testid="`vue-human-input-option-${option.id}`"
        @click="submitOption(option)"
      >
        {{ option.label }}
      </a-button>
    </div>

    <form
      v-if="allowText"
      class="human-input-card__text"
      :aria-describedby="errorMessage ? errorId : undefined"
      @submit.prevent="submitText"
    >
      <a-textarea
        v-model:value="text"
        :disabled="disabled"
        :aria-describedby="errorMessage ? errorId : undefined"
        :aria-invalid="Boolean(errorMessage)"
        :auto-size="{ minRows: 2, maxRows: 5 }"
        placeholder="请输入答案"
        data-testid="vue-human-input-text"
      />
      <a-button
        html-type="submit"
        type="primary"
        :disabled="disabled || !text.trim()"
        data-testid="vue-human-input-submit"
      >
        提交
      </a-button>
    </form>

    <form
      v-if="isForm"
      class="human-input-card__form"
      :aria-describedby="errorMessage ? errorId : undefined"
      @submit.prevent="submitForm"
    >
      <label
        v-for="field in request.fields"
        :key="field.name"
        class="human-input-card__field"
      >
        <span>
          {{ field.label }}
          <small v-if="field.required">必填</small>
        </span>
        <textarea
          v-if="field.type === 'textarea'"
          :value="formValue(field)"
          :placeholder="field.placeholder"
          :disabled="disabled"
          :aria-invalid="Boolean(errorMessage)"
          :data-testid="`vue-human-input-field-${field.name}`"
          @input="setFormValue(field, $event)"
        />
        <select
          v-else-if="field.type === 'select'"
          :value="formValue(field)"
          :disabled="disabled"
          :aria-invalid="Boolean(errorMessage)"
          :data-testid="`vue-human-input-field-${field.name}`"
          @change="setFormValue(field, $event)"
        >
          <option value="" />
          <option v-for="option in field.options" :key="option.id" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <div
          v-else-if="field.type === 'multi_select'"
          class="human-input-card__multi"
          :data-testid="`vue-human-input-field-${field.name}`"
        >
          <label v-for="option in field.options" :key="option.id">
            <input
              type="checkbox"
              :checked="isMultiChecked(field, option)"
              :disabled="disabled"
              :aria-invalid="Boolean(errorMessage)"
              @change="toggleMultiSelect(field, option, $event)"
            >
            <span>{{ option.label }}</span>
          </label>
        </div>
        <input
          v-else-if="field.type === 'checkbox'"
          type="checkbox"
          :checked="isChecked(field)"
          :disabled="disabled"
          :aria-invalid="Boolean(errorMessage)"
          :data-testid="`vue-human-input-field-${field.name}`"
          @change="setFormValue(field, $event)"
        >
        <input
          v-else
          :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'"
          :value="formValue(field)"
          :placeholder="field.placeholder"
          :disabled="disabled"
          :aria-invalid="Boolean(errorMessage)"
          :data-testid="`vue-human-input-field-${field.name}`"
          @input="setFormValue(field, $event)"
        >
      </label>
      <a-button
        html-type="submit"
        type="primary"
        :disabled="disabled"
        data-testid="vue-human-input-form-submit"
      >
        提交
      </a-button>
    </form>
  </section>
</template>
