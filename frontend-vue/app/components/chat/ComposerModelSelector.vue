<script setup lang="ts">
/*
  【文件职责】     统一主聊天与 Sidecar 的模型选择器尺寸、截断和菜单交互。
  【架构位置】     L3
  【主要导出】     默认 ComposerModelSelector 组件
  【依赖关系】     Model 展示契约 · composer controls · ui/dropdown-menu
  【边界与注意】   160px 仅用于窄屏兜底；sm 以上与 React 一致放宽到 224px。
                   菜单开合、方向键、Escape 与焦点归还都属于 primitive，
                   这里只负责选中语义与尺寸合同。

                   **没有选中模型时触发器照样渲染**，只是没有名字——React 的
                   ModelSelectorTrigger 就是这样（frontend/src/components/workspace/
                   input-box.tsx 里它渲染 selectedModel?.display_name）。用 v-if 把它
                   整个藏起来，工具条的控件个数会随后端返回什么而变，键盘 Tab 顺序也跟着变。
                   也**不加** aria-label：名字只能来自看得见的那行文字，否则读屏器会念出
                   一个屏幕上并不存在的模型名。
*/
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Model } from "@/core/models/types";

/*
  外面传进来的 class 要落在**触发器按钮**上，不是落在一层包装 div 上——sidecar 用
  `.sidecar-model-control { display: none }` 在窄面板里藏掉这个控件，而那层包装已经
  被去掉了（原因见模板里的说明）。根节点是 DropdownMenu 这个无 DOM 的 provider，
  默认继承会把 class 交给它、也就是交给空气，所以这里显式绑到按钮上。
*/
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    models: readonly Model[];
    selectedModel?: Model;
    testId?: string;
  }>(),
  { selectedModel: undefined, testId: "composer-model-selector" },
);

const emit = defineEmits<{
  select: [model: Model];
}>();

function selectModel(name: string) {
  const model = props.models.find((candidate) => candidate.name === name);
  if (model) emit("select", model);
}
</script>

<template>
  <!--
    触发器**直接**是工具条的 flex 子项，外面不再包一层 div。包着的时候按钮是行内块，
    行盒会在基线下面留出约 2px 的下沉空间，于是整条工具条比 React 高 2px，输入框
    跟着下移——React 那边 ModelSelectorTrigger 用 asChild 直接落在按钮上，没有这层。
  -->
  <DropdownMenu>
    <DropdownMenuTrigger>
      <button
        v-bind="$attrs"
        type="button"
        :data-testid="testId"
        class="hover:bg-accent h-8 max-w-40 min-w-0 rounded-md px-2.5 text-xs sm:max-w-56"
      >
        <span class="block truncate">{{ selectedModel?.display_name }}</span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" side="top" class="w-56">
      <DropdownMenuRadioGroup
        :model-value="selectedModel?.name"
        @update:model-value="selectModel(String($event))"
      >
        <DropdownMenuRadioItem
          v-for="model in models"
          :key="model.id"
          :value="model.name"
          class="text-sm"
        >
          {{ model.display_name }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
