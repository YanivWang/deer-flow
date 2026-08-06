/*
  【文件职责】     7 个业务 Context 的 provide/inject 底座（05 M1 / M2）。
  【对应 frontend/】 components/workspace/{artifacts,browser-view,messages,sidecar}/context.tsx
                   core/tasks/context.tsx · core/auth/AuthProvider.tsx · core/i18n/context.tsx
  【架构位置】     L3（Vue 适配）
  【主要导出】     defineThreadContext
  【依赖关系】     vue
  【边界与注意】   **M1 的执行方式是类型层强制，不是靠自觉。** 05 M1 说
                   「`provide()` 必须传 ref / reactive / computed，不能传普通对象
                   或裸值」——照搬 React 的 `provide(key, { open, setOpen })`
                   编译能过、运行不报错、只是**永远不更新**，这是本组最难发现的
                   一类失败。所以 `provide` 的入参类型限定成
                   `Ref | ComputedRef | 带 __v_isReactive 的对象`，
                   传裸对象在 `vue-tsc` 阶段就红。

                   M2「inject 只能在 setup 同步阶段调用」没法用类型挡（`inject`
                   在 await 之后调用是合法的 TS）。这里用运行时兜底：拿不到值时
                   抛一个**指名道姓**的错误，而不是返回 undefined 让消费方在几层
                   之外炸。错误信息里带 context 名字，因为 7 个 context 的失败
                   表现是同一句「Cannot read properties of undefined」。
*/

import {
  inject,
  isReactive,
  isRef,
  provide,
  type InjectionKey,
  type Ref,
} from "vue";

/** 允许 provide 的值：必须是响应式载体。 */
export type ReactiveContextValue = Ref<unknown> | object;

export interface ThreadContextDefinition<T extends ReactiveContextValue> {
  key: InjectionKey<T>;
  provide: (value: T) => T;
  /** 缺失时抛错。thread 作用域的 context 没有「合理的默认值」。 */
  use: () => T;
  /** 缺失时返回 undefined。给「可选地嵌在某个面板里」的组件用。 */
  useOptional: () => T | undefined;
}

export function defineThreadContext<T extends ReactiveContextValue>(
  name: string,
): ThreadContextDefinition<T> {
  const key: InjectionKey<T> = Symbol(name);

  return {
    key,
    provide(value: T) {
      if (!isRef(value) && !isReactive(value) && !isReactiveBag(value)) {
        // 类型层已经挡住了大部分；这一条守的是 `as any` 与 JS 调用方。
        throw new TypeError(
          `provide(${name}) received a plain value. Vue resolves inject() once during setup, so a plain object never propagates updates (05 M1).`,
        );
      }
      provide(key, value);
      return value;
    },
    use() {
      const value = inject(key, undefined);
      if (value === undefined) {
        throw new Error(
          `inject(${name}) found no provider. It must be called synchronously inside setup of a component under the provider (05 M2).`,
        );
      }
      return value;
    },
    useOptional: () => inject(key, undefined),
  };
}

/**
 * 一个「全部字段都是 ref/computed」的普通对象也算合格：这是 7 个 context 里
 * 最常见的形状（`{ messages, isStreaming, send }`）。判据是**至少有一个 ref**
 * 且没有裸的可变字段——后者才是 M1 真正要挡的东西。
 */
function isReactiveBag(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const entries = Object.values(value);
  if (entries.length === 0) return false;
  const hasRef = entries.some((entry) => isRef(entry) || isReactive(entry));
  const hasPlainMutable = entries.some(
    (entry) =>
      !isRef(entry) &&
      !isReactive(entry) &&
      typeof entry !== "function" &&
      typeof entry !== "symbol",
  );
  return hasRef && !hasPlainMutable;
}
