<!--
  【文件职责】     DropdownMenu 的分组容器（role="group"）。
  【架构位置】     L2
  【主要导出】     DropdownMenuGroup 组件
  【依赖关系】     Reka DropdownMenuGroup
  【边界与注意】   只做语义分组，不做样式——上游 ui/dropdown-menu.tsx 的
                   DropdownMenuGroup 同样只挂一个 data-slot。

                   wave 86 把侧栏页脚那颗「设置和更多」菜单接进取样面之后补的：
                   上游 workspace-nav-menu.tsx:90 用它把「设置 + 四条外链」括成
                   一组，本仓没有这个 primitive，于是对照树里 `group:` 这一行
                   只在 React 那边有。读屏器会把它念成一个分组，少了就少一层结构。
-->

<script setup lang="ts">
import { DropdownMenuGroup, type DropdownMenuGroupProps } from "reka-ui";

const props = defineProps<DropdownMenuGroupProps>();
</script>

<template>
  <DropdownMenuGroup data-slot="dropdown-menu-group" v-bind="props">
    <slot />
  </DropdownMenuGroup>
</template>
