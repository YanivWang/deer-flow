<script setup lang="ts">
/*
  【文件职责】     会话头部的 sidecar 面板开关。
  【架构位置】     L3
  【主要导出】     默认 SidecarTrigger 组件
  【依赖关系】     Button L2 · Tooltip L2 · lucide-vue-next
  【边界与注意】   这是 `BrowserTrigger.vue` 的孪生件，理由也一模一样，见那份文件头。
                   上游 `sidecar-trigger.tsx` 是一个独立组件，本仓此前把它内联在
                   `AgentChat.vue` 的头部里手写成
                   `<button class="... size-8 ...">◫</button>`。

                   **那个 `◫` 是一个文字字符**（U+25EB，"方框中带竖线"），不是图标：
                   上游画的是 lucide `MessageSquareTextIcon`（一只带横线的对话气泡）。
                   字符会跟着正文字体渲染，字重、基线和字形都由系统字体决定，
                   在两个应用里长得完全不是同一个东西。这条 `ariaSnapshot()` 看不见
                   （可访问名两边都取自 `sidecar.open`/`sidecar.close`），
                   `icon-parity` 也看不见——它只解析 import 进来的图标名，
                   而这里压根没 import 任何图标。

                   尺寸同 BrowserTrigger：`size="icon"` 是 36×36，手写那版是 32×32。
                   图标不传 `:size`，交给 `buttonVariants` 的
                   `[&_svg:not([class*='size-'])]:size-4`。

                   **`pending` 不是装饰。** 上游有一个 `isReconciling` 状态：打开前要
                   带 `force` 重查一次 sidecar 线程（缓存里的 id 可能指向别处删掉的
                   线程，#3555），这期间按钮是 disabled 的。本仓此前 `await` 了那次
                   重查却不锁按钮，于是连点两下会发两次 restore。
*/
import { computed } from "vue";
import { MessageSquareText } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const props = defineProps<{ open: boolean; pending?: boolean }>();
const emit = defineEmits<{ toggle: [] }>();

const { $i18n } = useNuxtApp();
const label = computed(() =>
  props.open ? $i18n.t.value.sidecar.close : $i18n.t.value.sidecar.open,
);
</script>

<template>
  <Tooltip :delay-duration="500">
    <TooltipTrigger>
      <Button
        :aria-label="label"
        class="text-muted-foreground hover:text-foreground"
        data-testid="sidecar-header-trigger"
        :disabled="pending"
        size="icon"
        type="button"
        :variant="open ? 'secondary' : 'ghost'"
        @click="emit('toggle')"
      >
        <MessageSquareText />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{ label }}</TooltipContent>
  </Tooltip>
</template>
