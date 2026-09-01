<script setup lang="ts">
/*
  【文件职责】     统一主聊天与 Sidecar 的模型选择器：带搜索的命令面板对话框。
  【架构位置】     L3
  【主要导出】     默认 ComposerModelSelector 组件
  【依赖关系】     Model 展示契约 · composer controls · ui/dialog · ui/command
  【边界与注意】   160px 仅用于窄屏兜底；sm 以上与 React 一致放宽到 224px。
                   对话框开合、方向键、Escape 与焦点归还都属于 primitive，
                   这里只负责选中语义与尺寸合同。

                   **是 Dialog + Command，不是下拉菜单。** 上游
                   frontend/src/components/ai-elements/model-selector.tsx 整份就是
                   Dialog + Command 的薄包装（ModelSelectorContent = DialogContent
                   p-0 + sr-only DialogTitle + Command），两个调用点
                   （input-box.tsx:2683、sidecar/sidecar-panel.tsx:949）都渲染
                   ModelSelectorInput + ModelSelectorList。本仓原来是
                   DropdownMenu + RadioGroup，**没有搜索框**，于是
                   `inputBox.searchModels` 一直躺在未引用词条里。

                   **筛选由本组件做**，Command primitive 不接管（与
                   workspace/CommandPalette.vue 同一条约定）。判据字段跟着上游走：
                   上游把 `value={m.name}` 交给 cmdk，cmdk 就只拿这一个字段打分，
                   所以这里也只看 `model.name`。**唯一已知分叉**：cmdk 是模糊评分
                   （command-score），这里是大小写无关的子串匹配——"minimax m3"
                   在上游能命中 `minimax-m3`，在这里不能。没有为此引入评分库。

                   **没有 CommandEmpty**：上游两个调用点都没渲染
                   ModelSelectorEmpty，无匹配时列表就是空的。补一句"无结果"会凭空
                   多出一条上游没有的词条与一行可访问文本。

                   **没有选中模型时触发器照样渲染**，只是没有名字——React 的
                   ModelSelectorTrigger 就是这样（input-box.tsx 里它渲染
                   selectedModel?.display_name）。用 v-if 把它整个藏起来，工具条的
                   控件个数会随后端返回什么而变，键盘 Tab 顺序也跟着变。
                   也**不加** aria-label：名字只能来自看得见的那行文字，否则读屏器会念出
                   一个屏幕上并不存在的模型名。
                   （sidecar 那一支例外，它在调用点上 v-if——上游
                   SidecarModelSelector 开头就是 `if (!selectedModel) return null`。）

                   开合状态留在组件内部。上游把 modelDialogOpen 提到两个调用点各自
                   的 useState 里，只为了在 handleModelSelect 末尾 setOpen(false)；
                   两个调用点都没有别的写入方，所以这里内聚成本组件自己的 ref，
                   对外行为一致。
*/
import { computed, ref, watch } from "vue";
import { Check } from "lucide-vue-next";

import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Model } from "@/core/models/types";

/*
  外面传进来的 class 要落在**触发器按钮**上，不是落在一层包装 div 上——sidecar 用
  `.sidecar-model-control { display: none }` 在窄面板里藏掉这个控件，而那层包装已经
  被去掉了（原因见模板里的说明）。根节点是 Dialog 这个无 DOM 的 provider，
  默认继承会把 class 交给它、也就是交给空气，所以这里显式绑到按钮上。
*/
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    models: readonly Model[];
    selectedModel?: Model;
    disabled?: boolean;
    testId?: string;
  }>(),
  {
    selectedModel: undefined,
    disabled: false,
    testId: "composer-model-selector",
  },
);

const emit = defineEmits<{
  select: [model: Model];
}>();

const { $i18n } = useNuxtApp();

const open = ref(false);
const search = ref("");

/*
  每次打开都从空查询开始。上游每次开合都重新挂载 CommandInput（cmdk 的
  CommandDialog 在关闭时卸载内容），于是上一次的查询不会留到下一次。
*/
watch(open, (value) => {
  if (value) search.value = "";
});

const filteredModels = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  if (!query) return props.models;
  return props.models.filter((model) =>
    model.name.toLocaleLowerCase().includes(query),
  );
});

function selectModel(model: Model) {
  /*
    上游两个 handleModelSelect 都在 disabled/润色中直接 return。触发器已经是
    disabled 了，但键盘从已打开的对话框里仍然够得着列表项，所以这一层也要拦。
  */
  if (props.disabled) return;
  open.value = false;
  emit("select", model);
}
</script>

<template>
  <!--
    触发器**直接**是工具条的 flex 子项，外面不再包一层 div。包着的时候按钮是行内块，
    行盒会在基线下面留出约 2px 的下沉空间，于是整条工具条比 React 高 2px，输入框
    跟着下移——React 那边 ModelSelectorTrigger 用 asChild 直接落在按钮上，没有这层。
  -->
  <Dialog v-model:open="open">
    <DialogTrigger>
      <button
        v-bind="$attrs"
        type="button"
        :data-testid="testId"
        :disabled="disabled"
        class="hover:bg-accent h-8 max-w-40 min-w-0 rounded-md px-2.5 text-xs disabled:opacity-50 sm:max-w-56"
      >
        <span class="block truncate">{{ selectedModel?.display_name }}</span>
      </button>
    </DialogTrigger>
    <DialogContent
      class="gap-0 overflow-hidden p-0"
      :close-label="$i18n.t.value.primitives.close"
    >
      <!--
        上游只给了一个 sr-only 的标题、没有 DialogDescription，默认文案是写死的
        英文 "Model Selector"（model-selector.tsx:40）。按「primitive 的可访问名
        照抄」那条约定走 primitives.*，不另造产品文案。
      -->
      <DialogTitle class="sr-only">
        {{ $i18n.t.value.primitives.modelSelector }}
      </DialogTitle>
      <Command>
        <CommandInput
          v-model="search"
          :placeholder="$i18n.t.value.inputBox.searchModels"
          :aria-label="$i18n.t.value.inputBox.searchModels"
        />
        <CommandList>
          <CommandItem
            v-for="model in filteredModels"
            :key="model.id"
            :value="model.name"
            @select="selectModel(model)"
          >
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="flex-1 truncate text-left text-xs">{{
                model.display_name
              }}</span>
              <span class="text-muted-foreground truncate text-[10px]">{{
                model.model
              }}</span>
            </div>
            <Check
              v-if="model.name === selectedModel?.name"
              :size="16"
              class="ml-auto"
            />
            <div v-else class="ml-auto size-4" />
          </CommandItem>
        </CommandList>
      </Command>
    </DialogContent>
  </Dialog>
</template>
