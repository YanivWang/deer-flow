import { describe, expect, it } from "@rstest/core";
import { render, screen } from "@testing-library/react";

import { PromptInputSubmit } from "@/components/ai-elements/prompt-input";

describe("PromptInputSubmit", () => {
  it("exposes the action represented by the streaming stop icon", () => {
    const { rerender } = render(<PromptInputSubmit status="ready" />);

    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();

    rerender(<PromptInputSubmit status="streaming" />);

    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
  });

  it("preserves an explicit caller-provided accessible name", () => {
    render(
      <PromptInputSubmit
        aria-label="Stop side conversation"
        status="streaming"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Stop side conversation" }),
    ).toBeTruthy();
  });
});
