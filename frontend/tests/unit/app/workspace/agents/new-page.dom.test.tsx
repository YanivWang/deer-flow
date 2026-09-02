import { afterEach, describe, expect, it, rs } from "@rstest/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import NewAgentPage from "@/app/workspace/agents/new/page";

const push = rs.fn();

rs.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: rs.fn(), refresh: rs.fn() }),
  usePathname: () => "/workspace/agents/new",
}));

// The name step never streams; a stub keeps the page off the real transport.
rs.mock("@/core/threads/hooks", () => ({
  useThreadStream: () => ({
    thread: { messages: [], isLoading: false },
    sendMessage: rs.fn(),
  }),
  hasToolResult: () => false,
}));

rs.mock("@/core/agents/api", () => ({
  checkAgentName: rs.fn(async () => ({ available: true, name: "x" })),
  getAgent: rs.fn(),
  AgentNameCheckError: class extends Error {},
  AgentsApiDisabledError: class extends Error {},
}));

rs.mock("@/core/i18n/hooks", () => ({
  useI18n: () => ({
    locale: "en-US",
    t: {
      agents: {
        createPageTitle: "Design your Agent",
        createPageSubtitle: "subtitle",
        backToGallery: "Back to Gallery",
        more: "More",
        nameStepTitle: "Name your new Agent",
        nameStepHint: "hint",
        nameStepPlaceholder: "e.g. code-reviewer",
        nameStepContinue: "Continue",
        nameStepInvalidError: "Invalid name",
        nameStepAlreadyExistsError: "taken",
        nameStepNetworkError: "network",
        nameStepCheckError: "check failed",
        nameStepCheckErrorWithDetail: "detail {detail}",
        nameStepApiDisabledError: "disabled",
        nameStepBootstrapMessage: "bootstrap {name}",
      },
    },
    changeLocale: rs.fn(),
  }),
}));

afterEach(() => {
  push.mockClear();
  cleanup();
});

/*
 * Both assertions cover accessibility affordances this page was missing while
 * the rest of the file already had them: the More trigger three lines below
 * the back button carries aria-label, and the two other validation-error
 * paragraphs in this codebase (account-settings-page.tsx, human-input-card.tsx)
 * are role="alert". A nameless icon-only control and a silent error message
 * are the kind of regression nothing else here would catch.
 */
describe("new agent name step accessibility", () => {
  it("names the back control and sends it to the gallery", () => {
    render(<NewAgentPage />);

    const back = screen.getByRole("button", { name: "Back to Gallery" });
    fireEvent.click(back);
    expect(push).toHaveBeenCalledWith("/workspace/agents");
  });

  it("announces the validation error", () => {
    render(<NewAgentPage />);

    fireEvent.change(screen.getByPlaceholderText("e.g. code-reviewer"), {
      target: { value: "bad name!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("alert").textContent).toBe("Invalid name");
  });
});
