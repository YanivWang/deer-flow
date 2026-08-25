/*
  【文件职责】     固定 WP-08 settings UI 的多账号、删除边界、connect 指引与 Gateway 错误展示。
  【架构位置】     WP-08 Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     ChannelConnections.vue · i18n · mocked composable owner
  【边界与注意】   provider runtime 删除与 connection instance 删除必须保持为两个明确动作。
*/

import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChannelConnections from "@/components/workspace/channels/ChannelConnections.vue";
import { buildChannelProviderViews } from "@/core/channels/state";
import type {
  ChannelConnectResponse,
  ChannelConnection,
  ChannelProvider,
} from "@/core/channels/types";
import { enUS } from "@/core/i18n/locales/en-US";

const ownerFactory = vi.hoisted(() => vi.fn());
const connectWindow = vi.hoisted(() => ({
  close: vi.fn(),
  open: vi.fn(),
  prepare: vi.fn(() => ({ closed: false })),
}));

vi.mock("@/composables/useChannelConnections", () => ({
  useChannelConnections: ownerFactory,
}));
vi.mock("@/composables/useAuthSession", () => ({
  useAuthSession: () => ({ session: { value: undefined } }),
}));
vi.mock("@/core/auth/auth-disabled-user", () => ({
  AUTH_DISABLED_USER: {
    id: "default",
    email: "default@test.local",
    system_role: "admin",
  },
  isAuthDisabledMode: () => true,
}));
vi.mock("@/core/channels/open-connect-url", () => ({
  closeConnectWindow: connectWindow.close,
  openConnectUrl: connectWindow.open,
  prepareConnectWindow: connectWindow.prepare,
}));

function provider(overrides: Partial<ChannelProvider> = {}): ChannelProvider {
  return {
    provider: "slack",
    display_name: "Slack",
    enabled: true,
    configured: true,
    connectable: true,
    auth_mode: "binding_code",
    connection_status: "not_connected",
    credential_fields: [
      {
        name: "bot_token",
        label: "Bot token",
        type: "password",
        required: true,
      },
    ],
    ...overrides,
  };
}

function connection(
  id: string,
  status: string,
  name: string,
): ChannelConnection {
  return {
    id,
    provider: "slack",
    status,
    external_account_name: name,
    workspace_name: "DeerFlow",
    scopes: [],
    metadata: {},
  };
}

function createOwner(
  providers = [provider()],
  connections = [
    connection("connection-a", "connected", "Alice"),
    connection("connection-b", "pending", "Bob"),
    connection("connection-old", "revoked", "Old"),
  ],
) {
  return {
    enabled: ref(true),
    providers: ref(providers),
    connections: ref(connections),
    providerViews: ref(buildChannelProviderViews(providers, connections)),
    connectFlows: ref({}),
    loaded: ref(true),
    loading: ref(false),
    error: ref<Error | null>(null),
    connect: vi.fn(),
    configure: vi.fn(),
    disconnectConnection: vi.fn().mockResolvedValue(undefined),
    disconnectProvider: vi.fn().mockResolvedValue(undefined),
    cancelConnect: vi.fn(),
    isProviderPending: vi.fn(() => false),
    isConnectionPending: vi.fn(() => false),
  };
}

function mountSettings(owner = createOwner()) {
  ownerFactory.mockReturnValue(owner);
  const wrapper = mount(ChannelConnections, {
    attachTo: document.body,
    props: { variant: "settings" },
    global: {
      stubs: { ChannelProviderIcon: true },
    },
  });
  return { owner, wrapper };
}

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS) },
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/**
 * 对话框现在由 ui/dialog · ui/alert-dialog 提供，内容 portal 到 body，
 * 所以断言从 wrapper 子树移到 document。破坏性确认是 alertdialog，其余是 dialog。
 */
function openDialog(role: "dialog" | "alertdialog" = "dialog") {
  const element = document.querySelector<HTMLElement>(`[role="${role}"]`);
  expect(element, `no [role="${role}"] in the document`).not.toBeNull();
  return element!;
}

describe("ChannelConnections settings UI", () => {
  it("renders every account and keeps instance/provider deletion explicit", async () => {
    const { owner, wrapper } = mountSettings();

    expect(wrapper.get('[data-testid="channel-status-slack"]').text()).toBe(
      "Connected",
    );
    expect(
      wrapper.get('[data-testid="channel-connection-connection-a"]').text(),
    ).toContain("Alice · DeerFlow");
    expect(
      wrapper.get('[data-testid="channel-connection-connection-b"]').text(),
    ).toContain("Bob · DeerFlow");
    expect(
      wrapper.get('[data-testid="channel-connection-connection-old"]').text(),
    ).toContain("Disconnected");

    await wrapper
      .get('button[aria-label="Disconnect Alice · DeerFlow"]')
      .trigger("click");
    expect(owner.disconnectConnection).toHaveBeenCalledWith("connection-a");

    await wrapper
      .get('button[aria-label="Remove provider configuration: Slack"]')
      .trigger("click");
    await nextTick();
    const removalDialog = openDialog("alertdialog");
    expect(removalDialog.textContent).toContain(
      "revokes every active connection",
    );
    [...removalDialog.querySelectorAll<HTMLElement>("button")]
      .find(
        (button) =>
          button.textContent?.trim() === "Remove provider configuration",
      )!
      .click();
    expect(owner.disconnectProvider).toHaveBeenCalledWith("slack");
  });

  it("opens deep links and keeps instruction plus waiting state visible", async () => {
    const telegram = provider({
      provider: "telegram",
      display_name: "Telegram",
      auth_mode: "deep_link",
      credential_fields: [],
    });
    const owner = createOwner([telegram], []);
    const response: ChannelConnectResponse = {
      provider: "telegram",
      mode: "deep_link",
      url: "https://t.me/deerflow_bot?start=code",
      code: "code",
      instruction: "Open Telegram and finish binding.",
      expires_in: 600,
    };
    owner.connect.mockImplementation(async () => {
      owner.connectFlows.value = {
        telegram: { provider: "telegram", status: "waiting", response },
      };
      return response;
    });
    const { wrapper } = mountSettings(owner);

    await wrapper.get("button").trigger("click");
    await nextTick();
    expect(connectWindow.prepare).toHaveBeenCalledTimes(1);
    expect(connectWindow.open).toHaveBeenCalledWith(
      response.url,
      expect.any(Object),
    );
    expect(openDialog().textContent).toContain(response.instruction);
    expect(
      document
        .querySelector('[data-testid="channel-connect-state"]')
        ?.textContent?.trim(),
    ).toBe("Waiting for the channel account to connect…");
  });

  it.each([
    {
      label: "URL-only",
      url: "https://t.me/deerflow_bot?start=url-only",
      instruction: "",
      visible: "The provider connection page opened in a new tab.",
    },
    {
      label: "instruction-only",
      url: null,
      instruction: "Send /connect instruction-only",
      visible: "Send /connect instruction-only",
    },
  ])(
    "supports a $label connect response",
    async ({ url, instruction, visible }) => {
      const telegram = provider({
        provider: "telegram",
        display_name: "Telegram",
        auth_mode: "deep_link",
        credential_fields: [],
      });
      const owner = createOwner([telegram], []);
      const response: ChannelConnectResponse = {
        provider: "telegram",
        mode: "deep_link",
        url,
        code: "code",
        instruction,
        expires_in: 600,
      };
      owner.connect.mockImplementation(async () => {
        owner.connectFlows.value = {
          telegram: { provider: "telegram", status: "waiting", response },
        };
        return response;
      });
      const { wrapper } = mountSettings(owner);

      await wrapper.get("button").trigger("click");
      await nextTick();
      expect(openDialog().textContent).toContain(visible);
      if (url)
        expect(connectWindow.open).toHaveBeenCalledWith(
          url,
          expect.any(Object),
        );
      else expect(connectWindow.close).toHaveBeenCalledWith(expect.any(Object));
    },
  );

  it.each([
    "Authentication required",
    "Admin privileges required to manage channel runtime credentials.",
    "Channel connection not found",
    "Too many pending channel connection attempts. Try again later.",
  ])("preserves the Gateway error detail: %s", async (message) => {
    const owner = createOwner([provider({ credential_fields: [] })], []);
    owner.connect.mockRejectedValue(new Error(message));
    const { wrapper } = mountSettings(owner);

    await wrapper.get("button").trigger("click");
    await nextTick();
    expect(wrapper.get('[role="alert"]').text()).toBe(message);
  });
});
