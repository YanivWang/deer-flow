<script setup lang="ts">
/*
  【文件职责】     编辑 once/cron 两种 Gateway schedule，并提供五种 cron preset、时区和预览。
  【架构位置】     L3 scheduled-task form component
  【主要导出】     默认 ScheduledTaskScheduleInput
  【依赖关系】     scheduled-tasks cron/schedule · app i18n
  【边界与注意】   datetime-local 保留 wall value；UTC/DST 转换只在 form.ts payload 边界发生。
*/
import { computed, ref, watch } from "vue";

import {
  describeSchedule,
  parseCron,
  serializeCron,
  WEEKDAYS,
  type CronParts,
  type CronPreset,
  type Weekday,
} from "@/core/scheduled-tasks/cron";
import type { ScheduleValue } from "@/core/scheduled-tasks/schedule";

const props = withDefaults(
  defineProps<{
    modelValue: ScheduleValue;
    typeLocked?: boolean;
  }>(),
  { typeLocked: false },
);
const emit = defineEmits<{
  "update:modelValue": [value: ScheduleValue];
}>();
const { $i18n } = useNuxtApp();

const preset = ref<CronPreset>("daily");
const parts = ref<CronParts>({ minute: 0, hour: 9 });
let resetting = false;
let emittedCron: string | null = null;

function resetFromModel(value: ScheduleValue) {
  if (
    value.schedule_type === "cron" &&
    value.schedule_spec.cron === emittedCron
  ) {
    emittedCron = null;
    return;
  }
  resetting = true;
  if (value.schedule_type === "cron") {
    const parsed = parseCron(value.schedule_spec.cron ?? "0 9 * * *");
    preset.value = parsed.preset;
    parts.value = { ...parsed.parts };
  }
  resetting = false;
}

watch(() => props.modelValue, resetFromModel, { deep: true, immediate: true });

function update(value: Partial<ScheduleValue>) {
  emit("update:modelValue", {
    ...props.modelValue,
    ...value,
    schedule_spec: value.schedule_spec ?? {
      ...props.modelValue.schedule_spec,
    },
  });
}

function setScheduleType(scheduleType: "once" | "cron") {
  if (props.typeLocked || scheduleType === props.modelValue.schedule_type) {
    return;
  }
  update({
    schedule_type: scheduleType,
    schedule_spec:
      scheduleType === "once"
        ? { run_at: "" }
        : { cron: serializeCron(preset.value, parts.value) },
  });
}

function emitCron() {
  if (resetting) return;
  emittedCron = serializeCron(preset.value, parts.value);
  update({ schedule_spec: { cron: emittedCron } });
}

function setPreset(event: Event) {
  preset.value = (event.target as HTMLSelectElement).value as CronPreset;
  if (preset.value === "custom") {
    parts.value = {
      raw: props.modelValue.schedule_spec.cron ?? "0 9 * * *",
    };
  }
  if (preset.value === "weekly" && !parts.value.weekdays?.length) {
    parts.value = { ...parts.value, weekdays: ["mon"] };
  }
  if (preset.value === "monthly" && !parts.value.dayOfMonth) {
    parts.value = { ...parts.value, dayOfMonth: 1 };
  }
  emitCron();
}

function setNumber(field: "minute" | "hour" | "dayOfMonth", event: Event) {
  parts.value = {
    ...parts.value,
    [field]: Number((event.target as HTMLInputElement).value),
  };
  emitCron();
}

function toggleWeekday(day: Weekday, checked: boolean) {
  const current = new Set(parts.value.weekdays ?? []);
  if (checked) current.add(day);
  else current.delete(day);
  parts.value = {
    ...parts.value,
    weekdays: WEEKDAYS.filter((candidate) => current.has(candidate)),
  };
  emitCron();
}

function setRawCron(event: Event) {
  parts.value = {
    ...parts.value,
    raw: (event.target as HTMLInputElement).value,
  };
  emitCron();
}

const timezoneSuggestions = computed(() => {
  try {
    const supported = (
      Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    return supported?.length
      ? supported
      : ["UTC", "Asia/Shanghai", "America/New_York", "Europe/London"];
  } catch {
    return ["UTC", "Asia/Shanghai", "America/New_York", "Europe/London"];
  }
});

const preview = computed(() => {
  const locale = $i18n.locale.value === "zh-CN" ? "zh" : "en";
  if (props.modelValue.schedule_type === "once") {
    return describeSchedule(
      {
        scheduleType: "once",
        runAtLocal: props.modelValue.schedule_spec.run_at ?? "",
        timezone: props.modelValue.timezone,
      },
      locale,
    );
  }
  return describeSchedule(
    {
      scheduleType: "cron",
      preset: preset.value,
      parts: parts.value,
      timezone: props.modelValue.timezone,
    },
    locale,
  );
});
</script>

<template>
  <fieldset class="space-y-3">
    <div class="flex gap-2" data-testid="scheduled-task-schedule-type">
      <button
        v-for="kind in ['cron', 'once'] as const"
        :key="kind"
        type="button"
        class="rounded-md border px-3 py-1.5 text-sm"
        :class="modelValue.schedule_type === kind ? 'bg-accent' : ''"
        :disabled="typeLocked"
        @click="setScheduleType(kind)"
      >
        {{ $i18n.t.value.scheduledTasks.scheduleType[kind] }}
      </button>
    </div>

    <template v-if="modelValue.schedule_type === 'cron'">
      <label class="block text-sm">
        <span>{{ $i18n.t.value.scheduledTasks.preset.label }}</span>
        <select
          data-testid="scheduled-task-cron-preset"
          class="border-input mt-1 w-full rounded-md border px-3 py-2"
          :value="preset"
          @change="setPreset"
        >
          <option
            v-for="kind in [
              'hourly',
              'daily',
              'weekly',
              'monthly',
              'custom',
            ] as const"
            :key="kind"
            :value="kind"
          >
            {{ $i18n.t.value.scheduledTasks.preset[kind] }}
          </option>
        </select>
      </label>
      <div v-if="preset !== 'custom'" class="grid gap-3 sm:grid-cols-2">
        <label v-if="preset !== 'hourly'" class="text-sm">
          <span>{{ $i18n.t.value.scheduledTasks.fields.time }}</span>
          <input
            :aria-label="$i18n.t.value.scheduledTasks.fields.time"
            type="number"
            min="0"
            max="23"
            class="border-input mt-1 w-full rounded-md border px-3 py-2"
            :value="parts.hour ?? 9"
            @input="setNumber('hour', $event)"
          />
        </label>
        <label class="text-sm">
          <span>{{ $i18n.t.value.scheduledTasks.fields.minute }}</span>
          <input
            :aria-label="$i18n.t.value.scheduledTasks.fields.minute"
            type="number"
            min="0"
            max="59"
            class="border-input mt-1 w-full rounded-md border px-3 py-2"
            :value="parts.minute ?? 0"
            @input="setNumber('minute', $event)"
          />
        </label>
      </div>
      <fieldset v-if="preset === 'weekly'" class="space-y-1">
        <legend class="text-sm">
          {{ $i18n.t.value.scheduledTasks.fields.weekday }}
        </legend>
        <div class="flex flex-wrap gap-2">
          <label v-for="day in WEEKDAYS" :key="day" class="text-sm">
            <input
              type="checkbox"
              :checked="parts.weekdays?.includes(day)"
              @change="
                toggleWeekday(day, ($event.target as HTMLInputElement).checked)
              "
            />
            {{ $i18n.t.value.scheduledTasks.weekdays[day] }}
          </label>
        </div>
      </fieldset>
      <label v-if="preset === 'monthly'" class="block text-sm">
        <span>{{ $i18n.t.value.scheduledTasks.fields.dayOfMonth }}</span>
        <input
          type="number"
          min="1"
          max="31"
          class="border-input mt-1 w-full rounded-md border px-3 py-2"
          :value="parts.dayOfMonth ?? 1"
          @input="setNumber('dayOfMonth', $event)"
        />
      </label>
      <label v-if="preset === 'custom'" class="block text-sm">
        <span>{{ $i18n.t.value.scheduledTasks.fields.cron }}</span>
        <input
          data-testid="scheduled-task-custom-cron"
          class="border-input mt-1 w-full rounded-md border px-3 py-2 font-mono"
          :placeholder="$i18n.t.value.scheduledTasks.fields.cronPlaceholder"
          :value="parts.raw ?? ''"
          @input="setRawCron"
        />
      </label>
    </template>
    <label v-else class="block text-sm">
      <span>{{ $i18n.t.value.scheduledTasks.fields.runAt }}</span>
      <input
        data-testid="scheduled-task-run-at"
        type="datetime-local"
        required
        class="border-input mt-1 w-full rounded-md border px-3 py-2"
        :value="modelValue.schedule_spec.run_at ?? ''"
        @input="
          update({
            schedule_spec: {
              run_at: ($event.target as HTMLInputElement).value,
            },
          })
        "
      />
    </label>

    <label class="block text-sm">
      <span>{{ $i18n.t.value.scheduledTasks.fields.timezone }}</span>
      <input
        data-testid="scheduled-task-timezone"
        list="scheduled-task-timezones"
        required
        class="border-input mt-1 w-full rounded-md border px-3 py-2"
        :value="modelValue.timezone"
        @input="update({ timezone: ($event.target as HTMLInputElement).value })"
      />
      <datalist id="scheduled-task-timezones">
        <option
          v-for="timezone in timezoneSuggestions"
          :key="timezone"
          :value="timezone"
        />
      </datalist>
    </label>
    <p
      data-testid="scheduled-task-schedule-preview"
      class="text-muted-foreground text-xs"
    >
      {{ $i18n.t.value.scheduledTasks.preview }}: {{ preview }}
    </p>
  </fieldset>
</template>
