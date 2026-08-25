/* settings modal DOM/history contract. */
import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsDialog from "@/components/workspace/settings/SettingsDialog.vue";
import { useSettingsDialog } from "@/composables/useSettingsDialog";
import { enUS } from "@/core/i18n/locales/en-US";

const route = reactive({
  path: "/workspace/chats/t-1",
  fullPath: "/workspace/chats/t-1",
  query: {} as Record<string, unknown>,
  hash: "#run-2",
});
const push = vi.fn();
let mounted: ReturnType<typeof mount> | null = null;

function mountDialog() {
  mounted = mount(SettingsDialog, {
    attachTo: document.body,
    global: {
      config: { globalProperties: { $i18n: { t: { value: enUS } } } },
      stubs: {
        AccountSettings: {
          template:
            '<button data-testid="account-control">Account control</button>',
        },
        AppearanceSettings: { template: "<div>Appearance panel</div>" },
        NotificationSettings: true,
        IntegrationsSettings: true,
        ChannelConnections: true,
        ToolSettings: true,
        SkillSettings: true,
        MemorySettings: true,
        AboutSettings: true,
      },
    },
  });
  return mounted;
}

beforeEach(() => {
  document.body.innerHTML = "";
  route.query = {};
  push.mockReset().mockResolvedValue(undefined);
  useSettingsDialog().close({ source: "route" });
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useRouter", () => ({ push }));
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: { value: enUS } } }));
});

afterEach(async () => {
  mounted?.unmount();
  mounted = null;
  await flushPromises();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("SettingsDialog", () => {
  it("has an associated title/description and traps Tab in the modal", async () => {
    const wrapper = mountDialog();
    useSettingsDialog().show("account");
    await flushPromises();

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(
      document.getElementById(dialog.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("Settings");

    const close = document.querySelector<HTMLButtonElement>(
      '[aria-label="Close Settings"]',
    )!;
    close.focus();
    close.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(dialog.contains(document.activeElement)).toBe(true);
    wrapper.unmount();
  });

  it("returns focus on Escape and closes a deep link by preserving query/hash", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open settings";
    document.body.appendChild(trigger);
    trigger.focus();
    route.query = { settings: "memory", tab: "files" };
    const wrapper = mountDialog();
    await flushPromises();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await flushPromises();
    expect(push).toHaveBeenCalledWith({
      path: "/workspace/chats/t-1",
      query: { tab: "files" },
      hash: "#run-2",
    });
    expect(document.activeElement).toBe(trigger);
    wrapper.unmount();
  });

  it("follows back/forward route changes without a query-write loop", async () => {
    route.query = { settings: "appearance", keep: "1" };
    const wrapper = mountDialog();
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    route.query = { keep: "1" };
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(push).not.toHaveBeenCalled();

    route.query = { settings: "appearance", keep: "1" };
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
