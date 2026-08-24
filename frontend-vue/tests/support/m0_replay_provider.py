"""
【文件职责】     为 M0 run 协议测试给仓库 ReplayChatModel 注入一次可控空闲窗口。
【架构位置】     测试
【主要导出】     M0ReplayChatModel
【依赖关系】     继承 backend/tests/replay_provider.py 的真实录制回放模型
【边界与注意】   只改变首个模型调用的时序，不改变输出、Gateway 路由或协议实现。
"""

from __future__ import annotations

import os
import time

from langchain_core.callbacks import CallbackManagerForLLMRun
from langchain_core.messages import AIMessage, BaseMessage
from pydantic import PrivateAttr
from replay_provider import ReplayChatModel


class M0ReplayChatModel(ReplayChatModel):
    """Pause once so the real StreamBridge emits heartbeat and permits cancel."""

    _m0_delay_used: bool = PrivateAttr(default=False)

    def _match(
        self,
        messages: list[BaseMessage],
        run_manager: CallbackManagerForLLMRun | None = None,
    ) -> AIMessage:
        if not self._m0_delay_used:
            self._m0_delay_used = True
            time.sleep(float(os.environ.get("DEERFLOW_M0_REPLAY_DELAY_SECONDS", "0")))
        return super()._match(messages, run_manager)


__all__ = ["M0ReplayChatModel"]
