<script setup lang="ts">
/*
  【文件职责】     为公开只读案例提供无 workspace 控件的全屏外壳。
  【架构位置】     L3
  【主要导出】     showcase layout
  【依赖关系】     WorkspaceToaster · workspace-shell/toast
  【边界与注意】   不渲染侧栏、设置或登录入口，避免公开案例进入可写工作区。

                   **但 toast viewport 要挂。** 上游的
                   `frontend/src/app/showcase/[thread_id]/layout.tsx` 里就有一个
                   `<Toaster position="top-center" />`——只读不等于没有反馈：导出成功/
                   失败这类提示在案例页上照样要说得出来。本仓此前这一层没有 owner，
                   于是任何调 `useWorkspaceToast()` 的组件（ExportTrigger）一挂上就抛错，
                   案例页只能靠把那些组件整个删掉来绕开，头部因此比上游少一颗按钮。
*/
import { onUnmounted } from "vue";

import WorkspaceToaster from "@/components/workspace/WorkspaceToaster.vue";
import { provideWorkspaceToast } from "@/core/workspace-shell/toast";

const toast = provideWorkspaceToast();
onUnmounted(() => toast.clear());
</script>

<template>
  <!--
    toast viewport 是 `<main>` 的**兄弟**而不是子节点，与上游同构：那边
    `<Toaster />` 挂在 SidebarInset（也就是那个 main）外面。放进 main 里，
    读屏器的「跳到主内容」之后会把一个永远在那儿的空 live region 也算进正文。
  -->
  <div class="bg-background text-foreground h-screen overflow-hidden">
    <main class="size-full">
      <slot />
    </main>
    <WorkspaceToaster />
  </div>
</template>
