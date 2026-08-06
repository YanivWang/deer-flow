/*
  【文件职责】     按点分路径从词典里取一条文案。
  【对应 frontend/】 无——上游用 `t.conversation.streamReplayGap` 直接取属性
  【架构位置】     L3（纯 TS）
  【主要导出】     resolveTranslation
  【依赖关系】     无
  【边界与注意】   为什么需要它：core 层（`cache-invalidation.ts` 的 A7）**不能认识
                   语言**，所以它只发一个字典 key（`"conversation.streamReplayGap"`），
                   由 UI 边界取文案。上游没有这个需求，因为它的 core 与 React 是
                   一坨，直接写属性访问就行。

                   ⚠️ **取不到时返回 key 本身是一条静默回退路径。** 用户看到的会是
                   一行 `conversation.streamReplayGap` 而不是任何报错——正是 M3
                   那条「静默回退 = 假绿」的形状。所以：
                   - 单测断言的是**取到真文案**，不是「没抛异常」；
                   - `tests/m4a-stream` 的 gap 用例断言的是**最终显示的整句英文**，
                     不是那个 key。
                   两处都盯着成功态，词典改名时会红。
*/

export function resolveTranslation(
  dictionary: unknown,
  key: string,
): string | undefined {
  const resolved = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? Reflect.get(node, part)
          : undefined,
      dictionary,
    );
  return typeof resolved === "string" ? resolved : undefined;
}
