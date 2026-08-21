/*
  【文件职责】     为 route/thread 作用域异步任务提供 generation stale guard。
  【对应 frontend/】 无独立文件；React input-box/chat-page 内为分散 request ref。
  【架构位置】     L3 纯状态机
  【主要导出】     createAsyncGeneration · AsyncGeneration
  【依赖关系】     无
  【边界与注意】   只判定结果归属；可取消请求仍由调用方 AbortController 负责。
*/

export interface AsyncGenerationToken {
  readonly generation: number;
  readonly scope: string;
}

export interface AsyncGeneration {
  begin(scope: string): AsyncGenerationToken;
  invalidate(): void;
  isCurrent(token: AsyncGenerationToken, scope: string): boolean;
}

/**
 * Small framework-neutral guard for async work whose result belongs to a
 * route/thread scope. Starting or invalidating work makes every older token
 * stale; callers still compare the current scope so route changes are safe
 * even before a watcher has run.
 */
export function createAsyncGeneration(): AsyncGeneration {
  let generation = 0;

  return {
    begin(scope) {
      generation += 1;
      return { generation, scope };
    },
    invalidate() {
      generation += 1;
    },
    isCurrent(token, scope) {
      return token.generation === generation && token.scope === scope;
    },
  };
}
