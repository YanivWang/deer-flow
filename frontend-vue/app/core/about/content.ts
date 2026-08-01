export const ABOUT_LINKS = [
  { href: "https://github.com/bytedance/deer-flow", label: "GitHub 仓库" },
  { href: "https://deerflow.tech/", label: "官方网站" },
  { href: "mailto:support@deerflow.tech", label: "支持邮箱" },
] as const;

export const ABOUT_FEATURES = [
  "技能与工具",
  "子智能体",
  "沙箱与文件系统",
  "上下文工程",
  "长期记忆",
] as const;

export type AboutMarkdownSection = {
  body?: readonly string[];
  heading: string;
  list?: readonly string[];
};

export const ABOUT_MARKDOWN_SECTIONS: readonly AboutMarkdownSection[] = [
  {
    body: [
      "DeerFlow 是一个面向研究、编码和工作流自动化的开源超级智能体框架。",
      "Vue/Nuxt 前端在替换 React UI 表面的同时，保持 Gateway 契约不变。",
    ],
    heading: "概览",
  },
  {
    heading: "运行时形态",
    list: [
      "`Gateway` 负责 REST、认证和 LangGraph 兼容运行生命周期。",
      "`frontend-vue` 负责 Nuxt 页面、本地设置状态和符合 Gateway 形态的客户端。",
      "`skills` 与 `MCP` 仍由后端治理；设置页只呈现已配置状态。",
    ],
  },
  {
    body: [
      "live runtime 签字仍需要已配置的 Gateway、provider 账号和对应环境车道。",
    ],
    heading: "验证边界",
  },
] as const;

export function resolveAboutVersion(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "开发版";
}
