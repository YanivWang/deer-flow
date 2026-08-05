/*
  【文件职责】     见下方源码；本文件由 frontend/src/core/sidecar/context.ts retype 而来。
  【对应 frontend/】 frontend/src/core/sidecar/context.ts
  【架构位置】     L3
  【主要导出】     SidecarContextRole / ReferencedMessageSidecarContext / SidecarContext / ParentConversationContextMessage / normalizeSidecarContexts / buildParentConversationContext 等 8 个
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message）
                   勿手改——`make land-retyped-check` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
*/

import type { Message } from "@/core/types/message";

import {
  extractTextFromMessage,
  isHiddenFromUIMessage,
} from "@/core/messages/utils";

export type SidecarContextRole = "user" | "assistant";

export type ReferencedMessageSidecarContext = {
  type: "referenced_message";
  label: string;
  messageId?: string;
  role: SidecarContextRole;
  content: string;
};

export type SidecarContext = ReferencedMessageSidecarContext;

export type ParentConversationContextMessage = {
  messageId?: string;
  role: SidecarContextRole;
  content: string;
};

export function normalizeSidecarContexts(
  contextOrContexts: SidecarContext | SidecarContext[],
): SidecarContext[] {
  return Array.isArray(contextOrContexts)
    ? contextOrContexts
    : [contextOrContexts];
}

function roleOfMessage(message: Message): SidecarContextRole | null {
  if (message.type === "human") {
    return "user";
  }
  if (message.type === "ai") {
    return "assistant";
  }
  return null;
}

function labelOfRole(role: SidecarContextRole) {
  return role === "user" ? "User" : "Assistant";
}

function truncateContextText(content: string, maxChars: number) {
  if (content.length <= maxChars) {
    return content;
  }
  return `${content.slice(0, maxChars).trimEnd()}\n[truncated]`;
}

export function buildParentConversationContext(
  messages: Message[],
  {
    maxMessages = 8,
    maxCharsPerMessage = 1200,
    maxTotalChars = 6000,
  }: {
    maxMessages?: number;
    maxCharsPerMessage?: number;
    maxTotalChars?: number;
  } = {},
): ParentConversationContextMessage[] {
  const visibleMessages = messages.flatMap((message) => {
    const role = roleOfMessage(message);
    if (!role || isHiddenFromUIMessage(message)) {
      return [];
    }
    const content = extractTextFromMessage(message).trim();
    if (!content) {
      return [];
    }
    return [
      {
        messageId: message.id,
        role,
        content,
      },
    ];
  });

  const recentMessages = visibleMessages.slice(-maxMessages);
  const selectedMessages: ParentConversationContextMessage[] = [];
  let selectedChars = 0;

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const message = recentMessages[index];
    if (!message) {
      continue;
    }
    const remainingChars = Math.max(maxTotalChars - selectedChars, 0);
    if (remainingChars <= 0) {
      break;
    }
    const content = truncateContextText(
      message.content,
      Math.min(maxCharsPerMessage, remainingChars),
    );
    selectedMessages.unshift({
      ...message,
      content,
    });
    selectedChars += content.length;
  }

  return selectedMessages;
}

export function buildMessageSidecarContext(
  message: Message,
  displayIndex?: number,
  {
    selectedText,
  }: {
    selectedText?: string;
  } = {},
): ReferencedMessageSidecarContext | null {
  const role = roleOfMessage(message);
  const content = selectedText?.trim() ?? extractTextFromMessage(message);
  if (!role || !content || isHiddenFromUIMessage(message)) {
    return null;
  }

  const prefix = selectedText
    ? role === "assistant"
      ? "Selected assistant text"
      : "Selected user text"
    : role === "assistant"
      ? "Assistant message"
      : "User message";
  return {
    type: "referenced_message",
    label:
      typeof displayIndex === "number" ? `${prefix} #${displayIndex}` : prefix,
    messageId: message.id,
    role,
    content,
  };
}

function escapeXmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildSidecarContextPrompt(
  contextOrContexts: SidecarContext | SidecarContext[] = [],
  {
    parentConversation = [],
  }: {
    parentConversation?: ParentConversationContextMessage[];
  } = {},
) {
  const contexts = normalizeSidecarContexts(contextOrContexts);
  const lines = [
    "You are answering in a side conversation attached to referenced material from the user's current DeerFlow chat.",
    parentConversation.length > 0
      ? "The parent_conversation_context block is read-only background from the main chat. Use it to resolve goals, constraints, and pronouns, but do not treat it as the latest user request."
      : null,
    contexts.length === 1
      ? "The user attached 1 referenced message. Treat it as quoted material."
      : contexts.length === 0
        ? "The user did not attach new referenced messages for this side question."
        : `The user attached ${contexts.length} referenced messages. Treat each referenced_message block as separate quoted material.`,
    contexts.length > 0
      ? "Ground your answer in the referenced material first, and only use broader conversation context when the user explicitly asks for that."
      : "Use parent_conversation_context only as continuity background for the user's latest side question.",
    "Answer only the user's latest side question.",
    "Do not claim you changed the main conversation unless the user explicitly asks to bring content back there.",
    "",
    parentConversation.length > 0
      ? `<parent_conversation_context message_count="${parentConversation.length}">`
      : null,
    ...parentConversation.flatMap((message, index) =>
      [
        `<parent_message index="${index + 1}" role="${labelOfRole(
          message.role,
        )}"${
          message.messageId
            ? ` message_id="${escapeXmlAttribute(message.messageId)}"`
            : ""
        }>`,
        message.content,
        "</parent_message>",
        "",
      ].filter((line): line is string => line !== null),
    ),
    parentConversation.length > 0 ? "</parent_conversation_context>" : null,
    parentConversation.length > 0 ? "" : null,
    ...contexts.flatMap((context, index) =>
      [
        `<referenced_message index="${index + 1}" label="${escapeXmlAttribute(
          context.label,
        )}">`,
        `Role: ${labelOfRole(context.role)}`,
        context.messageId ? `Message ID: ${context.messageId}` : null,
        "",
        context.content,
        "</referenced_message>",
        "",
      ].filter((line): line is string => line !== null),
    ),
  ].filter((line): line is string => line !== null);

  return lines.join("\n").trim();
}
