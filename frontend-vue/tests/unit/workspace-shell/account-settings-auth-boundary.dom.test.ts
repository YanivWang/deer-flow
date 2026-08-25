import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AccountSettings from "@/components/workspace/settings/AccountSettings.vue";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { enUS } from "@/core/i18n/locales/en-US";
import { buildComposerDraftKey } from "@/core/threads/composer-draft";

vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));

const navigateTo = vi.fn();

describe("AccountSettings authenticated client boundary", () => {
  beforeEach(() => {
    sessionStorage.clear();
    navigateTo.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("navigateTo", navigateTo);
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: { value: enUS } },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(fetchWithAuth).mockReset();
    sessionStorage.clear();
  });

  it("removes every previous-user query and composer draft after logout", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["threads", "search"], {
      threads: [{ thread_id: "admin-thread" }],
    });
    queryClient.setQueryData(["memory", "facts"], ["admin-memory"]);
    sessionStorage.setItem(
      buildComposerDraftKey({
        userId: "admin-user",
        threadId: "admin-thread",
      }),
      JSON.stringify({ text: "admin draft", skillName: null }),
    );
    sessionStorage.setItem("unrelated", "keep");

    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "admin-user",
            email: "admin@example.com",
            system_role: "admin",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const wrapper = mount(AccountSettings, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        config: { globalProperties: { $i18n: { t: { value: enUS } } } },
      },
    });
    await flushPromises();
    await wrapper.get("button.bg-red-600").trigger("click");
    await flushPromises();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(
      sessionStorage.getItem(
        buildComposerDraftKey({
          userId: "admin-user",
          threadId: "admin-thread",
        }),
      ),
    ).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("keep");
    expect(navigateTo).toHaveBeenCalledWith("/login");

    wrapper.unmount();
  });
});
