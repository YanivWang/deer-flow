/*
  【文件职责】     安装 @tanstack/vue-query，并把默认查询策略钉在一处。
  【对应 frontend/】 frontend/src/app/providers.tsx 的 QueryClientProvider
  【架构位置】     L3
  【主要导出】     Nuxt plugin
  【依赖关系】     @tanstack/vue-query
  【边界与注意】   05 A7 / A8 的验收对象就是这个 client——在它存在之前，「失效
                   持久化历史缓存」没有作用对象，这也是 06 把 A7/A8 从 M2 顺延到
                   M4a 的全部理由。

                   `retry: false` 与上游一致。**不要改成默认的 3 次重试**：
                   thread history 的 404 意味着 thread 不存在（上游把 403 也当
                   404 处理，为的是不泄露「这个 thread 存不存在」），重试三次
                   只是把跳回空聊天页这件事推迟 3 秒。

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
