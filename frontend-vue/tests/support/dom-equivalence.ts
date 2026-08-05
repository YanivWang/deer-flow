/*
  【文件职责】     把一段 HTML / 一棵 DOM 子树归一化成可逐节点比对的结构。
  【对应 frontend/】 无（gate 资产）
  【架构位置】     测试支撑
  【主要导出】     normalizeHtml · normalizeElement · type NormalizedNode
  【依赖关系】     运行在 happy-dom 环境（`*.dom.test.ts`）
  【边界与注意】   ⚠️ **判据是归一化 DOM 等价，不是字符级一致**（04 §1）。
                   字符级判据一定会红——Vue 与 React 在布尔属性序列化、style 属性顺序、
                   自闭合写法、空白处理上本来就不同——然后被人为放宽，gate 随即作废。

                   下面每一条归一化都是一类**显式登记**的允许差异。新增任何一条都要走
                   同样的登记（改这里 + 写进证据文档），不能在用例里就地放宽。

                   | 归一化                          | 为什么它是允许差异                                  |
                   | ------------------------------- | --------------------------------------------------- |
                   | 丢弃注释节点                    | Vue 的 fragment 锚点 / v-if 占位是注释，React 没有  |
                   | 丢弃 `<link rel="preload">`     | React 19 的 float：见到 `<img>` 就往文档里插预加载  |
                   | 布尔属性 `""` ↔ 属性名 ↔ 存在   | `disabled=""`（React）vs `disabled`（Vue）          |
                   | class 视作无序集合              | 两边生成顺序不同，但 CSS 不看顺序                   |
                   | style 视作属性 map              | 序列化顺序与单位补全不同                            |
                   | 属性名小写                      | HTML 属性名大小写不敏感                             |
                   | 合并相邻文本节点                | 见下                                                |

                   **相邻文本节点**这一条是实测逼出来的，值得单独说明：React 把
                   `["a", " ", "b"]` 序列化成一个文本节点，Vue 为每个 vnode 子节点建一个
                   DOM 文本节点。于是同一段 `- [ ] todo` 在 React 侧是 `" todo"` 一个节点、
                   Vue 侧是 `" "` + `"todo"` 两个节点。**合并后逐字比对，一个字符都不放过**——
                   放宽的只是「文本被切成几个节点」，那既不影响 `textContent`，
                   也不影响 CSS 与选择器。

                   **不做的归一化**（做了就等于放弃判据）：
                   - 文本内容逐字比对，不折叠空白。空白差异在 Markdown 里是可见差异。
                   - 子节点顺序严格比对。
                   - 属性集合严格比对——多一个少一个都算差异。
*/

export interface NormalizedElement {
  type: "element";
  tag: string;
  attributes: Record<string, string | true>;
  children: NormalizedNode[];
}

export interface NormalizedText {
  type: "text";
  value: string;
}

export type NormalizedNode = NormalizedElement | NormalizedText;

/** React 19 的 float 会为 `<img>` 插入这一条；Vue 不会。 */
function isReactFloatArtifact(element: Element): boolean {
  return (
    element.tagName.toLowerCase() === "link" &&
    element.getAttribute("rel") === "preload"
  );
}

function normalizeClass(value: string): string {
  return value.trim().split(/\s+/).filter(Boolean).sort().join(" ");
}

function normalizeStyle(value: string): string {
  return value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon === -1) return declaration.toLowerCase();
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const propertyValue = declaration.slice(colon + 1).trim();
      return `${property}:${propertyValue}`;
    })
    .sort()
    .join(";");
}

function normalizeAttributes(element: Element): Record<string, string | true> {
  const attributes: Record<string, string | true> = {};
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;
    if (name === "class") {
      attributes[name] = normalizeClass(value);
      continue;
    }
    if (name === "style") {
      attributes[name] = normalizeStyle(value);
      continue;
    }
    // 布尔属性：`disabled=""`（React）/ `disabled`（Vue）/ `disabled="disabled"` 同义。
    if (value === "" || value.toLowerCase() === name) {
      attributes[name] = true;
      continue;
    }
    attributes[name] = value;
  }
  return attributes;
}

export function normalizeElement(element: Element): NormalizedElement {
  return {
    type: "element",
    tag: element.tagName.toLowerCase(),
    attributes: normalizeAttributes(element),
    children: normalizeChildNodes(element),
  };
}

function normalizeChildNodes(parent: Node): NormalizedNode[] {
  const output: NormalizedNode[] = [];
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 8 /* comment */) continue;
    if (child.nodeType === 3 /* text */) {
      const value = child.nodeValue ?? "";
      // 空文本节点两边都可能有/没有，且不产生任何可见差异。
      if (value === "") continue;
      const previous = output.at(-1);
      // 相邻文本节点合并——见文件头。合并后的内容仍然逐字比对。
      if (previous?.type === "text") {
        previous.value += value;
        continue;
      }
      output.push({ type: "text", value });
      continue;
    }
    if (child.nodeType !== 1 /* element */) continue;
    const element = child as Element;
    if (isReactFloatArtifact(element)) continue;
    output.push(normalizeElement(element));
  }
  return output;
}

/** 解析一段 HTML 并归一化其顶层子节点。 */
export function normalizeHtml(html: string): NormalizedNode[] {
  const host = document.createElement("div");
  host.innerHTML = html;
  return normalizeChildNodes(host);
}

/** 归一化一个已挂载元素的子节点（与 `normalizeHtml` 同口径）。 */
export function normalizeChildren(element: Element): NormalizedNode[] {
  return normalizeChildNodes(element);
}
