import { readFileSync, readdirSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const vuePages = fileURLToPath(new URL("../../app/pages", import.meta.url));
const reactPages = fileURLToPath(
  new URL("../../../frontend/src/app", import.meta.url),
);

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

function normalizedRoute(path: string) {
  const segments = path
    .replace(/\.(vue|tsx)$/, "")
    .split("/")
    .filter((segment) => segment !== "index" && segment !== "page")
    .filter((segment) => !/^\(.+\)$/.test(segment))
    .map((segment) => segment.replace(/^\[\.\.\.(.+)]$/, "[...$1]"));
  return `/${segments.join("/")}`;
}

describe("React-observable product surface", () => {
  it("does not expose an unowned Vue page outside documented marketing fixtures", () => {
    const reactRoutes = new Set(
      filesBelow(reactPages)
        .filter((file) => file.endsWith("/page.tsx"))
        .map((file) => normalizedRoute(relative(reactPages, file))),
    );
    const vueRoutes = filesBelow(vuePages)
      .filter((file) => file.endsWith(".vue"))
      .map((file) => relative(vuePages, file))
      .filter((file) => !file.startsWith("__m0/"))
      .map(normalizedRoute);

    const documentedExceptions = new Set(["/about", "/pricing"]);
    expect(
      vueRoutes.filter(
        (route) => !reactRoutes.has(route) && !documentedExceptions.has(route),
      ),
    ).toEqual([]);
  });

  it("does not expose feedback until the React message-list call site does", () => {
    const reactMessageList = readFileSync(
      new URL(
        "../../../frontend/src/components/workspace/messages/message-list.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const reactCallSites = [
      ...reactMessageList.matchAll(/<MessageListItem\b([\s\S]*?)\/>/g),
    ];
    const reactPassesFeedback = reactCallSites.some((match) =>
      /\bfeedback\s*=/.test(match[1] ?? ""),
    );
    const vueMessageList = readFileSync(
      new URL("../../app/components/chat/MessageList.vue", import.meta.url),
      "utf8",
    );

    if (!reactPassesFeedback) {
      expect(vueMessageList).not.toMatch(
        /ThumbsUp|ThumbsDown|actions\.(?:helpful|notHelpful)/,
      );
    }
  });

  it("does not mount assets from the sibling React project at runtime", () => {
    const nuxtConfig = readFileSync(
      new URL("../../nuxt.config.ts", import.meta.url),
      "utf8",
    );
    expect(nuxtConfig).not.toContain('new URL("../frontend/');
  });

  it("keeps the attachment entry as the same keyboard-operable button surface", () => {
    const reactComposer = readFileSync(
      new URL(
        "../../../frontend/src/components/workspace/input-box.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const vueComposer = readFileSync(
      new URL("../../app/components/chat/ChatComposer.vue", import.meta.url),
      "utf8",
    );

    expect(reactComposer).toMatch(
      /<PromptInputButton[\s\S]*?data-testid="add-attachments-button"/,
    );
    expect(vueComposer).toMatch(
      /<button[\s\S]*?data-testid="add-attachments-button"/,
    );
    expect(vueComposer).not.toMatch(
      /<label[\s\S]*?data-testid="add-attachments-button"/,
    );
  });
});
