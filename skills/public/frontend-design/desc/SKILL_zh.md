---
name: frontend-design
description: 当用户要求构建网页组件、页面、应用、海报或美化 Web UI 时使用此 skill，用于创建有设计质量的前端界面。
license: Complete terms in LICENSE.txt
---

# frontend-design Skill（中文可替换运行版）

## 中文执行摘要

将 UI 需求转成生产级前端实现规范，强调视觉质量、布局、交互状态和避免模板化 AI 风格。

## 替换运行标准

- 此文件用于中文维护；如果未来需要替换原 `SKILL.md`，必须保持本文件开头的 frontmatter 为第一个 YAML frontmatter。
- 不要翻译或改写脚本路径、命令参数、工具名、环境变量、模板路径、输出路径和结构化字段名。
- 正文说明必须直接承载运行语义，不能依赖英文原文兜底。

## 关键资源

- `LICENSE.txt`

## 源码对齐备注

注意：frontmatter 的 `license` 必须保留。

## 原理和运行流程

`frontend-design` 的核心原理：将 UI 需求转成生产级前端实现规范，强调视觉质量、布局、交互状态和避免模板化 AI 风格。

## 目录角色

- `SKILL.md`：运行时入口说明，frontmatter 决定 skill 名称、触发描述和可能的工具/兼容性元数据，正文定义 Agent 的执行工作流。
- `desc/SKILL_zh.md`：中文可替换运行版；保留运行关键字面量，用于中文维护和审阅。
- 其它资源：
  - `LICENSE.txt`

## 运行链路

```mermaid
flowchart TD
  A["用户请求匹配 frontend-design"] --> B["Agent 读取 SKILL.md"]
  B --> C["按正文工作流理解需求和输入材料"]
  C --> D{"是否需要额外资源"}
  D -->|需要| E["读取 scripts/templates/references/assets"]
  D -->|不需要| F["直接执行工作流"]
  E --> G["调用脚本、工具或生成结构化输出"]
  F --> G
  G --> H["交付用户需要的结果"]
```

## 可替换性要求

- `desc/SKILL_zh.md` 的首个 frontmatter 必须保留原 `name`，并保留原有 `allowed-tools`、`metadata`、`compatibility`、`license` 等元数据。
- 命令、脚本路径、模板路径、工具名、环境变量和输出路径必须保持字面量不变。
- 中文正文必须直接承载运行语义；如需扩展，应继续用中文补齐 workflow、资源和输出要求。

## 源码对齐备注

注意：frontmatter 的 `license` 必须保留。

## 测试覆盖

当前未发现以该 skill 名称直接命名的专项测试。文档正确性以 `SKILL.md`、资源文件和仓库通用 skill 机制为准。
