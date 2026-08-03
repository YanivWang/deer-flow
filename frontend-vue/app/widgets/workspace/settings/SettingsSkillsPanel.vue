<script setup lang="ts">
import type { Skill } from "../../../core/api/skills/client";
import type { SettingsSkillsController } from "../../../features/settings/skills/use-settings-skills";
import type { SettingsDialog } from "../../../features/settings/dialogs/model";
import AppDialog from "../../../shared/ui/AppDialog.vue";

const props = defineProps<{
  canManage: boolean;
  createChatPath: string;
  dialog: SettingsDialog | null;
  skills: SettingsSkillsController;
}>();

const emit = defineEmits<{
  "open-create-dialog": [];
  "open-review-dialog": [];
  "close-dialog": [];
}>();

function eventTargetValue(event: Event): string {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
    ? event.target.value
    : "";
}

function eventTargetChecked(event: Event): boolean {
  return event.target instanceof HTMLInputElement ? event.target.checked : false;
}

function setCreateDraft() {
  if (props.skills.prepareCustomSkillDraft()) {
    emit("open-create-dialog");
  }
}

function setReviewTarget(skill: Skill) {
  props.skills.prepareSkillReview(skill);
  emit("open-review-dialog");
}
</script>

<template>
  <h2>技能</h2>
  <p data-testid="vue-settings-skills-anchor">
    技能管理会使用现有 Gateway `/api/skills` 契约。
  </p>
  <p v-if="props.skills.query.isLoading.value" data-testid="vue-settings-skills-loading">
    正在加载技能...
  </p>
  <p
    v-else-if="props.skills.adminRequired.value"
    class="workspace-notice"
    data-testid="vue-settings-skills-admin-required"
  >
    管理智能体技能需要管理员权限。
  </p>
  <p
    v-else-if="props.skills.errorMessage.value"
    class="workspace-error"
    data-testid="vue-settings-skills-error"
  >
    {{ props.skills.errorMessage.value }}
  </p>
  <template v-else>
    <div class="settings-skills-actions">
      <NuxtLink
        class="workspace-button"
        data-testid="vue-settings-skills-create-link"
        :to="props.createChatPath"
      >
        创建技能
      </NuxtLink>
      <button
        class="workspace-button"
        data-testid="vue-settings-skills-reload"
        :disabled="props.skills.isMutationPending.value"
        type="button"
        @click="props.skills.reloadSkillCache"
      >
        重新加载技能
      </button>
    </div>
    <section class="settings-skill-create" data-testid="vue-settings-skills-create-panel">
      <h3>自定义技能草稿</h3>
      <p>
        自定义技能创建由技能创建对话和归档安装流程负责。你可以先在这里生成 SKILL.md 草稿，然后继续在对话中完善，或安装打包后的归档。
      </p>
      <div class="settings-skill-create__form">
        <input
          data-testid="vue-settings-skills-create-name"
          placeholder="research-brief"
          :value="props.skills.skillCreateName.value"
          @input="props.skills.setSkillCreateName(eventTargetValue($event))"
        >
        <input
          data-testid="vue-settings-skills-create-description"
          placeholder="创建简洁、source-backed 的研究简报"
          :value="props.skills.skillCreateDescription.value"
          @input="props.skills.setSkillCreateDescription(eventTargetValue($event))"
        >
        <button
          class="workspace-button"
          data-testid="vue-settings-skills-create-draft"
          type="button"
          @click="setCreateDraft"
        >
          生成草稿
        </button>
        <NuxtLink
          class="workspace-button workspace-button--primary"
          data-testid="vue-settings-skills-create-chat"
          :to="props.createChatPath"
        >
          继续对话
        </NuxtLink>
      </div>
      <AppDialog :open="props.dialog === 'skill-create'" title="自定义技能草稿" @close="emit('close-dialog')">
        <textarea
          v-if="props.skills.skillCreateDraft.value"
          data-testid="vue-settings-skills-create-draft-content"
          readonly
          :value="props.skills.skillCreateDraft.value"
        />
      </AppDialog>
    </section>
    <form
      class="settings-skills-install"
      data-testid="vue-settings-skills-install-form"
      @submit.prevent="props.skills.installSkillArchive"
    >
      <input
        data-testid="vue-settings-skills-install-thread"
        placeholder="对话 ID"
        :value="props.skills.skillInstallThreadId.value"
        @input="props.skills.setSkillInstallThreadId(eventTargetValue($event))"
      >
      <input
        data-testid="vue-settings-skills-install-path"
        placeholder="mnt/user-data/outputs/example.skill"
        :value="props.skills.skillInstallPath.value"
        @input="props.skills.setSkillInstallPath(eventTargetValue($event))"
      >
      <button
        class="workspace-button"
        data-testid="vue-settings-skills-install-submit"
        :disabled="props.skills.isMutationPending.value"
        type="submit"
      >
        安装归档
      </button>
    </form>
    <div class="settings-tabs" data-testid="vue-settings-skills-tabs">
      <button
        class="settings-tabs__item"
        :class="{ 'settings-tabs__item--active': props.skills.skillFilter.value === 'public' }"
        data-testid="vue-settings-skills-filter-public"
        type="button"
        @click="props.skills.setSkillFilter('public')"
      >
        公共
      </button>
      <button
        class="settings-tabs__item"
        :class="{ 'settings-tabs__item--active': props.skills.skillFilter.value === 'custom' }"
        data-testid="vue-settings-skills-filter-custom"
        type="button"
        @click="props.skills.setSkillFilter('custom')"
      >
        自定义
      </button>
    </div>
    <p
      v-if="!props.canManage"
      class="workspace-notice"
      data-testid="vue-settings-skills-readonly"
    >
      修改技能启用状态需要管理员权限。
    </p>
    <a-empty
      v-if="props.skills.filteredSkills.value.length === 0"
      description="此分类暂无智能体技能"
      data-testid="vue-settings-skills-empty"
    />
    <ul v-else class="settings-skills-list" data-testid="vue-settings-skills-list">
      <li v-for="skill in props.skills.filteredSkills.value" :key="skill.name" class="settings-skill">
        <div class="settings-skill__body">
          <strong>{{ skill.name }}</strong>
          <p>{{ skill.description }}</p>
          <small>{{ skill.category }} · {{ skill.license || "无许可证" }}</small>
        </div>
        <div class="settings-skill__actions">
          <button
            class="workspace-button"
            :data-testid="`vue-settings-skills-detail-${skill.name}`"
            type="button"
            @click="props.skills.showSkillDetail(skill.name)"
          >
            详情
          </button>
          <button
            class="workspace-button"
            :data-testid="`vue-settings-skills-review-${skill.name}`"
            type="button"
            @click="setReviewTarget(skill)"
          >
            审查
          </button>
          <button
            v-if="skill.editable"
            class="workspace-button"
            :data-testid="`vue-settings-skills-edit-${skill.name}`"
            :disabled="!props.canManage || props.skills.isMutationPending.value"
            type="button"
            @click="props.skills.loadCustomSkillForEdit(skill.name)"
          >
            编辑
          </button>
          <label class="settings-skill__toggle">
            <input
              :checked="skill.enabled"
              :data-testid="`vue-settings-skills-toggle-${skill.name}`"
              :disabled="!props.canManage || props.skills.isMutationPending.value"
              type="checkbox"
              @change="props.skills.toggleSkill(skill.name, eventTargetChecked($event))"
            >
            <span>{{ skill.enabled ? "已启用" : "已禁用" }}</span>
          </label>
        </div>
      </li>
    </ul>
    <dl
      v-if="props.skills.skillDetail.value"
      class="settings-skill-detail"
      data-testid="vue-settings-skills-detail-panel"
    >
      <dt>名称</dt>
      <dd>{{ props.skills.skillDetail.value.name }}</dd>
      <dt>分类</dt>
      <dd>{{ props.skills.skillDetail.value.category }}</dd>
      <dt>可编辑</dt>
      <dd>{{ props.skills.skillDetail.value.editable ? "是" : "否" }}</dd>
    </dl>
    <AppDialog :open="props.dialog === 'skill-review'" title="技能审查" @close="emit('close-dialog')">
    <section class="settings-skill-review" data-testid="vue-settings-skills-review-panel">
      <h3>技能审查</h3>
      <p>
        技能审查会通过只读的 `skill-reviewer` 技能和 `review_skill_package` 工具执行；在对话运行执行它之前，这里只是静态指令。
      </p>
      <label class="workspace-field">
        <span>审查目标</span>
        <input
          data-testid="vue-settings-skills-review-target"
          placeholder="skill://public/skill-reviewer"
          :value="props.skills.skillReviewTarget.value"
          @input="props.skills.setSkillReviewTarget(eventTargetValue($event))"
        >
      </label>
      <textarea
        data-testid="vue-settings-skills-review-command"
        readonly
        :value="props.skills.skillReviewCommand.value"
      />
    </section>
    </AppDialog>
    <form
      v-if="props.skills.skillCustomContent.value"
      class="settings-skill-editor"
      data-testid="vue-settings-skills-editor"
      @submit.prevent="props.skills.saveCustomSkillEdit"
    >
      <label class="workspace-field">
        <span>{{ props.skills.skillCustomContent.value.name }} / SKILL.md</span>
        <textarea
          data-testid="vue-settings-skills-editor-content"
          :value="props.skills.skillEditorContent.value"
          @input="props.skills.setSkillEditorContent(eventTargetValue($event))"
        />
      </label>
      <div class="settings-skills-actions">
        <button
          class="workspace-button workspace-button--primary"
          data-testid="vue-settings-skills-editor-save"
          :disabled="props.skills.isMutationPending.value"
          type="submit"
        >
          保存
        </button>
        <button
          class="workspace-button"
          data-testid="vue-settings-skills-history"
          :disabled="props.skills.isMutationPending.value"
          type="button"
          @click="props.skills.loadSelectedCustomSkillHistory"
        >
          历史
        </button>
        <button
          class="workspace-button"
          data-testid="vue-settings-skills-rollback"
          :disabled="props.skills.isMutationPending.value"
          type="button"
          @click="props.skills.rollbackSelectedCustomSkill"
        >
          回滚最新版本
        </button>
        <button
          class="workspace-button"
          data-testid="vue-settings-skills-delete"
          :disabled="props.skills.isMutationPending.value"
          type="button"
          @click="props.skills.deleteSelectedCustomSkill"
        >
          删除
        </button>
      </div>
    </form>
    <pre
      v-if="props.skills.skillHistoryText.value"
      class="settings-skill-history"
      data-testid="vue-settings-skills-history-panel"
    >{{ props.skills.skillHistoryText.value }}</pre>
    <p
      v-if="props.skills.skillFormError.value"
      class="workspace-error"
      data-testid="vue-settings-skills-form-error"
    >
      {{ props.skills.skillFormError.value }}
    </p>
    <p
      v-if="props.skills.skillActionMessage.value"
      class="settings-success"
      data-testid="vue-settings-skills-action-message"
    >
      {{ props.skills.skillActionMessage.value }}
    </p>
    <p
      v-if="props.skills.mutationErrorMessage.value"
      class="workspace-error"
      data-testid="vue-settings-skills-mutation-error"
    >
      {{ props.skills.mutationErrorMessage.value }}
    </p>
  </template>
</template>
