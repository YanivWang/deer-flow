<script setup lang="ts">
/*
  【文件职责】     创建 DeerFlow custom agent 的命名步骤，确认后交给 bootstrap 会话。
  【架构位置】     L3 application page
  【主要导出】     默认 new agent page
  【依赖关系】     agents API · core/input/ime · AgentChat · ui/input · ui/button
  【边界与注意】   agent 管理业务，不属于 L2。

                   这一屏**不在对照取样面里**：覆盖率棘轮要求场景 id 逐字等于
                   `frontend/tests/e2e/*.spec.ts` 的文件名，而上游没有任何一条 spec
                   走到 `/workspace/agents/new`（坑 107）。所以它的对齐只能靠 probe
                   实测 + 单测守住，台账天生看不见——**别拿「台账是 0」当这一屏对齐
                   的证据**。wave 28 的 probe 实测差异是 9 行（5 onlyReact / 4 onlyVue），
                   下面每一处都对着其中一条。

                   命名步骤逐块对着上游 `frontend/src/app/workspace/agents/new/page.tsx`：
                   顶部 header（返回 + createPageTitle 的 h1）、圆形头像里的 Bot、
                   h2 的步骤标题、Input、错误段落、整宽的 Continue。此前本仓这一屏是
                   一张手搓的 `<form>`：没有 header、标题是 h1、按钮永不禁用，
                   `agents.createPageTitle` 与 `agents.nameStepNetworkError` 两条词条
                   因此在本仓零消费。

                   **输入框的可访问名来自 placeholder，不写 aria-label**——上游那颗
                   `<Input>` 就只有 placeholder，读屏器念的是 "e.g. code-reviewer"。
                   本仓原来挂了 `:aria-label="nameStepTitle"`，于是同一颗输入框两边
                   念出来的名字不同，快照里还多一行 `/placeholder:`（值也从行内挪成了
                   兄弟节点）。名字上方就是同文的 h2，信息没有丢。

                   **回车走 keydown 而不是 form submit**：上游是
                   `onKeyDown` + `isIMEComposing` 守卫，没有 `<form>`、也没有
                   `required`。留着原来的原生表单校验，空值回车会弹一个上游根本没有的
                   浏览器气泡。

                   **按钮文案恒为 nameStepContinue**：检查中只置灰不换字，与上游一致。
                   本仓原来那条"正在检查…"的词条**上游根本没有**（是本仓自己加的），
                   换回上游文案之后它零消费，所以整条从三份词典里删掉，而不是挂进
                   已审阅 unused 集——那个集合是给"上游有、上游自己也不用"的条目
                   （如 inputBox 里的 voiceInputStop）准备的。

                   （注释里**故意不写成带点的完整 key**：unused 扫描器按
                   `/\.([A-Za-z_$][\w$]*)/` 扫全文，注释里写一次 `x.leafName`
                   就会把那条 key 算成"有人用"，于是它从 unused 集里消失——
                   一条真正的死条目会因为一句注释被埋掉。坑 10 的同一条机制。）
*/
import { onMounted, ref } from "vue";
import { ArrowLeft, Bot } from "lucide-vue-next";

import AgentChat from "@/components/chat/AgentChat.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AgentNameCheckError,
  AgentsApiDisabledError,
  checkAgentName,
} from "@/core/agents/api";
import { isImeComposing } from "@/core/input/ime";

definePageMeta({ layout: "workspace" });
const { $i18n } = useNuxtApp();
const name = ref("");
const confirmedName = ref<string | null>(null);
const checking = ref(false);
const error = ref("");
const compositionActive = ref(false);
const nameField = ref<{ $el?: unknown } | null>(null);
const namePattern = /^[A-Za-z0-9-]+$/;

/*
  上游那颗 Input 带 `autoFocus`，React 是挂载后调 `.focus()`。裸 `autofocus`
  属性在水合出来的页面上不可靠（元素在解析时就已经存在，属性不会再触发一次），
  所以照 React 的做法在 onMounted 里显式聚焦。
*/
onMounted(() => {
  const el = nameField.value?.$el;
  if (el instanceof HTMLInputElement) el.focus();
});

function onNameInput() {
  // 上游 onChange 每次都清错误提示（page.tsx 的 setNameError("")）。
  error.value = "";
}

function onNameKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || isImeComposing(event, compositionActive.value)) {
    return;
  }
  event.preventDefault();
  void continueSetup();
}

async function continueSetup() {
  const candidate = name.value.trim();
  if (!candidate || checking.value) return;
  error.value = "";
  if (!namePattern.test(candidate)) {
    error.value = $i18n.t.value.agents.nameStepInvalidError;
    return;
  }
  checking.value = true;
  try {
    const result = await checkAgentName(candidate);
    if (!result.available) {
      error.value = $i18n.t.value.agents.nameStepAlreadyExistsError;
      return;
    }
    confirmedName.value = candidate;
  } catch (cause) {
    error.value = describeNameCheckFailure(cause);
  } finally {
    checking.value = false;
  }
}

/*
  三条分支与上游同构（page.tsx 的 catch）。`backend_unreachable` 单独一条是上游
  刻意的：后端连不上和后端拒绝这个名字，用户能做的事完全不同。本仓此前把它并进
  了通用兜底，`agents.nameStepNetworkError` 于是一直零消费。
*/
function describeNameCheckFailure(cause: unknown): string {
  const t = $i18n.t.value.agents;
  if (cause instanceof AgentsApiDisabledError)
    return t.nameStepApiDisabledError;
  if (cause instanceof AgentNameCheckError) {
    if (cause.reason === "backend_unreachable") return t.nameStepNetworkError;
    if (cause.detail) {
      return t.nameStepCheckErrorWithDetail.replace("{detail}", cause.detail);
    }
  }
  return t.nameStepCheckError;
}
</script>

<template>
  <div v-if="confirmedName" class="size-full">
    <AgentChat :agent-name="confirmedName" bootstrap />
  </div>
  <div v-else class="flex size-full flex-col">
    <header
      class="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
    >
      <div class="flex items-center gap-3">
        <!--
          上游这颗返回键是**没有可访问名**的（ghost + icon-sm 里只有一个
          ArrowLeftIcon），而同一个 header 里紧挨着的 More 按钮写着
          `aria-label={t.agents.more}`——同一处 header 里一颗有名一颗没名，
          是漏写不是设计。已两边同改，标签取 agents.backToGallery（它去的正是
          agent 画廊），两边的树仍逐行一致。
        -->
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="$i18n.t.value.agents.backToGallery"
          @click="navigateTo('/workspace/agents')"
        >
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <h1 class="text-sm font-semibold">
          {{ $i18n.t.value.agents.createPageTitle }}
        </h1>
      </div>
    </header>
    <main class="flex flex-1 flex-col items-center justify-center px-4">
      <div class="w-full max-w-sm space-y-8">
        <div class="space-y-3 text-center">
          <div
            class="bg-primary/10 mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          >
            <Bot class="text-primary h-7 w-7" />
          </div>
          <div class="space-y-1">
            <h2 class="text-xl font-semibold">
              {{ $i18n.t.value.agents.nameStepTitle }}
            </h2>
            <p class="text-muted-foreground text-sm">
              {{ $i18n.t.value.agents.nameStepHint }}
            </p>
          </div>
        </div>
        <div class="space-y-3">
          <Input
            ref="nameField"
            v-model="name"
            :placeholder="$i18n.t.value.agents.nameStepPlaceholder"
            :class="error ? 'border-destructive' : ''"
            @update:model-value="onNameInput"
            @keydown="onNameKeydown"
            @compositionstart="compositionActive = true"
            @compositionend="compositionActive = false"
          />
          <!--
            上游这一段是裸 `<p>`，没有 role。但上游自己在另外两处**同形**的表单
            错误上都写了 `role="alert"`（account-settings-page.tsx:133、
            human-input-card.tsx:339），而这一屏点完 Continue 焦点还留在按钮上，
            不播报就等于没有提示。按「同一份代码库里的既定写法」判定为漏写，
            已两边同改。
          -->
          <p v-if="error" role="alert" class="text-destructive text-sm">
            {{ error }}
          </p>
          <Button
            class="w-full"
            :disabled="!name.trim() || checking"
            @click="continueSetup"
          >
            {{ $i18n.t.value.agents.nameStepContinue }}
          </Button>
        </div>
      </div>
    </main>
  </div>
</template>
