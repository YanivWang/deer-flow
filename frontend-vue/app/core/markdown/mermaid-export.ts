/*
  【文件职责】     把渲染好的 mermaid 图导出成文件：PNG 转码与浏览器下载。
  【架构位置】     L2 —— 通用渲染层
  【主要导出】     svgToPngBlob · saveBlob
  【依赖关系】     浏览器 DOM（Image / canvas / URL.createObjectURL）
  【边界与注意】   ① 放在这里而不是 SFC 里，是因为它是**纯逻辑**：没有模板、不读词典、
                   可以单独测。顺带绕开一件事——`tests/unit/i18n/source-guard.test.ts`
                   会把产品 SFC 里 `new Error("…")` 的英文当成未翻译文案，而这几条
                   错误消息是给开发者看的控制流，不是 UI 文案；把它们塞进词典是假的，
                   删成空 Error 又让排查变瞎。

                   ② PNG 放大 5 倍再导出（照抄上游）：SVG 里的文字在 1:1 下发虚，
                   而这张图多半要贴进文档。

                   ③ **转码依赖 SVG 自包含**：外链字体或图片会让 canvas 被污染，
                   `toBlob` 直接抛。mermaid 的 `securityLevel: "strict"` 保证了这点。

                   ④ `unescape(encodeURIComponent(...))` 这一步不能省：`btoa` 只吃
                   Latin-1，图里出现任何非 ASCII 字符（中文标签是常态）都会让它抛
                   `InvalidCharacterError`。
*/

/** 见文件头 ②。 */
const PNG_SCALE = 5;

export async function svgToPngBlob(svg: string): Promise<Blob> {
  // 见文件头 ④。
  const source = `data:image/svg+xml;base64,${btoa(
    unescape(encodeURIComponent(svg)),
  )}`;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.crossOrigin = "anonymous";
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("mermaid: svg image load failed"));
    element.src = source;
  });

  const canvas = document.createElement("canvas");
  canvas.width = image.width * PNG_SCALE;
  canvas.height = image.height * PNG_SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("mermaid: 2d canvas context unavailable");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("mermaid: png encode failed"));
    }, "image/png");
  });
}

/**
 * 触发一次浏览器下载。
 *
 * 锚点要真的进 DOM 再点：Safari 与 Firefox 对游离节点上的 `click()` 不触发下载。
 */
export function saveBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
