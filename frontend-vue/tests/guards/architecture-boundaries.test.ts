import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const appRoot = resolve(process.cwd(), "app");

describe("frontend-vue architecture boundaries", () => {
  it("keeps Chat route adapters free of business implementation", () => {
    const routes = [
      "pages/workspace/chats/[thread_id].vue",
      "pages/workspace/agents/[agent_name]/chats/[thread_id].vue",
    ];

    const offenders = routes.flatMap((route) => {
      const source = readFileSync(join(appRoot, route), "utf8");
      return /(?:from ["'][^"']*(?:core|entities|features|composables)[^"']*["']|fetch\()/.test(source)
        ? [route]
        : [];
    });

    expect(offenders).toEqual([]);
  });

  it("keeps Settings account auth behavior in its feature/widget owner", () => {
    const route = readFileSync(join(appRoot, "pages/workspace/settings.vue"), "utf8");
    const source = readFileSync(join(appRoot, "widgets/workspace/settings/SettingsShell.vue"), "utf8");
    const owner = readFileSync(join(appRoot, "features/settings/shell/use-settings-shell.ts"), "utf8");

    expect(route).toContain("SettingsShell");
    expect(source).toContain("SettingsAccountPanel");
    expect(owner).toContain("useSettingsAccount");
    expect(source).not.toMatch(/(?:fetchCurrentUser|changePassword|logoutAndRedirect)/);
  });

  it("keeps Settings preference behavior in its feature/widgets owner", () => {
    const source = readFileSync(join(appRoot, "widgets/workspace/settings/SettingsShell.vue"), "utf8");
    const owner = readFileSync(join(appRoot, "features/settings/shell/use-settings-shell.ts"), "utf8");

    expect(owner).toContain("useSettingsPreferences");
    expect(source).toContain("SettingsAppearancePanel");
    expect(source).toContain("SettingsNotificationPanel");
    expect(source).not.toMatch(
      /(?:applyThemePreference|readWorkspacePreferences|writeWorkspacePreferences|readNotificationApi)/,
    );
  });

  it("keeps Settings memory behavior in its feature/widget owner", () => {
    const source = readFileSync(join(appRoot, "widgets/workspace/settings/SettingsShell.vue"), "utf8");
    const owner = readFileSync(join(appRoot, "features/settings/shell/use-settings-shell.ts"), "utf8");

    expect(owner).toContain("useSettingsMemory");
    expect(source).toContain("SettingsMemoryPanel");
    expect(source).not.toMatch(
      /(?:useMemorySettings|createMemoryFact|updateMemoryFact|deleteMemoryFact|clearMemory|importMemory|exportMemory)/,
    );
    expect(source).not.toMatch(/memory(?:Fact|Edit|Import|Export|Form)/);
  });

  it("keeps Settings tools/MCP behavior in its feature/widget owner", () => {
    const source = readFileSync(join(appRoot, "widgets/workspace/settings/SettingsShell.vue"), "utf8");
    const owner = readFileSync(join(appRoot, "features/settings/shell/use-settings-shell.ts"), "utf8");

    expect(owner).toContain("useSettingsTools");
    expect(source).toContain("SettingsToolsPanel");
    expect(source).not.toMatch(
      /(?:useMcpSettings|loadMcpConfig|updateMcpConfig|updateMcpServerState|resetMcpToolsCache|parseMcpConfig|summarizeMcpRuntime)/,
    );
    expect(source).not.toMatch(/mcp(?:ConfigText|FormError|ResetMessage|RuntimeSummary)/);
  });

  it("keeps Settings skills behavior in its feature/widget owner", () => {
    const source = readFileSync(join(appRoot, "widgets/workspace/settings/SettingsShell.vue"), "utf8");
    const owner = readFileSync(join(appRoot, "features/settings/shell/use-settings-shell.ts"), "utf8");

    expect(owner).toContain("useSettingsSkills");
    expect(source).toContain("SettingsSkillsPanel");
    expect(source).not.toMatch(
      /(?:useSkillSettings|fetchSkillDetail|fetchCustomSkill|updateCustomSkill|deleteCustomSkill|reloadSkills|buildCustomSkillDraft)/,
    );
    expect(source).not.toMatch(/skill(?:Filter|Detail|Custom|Editor|History|Action|Form|Install|Create|Review)/);
  });

  it("keeps Settings channel behavior in its feature/widget owner", () => {
    const source = readFileSync(join(appRoot, "widgets/workspace/settings/SettingsShell.vue"), "utf8");
    const owner = readFileSync(join(appRoot, "features/settings/shell/use-settings-shell.ts"), "utf8");

    expect(owner).toContain("useSettingsChannels");
    expect(source).toContain("SettingsChannelsPanel");
    expect(source).not.toMatch(
      /(?:useChannelSettings|connectChannelProvider|configureChannelProvider|disconnectChannelProvider|disconnectChannelConnection|buildChannelConnectionByProvider)/,
    );
    expect(source).not.toMatch(/channel(?:Action|Connect|Config|Provider|Connection)/);
  });

  it("keeps Settings integration behavior in its feature/widget owner", () => {
    const source = readFileSync(join(appRoot, "widgets/workspace/settings/SettingsShell.vue"), "utf8");
    const owner = readFileSync(join(appRoot, "features/settings/shell/use-settings-shell.ts"), "utf8");

    expect(owner).toContain("useSettingsIntegrations");
    expect(source).toContain("SettingsIntegrationsPanel");
    expect(source).not.toMatch(
      /(?:useLarkIntegration|startLarkAuthorization|completeLarkAuthorization|startLarkConfiguration|completeLarkConfiguration|installLarkIntegration)/,
    );
    expect(source).not.toMatch(/lark(?:Action|Form|Config|Auth|Calendar)/);
  });

  it("keeps Scheduled Tasks state and DOM out of the route adapter", () => {
    const source = readFileSync(join(appRoot, "pages/workspace/scheduled-tasks.vue"), "utf8");

    expect(source).toContain("ScheduledTaskPage");
    expect(source).not.toMatch(/(?:useScheduledTasks|buildCron|scheduleSummary|createScheduledTask|updateScheduledTask|pauseScheduledTask|triggerScheduledTask)/);
    expect(source).not.toMatch(/(?:cronBuilder|statusFilter|typeFilter|visibleSelectedTask|edit(?:Title|Prompt|Cron|Timezone))/);

    const widget = readFileSync(join(appRoot, "widgets/workspace/scheduled-tasks/ScheduledTaskPage.vue"), "utf8");
    expect(widget).toContain("useScheduledTaskPage");
    expect(widget).toContain("ScheduledTaskCreateForm");
    expect(widget).toContain("ScheduledTaskFilters");
    expect(widget).toContain("ScheduledTaskList");
    expect(widget).toContain("ScheduledTaskDetail");
  });

  it("keeps the custom-agent builder state and DOM in feature/widgets", () => {
    const source = readFileSync(join(appRoot, "pages/workspace/agents/new.vue"), "utf8");

    expect(source).toContain("useNewAgentPage");
    expect(source).toContain("NewAgentHeader");
    expect(source).toContain("NewAgentNameStep");
    expect(source).toContain("NewAgentChatStep");
    expect(source).not.toMatch(/(?:useNewAgent\(|checkAgentName|setup_agent|localStorage|newAgent\.(name|chat|save))/);
  });

  it("keeps the Agents gallery state and DOM in feature/entity/widgets", () => {
    const source = readFileSync(join(appRoot, "pages/workspace/agents/index.vue"), "utf8");

    expect(source).toContain("useAgentsGallery");
    expect(source).toContain("AgentGallery");
    expect(source).not.toMatch(/(?:useQuery|listAgents|fetch\(|deleteAgent|updateAgent)/);
  });

  it("keeps the chats index list state and DOM in feature/entity/widgets", () => {
    const source = readFileSync(join(appRoot, "pages/workspace/chats/index.vue"), "utf8");

    expect(source).toContain("useChatListPage");
    expect(source).toContain("ChatListPage");
    expect(source).not.toMatch(/(?:useThreadList|IntersectionObserver|formatThreadUpdatedAt|fetch\()/);
    expect(source).not.toMatch(/(?:filteredThreads|visibleThreads|searchText|workspace-recent-threads)/);
  });

  it("keeps Workspace navigation state and DOM in feature/widget owners", () => {
    const routeSource = readFileSync(join(appRoot, "widgets/workspace/navigation/WorkspaceNavShell.vue"), "utf8");
    const featureSource = readFileSync(join(appRoot, "features/workspace/navigation/use-workspace-navigation.ts"), "utf8");
    const widgetSource = readFileSync(join(appRoot, "widgets/workspace/navigation/WorkspaceNavigation.vue"), "utf8");

    expect(routeSource).toContain("useWorkspaceNavigation");
    expect(routeSource).toContain("WorkspaceNavigation");
    expect(routeSource).not.toMatch(/(?:localStorage|toggleCollapsed|toggleDensity|router\.(push|replace))/);
    expect(featureSource).toContain("useRoute");
    expect(featureSource).toContain("toggleMobileOpen");
    expect(featureSource).toContain("buildWorkspaceBreadcrumbs");
    expect(widgetSource).toContain("vue-workspace-nav-mobile-close");
    expect(widgetSource).toContain("visibleNavItems");
  });

  it("keeps Chat goal orchestration in the goal feature", () => {
    const source = readFileSync(join(appRoot, "widgets/workspace/chat/WorkspaceChatWidget.vue"), "utf8");

    expect(source).toContain("useChatGoal");
    expect(source).not.toContain("useThreadGoal");
    expect(source).not.toMatch(/const goalDraft = ref\(|async function (refreshActiveGoal|submitGoal|clearActiveGoal)/);
    expect(source).not.toMatch(/goalCommand(Objective|ThreadId)\.value\s*=/);
  });

  it("keeps Chat history pagination lifecycle in the history feature", () => {
    const source = readFileSync(join(appRoot, "widgets/workspace/chat/WorkspaceChatWidget.vue"), "utf8");

    expect(source).toContain("useChatHistoryPagination");
    expect(source).not.toContain("historyLoadMoreObserver");
    expect(source).not.toMatch(/async function loadMoreHistory|function observeHistoryLoadMoreSentinel/);
  });

  it("keeps Chat sidebar pagination lifecycle in the sidebar feature", () => {
    const source = readFileSync(join(appRoot, "widgets/workspace/chat/WorkspaceChatWidget.vue"), "utf8");

    expect(source).toContain("useChatSidebarPagination");
    expect(source).not.toMatch(/function observeRecentChatSentinel|async function loadMoreThreads/);
    expect(source).not.toContain("new IntersectionObserver");
  });

  it("keeps Chat sidebar pagination wiring in the sidebar widgets", () => {
    const sidebarSource = readFileSync(join(appRoot, "widgets/workspace/chat/ChatSidebar.vue"), "utf8");
    const threadListSource = readFileSync(join(appRoot, "widgets/workspace/chat/ChatThreadList.vue"), "utf8");

    expect(sidebarSource).toContain(":pagination=\"props.pagination\"");
    expect(sidebarSource).not.toContain("observeRecentChatSentinel");
    expect(threadListSource).toContain("setRecentChatSentinel");
    expect(threadListSource).not.toContain("emit(\"loadMoreThreads\")");
  });

  it("keeps Chat sidebar channel setup in the sidebar feature", () => {
    const widgetSource = readFileSync(join(appRoot, "widgets/workspace/chat/WorkspaceChatWidget.vue"), "utf8");
    const sidebarSource = readFileSync(join(appRoot, "widgets/workspace/chat/ChatSidebar.vue"), "utf8");

    expect(widgetSource).toContain("useChatSidebarChannels");
    expect(widgetSource).toContain(':channels="sidebarChannels"');
    expect(widgetSource).not.toContain("useChannelSettings");
    expect(widgetSource).not.toMatch(/channel(?:Setup|ProviderSnapshots|ActionMessage)/);
    expect(sidebarSource).toContain("ChatSidebarChannelsController");
    expect(sidebarSource).not.toContain("emit(\"connectChannel\")");
  });

  it("keeps Chat thread settings actions in the thread-settings feature", () => {
    const widgetSource = readFileSync(join(appRoot, "widgets/workspace/chat/WorkspaceChatWidget.vue"), "utf8");
    const settingsSource = readFileSync(join(appRoot, "widgets/workspace/chat/ChatThreadSettings.vue"), "utf8");

    expect(widgetSource).toContain("useChatThreadSettings");
    expect(widgetSource).toContain(":controller=\"threadSettings\"");
    expect(widgetSource).not.toContain("useLocalThreadSettings");
    expect(widgetSource).not.toMatch(/function update(?:ModelName|Mode|ReasoningEffort|ThinkingEnabled|SubagentEnabled)/);
    expect(widgetSource).not.toContain("buildRunContext(");
    expect(settingsSource).toContain("ChatThreadSettingsController");
    expect(settingsSource).not.toContain("defineEmits");
  });

  it("keeps the agent model below feature and widget layers", () => {
    const source = readFileSync(join(appRoot, "entities/agent/model.ts"), "utf8");

    expect(source).not.toMatch(/(?:widgets\/|features\/|\.vue["']|fetch\()/);
  });

  it("keeps Scheduled Tasks entity/core layers below feature and widget layers", () => {
    const entitySource = readFileSync(join(appRoot, "entities/scheduled-task/use-scheduled-tasks.ts"), "utf8");
    const modelSource = readFileSync(join(appRoot, "entities/scheduled-task/model.ts"), "utf8");

    expect(entitySource).not.toMatch(/(?:widgets\/|features\/|\.vue["'])/);
    expect(modelSource).not.toMatch(/(?:widgets\/|features\/|\.vue["']|fetch\()/);
  });

  it("does not allow lower layers to import business UI or use-case layers", () => {
    const offenders = filesUnder(appRoot).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const path = relative(appRoot, file);
      if (!/\.(?:ts|vue)$/.test(path)) return [];
      if (path.startsWith("shared/") && /(?:api\/|widgets\/|features\/|entities\/|fetch\()/.test(source)) {
        return [path];
      }
      if (path.startsWith("core/") && /(?:\.vue["']|widgets\/|features\/|entities\/)/.test(source)) {
        return [path];
      }
      if (path.startsWith("entities/") && /(?:widgets\/|features\/)/.test(source)) {
        return [path];
      }
      return [];
    });

    expect(offenders).toEqual([]);
  });

  it("keeps one production ThreadStreamEngine construction owner", () => {
    const owners = filesUnder(appRoot).filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("new ThreadStreamEngine(");
    });

    expect(owners.map((file) => relative(appRoot, file))).toEqual([
      "entities/thread/stream-store.ts",
    ]);
  });

  it("removes migrated Chat component directories and old style entrypoints", () => {
    expect(existsSync(join(appRoot, "components/workspace/chat"))).toBe(false);
    expect(existsSync(join(appRoot, "components/workspace/messages"))).toBe(false);
    expect(existsSync(join(appRoot, "components/workspace/artifacts"))).toBe(false);
    expect(existsSync(join(appRoot, "assets/styles/main.scss"))).toBe(false);
    expect(existsSync(join(appRoot, "shared/styles/main.scss"))).toBe(true);
  });

  it("keeps Message rendering behind one final owner", () => {
    const messageList = readFileSync(join(appRoot, "widgets/workspace/messages/MessageList.vue"), "utf8");
    const messageItem = readFileSync(join(appRoot, "widgets/workspace/messages/MessageListItem.vue"), "utf8");
    const sidecar = readFileSync(join(appRoot, "widgets/workspace/sidecar/SidecarMessageList.vue"), "utf8");
    const artifact = readFileSync(join(appRoot, "widgets/workspace/artifacts/ArtifactPreview.vue"), "utf8");

    expect(existsSync(join(appRoot, "widgets/workspace/messages/MessageContentRenderer.vue"))).toBe(true);
    expect(existsSync(join(appRoot, "widgets/workspace/messages/RichMessageContent.vue"))).toBe(false);
    expect(messageItem).toContain("MessageContentRenderer");
    expect(sidecar).toContain("MessageContentRenderer");
    expect(artifact).toContain("MessageContentRenderer");
    expect([messageList, messageItem, sidecar, artifact].join("\n")).not.toContain("RichMessageContent");
  });
});

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}
