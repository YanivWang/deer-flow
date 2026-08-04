<!--
  【文件职责】     提供 M0 workspace 空壳布局。
  【对应 frontend/】 frontend/src/app/workspace/layout.tsx
  【架构位置】     L3
  【主要导出】     workspace layout
  【依赖关系】     被 workspace 空壳页使用
  【边界与注意】   不包含聊天、thread、artifact 或 Pinia 业务状态。
-->

<template>
  <div class="bg-background text-foreground min-h-screen">
    <header class="border-b px-6 py-4 font-semibold">
      DeerFlow Workspace · Vue M0
    </header>
    <main class="p-6"><slot /></main>
  </div>
</template>
