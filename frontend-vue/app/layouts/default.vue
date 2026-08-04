<!--
  【文件职责】     提供营销占位页的公共布局。
  【对应 frontend/】 frontend/src/app/layout.tsx
  【架构位置】     L3
  【主要导出】     default layout
  【依赖关系】     被三个营销页使用
  【边界与注意】   不迁移 React landing 动效。
-->

<template>
  <div class="bg-background text-foreground min-h-screen">
    <header class="border-b px-6 py-4 font-semibold">DeerFlow Vue</header>
    <main class="mx-auto max-w-5xl p-8"><slot /></main>
  </div>
</template>
