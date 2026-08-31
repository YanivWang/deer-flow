<!--
  【文件职责】     折叠容器的根，持有 open 状态并向内容层广播 data-state。
  【架构位置】     L2
  【主要导出】     Collapsible 组件
  【依赖关系】     reka-ui CollapsibleRoot
  【边界与注意】   `unmountOnHide` 用 reka 的默认值（true），**不要**传 false 去「对齐
                   radix 会把节点留着」这件事——那是读源码之后才看清的一个反直觉点：

                   reka 的 CollapsibleContent 无论如何都把外层 Presence 设成
                   force-mount，元素一直在 DOM 里；unmountOnHide 决定的是
                   ①折叠时子内容渲不渲染，②`hidden` 属性取什么值：
                     - true（默认）→ `hidden=""`，即 display:none，子内容不渲染；
                     - false        → `hidden="until-found"`，即
                       content-visibility:hidden，**元素仍有盒子**，`mt-2 px-4 pb-4`
                       照样撑开，折叠着的 prompt 还会被浏览器页内查找翻出来。
                   上游 radix 给的是 `hidden=""`（probe 实测 React 折叠态那个 div
                   display:none、盒子 0×0），所以默认值才是对齐的那一个。

                   happy-dom 把 hidden 当布尔属性、两种情况都序列化成 `hidden=""`，
                   看不出这个区别，所以这条判据的来源是 reka 的源码，不是单测输出。

                   **`update:open` 必须显式声明并转发，靠 fallthrough 是不行的。**
                   Vue 的 `renderComponentRoot` 在把 `$attrs` 合并到根 vnode 之前会跑
                   `filterModelListeners`（runtime-core 3.5.40 第 4759 行）：凡是
                   `onUpdate:<key>` 且本组件**声明了名为 `<key>` 的 prop**，就从
                   fallthrough 里剔掉——它假定这一层自己在做 `v-model:<key>`，
                   剔掉是为了避免双重 emit。本组件恰好声明了 `open`，于是
                   `@update:open` 会被静默吞掉：**不报警告、不报错，点击触发器
                   毫无反应**。wave 14 实测：同一个 Host 直接挂 reka 的
                   CollapsibleRoot 能收到 `update:open`，套上这一层就收不到。
-->
<script setup lang="ts">
import { CollapsibleRoot } from "reka-ui";

defineProps<{ open?: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
</script>

<template>
  <CollapsibleRoot
    data-slot="collapsible"
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </CollapsibleRoot>
</template>
