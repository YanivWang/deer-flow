/*
  【文件职责】     HumanInputCard 的两个纯判定：Enter 是否提交、哪些必填项还空着。
  【架构位置】     L3 chat UI adapter（纯逻辑）
  【主要导出】     shouldSubmitHumanInputTextOnKeyDown · findMissingRequiredFields
  【依赖关系】     core/input/ime · core/messages/human-input
  【边界与注意】   上游把这两个函数**从组件文件里导出**
                   （frontend/src/components/workspace/messages/human-input-card.tsx:43 与 :67），
                   并单独写了用例。SFC 没法干净地多导出符号，所以本仓把它们放在同名 `.ts` 里
                   （`markdown-link-context.ts` 是同一个模式）；顺带绕开 i18n source guard
                   ——它只扫产品 `.vue`，纯逻辑挪进 `.ts` 就不会被误判（坑 52）。

                   `isEmptyFieldValue` 与 core 里的 `isEmptyFormValue` **是两个东西，不要合并**：
                   - 本文件的版本给的是「必填校验」的空，布尔 `false` 算空——
                     必填的复选框没勾上就是没填。
                   - core 那个给的是「摘要里要不要出现」的空，布尔 `false` 不算空——
                     "Approved: no" 是一条有信息量的回答，得进摘要。
                   两者只在布尔上分叉，上游同样是两份实现。

                   字符串一律 `trim()` 之后再判空。本仓此前把这条判定内联在 SFC 里写成
                   `value === ""`，于是一个只填了空格的必填项能通过校验直接提交；
                   上游用例明写 `amount: "  "` 必须被判为缺失
                   （frontend/tests/.../human-input-card.test.ts:184）。
*/

import { isImeComposing, type ImeKeyboardEvent } from "@/core/input/ime";
import {
  readHumanInputFormValue,
  type HumanInputField,
  type HumanInputFormValue,
} from "@/core/messages/human-input";

export function shouldSubmitHumanInputTextOnKeyDown(
  event: ImeKeyboardEvent & Pick<KeyboardEvent, "key" | "shiftKey">,
  isComposing = false,
) {
  return (
    event.key === "Enter" &&
    !event.shiftKey &&
    !isImeComposing(event, isComposing)
  );
}

function isEmptyFieldValue(value: HumanInputFormValue | undefined) {
  if (value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return value === false;
}

export function findMissingRequiredFields(
  fields: HumanInputField[],
  values: Record<string, HumanInputFormValue>,
) {
  // Own-property reads only: field names like "toString" must never resolve
  // to inherited Object.prototype members and satisfy required validation.
  return fields.filter(
    (field) =>
      field.required &&
      isEmptyFieldValue(readHumanInputFormValue(values, field.name)),
  );
}
