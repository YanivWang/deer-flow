export type BrowserPreviewKind =
  | "image"
  | "audio"
  | "video"
  | "iframe"
  | "html"
  | "markdown"
  | "code";

export type ArtifactCodeInfo =
  | { isCodeFile: true; language: string }
  | { isCodeFile: false; language: null };

export type ArtifactViewerState = {
  artifactUrl: string;
  canPreview: boolean;
  downloadFilename: string;
  downloadUrl: string;
  extensionLabel: string;
  fallbackDescription: string;
  filename: string;
  previewDescription: string;
  previewKind: BrowserPreviewKind | null;
};

export type WriteFileDraftPreview = {
  content: string;
  filename: string;
  language: string;
  targetPath: string;
};

const imagePreviewExtensions = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpg",
  "jpeg",
  "png",
  "webp",
]);
const audioPreviewExtensions = new Set(["mp3", "wav", "ogg", "aac", "m4a", "flac"]);
const videoPreviewExtensions = new Set(["mp4", "mov", "m4v", "webm"]);
const iframePreviewExtensions = new Set(["pdf"]);
const htmlPreviewExtensions = new Set(["html", "htm"]);
const markdownPreviewExtensions = new Set(["md", "mdx", "skill"]);
const codeLanguageByExtension: Readonly<Record<string, string>> = {
  astro: "astro",
  bash: "bash",
  c: "c",
  cc: "cpp",
  cjs: "javascript",
  clj: "clojure",
  cljs: "clojure",
  cmake: "cmake",
  conf: "text",
  config: "text",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  csv: "csv",
  cts: "typescript",
  cxx: "cpp",
  dart: "dart",
  docker: "docker",
  dockerfile: "dockerfile",
  elm: "elm",
  env: "dotenv",
  ex: "elixir",
  fish: "fish",
  gitignore: "git-commit",
  go: "go",
  gradle: "groovy",
  gql: "graphql",
  graphql: "graphql",
  groovy: "groovy",
  h: "c",
  haskell: "haskell",
  hcl: "hcl",
  hh: "cpp",
  hs: "haskell",
  htm: "html",
  html: "html",
  hxx: "cpp",
  ini: "ini",
  java: "java",
  js: "javascript",
  json: "json",
  json5: "json5",
  jsonc: "jsonc",
  jsx: "jsx",
  julia: "jl",
  kt: "kotlin",
  kts: "kotlin",
  less: "less",
  log: "text",
  lua: "lua",
  makefile: "makefile",
  matlab: "matlab",
  md: "markdown",
  mdx: "mdx",
  mjs: "javascript",
  mts: "typescript",
  php: "php",
  properties: "text",
  props: "text",
  proto: "protobuf",
  py: "python",
  pyi: "python",
  pyw: "python",
  r: "r",
  rake: "ruby",
  rb: "ruby",
  rs: "rust",
  rst: "rst",
  sass: "sass",
  scala: "scala",
  scss: "scss",
  sh: "bash",
  skill: "markdown",
  sql: "sql",
  svelte: "svelte",
  swift: "swift",
  tf: "terraform",
  tfvars: "terraform",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  txt: "text",
  v: "v",
  vue: "vue",
  wasm: "wasm",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  zig: "zig",
  zsh: "zsh",
};

const codePreviewExtensions = new Set(Object.keys(codeLanguageByExtension));

export function artifactApiUrl({
  filepath,
  threadId,
  download = false,
  isMock = false,
}: {
  filepath: string;
  threadId: string;
  download?: boolean;
  isMock?: boolean;
}): string {
  const encodedThreadId = encodeURIComponent(threadId);
  const prefix = isMock ? "/mock/api" : "/api";
  return `${prefix}/threads/${encodedThreadId}/artifacts${encodeArtifactPath(filepath)}${
    download ? "?download=true" : ""
  }`;
}

export function resolveArtifactUrl(filepath: string, threadId: string): string {
  return artifactApiUrl({ filepath, threadId });
}

export function resolveMarkdownArtifactUrl(src: string, threadId: string): string {
  const { path, suffix } = splitPathSuffix(src);
  return `${resolveArtifactUrl(path, threadId)}${suffix}`;
}

export function resolveMessageMediaUrl({
  artifactPaths,
  fallbackToOutputs = true,
  src,
  threadId,
}: {
  artifactPaths: readonly string[];
  fallbackToOutputs?: boolean;
  src: string;
  threadId: string;
}): string {
  if (src.startsWith("/mnt/")) {
    return resolveMarkdownArtifactUrl(src, threadId);
  }

  const imagePath = normalizeRelativeArtifactPath(src);
  if (!imagePath) {
    return src;
  }

  const matches = artifactPaths.filter((path) =>
    path.endsWith(`/${imagePath.decodedPath}`),
  );
  if (matches.length === 1) {
    return `${resolveArtifactUrl(matches[0]!, threadId)}${imagePath.suffix}`;
  }

  if (!fallbackToOutputs) {
    return src;
  }

  return `${resolveArtifactUrl(
    `/mnt/user-data/outputs/${imagePath.decodedPath}`,
    threadId,
  )}${imagePath.suffix}`;
}

export function artifactFilename(filepath: string): string {
  const pathname = stripUrlLikeSuffix(filepath);
  const parts = pathname.split("/").filter(Boolean);
  return parts.at(-1) ?? filepath;
}

export function artifactExtensionLabel(filepath: string): string {
  const extension = artifactExtension(filepath);
  switch (extension) {
    case "doc":
    case "docx":
      return "Word";
    case "md":
      return "Markdown";
    case "txt":
      return "文本";
    case "ppt":
    case "pptx":
      return "PowerPoint";
    case "xls":
    case "xlsx":
      return "Excel";
    default:
      return extension ? extension.toUpperCase() : "文件";
  }
}

export function artifactCodeLanguage(filepath: string): string {
  return artifactCodeInfo(filepath).language ?? "text";
}

export function artifactCodeInfo(filepath: string): ArtifactCodeInfo {
  const extension = artifactExtension(filepath);
  const language = codeLanguageByExtension[extension];
  if (language) {
    return { isCodeFile: true, language };
  }
  return { isCodeFile: false, language: null };
}

export function getBrowserPreviewKind(filepath: string): BrowserPreviewKind | null {
  const extension = artifactExtension(filepath);
  if (imagePreviewExtensions.has(extension)) {
    return "image";
  }
  if (audioPreviewExtensions.has(extension)) {
    return "audio";
  }
  if (videoPreviewExtensions.has(extension)) {
    return "video";
  }
  if (iframePreviewExtensions.has(extension)) {
    return "iframe";
  }
  if (htmlPreviewExtensions.has(extension)) {
    return "html";
  }
  if (markdownPreviewExtensions.has(extension)) {
    return "markdown";
  }
  if (codePreviewExtensions.has(extension)) {
    return "code";
  }
  return null;
}

export function describeArtifactViewer({
  filepath,
  threadId,
  isMock = false,
}: {
  filepath: string;
  threadId: string;
  isMock?: boolean;
}): ArtifactViewerState {
  const previewKind = getBrowserPreviewKind(filepath);
  return {
    artifactUrl: artifactApiUrl({ filepath, isMock, threadId }),
    canPreview: previewKind !== null,
    downloadFilename: artifactFilename(filepath),
    downloadUrl: artifactApiUrl({ filepath, download: true, isMock, threadId }),
    extensionLabel: artifactExtensionLabel(filepath),
    fallbackDescription: describeArtifactFallback(filepath, previewKind),
    filename: artifactFilename(filepath),
    previewDescription: describeArtifactPreview(filepath, previewKind),
    previewKind,
  };
}

export function describeWriteFileDraftPreview(value: unknown): WriteFileDraftPreview | null {
  if (!isRecord(value)) {
    return null;
  }
  const targetPath = readString(value.path)
    ?? readString(value.file_path)
    ?? readString(value.filepath)
    ?? readString(value.target_path)
    ?? readString(value.targetPath);
  const content = readString(value.content) ?? readString(value.text) ?? readString(value.chunk);
  if (!targetPath || content === null) {
    return null;
  }
  return {
    content,
    filename: artifactFilename(targetPath),
    language: artifactCodeLanguage(targetPath),
    targetPath,
  };
}

function describeArtifactPreview(
  filepath: string,
  previewKind: BrowserPreviewKind | null,
): string {
  switch (previewKind) {
    case "image":
      return "图片预览通过已认证的产物路由加载。";
    case "audio":
      return "音频预览使用浏览器控件，并保留下载作为兜底。";
    case "video":
      return "视频预览使用浏览器控件，并保留下载作为兜底。";
    case "iframe":
      return "PDF 预览已沙箱隔离；仍可下载后用外部阅读器打开。";
    case "html":
      return "HTML 预览会在相对资源改写到产物 API 路径后，以沙箱 blob 加载。";
    case "markdown":
      return "Markdown 预览复用聊天消息的安全富文本渲染器。";
    case "code":
      return "源码文本通过产物 API 加载，并使用 no-store 缓存策略。";
    default:
      return describeArtifactFallback(filepath, previewKind);
  }
}

function describeArtifactFallback(
  filepath: string,
  previewKind: BrowserPreviewKind | null,
): string {
  if (previewKind !== null) {
    return "如果浏览器预览不可用，请打开或下载此产物。";
  }
  return `${artifactExtensionLabel(filepath)} 文件无法在此处预览。请下载或用兼容应用打开。`;
}

function artifactExtension(filepath: string): string {
  const filename = artifactFilename(filepath);
  const extension = filename.includes(".") ? filename.split(".").at(-1) : "";
  return extension?.toLocaleLowerCase() ?? "";
}

function stripUrlLikeSuffix(filepath: string): string {
  const [pathname = ""] = filepath.split(/[?#]/, 1);
  return pathname;
}

function splitPathSuffix(src: string): { path: string; suffix: string } {
  const [path = ""] = src.split(/[?#]/, 1);
  return {
    path,
    suffix: src.slice(path.length),
  };
}

function normalizeRelativeArtifactPath(src: string): { decodedPath: string; suffix: string } | null {
  const { path, suffix } = splitPathSuffix(src);
  const normalizedPath = path.replace(/^(?:\.\/)+/, "");
  if (
    !normalizedPath ||
    normalizedPath.startsWith("/") ||
    normalizedPath.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(normalizedPath) ||
    normalizedPath.split("/").includes("..")
  ) {
    return null;
  }
  return {
    decodedPath: normalizedPath.split("/").map(decodePathSegment).join("/"),
    suffix,
  };
}

function encodeArtifactPath(filepath: string): string {
  return filepath
    .split("/")
    .map((segment) => encodeURIComponent(decodePathSegment(segment)))
    .join("/");
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
