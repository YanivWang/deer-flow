/*
  【文件职责】     Workspace 全局 toast 的唯一 client-state owner 与注入契约。
  【架构位置】     L3 workspace shell
  【主要导出】     create/provide/useWorkspaceToast
  【依赖关系】     Vue ref/provide/inject
  【边界与注意】   每个 workspace layout 只创建一次；卸载时 clear，避免残留 timer。

                   kind 与 React 用的 sonner 一一对应（success/error/info）；WorkspaceToaster
                   只把 error 播成 assertive，其余都是 polite。

                   **上游的 `toast.warning` 映到 info，不另开一个 kind。** sonner 的
                   warning 与 info 在可访问性上是同一档（都是 polite 的 status），
                   区别只有那个图标，而这个 toaster 一个图标都不画——多一个 kind 会是
                   一处没有任何可观察差别的分叉。上游用到 warning 的两处
                   （`core/threads/hooks.ts:1805` 的 replay gap、
                   `browser-view-panel.tsx:185` 的截图失败）都按 info 走。

                   show 接受一个已存在的 id 就地更新那一条，而不是再插一条：多步流程
                   （Lark 授权轮询）会对同一句提示反复改写「还在等待 / 已完成」，各插一条
                   会在屏幕上堆出一摞历史，读屏器也会把过期状态重播一遍。id 已经过期
                   （超时消失或被 dismiss）时退化成新增，这样调用方不需要自己记生死。
*/
import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

export type WorkspaceToastKind = "success" | "error" | "info";

export type WorkspaceToast = {
  id: number;
  kind: WorkspaceToastKind;
  message: string;
};

export interface ToastTimer {
  set(callback: () => void, delayMs: number): number;
  clear(id: number): void;
}

export interface WorkspaceToastStore {
  toasts: Ref<WorkspaceToast[]>;
  success(message: string, options?: WorkspaceToastOptions): number;
  error(message: string, options?: WorkspaceToastOptions): number;
  info(message: string, options?: WorkspaceToastOptions): number;
  dismiss(id: number): void;
  clear(): void;
}

export type WorkspaceToastOptions = {
  /** 就地更新这一条；它已经不在了就新增一条。 */
  id?: number;
};

const browserTimer: ToastTimer = {
  set: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clear: (id) => window.clearTimeout(id),
};

export function createWorkspaceToastStore(options?: {
  timer?: ToastTimer;
  durationMs?: number;
}): WorkspaceToastStore {
  const timer = options?.timer ?? browserTimer;
  const durationMs = options?.durationMs ?? 5_000;
  const toasts = ref<WorkspaceToast[]>([]);
  const timers = new Map<number, number>();
  let nextId = 0;

  function dismiss(id: number) {
    const timeoutId = timers.get(id);
    if (timeoutId !== undefined) {
      timer.clear(timeoutId);
      timers.delete(id);
    }
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function schedule(id: number) {
    const existing = timers.get(id);
    if (existing !== undefined) timer.clear(existing);
    timers.set(
      id,
      timer.set(() => dismiss(id), durationMs),
    );
  }

  function show(
    kind: WorkspaceToastKind,
    message: string,
    options?: WorkspaceToastOptions,
  ) {
    const target = options?.id;
    if (
      target !== undefined &&
      toasts.value.some((item) => item.id === target)
    ) {
      toasts.value = toasts.value.map((item) =>
        item.id === target ? { ...item, kind, message } : item,
      );
      schedule(target);
      return target;
    }
    const id = ++nextId;
    toasts.value = [...toasts.value, { id, kind, message }];
    schedule(id);
    return id;
  }

  function clear() {
    for (const timeoutId of timers.values()) timer.clear(timeoutId);
    timers.clear();
    toasts.value = [];
  }

  return {
    toasts,
    success: (message, options) => show("success", message, options),
    error: (message, options) => show("error", message, options),
    info: (message, options) => show("info", message, options),
    dismiss,
    clear,
  };
}

export const workspaceToastKey: InjectionKey<WorkspaceToastStore> =
  Symbol("workspace-toast");

export function provideWorkspaceToast(store = createWorkspaceToastStore()) {
  provide(workspaceToastKey, store);
  return store;
}

export function useWorkspaceToast() {
  const store = inject(workspaceToastKey);
  if (!store) throw new Error("Workspace toast owner is not available.");
  return store;
}
