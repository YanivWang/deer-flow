<!--
  【文件职责】     展示 DeerFlow 版本与项目说明。
  【对应 frontend/】 src/components/workspace/settings/about-settings.tsx
  【架构位置】     L3
  【主要导出】     默认 AboutSettings 组件
  【依赖关系】     settings dialog
  【边界与注意】   产品信息面板，不属于 L2。
-->

<template>
  <article class="prose prose-sm dark:prose-invert max-w-none">
    <h2>About DeerFlow</h2>
    <p>
      DeerFlow is an open-source super agent harness for research, coding,
      content generation, and computer use.
    </p>
    <h3>Safety</h3>
    <p>
      Agent output can be incorrect. Review important results and inspect tool
      actions before relying on them.
    </p>
    <h3>Runtime</h3>
    <p>
      This Vue workspace uses the current DeerFlow Gateway for threads, runs,
      tools, memory, integrations, channels, and scheduled tasks.
    </p>
  </article>
</template>
