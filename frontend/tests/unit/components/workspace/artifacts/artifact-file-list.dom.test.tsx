import { afterEach, describe, expect, it, rs } from "@rstest/core";
import { cleanup, render, screen } from "@testing-library/react";

import { ArtifactFileList } from "@/components/workspace/artifacts/artifact-file-list";
import { ThreadContext } from "@/components/workspace/messages/context";

// The list only needs select/setOpen from the artifacts context; hand it stubs
// rather than standing up the whole panel provider.
rs.mock("@/components/workspace/artifacts/context", () => ({
  useArtifacts: () => ({ select: rs.fn(), setOpen: rs.fn() }),
}));

rs.mock("@/core/auth/AuthProvider", () => ({
  useAuth: () => ({ user: null }),
}));

rs.mock("@/core/i18n/hooks", () => ({
  useI18n: () => ({
    locale: "en-US",
    t: { common: { download: "Download", install: "Install" } },
  }),
}));

function renderList(isMock: boolean) {
  return render(
    <ThreadContext.Provider
      value={{
        thread: { messages: [], values: {} } as never,
        isMock,
      }}
    >
      <ArtifactFileList
        files={["/mnt/user-data/outputs/summary.txt"]}
        threadId="demo-thread"
      />
    </ThreadContext.Provider>,
  );
}

afterEach(cleanup);

describe("ArtifactFileList download href", () => {
  /*
   * Regression: this list forgot to forward the mock-thread flag, while
   * artifact-file-detail.tsx forwards it to every URL it builds. On
   * /showcase/<thread_id> the demo artifacts are served by the /mock/api
   * route handler, so the plain /api/threads/... link is the authenticated
   * Gateway route and an anonymous visitor cannot read it.
   */
  it("routes a mock thread through the /mock/api handler", () => {
    renderList(true);
    expect(screen.getByRole("link", { name: /Download/ })).toHaveProperty(
      "pathname",
      "/mock/api/threads/demo-thread/artifacts/mnt/user-data/outputs/summary.txt",
    );
  });

  it("keeps the plain API route for a real thread", () => {
    renderList(false);
    expect(screen.getByRole("link", { name: /Download/ })).toHaveProperty(
      "pathname",
      "/api/threads/demo-thread/artifacts/mnt/user-data/outputs/summary.txt",
    );
  });
});
