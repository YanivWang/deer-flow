<script setup lang="ts">
/*
  【文件职责】     agents_api 关闭时替换整页的居中空态。
  【架构位置】     L3 Agent gallery component
  【主要导出】     默认 AgentsFeatureDisabled
  【依赖关系】     i18n · lucide-vue-next
  【边界与注意】   逐段对着上游 `agents-feature-disabled.tsx` 抄的：圆形底 +
                   `BotOff` + 两个 `<p>`，两段文案都是 `<p>` 而不是
                   `<strong>` + 裸文本。这不是排版偏好——读屏器把
                   `strong` 念成强调而不是一个段落，可访问性树上两边就是
                   不同的界面（对照台账在这一格上曾经有 7 行 aria 差异）。

                   上游把它挂在 `app/workspace/agents/layout.tsx` 上，于是
                   `/agents`、`/agents/new` 与 agent 会话页在 flag 关闭时都被它
                   替换掉。本仓的路由没有对应的父级布局，目前只有 `/agents`
                   这一处替换；另外两条路由的门禁属于 workspace shell 那一轮。

                   `data-testid` 是上游没有的：它是 `make e2e-agents` 里
                   「关掉 flag 之后不再打 /api/agents」那条用例的锚点。testid 不进
                   可访问性树也不进几何取样，留着它对跨应用对照零影响。
*/
import { BotOff } from "lucide-vue-next";

const { $i18n } = useNuxtApp();
</script>

<template>
  <div
    data-testid="agents-feature-disabled"
    class="flex size-full flex-col items-center justify-center gap-3 p-6 text-center"
  >
    <div
      class="bg-muted flex h-14 w-14 items-center justify-center rounded-full"
    >
      <BotOff class="text-muted-foreground h-7 w-7" />
    </div>
    <div>
      <p class="font-medium">{{ $i18n.t.value.agents.featureDisabledTitle }}</p>
      <p class="text-muted-foreground mt-1 max-w-md text-sm">
        {{ $i18n.t.value.agents.featureDisabledDescription }}
      </p>
    </div>
  </div>
</template>
