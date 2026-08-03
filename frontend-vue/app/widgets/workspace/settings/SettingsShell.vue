<script setup lang="ts">
import AppActionGroup from "../../../shared/ui/AppActionGroup.vue";
import AppButton from "../../../shared/ui/AppButton.vue";
import AppDialog from "../../../shared/ui/AppDialog.vue";
import { SETTINGS_SECTION_IDS } from "../../../entities/settings/model";
import { useSettingsShell } from "../../../features/settings/shell/use-settings-shell";
import SettingsAccountPanel from "./SettingsAccountPanel.vue";
import SettingsAppearancePanel from "./SettingsAppearancePanel.vue";
import SettingsChannelsPanel from "./SettingsChannelsPanel.vue";
import SettingsIntegrationsPanel from "./SettingsIntegrationsPanel.vue";
import SettingsMemoryPanel from "./SettingsMemoryPanel.vue";
import SettingsNavigation from "./SettingsNavigation.vue";
import SettingsNotificationPanel from "./SettingsNotificationPanel.vue";
import SettingsSectionView from "./SettingsSection.vue";
import SettingsSkillsPanel from "./SettingsSkillsPanel.vue";
import SettingsToolsPanel from "./SettingsToolsPanel.vue";
import WorkspaceNavShell from "../navigation/WorkspaceNavShell.vue";

const settings = useSettingsShell();
const { t } = useAppI18n();
const createSkillChatPath = "/workspace/chats/new?mode=skill";
</script>

<template>
  <WorkspaceNavShell>
    <section class="settings-page" data-dialog-name="Settings" data-testid="vue-settings-dialog">
      <header class="settings-page__header">
        <div>
          <h1>{{ t("common.settings") }}</h1>
          <p>管理账户、外观、记忆、工具、技能和产品信息。</p>
        </div>
        <NuxtLink class="workspace-button workspace-button--ghost" data-testid="vue-settings-back" to="/workspace">
          工作区
        </NuxtLink>
      </header>

      <div class="settings-layout">
        <SettingsNavigation
          :active-section="settings.activeSection.value"
          :labels="settings.labels"
          :sections="SETTINGS_SECTION_IDS"
          @select="settings.selectSection"
        />

        <SettingsSectionView
          :id="settings.activeSection.value"
          :title="settings.labels[settings.activeSection.value]"
          :data-testid="`vue-settings-section-${settings.activeSection.value}`"
        >
          <template v-if="settings.activeSection.value === 'appearance'">
            <SettingsAppearancePanel :preferences="settings.preferences" />
          </template>
          <template v-else-if="settings.activeSection.value === 'account'">
            <SettingsAccountPanel :account="settings.account" />
          </template>
          <template v-else-if="settings.activeSection.value === 'memory'">
            <SettingsMemoryPanel :memory="settings.memorySettings" />
          </template>
          <template v-else-if="settings.activeSection.value === 'tools'">
            <SettingsToolsPanel
              :config-editor-open="settings.activeDialog.value === 'mcp-config'"
              :tools="settings.tools"
              @close-config="settings.requestCloseSettingsDialog"
              @open-config="settings.openSettingsDialog('mcp-config')"
            />
          </template>
          <template v-else-if="settings.activeSection.value === 'skills'">
            <SettingsSkillsPanel
              :can-manage="settings.canManageSkills.value"
              :create-chat-path="createSkillChatPath"
              :skills="settings.skills"
              :dialog="settings.activeDialog.value"
              @open-create-dialog="settings.openSettingsDialog('skill-create')"
              @open-review-dialog="settings.openSettingsDialog('skill-review')"
              @close-dialog="settings.requestCloseSettingsDialog"
            />
          </template>
          <template v-else-if="settings.activeSection.value === 'notification'">
            <SettingsNotificationPanel :preferences="settings.preferences" />
          </template>
          <template v-else-if="settings.activeSection.value === 'channels'">
            <SettingsChannelsPanel
              :channels="settings.channels"
              :config-dialog-open="settings.activeDialog.value === 'channel-config'"
              :translate="t"
              @close-config="settings.requestCloseSettingsDialog"
              @open-config="settings.openSettingsDialog('channel-config')"
            />
          </template>
          <template v-else-if="settings.activeSection.value === 'integrations'">
            <SettingsIntegrationsPanel
              :auth-dialog-open="settings.activeDialog.value === 'lark-auth'"
              :config-dialog-open="settings.activeDialog.value === 'lark-config'"
              :integrations="settings.integrations"
              @close-dialog="settings.requestCloseSettingsDialog"
              @open-auth-dialog="settings.openSettingsDialog('lark-auth')"
              @open-config-dialog="settings.openSettingsDialog('lark-config')"
            />
          </template>
          <template v-else>
            <h2>关于 DeerFlow</h2>
            <article class="settings-about settings-about--markdown" data-testid="vue-settings-about-anchor">
              <h3>关于 DeerFlow {{ settings.aboutVersion }}</h3>
              <section v-for="section in settings.ABOUT_MARKDOWN_SECTIONS" :key="section.heading" class="settings-about__section">
                <h4>{{ section.heading }}</h4>
                <p v-for="paragraph in section.body ?? []" :key="paragraph">{{ paragraph }}</p>
                <ul v-if="section.list?.length">
                  <li v-for="item in section.list" :key="item">
                    <code v-if="item.startsWith('`')">{{ item.slice(1, item.indexOf('`', 1)) }}</code>
                    <span v-if="item.startsWith('`')">{{ item.slice(item.indexOf('`', 1) + 1) }}</span>
                    <span v-else>{{ item }}</span>
                  </li>
                </ul>
              </section>
              <h4>核心功能</h4>
              <ul><li v-for="feature in settings.ABOUT_FEATURES" :key="feature">{{ feature }}</li></ul>
              <h4>项目链接</h4>
              <ul><li v-for="link in settings.ABOUT_LINKS" :key="link.href"><a :href="link.href" rel="noreferrer" target="_blank">{{ link.label }}</a></li></ul>
              <p data-testid="vue-settings-about-license">许可证：MIT</p>
            </article>
          </template>
        </SettingsSectionView>
      </div>

      <AppDialog
        :open="settings.closeConfirmationOpen.value"
        title="放弃未保存更改？"
        @close="settings.cancelCloseSettingsDialog"
      >
        <p>当前对话框中仍有未保存内容。关闭将丢弃这些更改。</p>
        <AppActionGroup>
          <AppButton variant="ghost" @click="settings.cancelCloseSettingsDialog">继续编辑</AppButton>
          <AppButton variant="danger" data-testid="vue-settings-discard-dialog" @click="settings.closeSettingsDialog">放弃更改</AppButton>
        </AppActionGroup>
      </AppDialog>
    </section>
  </WorkspaceNavShell>
</template>
