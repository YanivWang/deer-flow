---
name: podcast-generation
description: 当用户请求从文本内容生成或制作播客时使用此 skill。它会把书面内容转换成双主持人的自然对话播客音频。
---

# podcast-generation Skill（中文可替换运行版）

## 中文执行摘要

先把文本整理为双主持人脚本，再通过 TTS provider 合成分段音频并拼接成播客文件。

## 替换运行标准

- 此文件用于中文维护；如果未来需要替换原 `SKILL.md`，必须保持本文件开头的 frontmatter 为第一个 YAML frontmatter。
- 不要翻译或改写脚本路径、命令参数、工具名、环境变量、模板路径、输出路径和结构化字段名。
- 正文说明必须直接承载运行语义，不能依赖英文原文兜底。

## 关键资源

- `scripts/generate.py`
- `templates/tech-explainer.md`

## 源码对齐备注

注意：当前脚本同时支持 Volcengine 和 MiniMax TTS，provider 选择取决于环境变量。

## 原理和运行流程

`podcast-generation` 的核心原理：先把文本整理为双主持人脚本，再通过 TTS provider 合成分段音频并拼接成播客文件。

## 目录角色

- `SKILL.md`：运行时入口说明，frontmatter 决定 skill 名称、触发描述和可能的工具/兼容性元数据，正文定义 Agent 的执行工作流。
- `desc/SKILL_zh.md`：中文可替换运行版；保留运行关键字面量，用于中文维护和审阅。
- 其它资源：
  - `scripts/generate.py`
  - `templates/tech-explainer.md`

## 运行链路

```mermaid
flowchart TD
  A["用户请求匹配 podcast-generation"] --> B["Agent 读取 SKILL.md"]
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

注意：当前脚本同时支持 Volcengine 和 MiniMax TTS，provider 选择取决于环境变量。

## 测试覆盖

当前仓库中可见的相关测试：
- `tests/skills/test_podcast_generation.py`
这些测试通常验证脚本/解析/边界逻辑；若 skill 调用第三方服务，mock 测试不等于真实端到端成功。
