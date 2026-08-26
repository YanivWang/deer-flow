/*
  【文件职责】     artifact 在列表里怎么被称呼：文件名与人读的类型名。
  【架构位置】     L3
  【主要导出】     artifactFileName / artifactTypeDisplayName
  【依赖关系】     无
  【边界与注意】   与 React 的 `getFileName` / `getFileExtensionDisplayName`
                   （frontend/src/core/utils/files.tsx）同形：几种常见办公与文档格式
                   有自己的名字，其余一律大写扩展名。类型名**不翻译**——React 那边
                   返回的就是 "Markdown" / "Word" 这样的固定串，两个应用必须叫同一个名字。
*/

export function artifactFileName(filepath: string) {
  return filepath.split("/").pop() ?? filepath;
}

export function artifactTypeDisplayName(filepath: string) {
  const extension = artifactFileName(filepath).split(".").pop() ?? "";
  switch (extension.toLowerCase()) {
    case "doc":
    case "docx":
      return "Word";
    case "md":
      return "Markdown";
    case "txt":
      return "Text";
    case "ppt":
    case "pptx":
      return "PowerPoint";
    case "xls":
    case "xlsx":
      return "Excel";
    default:
      return extension.toUpperCase();
  }
}
