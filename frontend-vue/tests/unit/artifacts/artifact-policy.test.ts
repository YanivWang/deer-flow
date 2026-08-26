/*
  【文件职责】     固定artifact 显式文件策略、文本加载/保存和 skill 行为边界。
  【架构位置】     测试
  【主要导出】     classifyArtifact 策略矩阵回归
  【依赖关系】     app/core/artifacts/policy.ts
  【边界与注意】   未知扩展名和无扩展名必须 fail closed；扩展名不得伪造 Gateway 权限。
*/

import { describe, expect, it } from "vitest";

import {
  canInstallSkillArtifact,
  canLoadArtifactText,
  canSaveArtifactText,
  classifyArtifact,
} from "@/core/artifacts/policy";

describe("classifyArtifact", () => {
  it.each([
    ["report.txt", "text", "text"],
    ["report.md", "text", "markdown"],
    ["page.html", "text", "html"],
    ["component.vue", "text", "vue"],
    ["data.json", "text", "json"],
    ["vector.svg", "download-only", null],
    ["photo.png", "browser-media", "image"],
    ["speech.mp3", "browser-media", "audio"],
    ["movie.mp4", "browser-media", "video"],
    ["report.pdf", "safe-document", "pdf"],
    ["report.doc", "download-only", null],
    ["report.docx", "download-only", null],
    ["sheet.xls", "download-only", null],
    ["sheet.xlsx", "download-only", null],
    ["slides.ppt", "download-only", null],
    ["slides.pptx", "download-only", null],
    ["bundle.zip", "download-only", null],
    ["bundle.tar.gz", "download-only", null],
    ["blob.bin", "download-only", null],
    ["mystery.custom", "download-only", null],
    ["README", "download-only", null],
    /*
      `.skill` 按 **markdown** 分类，不是"不能预览的归档"：它是一个目录，里面有一份
      SKILL.md，loader 会把 URL 补上那一段。React 的 isSkillFile 分支同样直接返回
      markdown（frontend/src/components/workspace/artifacts/artifact-file-detail.tsx）。
      它仍然不能编辑，靠的是 source 而不是 kind。
    */
    ["tool.skill", "text", "markdown"],
  ])("classifies %s as %s", (name, kind, detail) => {
    const policy = classifyArtifact(`/mnt/user-data/outputs/${name}`);
    expect(policy.kind).toBe(kind);
    expect(policy.kind === "text" ? policy.language : policy.previewKind).toBe(
      detail,
    );
  });

  it("never promotes unknown or extensionless files from untrusted MIME metadata", () => {
    for (const path of ["payload.unknown", "README"]) {
      const policy = classifyArtifact(`/mnt/user-data/outputs/${path}`, {
        contentType: "text/plain",
      });
      expect(policy.kind).toBe("download-only");
      expect(canLoadArtifactText(policy)).toBe(false);
    }
  });

  it("keeps streaming drafts, formal artifacts, skills, and mock artifacts on separate capabilities", () => {
    const formal = classifyArtifact("/mnt/user-data/outputs/report.md");
    const draft = classifyArtifact(
      "write-file:/mnt/user-data/outputs/report.md?tool_call_id=call-1",
    );
    const skill = classifyArtifact("/mnt/user-data/outputs/tool.skill");
    const mock = classifyArtifact("/mnt/user-data/outputs/report.md", {
      isMock: true,
    });
    const upload = classifyArtifact("/mnt/user-data/uploads/report.md");

    expect(formal.source).toBe("formal");
    expect(draft.source).toBe("write-file-draft");
    expect(skill.source).toBe("skill-archive");
    expect(canSaveArtifactText(skill, { hasRevision: true })).toBe(false);
    expect(canSaveArtifactText(formal, { hasRevision: true })).toBe(true);
    expect(canSaveArtifactText(draft, { hasRevision: true })).toBe(false);
    expect(canSaveArtifactText(mock, { hasRevision: true })).toBe(false);
    expect(canSaveArtifactText(upload, { hasRevision: true })).toBe(false);
    expect(canInstallSkillArtifact(skill, { isAdmin: true })).toBe(true);
    expect(canInstallSkillArtifact(skill, { isAdmin: false })).toBe(false);
  });
});
