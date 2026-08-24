/*
  【文件职责】     在类型层钉住 message.ts 的联合语义，塌陷时让 `make typecheck` 直接红。
  【架构位置】     L3 类型断言（纯 type-only，编译后不产出任何运行时代码）
  【主要导出】     只有类型别名，运行时为空模块
  【依赖关系】     app/core/types/message.ts
  【边界与注意】   这个文件之所以在 `app/` 而不是 `tests/`，是因为**`tests/` 根本不过 vue-tsc**。
                   `.nuxt/tsconfig.app.json` 的 include 只放了 `../tests/nuxt/` 一支，
                   所以 `tests/guards/` 与 `tests/unit/core/` 里的类型断言（含
                   `@ts-expect-error`）全是空操作——实测把 `AgentMessageContent`
                   改成 `string` 后，guard 测试 8 个用例照样全绿、vue-tsc 一声不吭。

                   断言放进 `app/` 才能骑在已有的 typecheck 预算门禁上：
                   联合一塌，这里多出一条 vue-tsc 报错，预算「多一条红」立刻生效，
                   不需要再造一套 `vitest --typecheck` 工具链。
*/

import type { AgentContentPart, AgentMessageContent, Message } from "./message";

/** `T` 不为 `true` 时报 TS2344，错误直接指到下面某一行。 */
type Assert<T extends true> = T;

type Extends<A, B> = [A] extends [B] ? true : false;

// --- 联合必须有两侧 --------------------------------------------------------

/** 塌成 `string` 时为 false → 报错。这是 06 §M1 1b 点名的那个失效方式。 */
export type _ContentIsNotOnlyString = Assert<
  Extends<AgentMessageContent, string> extends true ? false : true
>;

/** 反向：塌成 `AgentContentPart[]`（把字符串内容包成单元素数组）同样报错。 */
export type _ContentIsNotOnlyParts = Assert<
  Extends<AgentMessageContent, AgentContentPart[]> extends true ? false : true
>;

/** 两侧都必须真的在联合里，不能只是 `unknown` 蒙混过关。 */
export type _StringSideAccepted = Assert<Extends<string, AgentMessageContent>>;
export type _PartsSideAccepted = Assert<
  Extends<AgentContentPart[], AgentMessageContent>
>;

// --- part 的开放性 ---------------------------------------------------------

/** 未知 part 类型必须可表达（线上有 `thinking`，SDK 的闭合联合表达不了）。 */
export type _UnknownPartTypeAccepted = Assert<
  Extends<{ type: "thinking"; thinking: string }, AgentContentPart>
>;

/** `image_url` 的两种形状都要在类型内，否则消费方只能强转。 */
export type _ImageUrlStringAccepted = Assert<
  Extends<{ type: "image_url"; image_url: string }, AgentContentPart>
>;
export type _ImageUrlObjectAccepted = Assert<
  Extends<
    { type: "image_url"; image_url: { url: string; detail?: string } },
    AgentContentPart
  >
>;

// --- 消息本体 --------------------------------------------------------------

/** `Message["content"]` 必须就是这个联合本身，不能在消息层被收窄。 */
export type _MessageCarriesTheUnion = Assert<
  Extends<Message["content"], AgentMessageContent> extends true
    ? Extends<AgentMessageContent, Message["content"]>
    : false
>;
