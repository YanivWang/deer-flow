<script setup lang="ts">
/*
  【文件职责】     渲染欢迎态完整快捷建议，并提供创建类型下拉菜单。
  【对应 frontend/】 src/components/workspace/input-box.tsx::SuggestionList
  【架构位置】     L3
  【主要导出】     默认 WelcomeSuggestionList 组件
  【依赖关系】     i18n suggestions · Reka DropdownMenu · Button · ConfettiButton
  【边界与注意】   只回传 prompt；填草稿、占位符选择与发送策略由 ChatComposer 持有。
*/
import { Plus, Sparkles } from "lucide-vue-next";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";

import { Button } from "@/components/ui/button";
import ConfettiButton from "@/components/ui/effects/ConfettiButton.vue";

defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ select: [prompt: string] }>();
const { $i18n } = useNuxtApp();

const suggestionClass =
  "text-muted-foreground dark:bg-background h-auto max-w-full cursor-pointer rounded-full px-4 py-2 text-center text-xs font-normal whitespace-normal";
</script>

<template>
  <div
    data-slot="suggestions-list"
    data-testid="welcome-suggestions"
    class="flex min-h-16 w-full max-w-full flex-wrap items-center justify-center gap-2 self-center px-4 sm:w-fit sm:px-0"
  >
    <ConfettiButton
      variant="outline"
      size="sm"
      class="text-muted-foreground cursor-pointer rounded-full px-4 text-xs font-normal"
      :disabled="disabled"
      @click="emit('select', $i18n.t.value.inputBox.surpriseMePrompt)"
    >
      <Sparkles class="size-4" />
      {{ $i18n.t.value.inputBox.surpriseMe }}
    </ConfettiButton>

    <Button
      v-for="suggestion in $i18n.t.value.inputBox.suggestions"
      :key="suggestion.suggestion"
      type="button"
      variant="outline"
      size="sm"
      :class="suggestionClass"
      :disabled="disabled"
      @click="emit('select', suggestion.prompt)"
    >
      <component :is="suggestion.icon" class="size-4" />
      {{ suggestion.suggestion }}
    </Button>

    <DropdownMenuRoot>
      <DropdownMenuTrigger as-child :disabled="disabled">
        <Button
          data-testid="welcome-create-trigger"
          type="button"
          variant="outline"
          size="sm"
          :class="suggestionClass"
          :disabled="disabled"
        >
          <Plus class="size-4" />
          {{ $i18n.t.value.common.create }}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="start"
          :side-offset="4"
          class="bg-popover text-popover-foreground border-border z-[75] min-w-40 rounded-md border p-1 text-sm shadow-lg"
        >
          <template
            v-for="(suggestion, index) in $i18n.t.value.inputBox
              .suggestionsCreate"
            :key="
              'type' in suggestion
                ? `separator-${index}`
                : suggestion.suggestion
            "
          >
            <DropdownMenuSeparator
              v-if="'type' in suggestion"
              class="bg-border my-1 h-px"
            />
            <DropdownMenuItem
              v-else
              as="button"
              :data-testid="index === 0 ? 'welcome-create-webpage' : undefined"
              class="hover:bg-accent focus:bg-accent flex w-full cursor-default items-center gap-2 rounded px-2 py-1.5 outline-none"
              @select="emit('select', suggestion.prompt)"
            >
              <component :is="suggestion.icon" class="size-4" />
              {{ suggestion.suggestion }}
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
