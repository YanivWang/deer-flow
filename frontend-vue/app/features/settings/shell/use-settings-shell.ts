import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { ABOUT_FEATURES, ABOUT_LINKS, ABOUT_MARKDOWN_SECTIONS, resolveAboutVersion } from "../../../core/about/content";
import { DEFAULT_LOCALE } from "../../../core/i18n";
import type { LocalePreference } from "../../../core/settings/preferences";
import { useSettingsAccount } from "../account/use-settings-account";
import { useSettingsChannels } from "../channels/use-settings-channels";
import { useSettingsIntegrations } from "../integrations/use-settings-integrations";
import { useSettingsMemory } from "../memory/use-settings-memory";
import { useSettingsPreferences } from "../preferences/use-settings-preferences";
import { useSettingsSkills } from "../skills/use-settings-skills";
import { useSettingsTools } from "../tools/use-settings-tools";
import { readInitialDialog, SETTINGS_DIALOG_SECTIONS, type SettingsDialog } from "../dialogs/model";
import { readInitialSection, type SettingsSection } from "../../../entities/settings/model";

export function useSettingsShell() {
  const route = useRoute();
  const router = useRouter();
  const { t } = useAppI18n();
  const runtimeConfig = useRuntimeConfig();
  const appThemeMode = useState<"light" | "dark">("theme-mode", () => "light");
  const appLocale = useState<LocalePreference>("locale", () => DEFAULT_LOCALE);
  const account = useSettingsAccount({ push: (path) => router.push(path) });
  const preferences = useSettingsPreferences({
    appLocale,
    appThemeMode,
    notificationBody: () => t("settings.notification.testBody"),
    notificationTitle: () => t("settings.notification.testTitle"),
  });
  const labels: Record<SettingsSection, string> = {
    account: "账户",
    appearance: "外观",
    memory: "记忆",
    tools: "工具",
    skills: "技能",
    notification: "通知",
    channels: t("sidebar.channels"),
    integrations: "集成",
    about: "关于",
  };
  const initialDialog = readInitialDialog(route.query.dialog);
  const activeSection = ref<SettingsSection>(readInitialSection(
    route.query.settings,
    route.hash,
    initialDialog ? SETTINGS_DIALOG_SECTIONS[initialDialog] : null,
  ));
  const activeDialog = ref<SettingsDialog | null>(initialDialog);
  const closeConfirmationOpen = ref(false);
  const canManageSkills = computed(() => account.user.value?.system_role === "admin");
  const memorySettings = useSettingsMemory(computed(() => activeSection.value === "memory"));
  const tools = useSettingsTools(computed(() => activeSection.value === "tools"));
  const skills = useSettingsSkills(computed(() => activeSection.value === "skills"));
  const channels = useSettingsChannels(computed(() => activeSection.value === "channels"));
  const integrations = useSettingsIntegrations(computed(() => activeSection.value === "integrations"));
  const aboutVersion = computed(() => resolveAboutVersion(runtimeConfig.public.appVersion));

  const hasUnsavedDialogChanges = computed(() => {
    switch (activeDialog.value) {
      case "mcp-config": return tools.hasUnsavedChanges.value;
      case "channel-config": return channels.hasUnsavedChanges.value;
      case "lark-auth":
      case "lark-config": return integrations.hasUnsavedChanges.value;
      case "skill-create":
      case "skill-review": return skills.hasUnsavedChanges.value;
      default: return false;
    }
  });

  onMounted(() => {
    void account.load();
    window.addEventListener("keydown", handleSettingsEscape);
  });
  onBeforeUnmount(() => window.removeEventListener("keydown", handleSettingsEscape));

  watch(
    () => [route.query.settings, route.query.dialog, route.hash] as const,
    ([settings, dialog, hash]) => {
      const nextDialog = readInitialDialog(dialog);
      activeDialog.value = nextDialog;
      activeSection.value = readInitialSection(
        settings,
        hash,
        nextDialog ? SETTINGS_DIALOG_SECTIONS[nextDialog] : null,
      );
    },
  );

  function handleSettingsEscape(event: KeyboardEvent): void {
    if (event.key === "Escape" && !activeDialog.value) void router.push("/workspace/chats/new");
  }

  function selectSection(section: SettingsSection): void {
    activeSection.value = section;
    activeDialog.value = null;
    void replaceSettingsRoute(section, null);
  }

  function openSettingsDialog(dialog: SettingsDialog): void {
    activeDialog.value = dialog;
    activeSection.value = SETTINGS_DIALOG_SECTIONS[dialog];
    void replaceSettingsRoute(activeSection.value, dialog);
  }

  function requestCloseSettingsDialog(): void {
    if (hasUnsavedDialogChanges.value) {
      closeConfirmationOpen.value = true;
      return;
    }
    closeSettingsDialog();
  }

  function closeSettingsDialog(): void {
    resetActiveDialogState();
    closeConfirmationOpen.value = false;
    activeDialog.value = null;
    void replaceSettingsRoute(activeSection.value, null);
  }

  function resetActiveDialogState(): void {
    switch (activeDialog.value) {
      case "mcp-config":
        tools.resetMcpConfigEditor();
        break;
      case "channel-config":
        channels.resetChannelRuntimeConfig();
        break;
      case "lark-auth":
      case "lark-config":
        integrations.resetIntegrationDialogState();
        break;
      case "skill-create":
      case "skill-review":
        skills.resetSkillDialogState();
        break;
    }
  }

  function cancelCloseSettingsDialog(): void {
    closeConfirmationOpen.value = false;
  }

  function replaceSettingsRoute(section: SettingsSection, dialog: SettingsDialog | null) {
    const query: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(route.query)) {
      if (typeof value === "string") query[key] = value;
      else if (Array.isArray(value)) query[key] = value.filter((item): item is string => typeof item === "string");
    }
    query.settings = section;
    if (dialog) query.dialog = dialog;
    else delete query.dialog;
    return router.replace({ hash: `#${section}`, query });
  }

  return {
    ABOUT_FEATURES,
    ABOUT_LINKS,
    ABOUT_MARKDOWN_SECTIONS,
    aboutVersion,
    account,
    activeDialog,
    activeSection,
    canManageSkills,
    channels,
    closeConfirmationOpen,
    closeSettingsDialog,
    integrations,
    labels,
    memorySettings,
    openSettingsDialog,
    preferences,
    requestCloseSettingsDialog,
    cancelCloseSettingsDialog,
    selectSection,
    skills,
    tools,
  };
}

export type SettingsShellController = ReturnType<typeof useSettingsShell>;
