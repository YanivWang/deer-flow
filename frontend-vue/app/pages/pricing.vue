<!--
  【文件职责】     展示 pricing 营销占位页。
  【对应 frontend/】 无；范围内新增占位页
  【架构位置】     L3
  【主要导出】     /pricing 页面
  【依赖关系】     使用 default layout
  【边界与注意】   仅为预渲染路由验证。
-->

<template>
  <h1 class="text-3xl font-semibold">
    {{ $i18n.t.value.marketing.pricingPlaceholder }}
  </h1>
</template>
