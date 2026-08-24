<script setup lang="ts">
/*
  【文件职责】     渲染 Buzz provider 品牌标记。
  【架构位置】     L3
  【主要导出】     默认 BuzzProviderIcon 组件
  【依赖关系】     Vue useId
  【边界与注意】   几何来自 Block Buzz BuzzMark.tsx（Apache-2.0）；相邻 LICENSE 保留许可。
*/
import { useId } from "vue";

const maskId = `buzz-mark-cutouts-${useId().replaceAll(/[^a-zA-Z0-9_-]/g, "")}`;
</script>

<template>
  <svg viewBox="0 0 466 309" fill="currentColor" aria-hidden="true">
    <defs>
      <mask
        :id="maskId"
        x="-80"
        y="-80"
        width="626"
        height="469"
        maskUnits="userSpaceOnUse"
        maskContentUnits="userSpaceOnUse"
      >
        <rect x="-80" y="-80" width="626" height="469" fill="#fff" />
        <ellipse cx="193.3" cy="84.4" rx="27" ry="27" fill="#000" />
        <ellipse cx="276" cy="84.4" rx="27" ry="27" fill="#000" />
        <rect
          x="166.3"
          y="157.2"
          width="136.9"
          height="38.3"
          rx="5"
          fill="#000"
        />
        <rect
          x="166.9"
          y="235.1"
          width="136.2"
          height="37.6"
          rx="5"
          fill="#000"
        />
      </mask>
    </defs>
    <g :mask="`url(#${maskId})`">
      <circle cx="91.7" cy="154.5" r="91.7" />
      <circle cx="374.3" cy="154.5" r="91.7" />
      <rect x="128" y="0" width="210" height="309" rx="34" />
    </g>
  </svg>
</template>
