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
    <!--
      上游 todo-list.tsx:45 这一层是一个**挂着 onClick 的 `<header>`**，不是按钮：
      键盘用户根本折不动这块面板。本仓这里是 `<button` + `aria-expanded`，
      **有意不跟**（那是上游自己的可达性缺陷，按 wave 28 的判据属于「两边同改」，
      账记在交接文档，不在这一轮改 `frontend/`）。

      外观照抄上游那一层：`min-h-8`（上游 32px，本仓原来 `min-h-9` 高 4px）、
      `cursor-pointer`（上游显式写了；Tailwind 4 的 preflight 不给按钮小手，
      本仓这颗此前是箭头）、`transition-all duration-300 ease-out`，
      以及箭头自己的 `text-muted-foreground`——上游那颗箭头是中灰的，
      本仓原来继承前景色，比上游深一档（坑 204：颜色只能从渲染读，不能从 class 推）。
    -->
    <button
      type="button"
      class="bg-accent flex min-h-8 w-full cursor-pointer items-center justify-between px-4 text-sm transition-all duration-300 ease-out"
      :aria-expanded="!collapsed"
      @click="collapsed = !collapsed"
    >
      <span class="text-muted-foreground flex items-center gap-2">
        <ListTodo :size="16" /> To-dos
      </span>
      <ChevronUp
        :size="16"
        class="text-muted-foreground transition-transform duration-300 ease-out"
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
