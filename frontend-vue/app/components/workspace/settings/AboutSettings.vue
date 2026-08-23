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
    <h2>{{ $i18n.t.value.settings.about.title }}</h2>
    <p>{{ $i18n.t.value.settings.about.description }}</p>
    <h3>{{ $i18n.t.value.settings.about.safetyTitle }}</h3>
    <p>{{ $i18n.t.value.settings.about.safetyDescription }}</p>
    <h3>{{ $i18n.t.value.settings.about.runtimeTitle }}</h3>
    <p>{{ $i18n.t.value.settings.about.runtimeDescription }}</p>
  </article>
</template>
