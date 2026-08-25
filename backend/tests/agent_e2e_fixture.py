"""Controlled model boundary for the Vue real-Gateway Agent e2e.

Auth, CSRF, FastAPI routers, LangGraph, setup_agent, persistence and model
capability discovery remain production code. Only the external LLM is replaced
with a deterministic in-process chat model. The runner installs this module and
its config-toggle router only under ``DEERFLOW_ENABLE_AGENT_TEST_MODEL=1``.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.runnables import Runnable
from pydantic import BaseModel

router = APIRouter(prefix="/api/test-only/agents", tags=["test-only"])

AGENT_E2E_MODEL_BLOCK = """\
  - name: basic-model
    display_name: Basic Model
    use: replay_provider:ReplayChatModel
    model: basic-e2e
    supports_thinking: false
    supports_reasoning_effort: false
  - name: reasoning-model
    display_name: Reasoning Model
    use: replay_provider:ReplayChatModel
    model: reasoning-e2e
    supports_thinking: true
    supports_reasoning_effort: true"""


def _text(message: BaseMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    return "".join(str(part.get("text", "")) for part in content if isinstance(part, dict))


class _AgentLifecycleModel(FakeMessagesListChatModel):
    """Deterministically discusses first, then calls the real setup_agent."""

    def bind_tools(  # type: ignore[override]
        self,
        tools: Any,
        *,
        tool_choice: Any = None,
        **kwargs: Any,
    ) -> Runnable:
        return self

    def _generate(  # type: ignore[override]
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        if any(isinstance(message, ToolMessage) for message in messages):
            response = AIMessage(content="The first version is ready.")
        else:
            human = next(
                (message for message in reversed(messages) if isinstance(message, HumanMessage)),
                None,
            )
            hidden = bool(human and human.additional_kwargs.get("hide_from_ui") is True)
            save_requested = bool(human and "save this custom agent now" in _text(human).lower())
            if hidden and save_requested:
                response = AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "setup_agent",
                            "args": {
                                "soul": "# Reviewer\n\nReview code carefully and explain actionable findings.",
                                "description": "Reviews code and explains actionable findings",
                                "skills": ["review", "review"],
                            },
                            "id": "call_wp09_setup_agent",
                            "type": "tool_call",
                        }
                    ],
                )
            else:
                response = AIMessage(
                    content="Let's design the agent's purpose and review style before saving.",
                )
        return ChatResult(generations=[ChatGeneration(message=response)])


def install_agent_model_fixture() -> None:
    """Replace only lead_agent's imported model factory before app startup."""
    import deerflow.agents.lead_agent.agent as lead_agent_module

    def create_agent_e2e_model(**_kwargs: Any) -> _AgentLifecycleModel:
        return _AgentLifecycleModel(responses=[AIMessage(content="unused")])

    lead_agent_module.create_chat_model = create_agent_e2e_model


class FeatureBody(BaseModel):
    enabled: bool


@router.post("/set-enabled")
async def set_agents_api_enabled(body: FeatureBody, request: Request) -> dict[str, bool]:
    if getattr(request.state, "user", None) is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    raw_path = os.environ.get("DEER_FLOW_CONFIG_PATH")
    if not raw_path:
        raise HTTPException(status_code=503, detail="Hermetic config path is unavailable")
    path = Path(raw_path)
    text = path.read_text(encoding="utf-8")
    updated, count = re.subn(
        r"(agents_api:\s*\n\s*enabled:\s*)(true|false)",
        rf"\g<1>{str(body.enabled).lower()}",
        text,
        count=1,
    )
    if count != 1:
        raise HTTPException(status_code=500, detail="agents_api.enabled was not found")
    path.write_text(updated, encoding="utf-8")
    os.utime(path, None)
    return {"enabled": body.enabled}
