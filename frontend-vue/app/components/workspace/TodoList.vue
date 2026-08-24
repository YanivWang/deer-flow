<!--
  【文件职责】     折叠展示 thread.values.todos 的真实任务状态。
  【架构位置】     L3 workspace UI adapter
  【主要导出】     默认 TodoList 组件
  【依赖关系】     core/todos
  【边界与注意】   数据所有权在 thread server state；组件只负责 pending/in_progress/completed 展示。
-->

<script setup lang="ts">
import { ref } from "vue";
import { Check, ChevronUp, Circle, ListTodo } from "lucide-vue-next";

import type { Todo } from "@/core/todos";

defineProps<{ todos: Todo[] }>();
const collapsed = ref(true);
</script>

<template>
  <section
    v-if="todos.length"
    class="border-border bg-background overflow-hidden rounded-xl border"
    data-testid="thread-todos"
  >
    <button
      type="button"
      class="bg-accent flex min-h-9 w-full items-center justify-between px-4 text-sm"
      :aria-expanded="!collapsed"
      @click="collapsed = !collapsed"
    >
      <span class="text-muted-foreground flex items-center gap-2">
        <ListTodo :size="16" /> To-dos
      </span>
      <ChevronUp
        :size="16"
        class="transition-transform"
        :class="collapsed ? '' : 'rotate-180'"
      />
    </button>
    <ul v-if="!collapsed" class="space-y-1 p-3">
      <li
        v-for="(todo, index) in todos"
        :key="`${index}:${todo.content}`"
        class="flex items-start gap-2 text-sm"
        :data-status="todo.status"
      >
        <Check
          v-if="todo.status === 'completed'"
          :size="15"
          class="mt-0.5 text-emerald-600"
        />
        <Circle
          v-else
          :size="15"
          class="mt-0.5"
          :class="
            todo.status === 'in_progress'
              ? 'fill-primary text-primary'
              : 'text-muted-foreground'
          "
        />
        <span
          :class="
            todo.status === 'completed'
              ? 'text-muted-foreground line-through'
              : ''
          "
        >
          {{ todo.content }}
        </span>
      </li>
    </ul>
  </section>
</template>
