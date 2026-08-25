import { describe, expect, it } from "vitest";

import { isEditableKeyboardTarget } from "@/core/input/keyboard";

describe("global keyboard ownership", () => {
  it.each(["input", "textarea", "select", "[contenteditable=true]"])(
    "recognizes %s as an editable shortcut owner",
    (selector) => {
      document.body.innerHTML =
        selector === "[contenteditable=true]"
          ? '<div contenteditable="true"><span id="target"></span></div>'
          : `<${selector} id="target"></${selector}>`;
      expect(isEditableKeyboardTarget(document.querySelector("#target"))).toBe(
        true,
      );
    },
  );

  it("allows shortcuts from ordinary controls", () => {
    document.body.innerHTML = '<button id="target">Toggle</button>';
    expect(isEditableKeyboardTarget(document.querySelector("#target"))).toBe(
      false,
    );
  });
});
