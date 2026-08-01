import type { Page, Route } from "@playwright/test";

export const MOCK_THREAD_ID = "thread-e2e";
export const MOCK_RUN_ID = "run-e2e";
export const MOCK_AI_REPLY = "Hello from Vue E2E!";

type MockThread = {
  thread_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  values: {
    title: string;
    messages?: Array<Record<string, unknown>>;
  };
};

export async function authenticateVuePage(page: Page, baseURL: string | undefined): Promise<void> {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required for cookie-backed auth setup.");
  }
  await page.context().addCookies([
    {
      name: "access_token",
      url: baseURL,
      value: "mock-access-token",
    },
    {
      name: "csrf_token",
      url: baseURL,
      value: "mock-csrf-token",
    },
  ]);
}

export function mockVueChatApi(page: Page): void {
  const thread = createThread();
  const messages: Array<Record<string, unknown>> = [];

  void page.route("**/api/threads/search", (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }
    return route.fulfill({
      body: JSON.stringify([thread]),
      contentType: "application/json",
      status: 200,
    });
  });

  void page.route("**/api/threads/*/messages/page**", (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return route.fulfill({
      body: JSON.stringify({
        data: [],
        has_more: false,
        next_before_seq: null,
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  void page.route("**/api/threads/*/state", (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return route.fulfill({
      body: JSON.stringify({ values: { messages } }),
      contentType: "application/json",
      status: 200,
    });
  });

  void page.route("**/api/threads/*/runs/stream", (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }
    const prompt = readSubmittedPrompt(route);
    messages.splice(
      0,
      messages.length,
      { content: prompt, id: "human-e2e", type: "human" },
      { content: MOCK_AI_REPLY, id: "ai-e2e", type: "ai" },
    );
    thread.values.messages = messages;
    thread.updated_at = new Date().toISOString();
    return fulfillRunStream(route, messages);
  });
}

function createThread(): MockThread {
  const now = new Date().toISOString();
  return {
    created_at: now,
    metadata: {},
    status: "idle",
    thread_id: MOCK_THREAD_ID,
    updated_at: now,
    values: { title: "Mock Chat" },
  };
}

function fulfillRunStream(route: Route, messages: Array<Record<string, unknown>>) {
  const events = [
    {
      data: { run_id: MOCK_RUN_ID, thread_id: MOCK_THREAD_ID },
      event: "metadata",
      id: "1",
    },
    {
      data: { messages },
      event: "values",
      id: "2",
    },
    {
      data: {},
      event: "end",
      id: "3",
    },
  ];
  return route.fulfill({
    body: events
      .map((event) =>
        [`event: ${event.event}`, `id: ${event.id}`, `data: ${JSON.stringify(event.data)}`, ""].join(
          "\n",
        ),
      )
      .join("\n"),
    contentType: "text/event-stream",
    headers: {
      "Cache-Control": "no-cache",
      "Content-Location": `/api/threads/${MOCK_THREAD_ID}/runs/${MOCK_RUN_ID}`,
      "X-Accel-Buffering": "no",
    },
    status: 200,
  });
}

function readSubmittedPrompt(route: Route): string {
  const body = route.request().postDataJSON() as unknown;
  if (!isRecord(body) || !isRecord(body.input) || !Array.isArray(body.input.messages)) {
    return "";
  }
  const lastMessage = body.input.messages.at(-1);
  if (!isRecord(lastMessage)) {
    return "";
  }
  return readTextContent(lastMessage.content);
}

function readTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(readContentPart).join("");
  }
  return "";
}

function readContentPart(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }
  if (isRecord(part) && typeof part.text === "string") {
    return part.text;
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
