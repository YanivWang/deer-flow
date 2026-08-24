/*
  【文件职责】     见下方导出与 JSDoc。
  【架构位置】     L3
  【主要导出】     PromptInputFilePart / promptInputFilePartToFile
  【依赖关系】     见下方 import。
  【边界与注意】   本文件由本仓维护；行为由 tests/ 下的用例约束。
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
