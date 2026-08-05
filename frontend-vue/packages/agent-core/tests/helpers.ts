/*
  【文件职责】     L1 测试共用的流构造与收集工具。
  【对应 frontend/】 无
  【架构位置】     L1 测试
  【主要导出】     streamOf · bytesOf · collect
  【依赖关系】     无
  【边界与注意】   `streamOf` 接收的是**chunk 数组**而不是一整个字符串，因为
                   transport 的大半 bug 都只在特定切分下出现：帧被切在
                   `\r\n\r\n` 中间、多字节字符被切在两个 chunk 之间。
                   传一整个字符串的测试永远遇不到这些。
*/

export function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** 把若干 chunk 变成一个 ReadableStream，逐个 enqueue，不合并。 */
export function streamOf(
  chunks: readonly (string | Uint8Array)[],
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === "string" ? bytesOf(chunk) : chunk);
      }
      controller.close();
    },
  });
}

/** 一个永不结束的流，用来测 abort 与看门狗。 */
export function pendingStream(
  chunks: readonly string[] = [],
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(bytesOf(chunk));
    },
  });
}

export async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}
