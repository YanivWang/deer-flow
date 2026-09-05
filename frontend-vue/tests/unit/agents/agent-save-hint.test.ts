/*
  【文件职责】     守住 bootstrap 会话里那条一次性「记得保存」提示。
  【架构位置】     L3 单元测试（只读源码，不挂载）
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/chat/AgentChat.vue
  【边界与注意】   只读源码的理由与 chat-header.test.ts 相同：挂载 AgentChat 要连上
                   stream/threads/query 一整套，代价远大于它能多钉住的东西。

                   **对照台账看不见这一条**：它只在 `/workspace/agents/new` 确认名字
                   之后出现，而那条路由没有同名的 React spec 文件，进不了取样面
                   （坑 107）。

                   存储键必须与上游**逐字相同**——两个应用共用一份「读过了」的记忆。
                   键写歪了不会有任何门禁变红，用户只会在换个应用时被同一句提示再教育
                   一次。这里写死字面量而不是去读上游源码，理由写在那条用例上面。
*/

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const raw = readFileSync(
  new URL("../../../app/components/chat/AgentChat.vue", import.meta.url),
  "utf8",
);

/* 注释先剥掉：这里钉的每一条在文件里都同时出现在解释它的注释里。 */
const source = raw
  .replaceAll(/<!--[\s\S]*?-->/g, "")
  .replaceAll(/\/\*[\s\S]*?\*\//g, "");

describe("agent bootstrap save hint", () => {
  it("shows the hint once and only for a bootstrap session", () => {
    expect(source).toContain("if (!props.bootstrap) return;");
    expect(source).toContain(
      'if (safeLocalStorage.getItem(SAVE_HINT_STORAGE_KEY) === "1") return;',
    );
    expect(source).toContain(
      'safeLocalStorage.setItem(SAVE_HINT_STORAGE_KEY, "1");',
    );
    // 渲染门必须是这个 ref，不是别的 bootstrap 判据——否则每次进来都会再弹一次。
    expect(source).toMatch(/<div v-if="showSaveHint" class="px-4 pt-4">/);
    expect(source).toContain("$i18n.t.value.agents.saveHint");
  });

  it("takes the hint down when the user saves", () => {
    expect(source).toMatch(
      /function saveAgent\(\) \{\s*showSaveHint\.value = false;\s*void creation\.save\(\);\s*\}/,
    );
    // 保存那一项走 saveAgent，不再直接调 creation.save。
    expect(source).toContain('@select="saveAgent"');
    expect(source).not.toContain('@click="creation.save"');
    expect(source).not.toContain('@select="creation.save"');
  });

  /*
    提示这句文案（两个应用共用的上游 saveHint）写的是「from the top-right menu」。
    在 wave 78 之前本仓的保存是工具条上一颗可见按钮，界面和它自己的说明打架，
    所以这里把「保存那一项在 ⋯ 菜单里」也钉住：谁把它搬回工具条，这条当场红。
    形状同上游 agents/new/page.tsx:309 的 DropdownMenuItem + SaveIcon。
  */
  it("keeps save inside the top-right more menu the hint points at", () => {
    expect(source).toMatch(
      /<DropdownMenuItem\s+data-testid="agent-save"[\s\S]*?<Save class="h-4 w-4" \/>/,
    );
    expect(source).toContain('data-testid="agent-more"');
    expect(source).toContain("$i18n.t.value.agents.more");
  });

  it("gives the conversation the upstream top padding while the hint is up", () => {
    expect(source).toContain(
      ":class=\"isWelcomeMode ? '' : showSaveHint ? 'pt-4' : 'pt-10'\"",
    );
  });

  /*
    键值写死在这里，**不去读上游那份源码**。读它能钉得更死（上游改名这里就红），
    但那会给 `scripts/standalone-check.mjs` 的 CROSS_APP_BY_DESIGN 再添一个文件，
    而「移走 frontend/ 之后 Vue 仍然自足」这条判据现在是 0 处 / 0 个文件。
    为一条「换个应用会不会被同一句提示再教育一次」的低风险漂移换掉那个 0，不值。
    上游的声明在 frontend/src/app/workspace/agents/new/page.tsx 的
    SAVE_HINT_STORAGE_KEY；改这一行时去那里核一眼。
  */
  it("remembers under the key both apps share", () => {
    expect(source).toContain(
      'const SAVE_HINT_STORAGE_KEY = "deerflow.agent-create.save-hint-seen";',
    );
  });
});
