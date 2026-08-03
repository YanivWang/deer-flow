import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import {
  useChatSidebarChannels,
  type ChatSidebarChannelsController,
} from "../../../../app/features/chat/sidebar/use-chat-sidebar-channels";
import type { useChannelSettings } from "../../../../app/features/settings/channels/use-channel-settings";
import type { ChannelProvider } from "../../../../app/core/api/channels/client";

type ChannelSettingsController = ReturnType<typeof useChannelSettings>;

describe("useChatSidebarChannels", () => {
  it("filters visible providers and opens setup with editable credential values", async () => {
    const configuredProvider = provider({
      configured: true,
      credential_fields: [credentialField("bot_token", "Bot token")],
      credential_values: { bot_token: "********" },
      connection_status: "connected",
      provider: "slack",
    });
    const hiddenProvider = provider({ enabled: false, provider: "discord" });
    const settings = createChannelSettings([configuredProvider, hiddenProvider]);
    const controller = mountController(settings);

    expect(controller.visibleChannelProviders.value).toEqual([configuredProvider]);

    await controller.connectChannel(configuredProvider);
    expect(controller.channelSetupProvider.value).toEqual(configuredProvider);
    expect(controller.channelSetupValues.value).toEqual({ bot_token: "********" });

    controller.updateChannelSetupValue("bot_token", "xoxb-ui");
    expect(controller.channelSetupValues.value).toEqual({ bot_token: "xoxb-ui" });
    controller.cancelChannelSetup();
    expect(controller.channelSetupProvider.value).toBeNull();
  });

  it("connects configured providers and exposes the Gateway instruction", async () => {
    const connectProvider = vi.fn(async () => ({ instruction: "Send /connect abc123." }));
    const providerValue = provider({ configured: true, provider: "slack" });
    const controller = mountController(createChannelSettings([providerValue], { connectProvider }));

    await controller.connectChannel(providerValue);

    expect(connectProvider).toHaveBeenCalledWith("slack");
    expect(controller.channelActionMessage.value).toBe("Send /connect abc123.");
  });

  it("configures the provider, preserves masked fields, and continues to connect", async () => {
    const updatedProvider = provider({
      configured: true,
      connectable: true,
      connection_status: "not_connected",
      credential_fields: [],
      credential_values: {},
      provider: "slack",
    });
    const configureProvider = vi.fn(async () => updatedProvider);
    const connectProvider = vi.fn(async () => ({ instruction: "Send /connect configured." }));
    const sourceProvider = provider({
      configured: false,
      credential_fields: [credentialField("bot_token", "Bot token")],
      credential_values: {},
      provider: "slack",
    });
    const controller = mountController(
      createChannelSettings([sourceProvider], { configureProvider, connectProvider }),
    );

    await controller.connectChannel(sourceProvider);
    controller.updateChannelSetupValue("bot_token", "xoxb-ui");
    await controller.saveChannelSetup();

    expect(configureProvider).toHaveBeenCalledWith({
      provider: "slack",
      values: { bot_token: "xoxb-ui" },
    });
    expect(connectProvider).toHaveBeenCalledWith("slack");
    expect(controller.channelSetupProvider.value).toBeNull();
    expect(controller.channelActionMessage.value).toBe("Send /connect configured.");

    await controller.connectChannel({ ...updatedProvider, connection_status: "connected" });
    expect(controller.channelSetupValues.value).toEqual({ bot_token: "********" });
  });

  it("keeps connection failures visible without leaving the setup pending", async () => {
    const providerValue = provider({ configured: true, provider: "slack" });
    const controller = mountController(createChannelSettings([providerValue], {
      connectProvider: vi.fn(async () => {
        throw new Error("Gateway unavailable");
      }),
    }));

    await controller.connectChannel(providerValue);

    expect(controller.channelActionMessage.value).toBe("Gateway unavailable");
  });
});

function mountController(settings: ChannelSettingsController): ChatSidebarChannelsController {
  let controller: ChatSidebarChannelsController | undefined;
  const Host = defineComponent({
    setup() {
      controller = useChatSidebarChannels({ channelSettings: settings });
      return () => h("div");
    },
  });
  mount(Host);
  if (!controller) {
    throw new Error("Sidebar channel controller was not initialized.");
  }
  return controller;
}

function createChannelSettings(
  providers: ChannelProvider[],
  overrides: {
    configureProvider?: ChannelSettingsController["configureProvider"];
    connectProvider?: ChannelSettingsController["connectProvider"];
  } = {},
): ChannelSettingsController {
  return {
    adminRequired: ref(false),
    channelConnectionsEnabled: computed(() => true),
    configureProvider: overrides.configureProvider ?? vi.fn(async () => providers[0] as ChannelProvider),
    connectProvider: overrides.connectProvider ?? vi.fn(async () => ({ instruction: "connected" })),
    connections: computed(() => []),
    connectionsQuery: {} as ChannelSettingsController["connectionsQuery"],
    disconnectConnection: vi.fn(async () => {}),
    disconnectProvider: vi.fn(async () => providers[0] as ChannelProvider),
    errorMessage: ref(""),
    isLoading: ref(false),
    isMutationPending: ref(false),
    mutationErrorMessage: ref(""),
    providers: ref(providers),
    providersQuery: {} as ChannelSettingsController["providersQuery"],
  } as unknown as ChannelSettingsController;
}

function provider(overrides: Partial<ChannelProvider> = {}): ChannelProvider {
  return {
    auth_mode: "binding_code",
    configured: false,
    connectable: false,
    connection_status: "not_connected",
    credential_fields: [],
    credential_values: {},
    display_name: "Slack",
    enabled: true,
    provider: "slack",
    unavailable_reason: null,
    ...overrides,
  };
}

function credentialField(name: string, label: string) {
  return { label, name, required: true, type: "password" };
}
