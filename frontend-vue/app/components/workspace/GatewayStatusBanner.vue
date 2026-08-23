<!--
  【文件职责】     在工作区持续显示 Gateway unavailable，并提供同页重试/恢复路径。
  【对应 frontend/】 frontend/src/components/workspace/gateway-offline-banner.tsx
  【架构位置】     L3 workspace authentication surface
  【主要导出】     默认组件
  【依赖关系】     useAuthSession · auth decision · workspace layout
  【边界与注意】   401 才跳登录；unavailable 只显示状态，不能清 session 或 cookie。
-->

<script setup lang="ts">
import { computed, watch } from "vue";

import { useAuthSession } from "@/composables/useAuthSession";
import { buildLoginLocation, isEnabledRuntimeFlag } from "@/core/auth/decision";
import { createGatewayRecoveryTracker } from "@/core/workspace-shell/gateway-recovery";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const { $i18n } = useNuxtApp();
const config = useRuntimeConfig();
const route = useRoute();
const toast = useWorkspaceToast();
const enabled = computed(
  () => !isEnabledRuntimeFlag(config.public.authDisabled),
);
const { session, isFetching, refresh } = useAuthSession({ enabled });
const unavailable = computed(() => session.value?.tag === "unavailable");
const recovery = createGatewayRecoveryTracker(() =>
  toast.success($i18n.t.value.workspace.gatewayRecovered),
);

watch(
  session,
  (current) => {
    recovery.observe(current?.tag);
    if (current?.tag === "unauthenticated") {
      void navigateTo(buildLoginLocation(route.fullPath), { replace: true });
    } else if (current?.tag === "authenticated" && current.user.needs_setup) {
      void navigateTo("/setup", { replace: true });
    }
  },
  // The route middleware can populate the shared Query owner before this
  // component mounts. Observe that first unavailable state too, otherwise the
  // subsequent authenticated value has no unavailable predecessor and the
  // recovery edge is lost.
  { immediate: true },
);
</script>

<template>
  <div
    v-if="unavailable"
    data-gateway-status="unavailable"
    role="status"
    aria-live="polite"
    class="bg-muted text-muted-foreground flex items-center justify-between gap-3 border-b px-4 py-2 text-sm"
  >
    <span>
      {{ $i18n.t.value.workspace.gatewayUnavailable }}
      {{ $i18n.t.value.workspace.gatewayUnavailableRetrying }}
    </span>
    <button
      type="button"
      class="hover:bg-background rounded-md border px-3 py-1 text-xs"
      :disabled="isFetching"
      @click="refresh()"
    >
      {{
        isFetching
          ? $i18n.t.value.workspace.retrying
          : $i18n.t.value.workspace.retryNow
      }}
    </button>
  </div>
</template>
