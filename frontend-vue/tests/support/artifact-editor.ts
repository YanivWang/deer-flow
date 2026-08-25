/*
  【文件职责】     统一 artifact 编辑器在浏览器合同里的定位方式。
  【架构位置】     测试基础设施
  【主要导出】     artifactEditorInput
  【依赖关系】     @playwright/test（仅类型）
  【边界与注意】   `data-testid="artifact-editor"` 仍然标在 ArtifactEditor 渲染的宿主上，
                   所以「有没有挂编辑器」的断言语义不变；但真正能打字的是 CodeMirror
                   在里面创建的 contenteditable，它带 role="textbox"。
                   用 role 而不是 `.cm-content`：前者是编辑器对辅助技术承诺的语义，
                   后者是库的内部 class。
*/

import type { Locator } from "@playwright/test";

export function artifactEditorInput(panel: Locator): Locator {
  return panel.getByTestId("artifact-editor").getByRole("textbox");
}
