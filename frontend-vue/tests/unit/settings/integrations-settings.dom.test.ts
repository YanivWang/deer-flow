/*
  【文件职责】     钉住 Lark 集成面板里几处**取样看不见**的分支：已验证授权的措辞、
                   sandbox runtime 的就绪徽标、非管理员的安装门禁，以及新流程作废
                   在飞状态回读。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     IntegrationsSettings · mocked lark api · mocked auth session/toast
  【边界与注意】   对照台账 (`e2e-parity`) 只取一个默认状态的样本：未安装、未授权、
                   非管理员这三条分支它一条都走不到，几何与可访问性树因此全都相等。
                   这四条恰恰是那时候错着也不会红的地方，所以在这里各钉一条。

                   四条都做过负向验证（把修改逐条改回去，对应用例立刻红）——记录在
                   本轮提交说明里。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import IntegrationsSettings from "@/components/workspace/settings/IntegrationsSettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { LarkIntegrationStatus } from "@/core/integrations/lark/types";

const loadStatus = vi.hoisted(() => vi.fn());
const sessionRef = vi.hoisted(() => ({ value: null as unknown }));

vi.mock("@/core/integrations/lark/api", async () => {
  const actual = await vi.importActual<
    typeof import("@/core/integrations/lark/api")
  >("@/core/integrations/lark/api");
  return {
    ...actual,
    loadLarkIntegrationStatus: loadStatus,
    installLarkIntegration: vi.fn(),
    startLarkAuthorization: vi.fn(),
    startLarkConfiguration: vi.fn(),
    completeLarkConfiguration: vi.fn(),
    completeLarkAuthorization: vi.fn(),
    setLarkAppCredentials: vi.fn(),
  };
});

vi.mock("@/composables/useAuthSession", () => ({
  useAuthSession: () => ({
    session: sessionRef,
    isFetching: ref(false),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/core/auth/auth-disabled-user", async () => {
  const actual = await vi.importActual<
    typeof import("@/core/auth/auth-disabled-user")
  >("@/core/auth/auth-disabled-user");
  return { ...actual, isAuthDisabledMode: () => false };
});

vi.mock("@/core/workspace-shell/toast", () => ({
  useWorkspaceToast: () => ({
    toasts: ref([]),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn(),
  }),
}));

function status(
  overrides: Partial<LarkIntegrationStatus> = {},
): LarkIntegrationStatus {
  return {
    installed: true,
    version: "v1.0.65",
    manifest_version: "v1.0.65",
    latest_available_version: "v1.0.65",
    runtime_version_mismatch: false,
    app_configured: true,
    app_id: "cli_mock",
    app_brand: "feishu",
    skills_expected: 27,
    skills_installed: 4,
    installed_skills: [],
    enabled_skills: [],
    install_path: "/tmp/lark-cli",
    cli: {
      available: true,
      path: "/usr/bin/lark-cli",
      version: "lark-cli v1.0.65",
      error: null,
    },
    auth: {
      status: "authenticated",
      message: "ok",
      user: "Alice",
      verified: true,
    },
    sandbox_runtime_mode: "init-container",
    sandbox_runtime_ready: true,
    sandbox_runtime_detail: null,
    ...overrides,
  };
}

function mountPanel() {
  return mount(IntegrationsSettings, {
    attachTo: document.body,
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false } },
            }),
          },
        ],
      ],
    },
  });
}

const admin = {
  tag: "authenticated",
  user: { id: "u1", email: "a@b.c", system_role: "admin" },
};
const member = {
  tag: "authenticated",
  user: { id: "u2", email: "d@e.f", system_role: "user" },
};

beforeEach(() => {
  loadStatus.mockReset().mockResolvedValue(status());
  sessionRef.value = admin;
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: { value: enUS } } }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("IntegrationsSettings", () => {
  it("names a live-verified connection by its user, not by the configured-for wording", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    /*
      verified 与「只是配了凭据」是两种状态。verified 时读到的应该就是那个账号名；
      退回 authConfiguredFor 等于告诉用户「配好了」，而实际上已经连通了。
    */
    expect(wrapper.text()).toContain("Alice");
    expect(wrapper.text()).not.toContain(
      enUS.settings.integrations.lark.authConfiguredFor("Alice"),
    );
    wrapper.unmount();
  });

  it("gives the sandbox-runtime card the same ready/pending badge as the other three", async () => {
    loadStatus.mockResolvedValue(
      status({
        sandbox_runtime_ready: false,
        sandbox_runtime_detail: "no init image",
      }),
    );
    const wrapper = mountPanel();
    await flushPromises();

    // 四格同一个组件：少一个徽标，这一格就成了唯一读不出就绪状态的那格。
    const badges = wrapper.findAll('[data-slot="badge"]');
    expect(badges).toHaveLength(4);
    expect(badges.map((badge) => badge.text())).toEqual([
      enUS.settings.integrations.ready,
      enUS.settings.integrations.ready,
      enUS.settings.integrations.ready,
      enUS.settings.integrations.pending,
    ]);
    wrapper.unmount();
  });

  it("disables install for a non-admin and says why", async () => {
    sessionRef.value = member;
    const wrapper = mountPanel();
    await flushPromises();

    const install = wrapper
      .findAll("button")
      .find((button) => button.text() === enUS.settings.integrations.reinstall);
    expect(install?.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain(enUS.settings.integrations.adminRequired);
    wrapper.unmount();
  });

  it("says out loud which authorization domains are selected", async () => {
    /*
      对照台账钉的是「两个应用一不一致」，不是「这个属性在不在」——两边一起漏掉
      aria-pressed 时它照样是 0 行（wave 88 就是这么量出来的）。所以存在性只能在
      各自的用例里钉：这一条守 Vue 那一侧，React 那一侧守在
      frontend/tests/e2e/integrations.spec.ts 的同一处交互上。
    */
    const wrapper = mountPanel();
    await flushPromises();

    const domain = (label: string) =>
      wrapper.findAll("button").find((button) => button.text() === label)!;

    const calendar = domain(
      enUS.settings.integrations.lark.authDomains.calendar.label,
    );
    expect(calendar.attributes("aria-pressed")).toBe("false");
    await calendar.trigger("click");
    expect(
      domain(
        enUS.settings.integrations.lark.authDomains.calendar.label,
      ).attributes("aria-pressed"),
    ).toBe("true");
    // 相邻的那颗必须还是 false：整排一起翻过去和一颗都不翻一样是错的。
    expect(
      domain(
        enUS.settings.integrations.lark.authDomains.drive.label,
      ).attributes("aria-pressed"),
    ).toBe("false");
    wrapper.unmount();
  });

  it("says out loud which Lark app brand is selected", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    const byText = (label: string) =>
      wrapper.findAll("button").find((button) => button.text() === label)!;
    await byText(enUS.settings.integrations.lark.changeAppButton).trigger(
      "click",
    );

    const lark = enUS.settings.integrations.lark;
    // 单选：点掉默认的 feishu 之后，两颗的状态必须一起翻过来。
    expect(byText(lark.brandFeishu).attributes("aria-pressed")).toBe("true");
    expect(byText(lark.brandLark).attributes("aria-pressed")).toBe("false");
    await byText(lark.brandLark).trigger("click");
    expect(byText(lark.brandFeishu).attributes("aria-pressed")).toBe("false");
    expect(byText(lark.brandLark).attributes("aria-pressed")).toBe("true");
    wrapper.unmount();
  });

  it("drops an in-flight status read that a newer flow has superseded", async () => {
    /*
      真正会撞上的顺序：先点 Refresh（一次状态回读在飞），再点 Connect。Connect 的
      第一步就是重新读一次状态，两次读的响应回来的先后没有保证。React 在这里
      queryClient.cancelQueries + 把 AbortSignal 交给 queryFn，迟到的旧响应连
      resolve 的机会都没有；少了它，旧响应会把新流程刚拿到的状态盖回去，
      而用户看到的仍然是「刚刷新过」的界面。
    */
    let refreshSignal: AbortSignal | undefined;
    let releaseRefresh!: (value: LarkIntegrationStatus) => void;
    loadStatus
      .mockResolvedValueOnce(status())
      .mockImplementationOnce(
        (signal?: AbortSignal) =>
          new Promise<LarkIntegrationStatus>((resolve, reject) => {
            refreshSignal = signal;
            releaseRefresh = resolve;
            signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      )
      .mockResolvedValueOnce(status({ app_configured: false }));
    vi.stubGlobal("open", () => null);

    const wrapper = mountPanel();
    await flushPromises();
    const click = async (label: string) => {
      await wrapper
        .findAll("button")
        .find((button) => button.text() === label)!
        .trigger("click");
      await flushPromises();
    };

    await click(enUS.settings.integrations.refresh);
    expect(refreshSignal?.aborted).toBe(false);

    await click(enUS.settings.integrations.lark.connectedAction);
    expect(refreshSignal?.aborted).toBe(true);

    releaseRefresh(status({ cli: { ...status().cli, version: "STALE" } }));
    await flushPromises();
    expect(wrapper.text()).not.toContain("STALE");
    expect(wrapper.text()).not.toContain(enUS.settings.integrations.loadFailed);
    wrapper.unmount();
  });
});
