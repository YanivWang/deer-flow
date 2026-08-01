import {
  artifactFilename,
  describeWriteFileDraftPreview,
  type WriteFileDraftPreview,
} from "../artifacts/utils";

export type ToolRichCard = {
  description: string | null;
  details: string[];
  draftPreview: WriteFileDraftPreview | null;
  id: string | null;
  kind: "assistant-call" | "tool-result";
  name: string;
  title: string;
};

type ToolCallRecord = {
  args: Record<string, unknown>;
  id: string | null;
  name: string;
};

export function extractToolRichCards(message: unknown): ToolRichCard[] {
  const record = asRecord(message);
  if (!record) {
    return [];
  }

  const toolCalls = Array.isArray(record.tool_calls)
    ? record.tool_calls.map(normalizeToolCall).filter((call): call is ToolCallRecord => call !== null)
    : [];
  const resultCard = describeToolResult(record);

  return [
    ...toolCalls.map((toolCall) => describeAssistantToolCall(toolCall)),
    ...(resultCard ? [resultCard] : []),
  ];
}

function describeAssistantToolCall(toolCall: ToolCallRecord): ToolRichCard {
  const draftPreview = describeWriteFileDraftPreview(toolCall.args);
  return {
    description: describeToolDescription(toolCall, draftPreview),
    details: buildToolDetails(toolCall),
    draftPreview,
    id: toolCall.id,
    kind: "assistant-call",
    name: toolCall.name,
    title: titleForToolCall(toolCall, draftPreview),
  };
}

function describeToolResult(record: Record<string, unknown>): ToolRichCard | null {
  const role = readRole(record);
  const toolCallId = readNonEmptyString(record.tool_call_id);
  if (role !== "tool" && !toolCallId) {
    return null;
  }

  const name = readNonEmptyString(record.name) ?? "tool_result";
  const content = readTextContent(record.content);
  return {
    description: content ? truncate(content, 220) : null,
    details: [
      ...(toolCallId ? [`调用：${toolCallId}`] : []),
      ...(content ? [`结果：${truncate(content, 140)}`] : []),
    ],
    draftPreview: describeWriteFileDraftPreview(record.artifact),
    id: toolCallId,
    kind: "tool-result",
    name,
    title: `${humanizeToolName(name)} 结果`,
  };
}

function titleForToolCall(
  toolCall: ToolCallRecord,
  draftPreview: WriteFileDraftPreview | null,
): string {
  const args = toolCall.args;
  switch (toolCall.name) {
    case "browser_navigate": {
      const url = readNonEmptyString(args.url);
      return url ? `在浏览器中打开 ${url}` : "在浏览器中打开页面";
    }
    case "browser_click":
      return "点击浏览器元素";
    case "browser_type":
      return "在浏览器字段中输入";
    case "browser_snapshot":
      return "读取浏览器快照";
    case "browser_get_text":
      return "读取浏览器文本";
    case "browser_back":
      return "浏览器返回上一页";
    case "browser_screenshot":
      return "截取浏览器截图";
    case "browser_close":
      return "关闭浏览器";
    case "web_search":
    case "image_search": {
      const query = readNonEmptyString(args.query);
      return query ? `搜索“${query}”` : "搜索相关信息";
    }
    case "web_fetch":
      return "查看网页";
    case "present_files":
      return "展示文件";
    case "ask_clarification":
      return "需要你确认";
    case "task":
      return readNonEmptyString(args.description) ?? "运行子任务";
    case "write_file":
    case "str_replace":
      return draftPreview ? `写入 ${draftPreview.filename}` : "写入文件";
    case "install_skill":
      return `安装技能 ${artifactTargetLabel(args)}`;
    case "begin_artifact_write":
      return `开始分段写入产物 ${artifactTargetLabel(args)}`;
    case "append_artifact_chunk":
      return `追加分段产物内容 ${artifactTargetLabel(args)}`;
    case "finalize_artifact_write":
      return `完成分段产物 ${artifactTargetLabel(args)}`;
    default:
      return `使用“${toolCall.name}”工具`;
  }
}

function describeToolDescription(
  toolCall: ToolCallRecord,
  draftPreview: WriteFileDraftPreview | null,
): string | null {
  if (draftPreview) {
    return `${draftPreview.targetPath} 的草稿预览`;
  }

  const description = readNonEmptyString(toolCall.args.description);
  if (description) {
    return description;
  }

  if (toolCall.name === "present_files") {
    const files = readStringArray(toolCall.args.filepaths);
    return files.length > 0 ? files.map(artifactFilename).join(", ") : null;
  }

  if (toolCall.name === "install_skill") {
    const path = readNonEmptyString(toolCall.args.path)
      ?? readNonEmptyString(toolCall.args.file_path)
      ?? readNonEmptyString(toolCall.args.filepath);
    return path ? `从 ${path} 安装技能包` : "安装技能包";
  }

  if (toolCall.name === "begin_artifact_write") {
    return "正在准备分段产物写入；finalize 成功前还没有最终文件。";
  }

  if (toolCall.name === "append_artifact_chunk") {
    return "正在追加分段产物内容。";
  }

  if (toolCall.name === "finalize_artifact_write") {
    return "后端验证后正在完成分段产物。";
  }

  const path = readNonEmptyString(toolCall.args.path)
    ?? readNonEmptyString(toolCall.args.file_path)
    ?? readNonEmptyString(toolCall.args.filepath);
  return path ?? null;
}

function buildToolDetails(toolCall: ToolCallRecord): string[] {
  const args = toolCall.args;
  const details = [
    ...(toolCall.id ? [`调用：${toolCall.id}`] : []),
    ...detailFromValue("查询", args.query),
    ...detailFromValue("URL", args.url),
    ...detailFromValue("路径", args.path ?? args.file_path ?? args.filepath),
    ...detailFromValue("目标", args.target_path ?? args.targetPath),
    ...detailFromValue("选择器", args.selector),
    ...detailFromValue("文本", args.text),
    ...detailFromValue("片段", args.chunk),
  ];
  const files = readStringArray(args.filepaths);
  if (files.length > 0) {
    details.push(`文件：${files.map(artifactFilename).join(", ")}`);
  }
  return details;
}

function artifactTargetLabel(args: Record<string, unknown>): string {
  const target = readNonEmptyString(args.path)
    ?? readNonEmptyString(args.file_path)
    ?? readNonEmptyString(args.filepath)
    ?? readNonEmptyString(args.target_path)
    ?? readNonEmptyString(args.targetPath);
  return target ? artifactFilename(target) : "写入";
}

function normalizeToolCall(value: unknown): ToolCallRecord | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const name = readNonEmptyString(record.name);
  if (!name) {
    return null;
  }
  return {
    args: asRecord(record.args) ?? {},
    id: readNonEmptyString(record.id),
    name,
  };
}

function detailFromValue(label: string, value: unknown): string[] {
  const text = readNonEmptyString(value);
  return text ? [`${label}：${truncate(text, 120)}`] : [];
}

function readRole(record: Record<string, unknown>): string | null {
  return readNonEmptyString(record.type) ?? readNonEmptyString(record.role);
}

function readTextContent(content: unknown): string | null {
  if (typeof content === "string") {
    return content.trim() || null;
  }
  if (!Array.isArray(content)) {
    return null;
  }
  const text = content.map(readContentPart).filter(Boolean).join("").trim();
  return text || null;
}

function readContentPart(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  const record = asRecord(value);
  if (!record) {
    return "";
  }
  return readNonEmptyString(record.text) ?? readNonEmptyString(record.content) ?? "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function humanizeToolName(name: string): string {
  return name
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "工具";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}
