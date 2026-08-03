import { getCurrentInstance, nextTick, onBeforeUnmount, ref, type Ref } from "vue";

import type { StartThreadMessageOptions } from "../../../entities/thread/stream-store";
import {
  getThreadUploadLimits,
  uploadThreadFiles,
  type ThreadUploadLimits,
} from "../../../core/api/thread/client";
import { polishInput } from "../../../core/api/input-polish/client";
import { createId } from "../../../core/utils/id";
import { composeChatMessage, goalObjectiveFromMessage } from "./model";

export type ComposerAttachmentUpload = {
  filename: string;
  size: number;
  path: string;
  virtual_path: string;
  status: string;
};

export type ComposerAttachment = {
  file: File;
  uploaded?: ComposerAttachmentUpload;
};

export type ComposerUploadLimits = ThreadUploadLimits;

type ComposerSkillSuggestion = { name: string };

type ComposerActionOptions = {
  agentName: Readonly<Ref<string | null>>;
  draft: Ref<string>;
  editingMessageId: Ref<string | null>;
  isBusy: Readonly<Ref<boolean>>;
  matchingSkills: Readonly<Ref<ComposerSkillSuggestion[]>>;
  selectedSlashSkill: Ref<string | null>;
  threadId: Readonly<Ref<string>>;
  threadRunContext: Readonly<Ref<Record<string, unknown> | undefined>>;
  historyPrompts: Readonly<Ref<string[]>>;
  createThread: (input: { agentName?: string | null; threadId?: string }) => Promise<{ thread_id: string }>;
  replaceThreadRoute: (threadId: string) => Promise<void>;
  saveGoal: (objective: string, targetThreadId?: string) => Promise<unknown>;
  sendMessage: (options: StartThreadMessageOptions) => Promise<void>;
  refetchHistory: () => Promise<unknown>;
  refetchThreads: () => Promise<unknown>;
  clearDraft: () => void;
  onGoalCommand: (objective: string, targetThreadId: string) => void;
};

const DEFAULT_UPLOAD_LIMITS: ComposerUploadLimits = {
  max_files: 10,
  max_file_size: 50 * 1024 * 1024,
  max_total_size: 100 * 1024 * 1024,
};

export function useComposerActions(options: ComposerActionOptions) {
  const attachmentTooltipVisible = ref(false);
  const uploadLimits = ref<ComposerUploadLimits>({ ...DEFAULT_UPLOAD_LIMITS });
  const attachments = ref<ComposerAttachment[]>([]);
  const attachmentErrorMessage = ref("");
  const isUploadingAttachments = ref(false);
  const polishingInput = ref(false);
  const polishUndo = ref<{ originalText: string; rewrittenText: string } | null>(null);
  const promptHistoryIndex = ref<number | null>(null);
  const promptHistoryDraft = ref("");
  const skillSuggestionIndex = ref(0);
  let polishController: AbortController | null = null;

  function formatUploadSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Number((bytes / 1024).toFixed(1))} KiB`;
    if (bytes < 1024 * 1024 * 1024) return `${Number((bytes / (1024 * 1024)).toFixed(1))} MiB`;
    return `${Number((bytes / (1024 * 1024 * 1024)).toFixed(1))} GiB`;
  }

  async function loadUploadLimits() {
    try {
      uploadLimits.value = await getThreadUploadLimits(options.threadId.value);
    } catch {
      // The composer remains usable with conservative defaults.
    }
  }

  function showAttachmentTooltip() {
    attachmentTooltipVisible.value = true;
    void loadUploadLimits();
  }

  function acceptAttachments(event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const incoming = Array.from(input.files ?? []);
    let count = attachments.value.length;
    let total = attachments.value.reduce((sum, item) => sum + item.file.size, 0);
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of incoming) {
      if (
        file.size > uploadLimits.value.max_file_size
        || count >= uploadLimits.value.max_files
        || total + file.size > uploadLimits.value.max_total_size
      ) {
        rejected.push(file.name);
        continue;
      }
      accepted.push(file);
      count += 1;
      total += file.size;
    }
    attachments.value = [...attachments.value, ...accepted.map((file) => ({ file }))];
    attachmentErrorMessage.value = rejected.length > 0
      ? `${rejected.join(", ")} 超出附件限制（${formatUploadSize(uploadLimits.value.max_total_size)}）。`
      : "";
    input.value = "";
  }

  function focusSuggestionPlaceholder() {
    void nextTick(() => {
      const textarea = document.querySelector("textarea[name='message']");
      if (!(textarea instanceof HTMLTextAreaElement)) return;
      const match = /\[([^\]]+)\]/.exec(textarea.value);
      if (!match || match.index === undefined) return;
      textarea.focus();
      textarea.setSelectionRange(match.index, match.index + match[0].length);
    });
  }

  async function polishDraft() {
    if (polishingInput.value) return;
    if (polishUndo.value && options.draft.value === polishUndo.value.rewrittenText) {
      options.draft.value = polishUndo.value.originalText;
      polishUndo.value = null;
      return;
    }
    if (!options.draft.value.trim()) return;
    const controller = new AbortController();
    polishController = controller;
    polishingInput.value = true;
    const originalText = options.draft.value;
    try {
      const result = await polishInput(originalText, options.threadId.value, controller.signal);
      if (result.changed && result.rewritten_text) {
        options.draft.value = result.rewritten_text;
        polishUndo.value = { originalText, rewrittenText: result.rewritten_text };
      }
    } catch {
      // Aborts intentionally leave the original draft untouched.
    } finally {
      if (polishController === controller) polishController = null;
      polishingInput.value = false;
    }
  }

  function cancelPolishDraft() {
    polishController?.abort();
    polishController = null;
    polishingInput.value = false;
  }

  async function submitMessage() {
    if (options.isBusy.value || polishingInput.value || isUploadingAttachments.value) return;

    const text = options.draft.value.trim();
    if (!text) {
      options.draft.value = "";
      return;
    }

    const goalObjective = goalObjectiveFromMessage(text);
    if (/\[[^\]]+\]/.test(text)) {
      focusSuggestionPlaceholder();
      return;
    }
    const messageText = composeChatMessage(text, options.selectedSlashSkill.value);
    options.draft.value = "";
    options.selectedSlashSkill.value = null;
    options.clearDraft();
    let activeThreadId = options.threadId.value;
    const isNewThread = activeThreadId === "new";
    try {
      if (isNewThread) {
        const created = await options.createThread({
          agentName: options.agentName.value,
          threadId: createId(),
        });
        activeThreadId = created.thread_id;
      }
      if (goalObjective) {
        options.onGoalCommand(goalObjective, activeThreadId);
        await options.saveGoal(goalObjective, activeThreadId);
      }
      if (goalObjective && isNewThread) {
        await options.replaceThreadRoute(activeThreadId);
        await nextTick();
      }
      const context = options.threadRunContext.value;
      let uploadedFiles = attachments.value
        .map((item) => item.uploaded)
        .filter((file): file is ComposerAttachmentUpload => Boolean(file));
      if (attachments.value.some((item) => !item.uploaded)) {
        isUploadingAttachments.value = true;
        const result = await uploadThreadFiles(
          activeThreadId,
          attachments.value.map((item) => item.file),
        );
        uploadedFiles = (result.files ?? []).map((file) => ({
          filename: file.filename,
          size: file.size,
          path: file.virtual_path || file.path,
          virtual_path: file.virtual_path || file.path,
          status: "uploaded",
        }));
      }
      if (isNewThread && !goalObjective) await options.replaceThreadRoute(activeThreadId);
      const filesForSubmit = uploadedFiles.map(({ filename, size, path, status }) => ({
        filename,
        size,
        path,
        status,
      }));
      await options.sendMessage({
        ...(context ? { context } : {}),
        ...(filesForSubmit.length > 0 ? { additionalKwargs: { files: filesForSubmit } } : {}),
        text: messageText,
        threadId: activeThreadId,
      });
      attachments.value = [];
      polishUndo.value = null;
      await options.refetchHistory();
      await options.refetchThreads();
      if (goalObjective) options.onGoalCommand(goalObjective, activeThreadId);
    } catch {
      options.draft.value = text;
    } finally {
      isUploadingAttachments.value = false;
    }
  }

  function selectSlashSkill(skillName: string) {
    options.selectedSlashSkill.value = skillName;
    options.draft.value = "";
    options.editingMessageId.value = null;
  }

  function handleComposerKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (options.matchingSkills.value.length > 0) {
        event.preventDefault();
        skillSuggestionIndex.value = (
          skillSuggestionIndex.value + (event.key === "ArrowDown" ? 1 : -1) + options.matchingSkills.value.length
        ) % options.matchingSkills.value.length;
        return;
      }
      const prompts = options.historyPrompts.value;
      if (prompts.length === 0 || (promptHistoryIndex.value === null && options.draft.value.trim())) return;
      event.preventDefault();
      if (event.key === "ArrowUp") {
        if (promptHistoryIndex.value === null) promptHistoryDraft.value = options.draft.value;
        promptHistoryIndex.value = Math.min((promptHistoryIndex.value ?? 0) + 1, prompts.length);
      } else if (promptHistoryIndex.value !== null) {
        if (promptHistoryIndex.value <= 1) {
          promptHistoryIndex.value = null;
          options.draft.value = promptHistoryDraft.value;
          return;
        }
        promptHistoryIndex.value -= 1;
      }
      options.draft.value = promptHistoryIndex.value === null
        ? promptHistoryDraft.value
        : prompts[prompts.length - promptHistoryIndex.value] ?? "";
      return;
    }
    if (event.key !== "Enter" || event.shiftKey) return;
    const firstMatch = options.matchingSkills.value[skillSuggestionIndex.value] ?? options.matchingSkills.value[0];
    if (firstMatch && options.draft.value.trim().startsWith("/")) {
      event.preventDefault();
      selectSlashSkill(firstMatch.name);
      return;
    }
    event.preventDefault();
    void submitMessage();
  }

  function handleComposerEditableInput(event: Event) {
    options.draft.value = event.currentTarget instanceof HTMLElement ? event.currentTarget.innerText : "";
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(cancelPolishDraft);
  }

  return {
    acceptAttachments,
    attachmentErrorMessage,
    attachmentTooltipVisible,
    attachments,
    cancelPolishDraft,
    formatUploadSize,
    handleComposerEditableInput,
    handleComposerKeydown,
    isUploadingAttachments,
    loadUploadLimits,
    polishDraft,
    polishUndo,
    polishingInput,
    selectSlashSkill,
    showAttachmentTooltip,
    skillSuggestionIndex,
    submitMessage,
    uploadLimits,
  };
}
