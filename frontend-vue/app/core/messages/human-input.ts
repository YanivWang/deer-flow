import type { DeerFlowMessage } from "../api/thread/types";

export type HumanInputMode = "free_text" | "single_choice" | "choice_with_other" | "form";

export type HumanInputOption = {
  id: string;
  label: string;
  value: string;
};

export type HumanInputFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "multi_select"
  | "checkbox"
  | "date";

export type HumanInputField = {
  name: string;
  label: string;
  type: HumanInputFieldType;
  required: boolean;
  placeholder?: string;
  options?: HumanInputOption[];
};

export type HumanInputFormValue = string | number | boolean | string[];

export type HumanInputRequest = {
  version: 1 | 2;
  kind: "human_input_request";
  source: string;
  request_id: string;
  tool_call_id?: string;
  clarification_type?: string;
  title?: string;
  question: string;
  context?: string | null;
  input_mode: HumanInputMode;
  options?: HumanInputOption[];
  fields?: HumanInputField[];
};

export type HumanInputResponse =
  | {
      version: 1;
      kind: "human_input_response";
      source: string;
      request_id: string;
      response_kind: "option";
      option_id: string;
      value: string;
    }
  | {
      version: 1;
      kind: "human_input_response";
      source: string;
      request_id: string;
      response_kind: "text";
      value: string;
    };

const RESERVED_FIELD_NAMES = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "toLocaleString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);

export function extractHumanInputRequest(message: unknown): HumanInputRequest | null {
  if (!isRecord(message) || message.type !== "tool") {
    return null;
  }
  const artifact = message.artifact;
  if (!isRecord(artifact)) {
    return null;
  }
  return parseHumanInputRequest(artifact.human_input);
}

export function parseHumanInputRequest(value: unknown): HumanInputRequest | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    (value.version !== 1 && value.version !== 2) ||
    value.kind !== "human_input_request" ||
    !isNonEmptyString(value.source) ||
    !isNonEmptyString(value.request_id) ||
    !isNonEmptyString(value.question) ||
    !isHumanInputMode(value.input_mode)
  ) {
    return null;
  }

  const options = parseOptions(value.options);
  if (value.options !== undefined && options === undefined) {
    return null;
  }
  if (
    (value.input_mode === "single_choice" || value.input_mode === "choice_with_other") &&
    (!options || options.length === 0)
  ) {
    return null;
  }

  const fields = parseFields(value.fields);
  if (value.fields !== undefined && fields === undefined) {
    return null;
  }
  if (value.input_mode === "form" && (!fields || fields.length === 0)) {
    return null;
  }
  if ((value.input_mode === "form") !== (value.version === 2)) {
    return null;
  }

  const context = value.context;
  if (context !== undefined && context !== null && typeof context !== "string") {
    return null;
  }

  return {
    version: value.version,
    kind: "human_input_request",
    source: value.source,
    request_id: value.request_id,
    ...(readOptionalString(value.tool_call_id)
      ? { tool_call_id: readOptionalString(value.tool_call_id) }
      : {}),
    ...(readOptionalString(value.clarification_type)
      ? { clarification_type: readOptionalString(value.clarification_type) }
      : {}),
    ...(readOptionalString(value.title) ? { title: readOptionalString(value.title) } : {}),
    question: value.question,
    ...(context !== undefined ? { context } : {}),
    input_mode: value.input_mode,
    ...(options ? { options } : {}),
    ...(fields ? { fields } : {}),
  };
}

export function createHumanInputOptionResponse(
  request: HumanInputRequest,
  option: HumanInputOption,
): HumanInputResponse {
  return {
    version: 1,
    kind: "human_input_response",
    source: request.source,
    request_id: request.request_id,
    response_kind: "option",
    option_id: option.id,
    value: option.value,
  };
}

export function createHumanInputTextResponse(
  request: HumanInputRequest,
  value: string,
): HumanInputResponse {
  return {
    version: 1,
    kind: "human_input_response",
    source: request.source,
    request_id: request.request_id,
    response_kind: "text",
    value,
  };
}

export function buildHumanInputResponseText(
  request: HumanInputRequest,
  response: HumanInputResponse,
) {
  return `关于“${request.question}”，我的回答是：${response.value}`;
}

export function buildHumanInputHiddenMessage(
  request: HumanInputRequest,
  response: HumanInputResponse,
): DeerFlowMessage {
  return {
    type: "human",
    content: buildHumanInputResponseText(request, response),
    additional_kwargs: {
      hide_from_ui: true,
      human_input_response: response,
    },
  };
}

export function readHumanInputFormValue(
  values: Record<string, HumanInputFormValue>,
  name: string,
): HumanInputFormValue | undefined {
  return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : undefined;
}

export function buildHumanInputFormSummary(
  request: HumanInputRequest,
  values: Record<string, HumanInputFormValue>,
) {
  const parts: string[] = [];
  for (const field of request.fields ?? []) {
    const value = readHumanInputFormValue(values, field.name);
    if (isEmptyFormValue(value)) {
      continue;
    }
    parts.push(`${field.label}: ${formatFormValue(value!)}`);
  }
  return parts.join("; ");
}

export function buildHumanInputFormSubmissionValue(
  request: HumanInputRequest,
  values: Record<string, HumanInputFormValue>,
) {
  const record: Record<string, HumanInputFormValue> = {};
  for (const field of request.fields ?? []) {
    const value = readHumanInputFormValue(values, field.name);
    if (!isEmptyFormValue(value)) {
      record[field.name] = value!;
    }
  }
  return `${buildHumanInputFormSummary(request, values)} [values: ${JSON.stringify(record)}]`;
}

export function buildInitialHumanInputFormValues(fields: HumanInputField[]) {
  const values: Record<string, HumanInputFormValue> = {};
  for (const field of fields) {
    if (field.type === "checkbox") {
      values[field.name] = false;
    }
  }
  return values;
}

function parseOptions(value: unknown): HumanInputOption[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const options: HumanInputOption[] = [];
  const ids = new Set<string>();
  const values = new Set<string>();
  for (const option of value) {
    if (!isRecord(option)) {
      return undefined;
    }
    const { id, label, value: optionValue } = option;
    if (
      !isNonEmptyString(id) ||
      !isNonEmptyString(label) ||
      !isNonEmptyString(optionValue) ||
      ids.has(id) ||
      values.has(optionValue)
    ) {
      return undefined;
    }
    ids.add(id);
    values.add(optionValue);
    options.push({ id, label, value: optionValue });
  }
  return options;
}

function parseFields(value: unknown): HumanInputField[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const fields: HumanInputField[] = [];
  const names = new Set<string>();
  for (const field of value) {
    if (!isRecord(field)) {
      return undefined;
    }
    const { name, label, type } = field;
    if (
      !isNonEmptyString(name) ||
      names.has(name) ||
      RESERVED_FIELD_NAMES.has(name) ||
      !isNonEmptyString(label) ||
      !isHumanInputFieldType(type) ||
      (field.required !== undefined && typeof field.required !== "boolean")
    ) {
      return undefined;
    }
    const options = parseOptions(field.options);
    if (field.options !== undefined && options === undefined) {
      return undefined;
    }
    if ((type === "select" || type === "multi_select") && (!options || options.length === 0)) {
      return undefined;
    }
    names.add(name);
    fields.push({
      name,
      label,
      type,
      required: field.required === true,
      ...(readOptionalString(field.placeholder)
        ? { placeholder: readOptionalString(field.placeholder) }
        : {}),
      ...(options ? { options } : {}),
    });
  }
  return fields;
}

function isEmptyFormValue(value: HumanInputFormValue | undefined) {
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

function formatFormValue(value: HumanInputFormValue) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  return String(value);
}

function isHumanInputMode(value: unknown): value is HumanInputMode {
  return (
    value === "free_text" ||
    value === "single_choice" ||
    value === "choice_with_other" ||
    value === "form"
  );
}

function isHumanInputFieldType(value: unknown): value is HumanInputFieldType {
  return (
    value === "text" ||
    value === "textarea" ||
    value === "number" ||
    value === "select" ||
    value === "multi_select" ||
    value === "checkbox" ||
    value === "date"
  );
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
