/*
  【文件职责】     从持久化 HumanMessage 提取并校验现代/legacy 附件。
  【对应 frontend/】 components/workspace/messages/message-list-item.tsx
  【架构位置】     L3 消息协议适配
  【主要导出】     extractMessageAttachments · isImageAttachment
  【依赖关系】     messages/utils · types/message
  【边界与注意】   不读取 composer 本地文件；格式不完整的服务端字段不补造。
*/

import { extractContentFromMessage, parseUploadedFiles } from "./utils";
import type { FileInMessage } from "./utils";
import type { Message } from "../types/message";

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
]);

function parseModernAttachment(value: unknown): FileInMessage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.filename !== "string" ||
    candidate.filename.length === 0 ||
    typeof candidate.size !== "number" ||
    !Number.isFinite(candidate.size) ||
    candidate.size < 0 ||
    !(candidate.path === undefined || typeof candidate.path === "string") ||
    !(
      candidate.status === undefined ||
      candidate.status === "uploading" ||
      candidate.status === "uploaded"
    )
  ) {
    return null;
  }
  return {
    filename: candidate.filename,
    size: candidate.size,
    ...(candidate.path === undefined ? {} : { path: candidate.path }),
    ...(candidate.status === undefined ? {} : { status: candidate.status }),
  };
}

export function extractMessageAttachments(message: Message): FileInMessage[] {
  const modern = message.additional_kwargs?.files;
  if (Array.isArray(modern)) {
    const validated = modern
      .map(parseModernAttachment)
      .filter((file): file is FileInMessage => file !== null);
    if (validated.length > 0) {
      return validated;
    }
  }

  const content = extractContentFromMessage(message);
  return content.includes("<current_uploads>") ||
    content.includes("<uploaded_files>")
    ? parseUploadedFiles(content)
    : [];
}

export function isImageAttachment(file: Pick<FileInMessage, "filename">) {
  const extension = file.filename.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(extension);
}
