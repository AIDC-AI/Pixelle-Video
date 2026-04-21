from __future__ import annotations

import os

from web.i18n import get_language

READ_ONLY_ENV = "PIXELLE_STREAMLIT_READ_ONLY"


def is_streamlit_read_only() -> bool:
    return os.getenv(READ_ONLY_ENV, "0").strip().lower() in {"1", "true", "yes", "on"}


def should_disable_action(base_disabled: bool = False) -> bool:
    return base_disabled or is_streamlit_read_only()


def migration_banner_copy() -> tuple[str, str, str]:
    if is_streamlit_read_only():
        if get_language() == "zh_CN":
            return (
                "#### 本端已切换为只读模式，创作请前往新版",
                "历史记录仍可查看；新的创作与批量任务请在新版工作台完成。",
                "前往新版工作台",
            )
        return (
            "#### This workspace is now read-only. Create in the new workbench.",
            "History stays available here, but all new creation and batch work has moved to the new app.",
            "Open New Workbench",
        )

    if get_language() == "zh_CN":
        return (
            "#### 🆕 新版工作台已上线，点击切换",
            "新工作台支持项目化管理、历史视频库与批量任务队列。",
            "切换到新版",
        )
    return (
        "#### 🆕 The new workbench is live.",
        "Use the new experience for project-based creation, reusable libraries, and batch operations.",
        "Switch to New Workbench",
    )


def read_only_notice() -> str:
    if get_language() == "zh_CN":
        return "当前 Streamlit 端为只读模式，新的创作请前往新版工作台。"
    return "This Streamlit surface is read-only. Use the new workbench for new creation."
