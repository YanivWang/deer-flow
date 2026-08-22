/*
  【文件职责】     WP-06 artifact 显式文件分类与能力策略。
  【对应 frontend/】 frontend/src/core/utils/files.tsx
  【架构位置】     L3
  【主要导出】     classifyArtifact / canLoadArtifactText / canSaveArtifactText / canInstallSkillArtifact
  【依赖关系】     无
  【边界与注意】   未知扩展名、无扩展名、SVG、Office 与归档一律 fail closed；MIME 只能收窄能力。
*/

export type ArtifactSource = "formal" | "write-file-draft" | "skill-archive";

export type ArtifactPreviewKind = "image" | "audio" | "video" | "pdf";

export type ArtifactPolicy =
  | {
      kind: "text";
      language: string;
      previewKind: null;
      source: ArtifactSource;
      isMock: boolean;
      filepath: string;
    }
  | {
      kind: "browser-media" | "safe-document";
      language: null;
      previewKind: ArtifactPreviewKind;
      source: ArtifactSource;
      isMock: boolean;
      filepath: string;
    }
  | {
      kind: "skill-archive" | "download-only";
      language: null;
      previewKind: null;
      source: ArtifactSource;
      isMock: boolean;
      filepath: string;
    };

const TEXT_LANGUAGES: Readonly<Record<string, string>> = {
  bash: "bash",
  c: "c",
  cc: "cpp",
  cjs: "javascript",
  cpp: "cpp",
  css: "css",
  csv: "text",
  go: "go",
  h: "c",
  hpp: "cpp",
  htm: "html",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsonl: "json",
  jsx: "jsx",
  log: "text",
  md: "markdown",
  mdx: "markdown",
  mjs: "javascript",
  php: "php",
  py: "python",
  rb: "ruby",
  rs: "rust",
  scss: "scss",
  sh: "bash",
  sql: "sql",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  txt: "text",
  vue: "vue",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

const MEDIA_EXTENSIONS: Readonly<Record<string, ArtifactPreviewKind>> = {
  apng: "image",
  avif: "image",
  bmp: "image",
  gif: "image",
  jpeg: "image",
  jpg: "image",
  png: "image",
  webp: "image",
  aac: "audio",
  flac: "audio",
  m4a: "audio",
  mp3: "audio",
  oga: "audio",
  ogg: "audio",
  wav: "audio",
  weba: "audio",
  m4v: "video",
  mov: "video",
  mp4: "video",
  ogv: "video",
  webm: "video",
};

function sourceOf(filepath: string): ArtifactSource {
  if (filepath.startsWith("write-file:")) return "write-file-draft";
  return filepath.split(/[?#]/, 1)[0]?.toLowerCase().endsWith(".skill")
    ? "skill-archive"
    : "formal";
}

function extensionOf(filepath: string) {
  let normalized = filepath.split(/[?#]/, 1)[0] ?? filepath;
  if (filepath.startsWith("write-file:")) {
    try {
      normalized = new URL(filepath).pathname;
    } catch {
      normalized = filepath.slice("write-file:".length);
    }
  }
  const name = normalized.slice(normalized.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function classifyArtifact(
  filepath: string,
  metadata: { contentType?: string; isMock?: boolean } = {},
): ArtifactPolicy {
  const source = sourceOf(filepath);
  const extension = extensionOf(filepath);
  const common = { filepath, source, isMock: metadata.isMock === true };

  if (source === "skill-archive") {
    return {
      ...common,
      kind: "skill-archive",
      language: null,
      previewKind: null,
    };
  }

  const language = TEXT_LANGUAGES[extension];
  if (language !== undefined) {
    return { ...common, kind: "text", language, previewKind: null };
  }

  const previewKind = MEDIA_EXTENSIONS[extension];
  if (previewKind !== undefined) {
    return {
      ...common,
      kind: "browser-media",
      language: null,
      previewKind,
    };
  }

  if (extension === "pdf") {
    return {
      ...common,
      kind: "safe-document",
      language: null,
      previewKind: "pdf",
    };
  }

  return {
    ...common,
    kind: "download-only",
    language: null,
    previewKind: null,
  };
}

export function canLoadArtifactText(policy: ArtifactPolicy) {
  return policy.kind === "text";
}

export function canSaveArtifactText(
  policy: ArtifactPolicy,
  options: { hasRevision: boolean; fullContentLoaded?: boolean },
) {
  return (
    policy.kind === "text" &&
    policy.source === "formal" &&
    !policy.isMock &&
    policy.filepath.replace(/^\/+/, "").startsWith("mnt/user-data/outputs/") &&
    options.hasRevision &&
    options.fullContentLoaded !== false
  );
}

export function canInstallSkillArtifact(
  policy: ArtifactPolicy,
  options: { isAdmin: boolean },
) {
  return (
    policy.kind === "skill-archive" &&
    policy.source === "skill-archive" &&
    !policy.isMock &&
    options.isAdmin
  );
}
