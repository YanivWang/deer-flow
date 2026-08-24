<!--
  【文件职责】     展示 about 营销占位页。
  【对应 frontend/】 无；明确豁免的自定义占位页
  【架构位置】     L3
  【主要导出】     /about 页面
  【依赖关系】     使用 default layout
  【边界与注意】   营销页不进入 React/Vue 产品对齐范围。
-->

<template>
  <h1 class="text-3xl font-semibold">
    {{ $i18n.t.value.marketing.aboutPlaceholder }}
  </h1>
</template>
