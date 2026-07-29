# image-generation Skill 原理说明

`image-generation` 的核心原理：Agent 负责构造结构化英文视觉 prompt 和参考图路径，Python 脚本负责选择 Gemini 或 MiniMax 并写出图片文件。

## 目录角色

- `SKILL.md`：运行时入口说明，frontmatter 决定 skill 名称、触发描述和可能的工具/兼容性元数据，正文定义 Agent 的执行工作流。
- `desc/SKILL_zh.md`：中文可替换运行版；保留运行关键字面量和原始执行规范，用于中文维护和审阅。
- 其它资源：
  - `scripts/generate.py`
  - `templates/doraemon.md`

## 运行链路

```mermaid
flowchart TD
  A["用户请求匹配 image-generation"] --> B["Agent 读取 SKILL.md"]
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
- 为避免复杂运行规范因翻译遗漏而失真，中文文件中保留了原始 `SKILL.md` 正文作为执行权威。

## 源码对齐备注

注意：MiniMax 路径使用 `MINIMAX_API_KEY`，Gemini 路径使用 `GEMINI_API_KEY`；参考图会按 provider 要求转换。

## 测试覆盖

当前仓库中可见的相关测试：
- `tests/skills/test_image_generation.py`
这些测试通常验证脚本/解析/边界逻辑；若 skill 调用第三方服务，mock 测试不等于真实端到端成功。
