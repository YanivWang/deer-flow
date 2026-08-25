/* user-visible status/reason/error/retry contract. */
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceChangesBadge from "@/components/workspace/changes/WorkspaceChangesBadge.vue";
import { enUS } from "@/core/i18n/locales/en-US";

const fetchChanges = vi.hoisted(() => vi.fn());
vi.mock("@/core/workspace-changes/api", () => ({
  fetchWorkspaceChanges: fetchChanges,
}));

const summary = {
  available: true,
  version: 1,
  summary: {
    created: 1,
    modified: 1,
    deleted: 1,
    symlink_created: 1,
    additions: 4,
    deletions: 2,
    truncated: true,
  },
  files: [
    {
      path: "/mnt/user-data/workspace/a.txt",
      root: "workspace",
      status: "created",
      binary: false,
      sensitive: false,
      size_before: null,
      size_after: 1,
      sha256_before: null,
      sha256_after: "a",
      diff: "",
      diff_truncated: false,
      diff_unavailable_reason: null,
      additions: 1,
      deletions: 0,
      symlink: false,
      symlink_target_before: null,
      symlink_target_after: null,
    },
    {
      path: "/mnt/user-data/workspace/b.bin",
      root: "workspace",
      status: "modified",
      binary: true,
      sensitive: false,
      size_before: 1,
      size_after: 2,
      sha256_before: "a",
      sha256_after: "b",
      diff: "",
      diff_truncated: false,
      diff_unavailable_reason: "binary",
      additions: 0,
      deletions: 0,
      symlink: false,
      symlink_target_before: null,
      symlink_target_after: null,
    },
    {
      path: "/mnt/user-data/workspace/secret",
      root: "workspace",
      status: "deleted",
      binary: false,
      sensitive: true,
      size_before: 1,
      size_after: null,
      sha256_before: "a",
      sha256_after: null,
      diff: "",
      diff_truncated: false,
      diff_unavailable_reason: "sensitive",
      additions: 0,
      deletions: 1,
      symlink: false,
      symlink_target_before: null,
      symlink_target_after: null,
    },
    {
      path: "/mnt/user-data/workspace/link",
      root: "workspace",
      status: "symlink_created",
      binary: false,
      sensitive: false,
      size_before: null,
      size_after: null,
      sha256_before: null,
      sha256_after: null,
      diff: "",
      diff_truncated: false,
      diff_unavailable_reason: "symlink",
      additions: 0,
      deletions: 0,
      symlink: true,
      symlink_target_before: null,
      symlink_target_after: "a.txt",
    },
  ],
  limits: {},
} as const;

function mountBadge() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return mount(WorkspaceChangesBadge, {
    props: { threadId: "t-1", runId: "r-1" },
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      config: { globalProperties: { $i18n: { t: { value: enUS } } } },
    },
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  fetchChanges.mockReset().mockResolvedValue(summary);
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: { value: enUS } } }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("WorkspaceChangesBadge", () => {
  it("shows truncated summary and every actual file status", async () => {
    const wrapper = mountBadge();
    await flushPromises();
    expect(wrapper.text()).toContain("Some changes were truncated");
    expect(wrapper.text()).toContain("Created");
    expect(wrapper.text()).toContain("Modified");
    expect(wrapper.text()).toContain("Deleted");
    expect(wrapper.text()).toContain("Symlink created");
    wrapper.unmount();
  });

  it("shows exact unavailable reasons and retries a failed detail request", async () => {
    fetchChanges
      .mockResolvedValueOnce(summary)
      .mockRejectedValueOnce(new Error("snapshot expired"))
      .mockResolvedValueOnce(summary);
    const wrapper = mountBadge();
    await flushPromises();
    await wrapper
      .get("button[data-testid='workspace-changes-open']")
      .trigger("click");
    await flushPromises();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "snapshot expired",
    );
    const retry = document.querySelector<HTMLButtonElement>(
      '[data-testid="workspace-changes-retry"]',
    )!;
    retry.click();
    await flushPromises();
    expect(document.body.textContent).toContain(
      "Binary file. Diff unavailable.",
    );
    expect(document.body.textContent).toContain(
      "Sensitive path. Content hidden.",
    );
    expect(document.body.textContent).toContain(
      "Symlink change. Diff unavailable.",
    );
    expect(fetchChanges).toHaveBeenCalledTimes(3);
    wrapper.unmount();
  });
});
