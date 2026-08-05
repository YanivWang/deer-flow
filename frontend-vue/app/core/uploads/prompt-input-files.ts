/*
  【文件职责】     见下方源码；本文件由 frontend/src/core/uploads/prompt-input-files.ts retype 而来。
  【对应 frontend/】 frontend/src/core/uploads/prompt-input-files.ts
  【架构位置】     L3
  【主要导出】     PromptInputFilePart / promptInputFilePartToFile
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：Vercel AI SDK 的类型内联进 @/core/types/message，不装这个包（02 §321）。（ai → @/core/types/message）
                   勿手改——`make land-retyped-check` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
*/

import type { FileUIPart } from "@/core/types/message";

export type PromptInputFilePart = FileUIPart & {
  // Transient submit-time handle to the original browser File; not serializable.
  file?: File;
};

export async function promptInputFilePartToFile(
  filePart: PromptInputFilePart,
): Promise<File | null> {
  if (filePart.file instanceof File) {
    const filename =
      typeof filePart.filename === "string" && filePart.filename.length > 0
        ? filePart.filename
        : filePart.file.name;
    const mediaType =
      typeof filePart.mediaType === "string" && filePart.mediaType.length > 0
        ? filePart.mediaType
        : filePart.file.type;

    if (filePart.file.name === filename && filePart.file.type === mediaType) {
      return filePart.file;
    }

    return new File([filePart.file], filename, { type: mediaType });
  }

  if (!filePart.url || !filePart.filename) {
    return null;
  }

  try {
    const response = await fetch(filePart.url);
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} while fetching fallback file URL`,
      );
    }
    const blob = await response.blob();

    return new File([blob], filePart.filename, {
      type: filePart.mediaType || blob.type,
    });
  } catch (error) {
    console.warn("promptInputFilePartToFile: fetch fallback failed", {
      error,
      url: filePart.url,
      filename: filePart.filename,
    });
    return null;
  }
}
