/*
  【文件职责】     安装 @tanstack/vue-query，并把默认查询策略钉在一处。
  【架构位置】     L3
  【主要导出】     Nuxt plugin
  【依赖关系】     @tanstack/vue-query
  【边界与注意】   05 A7 / A8 的验收对象就是这个 client——在它存在之前，「失效
                   持久化历史缓存」没有作用对象，这也是 06 把 A7/A8 从 M2 顺延到
                   M4a 的全部理由。

                   ~~`retry: false` 与上游一致。~~ **⚠ 这句话是错的，wave 128 实测推翻。**
                   上游是 `new QueryClient()`——**没有 defaultOptions**，
                   吃的是 TanStack 的默认值 `retry: 3`。对照台账在
                   `integrations#load-failed` 那个终态上把它量了出来：
                   同一次 500，**上游发了 3 次 `GET /api/integrations/lark/status`，
                   本仓发 1 次**。

                   **决定：保留本仓的 `retry: false`**，判据是 fork-boundary 里
                   那条已授权的例外「vue 有更好的可以保留」——
                   thread history 的 404 意味着 thread 不存在（上游把 403 也当
                   404 处理，为的是不泄露「这个 thread 存不存在」），而 TanStack 的
                   默认重试**不分错误码**，于是重试三次只是把跳回空聊天页推迟 3 秒。
                   **翻案判据**：哪天需要按错误码分流（5xx 重试、4xx 不重试），
                   那时把这里换成一个 `retry: (count, error) => …`，而不是改回默认。

                   `refetchOnWindowFocus: false` 是全局默认，`THREAD_HISTORY_QUERY_POLICY`
                   里又写了一遍——不是冗余：那份策略是上游 `thread-history-options`
                   单测逐字段断言的对象，它必须能脱离 plugin 独立成立。
*/

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient });
});
