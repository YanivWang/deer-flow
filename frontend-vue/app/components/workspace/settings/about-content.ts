/*
  【文件职责】     「关于 DeerFlow」那一页的 markdown 正文。
  【架构位置】     L3
  【主要导出】     buildAboutMarkdown
  【依赖关系】     core/config（产品版本）
  【边界与注意】   与 React 的 `about-content.ts` **逐字**同一份文案。上游把它内联成
                   模板字符串而不是 import 一个 .md，理由写在它的文件头里
                   （Turbopack 解析不了 raw-loader）；本仓照抄这个形状，是为了让两边
                   的差异只可能来自渲染器而不是内容来源。

                   版本号是**运行期**注入的（见 nuxt.config.ts 的 `appVersion`），
                   所以这里导出的是一个函数而不是常量——写成常量会在模块求值时把
                   版本冻在「还没注入」的空串上。
*/

import { getAppVersion } from "@/core/config";

export function buildAboutMarkdown(version = getAppVersion()) {
  return `# 🦌 [About DeerFlow ${version}](https://github.com/bytedance/deer-flow)

> **From Open Source, Back to Open Source**

DeerFlow (**D**eep **E**xploration and **E**fficient **R**esearch **Flow**) is an open-source **super agent harness** that orchestrates **sub-agents**, **memory**, and **sandboxes** to do almost anything — powered by **extensible skills**.

---

## 🚀 Core Features

* **Skills & Tools**: With built-in and extensible skills and tools, DeerFlow can do almost anything.
* **Sub-Agents**: Sub-Agents help the main agent to do the tasks that are too complex to be done by the main agent.
* **Sandbox & File System**: Safely execute code and manipulate files in the sandbox.
* **Context Engineering**: Isolated sub-agent context, summarization to keep the context window sharp.
* **Long-Term Memory**: Keep recording the user's profile, top of mind, and conversation history.

---

## 🌟 GitHub Repository

![Star History Chart](https://api.star-history.com/svg?repos=bytedance/deer-flow&type=Date)

Explore DeerFlow on GitHub: [github.com/bytedance/deer-flow](https://github.com/bytedance/deer-flow)

## 🌐 Official Website

Visit the official website of DeerFlow: [deerflow.tech](https://deerflow.tech/)

## 📧 Support

If you have any questions or need help, please contact us at [support@deerflow.tech](mailto:support@deerflow.tech).

---

## 📜 License

DeerFlow is proudly open source and distributed under the **MIT License**.

---

## 🙌 Acknowledgments

We extend our heartfelt gratitude to the open source projects and contributors who have made DeerFlow a reality. We truly stand on the shoulders of giants.

### Core Frameworks
- **[LangChain](https://github.com/langchain-ai/langchain)**: A phenomenal framework that powers our LLM interactions and chains.
- **[LangGraph](https://github.com/langchain-ai/langgraph)**: Enabling sophisticated multi-agent orchestration.
- **[Next.js](https://nextjs.org/)**: A cutting-edge framework for building web applications.

### UI Libraries
- **[Shadcn](https://ui.shadcn.com/)**: Minimalistic components that power our UI.
- **[SToneX](https://github.com/stonexer)**: For his invaluable contribution to token-by-token visual effects.

These outstanding projects form the backbone of DeerFlow and exemplify the transformative power of open source collaboration.

### Special Thanks
Finally, we want to express our heartfelt gratitude to the core authors of DeerFlow 1.0 and 2.0:

- **[Daniel Walnut](https://github.com/hetaoBackend/)**
- **[Henry Li](https://github.com/magiccube/)**

Without their vision, passion and dedication, \`DeerFlow\` would not be what it is today.
`;
}
