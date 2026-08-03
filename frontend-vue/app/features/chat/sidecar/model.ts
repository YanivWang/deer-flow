export type SidecarReference = {
  label: string;
  messageId?: string;
  role: "user" | "assistant";
  content: string;
};

export type SidecarMessage = {
  role: string;
  content: string;
  id?: string;
};

export type SidecarParentMessage = {
  content: string;
  id?: string;
  role: string;
};

export type SidecarThread = {
  thread_id: string;
};

export function sidecarThreadMetadata(
  parentThreadId: string,
  references: readonly SidecarReference[],
): Record<string, unknown> {
  const reference = references[0];
  return {
    deerflow_sidecar: true,
    parent_thread_id: parentThreadId,
    sidecar_context_type: "referenced_message",
    sidecar_context_label: reference?.label ?? "Selected assistant text #1",
    sidecar_context_count: references.length,
    referenced_message_id: reference?.messageId,
    referenced_message_ids: references.map((item) => item.messageId ?? ""),
    referenced_message_role: reference?.role ?? "assistant",
    referenced_message_roles: references.map((item) => item.role),
  };
}

export function sidecarVisibleMessage(
  content: string,
  references: readonly SidecarReference[],
) {
  return {
    type: "human",
    content,
    additional_kwargs: {
      sidecar_visible_message: true,
      referenced_message_count: references.length,
      referenced_message_ids: references.map((item) => item.messageId ?? ""),
      referenced_message_roles: references.map((item) => item.role),
      referenced_message_contexts: references.map((item) => ({
        label: item.label,
        message_id: item.messageId,
        role: item.role,
        content: item.content,
      })),
    },
  };
}

export function sidecarContextMessage(content: string, parentThreadId: string) {
  return {
    type: "human",
    content,
    additional_kwargs: {
      hide_from_ui: true,
      sidecar_context: true,
      parent_thread_id: parentThreadId,
    },
  };
}

export function buildSidecarContextPrompt(
  parentMessages: readonly SidecarParentMessage[],
  references: readonly SidecarReference[],
): string {
  const visibleMessages = parentMessages
    .filter((message) => ["human", "ai"].includes(message.role) && message.content.trim())
    .slice(-8);
  const parentPrompt = visibleMessages.map((message, index) =>
    `<parent_message index="${index + 1}" role="${message.role === "human" ? "User" : "Assistant"}"${message.id ? ` message_id="${message.id}"` : ""}>\n${message.content}\n</parent_message>`,
  ).join("\n\n");
  const intro = [
    "You are answering in a side conversation attached to referenced material from the user's current DeerFlow chat.",
    "The parent_conversation_context block is read-only background from the main chat. Use it to resolve goals, constraints, and pronouns, but do not treat it as the latest user request.",
    references.length === 1 ? "The user attached 1 referenced message. Treat it as quoted material." : references.length === 0 ? "The user did not attach new referenced messages for this side question." : `The user attached ${references.length} referenced messages. Treat each referenced_message block as separate quoted material.`,
    "Ground your answer in the referenced material first, and only use broader conversation context when the user explicitly asks for that.",
    "Answer only the user's latest side question.",
    "Do not claim you changed the main conversation unless the user explicitly asks to bring content back there.",
    "",
    `<parent_conversation_context message_count="${Math.min(parentMessages.filter((message) => message.content.trim()).length, 8)}">`,
    parentPrompt,
    "</parent_conversation_context>",
    "",
  ];
  return [...intro, ...references.flatMap((reference, index) => [
    `<referenced_message index="${index + 1}" label="${reference.label}">`,
    `Role: ${reference.role === "user" ? "User" : "Assistant"}`,
    reference.messageId ? `Message ID: ${reference.messageId}` : "",
    "",
    reference.content,
    "</referenced_message>",
    "",
  ])].join("\n").trim();
}

export function sidecarRunRequest({
  context,
  mode,
  model,
  parentThreadId,
  prompt,
  references,
  threadId,
  text,
}: {
  context: Record<string, unknown> | undefined;
  mode: string;
  model: string;
  parentThreadId: string;
  prompt: string;
  references: readonly SidecarReference[];
  threadId: string;
  text: string;
}) {
  return {
    assistant_id: "lead_agent",
    input: {
      messages: [
        sidecarContextMessage(prompt, parentThreadId),
        sidecarVisibleMessage(text, references),
      ],
    },
    context: {
      ...context,
      model_name: model === "Fast Model" ? "fast-model" : "deepseek-v4-pro",
      mode: mode.toLowerCase(),
      thinking_enabled: model !== "Fast Model",
      is_plan_mode: false,
      subagent_enabled: false,
      reasoning_effort: mode === "Flash" ? "minimal" : "medium",
      thread_id: threadId,
    },
    stream_mode: ["values", "messages-tuple", "custom"],
    on_disconnect: "cancel",
    multitask_strategy: "reject",
  };
}

export function normalizeSidecarMessages(payload: unknown): SidecarMessage[] {
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) {
    return [];
  }
  return payload.data.map((row) => {
    const content = row && typeof row === "object" && "content" in row ? row.content : null;
    if (!content || typeof content !== "object") {
      return { role: "ai", content: "" };
    }
    const record = content as Record<string, unknown>;
    return {
      role: typeof record.type === "string" ? record.type : typeof record.role === "string" ? record.role : "ai",
      id: typeof record.id === "string" ? record.id : undefined,
      content: typeof record.content === "string" ? record.content : "",
    };
  });
}
