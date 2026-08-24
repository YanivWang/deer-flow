/*
  【文件职责】     Workspace 全局 toast 的唯一 client-state owner 与注入契约。
  【架构位置】     L3 workspace shell
  【主要导出】     create/provide/useWorkspaceToast
  【依赖关系】     Vue ref/provide/inject
  【边界与注意】   每个 workspace layout 只创建一次；卸载时 clear，避免残留 timer。
*/
import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

export type WorkspaceToastKind = "success" | "error";

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
  success(message: string): number;
  error(message: string): number;
  dismiss(id: number): void;
  clear(): void;
}

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

  function show(kind: WorkspaceToastKind, message: string) {
    const id = ++nextId;
    toasts.value = [...toasts.value, { id, kind, message }];
    timers.set(
      id,
      timer.set(() => dismiss(id), durationMs),
    );
    return id;
  }

  function clear() {
    for (const timeoutId of timers.values()) timer.clear(timeoutId);
    timers.clear();
    toasts.value = [];
  }

  return {
    toasts,
    success: (message) => show("success", message),
    error: (message) => show("error", message),
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
