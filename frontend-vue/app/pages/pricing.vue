<!--
  【文件职责】     展示 pricing 营销占位页。
  【架构位置】     L3
  【主要导出】     /pricing 页面
  【依赖关系】     使用 default layout
  【边界与注意】   ⚠️ React 没有 `/pricing` 这条路由，它的落地页导航只链到
                   `/{lang}/docs` 与 `/blog/posts`（frontend/src/components/landing/
                   header.tsx）。按「React 没有的 Vue 不许有」，本页应当删除；
                   保留与否待定，在定论前不要把它当成已对齐的产品页。
-->

<template>
  <h1 class="text-3xl font-semibold">
    {{ $i18n.t.value.marketing.pricingPlaceholder }}
  </h1>
</template>
