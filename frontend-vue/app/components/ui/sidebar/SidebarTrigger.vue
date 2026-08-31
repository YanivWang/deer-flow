<!--
  【文件职责】     侧栏开合触发器（上游 `SidebarTrigger`，frontend/src/components/ui/sidebar.tsx:256）。
  【架构位置】     L2 —— 通用 UI primitive
  【主要导出】     SidebarTrigger 组件
  【依赖关系】     ../button/Button.vue · @/lib/utils · lucide-vue-next
  【边界与注意】   ① **`open` 是必填 prop，没有默认值。** 本仓此前有三份手搓副本
                   （AgentChat / WorkspaceContainer / ThreadSidebar），其中两份只往
                   window 上发一个全局事件、**根本拿不到开合态**，于是它们连「该画哪个
                   图标」都答不出来，只能各自挑一个固定图标（Menu / ChevronRight）。
                   把 open 做成必填而不是给个默认值，是为了让「谁来回答这个状态」
                   在编译期就必须有人认领——给默认值等于把同一个 bug 换个地方再犯一次。

                   ② **图标尺寸不写 `:size`，靠 Button base 的
                   `[&_svg:not([class*='size-'])]:size-4` 用 CSS 压到 16。**
                   这是上游同一条机制：lucide 渲染的是 `<svg width="24" height="24">`,
                   CSS 的 width/height 覆盖表现属性。写 `:size="16"` 结果一样但机制不同——
                   将来 Button 的图标档位一改，写死的那份不会跟着走。
                   happy-dom 不算 computed style，所以这条判据由 e2e 几何 probe 给，
                   不由单测给（实测 React 与本仓都是 16×16）。

                   ③ **`data-slot="sidebar-trigger"` 覆盖 Button 自己的 `data-slot="button"`。**
                   靠的是 Vue 的 fallthrough attrs 在根元素上后来居上，与上游 React
                   `{...props}` 展开在 `data-slot="button"` 之后是同一个结果
                   （React probe 实测该按钮的 data-slot 是 sidebar-trigger）。
                   这条有单测钉住——它是「里层赢还是外层赢」那类反直觉点，见坑 62。

                   ④ **名字走 `primitives.toggleSidebar`，不是 sr-only span。**
                   上游写死英文 "Toggle Sidebar"，本仓按 untranslated-primitive-names
                   的约定改成词典 key + aria-label：可访问名一致，不进可见文本。
                   名字**不随开合态变**（上游也不变）：读屏器每折叠一次就重念一遍按钮，
                   用户听到的会是"控件变了"，其实只是状态变了。
-->

<script setup lang="ts">
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-vue-next";
import { computed } from "vue";

import { cn } from "@/lib/utils";

import Button from "../button/Button.vue";

const props = withDefaults(defineProps<{ open: boolean; class?: string }>(), {
  class: "",
});

const classes = computed(() =>
  cn("size-7 opacity-50 hover:opacity-100", props.class),
);
</script>

<template>
  <Button
    data-sidebar="trigger"
    data-slot="sidebar-trigger"
    variant="ghost"
    size="icon"
    :class="classes"
  >
    <PanelLeftCloseIcon v-if="open" />
    <PanelLeftOpenIcon v-else />
  </Button>
</template>
