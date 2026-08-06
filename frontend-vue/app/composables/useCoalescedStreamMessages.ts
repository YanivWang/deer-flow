/*
  【文件职责】     把流式消息数组降频成「每 80ms 至多一帧」的渲染快照。
  【对应 frontend/】 core/threads/hooks.ts 的 useCoalescedStreamMessages
  【架构位置】     L3（Vue 适配）
  【主要导出】     useCoalescedStreamMessages
  【依赖关系】     @/core/threads/coalesce · vue
  【边界与注意】   `null` 的含义是「当前这条流还没有属于它的快照」——在前沿 flush
                   落地之前一律透传实时数组，否则上一条流留下的快照会被画出来
                   （切 thread 时页面**故意不重挂载**，所以快照会跨 thread 存活）。

                   时钟用 `performance.now()`：墙钟被 NTP 或睡眠唤醒跳一下，
                   差值会被加进剩余间隔里，表现是流式画面卡住整整一个跳变的时长。

                   `watch` 的 `immediate: true`（05 M5）在这里的后果特别直白：
                   漏了它，一条流的**第一帧永远等一个 interval**，而第一帧恰好是
                   用户盯着看的那一帧。
*/

import {
  computed,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import {
  decideCoalesce,
  STREAM_RENDER_COALESCE_MS,
} from "@/core/threads/coalesce";
import type { Message } from "@/core/types/message";

function sameMessageArray(a: Message[], b: Message[]): boolean {
  return (
    a === b ||
    (a.length === b.length && a.every((message, index) => message === b[index]))
  );
}

export function useCoalescedStreamMessages(
  messages: MaybeRefOrGetter<Message[]>,
  isStreaming: MaybeRefOrGetter<boolean>,
  intervalMs: MaybeRefOrGetter<number> = STREAM_RENDER_COALESCE_MS,
) {
  const snapshot = ref<Message[] | null>(null);
  let lastFlushMs = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const publish = () => {
    const latest = toValue(messages);
    if (snapshot.value !== null && sameMessageArray(snapshot.value, latest)) {
      return;
    }
    snapshot.value = latest;
  };

  const clearPendingFlush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  watch(
    [
      () => toValue(messages),
      () => toValue(isStreaming),
      () => toValue(intervalMs),
    ],
    ([, streaming, interval]) => {
      if (!streaming) {
        clearPendingFlush();
        // 前沿是**每条流**一次而不是每个实例一次：一条流在上一条结束后不到一个
        // interval 就开始时，它的第一帧不该被推迟。
        lastFlushMs = Number.NEGATIVE_INFINITY;
        snapshot.value = null;
        return;
      }
      const now = performance.now();
      const decision = decideCoalesce(
        now,
        lastFlushMs,
        interval,
        timer !== null,
      );
      if (decision.action === "flush-now") {
        // 已武装的尾部定时器必须先拆掉：定时器在主线程繁忙时会迟到，
        // 而那正是 chunk 追上它的时刻。留着它会多发一次并把下一个 interval 后移。
        clearPendingFlush();
        lastFlushMs = now;
        publish();
      } else if (decision.action === "schedule") {
        timer = setTimeout(() => {
          timer = null;
          // 再读一次时钟：定时器可能迟到，下一个 interval 要从真实 flush 起算。
          lastFlushMs = performance.now();
          publish();
        }, decision.delayMs);
      }
    },
    { immediate: true },
  );

  onScopeDispose(clearPendingFlush);

  return {
    messages: computed(() =>
      toValue(isStreaming) && snapshot.value !== null
        ? snapshot.value
        : toValue(messages),
    ),
  };
}
