# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
Global light, modern theme for Pixelle-Video Web UI.

Single entrypoint: inject_theme() — call once per page after st.set_page_config.
Light palette: soft off-white background, indigo/violet brand accents, subtle
gradient highlights, clean glass cards, gentle shadows. Tuned for readability
and a professional, polished look.
"""

import streamlit as st


_THEME_CSS = """
<style>
/* ===== Design tokens =============================================== */
:root {
    --pv-bg-1: #f7f8fc;          /* page bg base */
    --pv-bg-2: #eef2fb;          /* page bg accent */
    --pv-surface: #ffffff;       /* card / panel */
    --pv-surface-2: #f4f6fb;     /* nested surfaces */
    --pv-border: #e3e8f2;        /* subtle borders */
    --pv-border-strong: #c8d2e6;
    --pv-text: #1d2433;          /* primary text */
    --pv-text-soft: #4a5468;     /* secondary text */
    --pv-text-mute: #7c8699;     /* tertiary text */
    --pv-brand: #4f46e5;         /* indigo */
    --pv-brand-2: #7c3aed;       /* violet */
    --pv-brand-soft: #eef0ff;
    --pv-accent: #06b6d4;        /* cyan accent (sparingly) */
    --pv-success: #10b981;
    --pv-warning: #f59e0b;
    --pv-danger: #ef4444;
    --pv-shadow-sm: 0 1px 2px rgba(20, 28, 56, 0.04),
                    0 1px 3px rgba(20, 28, 56, 0.06);
    --pv-shadow-md: 0 4px 12px rgba(20, 28, 56, 0.06),
                    0 2px 4px rgba(20, 28, 56, 0.04);
    --pv-shadow-lg: 0 12px 32px rgba(20, 28, 56, 0.10),
                    0 4px 12px rgba(20, 28, 56, 0.06);
}

/* ===== Font ======================================================= */
/* Fonts are preloaded into parent <head> once; @import kept here for
   the rare case the parent injection didn't run yet. */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Orbitron:wght@600;700;800;900&display=swap');

html, body, [class*="css"], .stApp, .main, section[data-testid="stMain"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont,
                 "PingFang SC", "Microsoft YaHei", sans-serif !important;
    -webkit-font-smoothing: antialiased;
    color: var(--pv-text) !important;
}

/* ===== App background — soft light gradient ======================= */
.stApp {
    background:
        radial-gradient(circle at 12% 0%, rgba(124, 58, 237, 0.08) 0%, transparent 45%),
        radial-gradient(circle at 88% 100%, rgba(6, 182, 212, 0.07) 0%, transparent 45%),
        linear-gradient(180deg, #f7f8fc 0%, #eef2fb 60%, #f7f8fc 100%) !important;
    color: var(--pv-text) !important;
    position: relative;
}
.stApp::before {
    content: "";
    position: fixed;
    inset: 0;
    background-image:
        linear-gradient(rgba(79, 70, 229, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(79, 70, 229, 0.035) 1px, transparent 1px);
    background-size: 56px 56px;
    pointer-events: none;
    z-index: 0;
    mask-image: radial-gradient(ellipse at center, black 25%, transparent 78%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 25%, transparent 78%);
}
.stApp > * { position: relative; z-index: 1; }

/* Hide Streamlit native chrome */
header[data-testid="stHeader"],
[data-testid="stToolbar"],
[data-testid="stDecoration"] {
    display: none !important;
    height: 0 !important;
    visibility: hidden !important;
}
footer { visibility: hidden !important; }
#MainMenu { visibility: hidden !important; }
.stDeployButton { display: none !important; }

/* Push main block down so sticky topbar (60px) doesn't overlap content.
   Left-align the container instead of Streamlit's default centering, so
   the content sits flush with the sidebar and doesn't feel empty on the
   left at wide viewports. Top gap is kept tight (just clears topbar). */
section[data-testid="stMain"] > div.block-container,
.main .block-container {
    padding-top: 1rem !important;
    padding-bottom: 3rem !important;
    padding-left: 2.4rem !important;
    padding-right: 2.4rem !important;
    max-width: 1480px !important;
    margin-left: 0 !important;
    margin-right: auto !important;
}

/* ===== Sticky top bar ============================================ */
.pv-topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    z-index: 999999;
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    background: rgba(255, 255, 255, 0.82);
    border-bottom: 1px solid var(--pv-border);
    box-shadow: 0 1px 3px rgba(20, 28, 56, 0.04),
                0 4px 16px rgba(20, 28, 56, 0.04);
    display: flex;
    align-items: center;
    padding: 0 28px;
}
.pv-topbar .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 700;
    color: var(--pv-text);
    font-size: 1.02rem;
}
.pv-topbar .logo {
    width: 38px;
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    filter:
        drop-shadow(0 3px 6px rgba(30, 27, 75, 0.30))
        drop-shadow(0 2px 10px rgba(79, 70, 229, 0.32))
        drop-shadow(0 0 14px rgba(6, 182, 212, 0.20));
    transition: transform .35s cubic-bezier(.2,.7,.3,1.2),
                filter .35s ease;
    transform: translateZ(0);
}
.pv-topbar .logo svg {
    width: 100%;
    height: 100%;
    display: block;
}
.pv-topbar .logo:hover {
    transform: rotate(-6deg) scale(1.08) translateY(-1px);
    filter:
        drop-shadow(0 6px 10px rgba(30, 27, 75, 0.38))
        drop-shadow(0 4px 14px rgba(124, 58, 237, 0.45))
        drop-shadow(0 0 18px rgba(6, 182, 212, 0.32));
}
.pv-topbar .brand-name {
    font-family: 'Orbitron', 'Inter', sans-serif !important;
    font-weight: 900;
    font-size: 1.18rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    background: linear-gradient(135deg,
        #67e8f9 0%,
        #4f46e5 35%,
        #7c3aed 70%,
        #a78bfa 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow:
        0 0 12px rgba(79, 70, 229, 0.28),
        0 0 24px rgba(6, 182, 212, 0.16);
    position: relative;
    padding-right: 2px;
}
.pv-topbar .brand-name::after {
    content: "";
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-left: 6px;
    border-radius: 50%;
    background: #22d3ee;
    box-shadow: 0 0 8px rgba(34, 211, 238, 0.85);
    transform: translateY(-1px);
    animation: pv-brand-pulse 2s ease-in-out infinite;
}
@keyframes pv-brand-pulse {
    0%, 100% { opacity: 1; transform: translateY(-1px) scale(1); }
    50%      { opacity: 0.55; transform: translateY(-1px) scale(0.78); }
}
.pv-topbar .brand-sub {
    font-family: 'JetBrains Mono', 'SF Mono', monospace !important;
    color: var(--pv-text-soft);
    font-weight: 500;
    font-size: 0.78rem;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 6px;
    background: linear-gradient(180deg,
        rgba(79, 70, 229, 0.06) 0%,
        rgba(6, 182, 212, 0.04) 100%);
    border: 1px solid rgba(79, 70, 229, 0.14);
    border-left: 2px solid var(--pv-accent);
    backdrop-filter: blur(6px);
}
.pv-topbar .tag {
    margin-left: 16px;
    font-size: 0.70rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--pv-brand);
    text-transform: uppercase;
    background: var(--pv-brand-soft);
    border: 1px solid rgba(79, 70, 229, 0.18);
    padding: 4px 10px;
    border-radius: 999px;
    font-family: 'JetBrains Mono', monospace;
}
.pv-topbar .spacer { flex: 1; }
.pv-topbar .meta {
    color: var(--pv-text-soft);
    font-size: 0.82rem;
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
    display: inline-flex;
    align-items: center;
}
.pv-topbar .pulse {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--pv-success); display: inline-block;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
    margin-right: 8px;
    animation: pv-pulse 1.8s ease-in-out infinite;
}
@keyframes pv-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.6; transform: scale(0.85); }
}

/* ===== Sidebar — light rail ====================================== */
section[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #ffffff 0%, #fafbff 100%) !important;
    border-right: 1px solid var(--pv-border) !important;
    box-shadow: 1px 0 0 rgba(20, 28, 56, 0.02);
    width: 268px !important;
    min-width: 268px !important;
    max-width: 268px !important;
    transform: none !important;
    visibility: visible !important;
}
section[data-testid="stSidebar"] > div:first-child {
    padding-top: 1rem;
    width: 268px !important;
    background: transparent !important;
}
button[data-testid="stSidebarCollapseButton"],
button[data-testid="baseButton-headerNoPadding"],
[data-testid="collapsedControl"],
[data-testid="stSidebarCollapsedControl"],
[data-testid="stSidebarHeader"] button {
    display: none !important;
}
[data-testid="stSidebarNav"] {
    max-height: none !important;
    overflow: visible !important;
    padding-top: 0.4rem !important;
    background: transparent !important;
}
[data-testid="stSidebarNav"] ul {
    max-height: none !important;
    overflow: visible !important;
    list-style: none !important;
}
/* Section dividers (st.navigation dict keys) */
[data-testid="stSidebarNav"] section > div > span,
[data-testid="stSidebarNav"] > div > div > span {
    text-transform: uppercase !important;
    letter-spacing: 0.10em !important;
    font-size: 0.85rem !important;
    color: var(--pv-text) !important;
    font-weight: 800 !important;
    font-family: 'Inter', sans-serif !important;
    padding: 16px 18px 8px 18px !important;
    display: block;
}
/* Nav items — no motion, just color state changes */
[data-testid="stSidebarNav"] ul li a,
[data-testid="stSidebarNavLink"] {
    border-radius: 10px !important;
    padding: 12px 14px !important;
    margin: 4px 10px !important;
    transition: none !important;
    color: var(--pv-text-soft) !important;
    font-weight: 600 !important;
    font-size: 1.02rem !important;
    border: 1px solid transparent !important;
    transform: none !important;
}
[data-testid="stSidebarNav"] ul li a *,
[data-testid="stSidebarNavLink"] * {
    transition: none !important;
    transform: none !important;
    animation: none !important;
}
[data-testid="stSidebarNav"] ul li a:hover,
[data-testid="stSidebarNavLink"]:hover {
    background: var(--pv-brand-soft) !important;
    color: var(--pv-brand) !important;
    border-color: rgba(79, 70, 229, 0.14) !important;
    transform: none !important;
    box-shadow: none !important;
}
[data-testid="stSidebarNav"] ul li a:active,
[data-testid="stSidebarNavLink"]:active,
[data-testid="stSidebarNav"] ul li a:focus,
[data-testid="stSidebarNavLink"]:focus {
    transform: none !important;
    box-shadow: none !important;
    outline: none !important;
}
[data-testid="stSidebarNavLink"][aria-current="page"],
[data-testid="stSidebarNav"] ul li a[aria-current="page"] {
    background: linear-gradient(90deg,
        rgba(79, 70, 229, 0.10) 0%,
        rgba(124, 58, 237, 0.10) 100%) !important;
    color: var(--pv-brand) !important;
    font-weight: 700 !important;
    border-color: rgba(79, 70, 229, 0.25) !important;
    box-shadow: none !important;
    transform: none !important;
}

/* Sidebar text */
section[data-testid="stSidebar"] * {
    color: var(--pv-text);
}
section[data-testid="stSidebar"] [data-baseweb="select"] > div {
    background: #ffffff !important;
    border-color: var(--pv-border) !important;
    color: var(--pv-text) !important;
}

/* ===== Headings ================================================== */
h1, h2, h3, h4 {
    color: var(--pv-text) !important;
    letter-spacing: -0.01em !important;
    font-family: 'Inter', sans-serif !important;
    font-weight: 700 !important;
}
h1 { font-size: 2.4rem !important; line-height: 1.15 !important; }
h2 { font-size: 1.85rem !important; line-height: 1.22 !important; }
h3 { font-size: 1.35rem !important; line-height: 1.3 !important; }

p, .stMarkdown p, label, .stCaption {
    color: var(--pv-text-soft) !important;
}

/* ===== Glass cards / containers (border=True) ====================
   .pv-panel is added via JS at runtime — see _PANEL_MARKER_JS. */
.pv-panel,
div[data-testid="stVerticalBlock"].pv-panel {
    background: linear-gradient(180deg,
        rgba(255, 255, 255, 0.92) 0%,
        rgba(250, 251, 255, 0.92) 100%) !important;
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    border: 1px solid var(--pv-border) !important;
    border-radius: 16px !important;
    box-shadow: var(--pv-shadow-md) !important;
    padding: 2.2rem 2.4rem !important;
    margin-bottom: 1.8rem !important;
    margin-top: 0.4rem !important;
    position: relative !important;
    overflow: visible !important;
    transition: border-color .25s ease,
                box-shadow .25s ease,
                transform .25s ease !important;
}
/* Top accent strip */
.pv-panel::before {
    content: "";
    position: absolute;
    top: -1px; left: 16px; right: 16px;
    height: 2px;
    background: linear-gradient(90deg,
        transparent 0%,
        rgba(79, 70, 229, 0.55) 30%,
        rgba(124, 58, 237, 0.55) 70%,
        transparent 100%);
    pointer-events: none;
    border-radius: 2px;
}
/* Left vertical accent bar */
.pv-panel::after {
    content: "";
    position: absolute;
    left: -1px; top: 16px; bottom: 16px;
    width: 3px;
    background: linear-gradient(180deg, var(--pv-brand) 0%, var(--pv-brand-2) 100%);
    border-radius: 2px;
    pointer-events: none;
}
/* Hover lift */
.pv-panel:hover {
    border-color: var(--pv-border-strong) !important;
    box-shadow: var(--pv-shadow-lg) !important;
    transform: translateY(-1px);
}
/* Nested panels: tighter spacing, no double accents */
.pv-panel .pv-panel {
    margin-bottom: 1rem !important;
    padding: 1.6rem 1.7rem !important;
}
/* Panel title: first **Title** inside .pv-panel */
.pv-panel > [data-testid="stMarkdownContainer"]:first-child p:first-child strong,
.pv-panel
    [data-testid="stVerticalBlock"]
    > [data-testid="stMarkdownContainer"]:first-child p:first-child strong {
    display: inline-block;
    font-size: 1.08rem !important;
    font-weight: 700 !important;
    color: var(--pv-brand) !important;
    letter-spacing: 0.01em !important;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--pv-border);
    margin-bottom: 14px !important;
    font-family: 'Inter', sans-serif !important;
}
/* Legacy fallback (older streamlit versions that DID emit the wrapper) */
[data-testid="stVerticalBlockBorderWrapper"] {
    background: linear-gradient(180deg,
        rgba(255, 255, 255, 0.92) 0%,
        rgba(250, 251, 255, 0.92) 100%) !important;
    border: 1px solid var(--pv-border) !important;
    border-radius: 16px !important;
    box-shadow: var(--pv-shadow-md) !important;
    padding: 2.2rem 2.4rem !important;
    margin-bottom: 1.8rem !important;
    margin-top: 0.4rem !important;
    position: relative !important;
}

/* ===== Expander ================================================== */
[data-testid="stExpander"] {
    background: var(--pv-surface) !important;
    border: 1px solid var(--pv-border) !important;
    border-radius: 12px !important;
    box-shadow: var(--pv-shadow-sm);
    overflow: hidden;
}
[data-testid="stExpander"] summary {
    padding: 0.85rem 1.2rem !important;
    font-weight: 600 !important;
    color: var(--pv-text) !important;
    background: transparent !important;
}
[data-testid="stExpander"] summary:hover {
    background: var(--pv-brand-soft) !important;
}

/* ===== Buttons =================================================== */
.stButton > button,
.stDownloadButton > button,
.stFormSubmitButton > button {
    border-radius: 10px !important;
    border: 1px solid var(--pv-border-strong) !important;
    background: #ffffff !important;
    color: var(--pv-text) !important;
    font-weight: 600 !important;
    padding: 0.55rem 1.4rem !important;
    transition: all .18s ease !important;
    box-shadow: var(--pv-shadow-sm);
    font-family: 'Inter', sans-serif !important;
}
.stButton > button:hover,
.stDownloadButton > button:hover,
.stFormSubmitButton > button:hover {
    transform: translateY(-1px);
    border-color: var(--pv-brand) !important;
    background: var(--pv-brand-soft) !important;
    color: var(--pv-brand) !important;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.14);
}
/* Primary buttons → brand gradient */
.stButton > button[kind="primary"],
.stFormSubmitButton > button[kind="primary"],
button[data-testid="baseButton-primary"] {
    background: linear-gradient(90deg, var(--pv-brand) 0%, var(--pv-brand-2) 100%) !important;
    color: #ffffff !important;
    border: none !important;
    font-weight: 700 !important;
    letter-spacing: 0.01em !important;
    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.32),
                0 1px 0 rgba(255, 255, 255, 0.18) inset;
}
.stButton > button[kind="primary"] *,
.stFormSubmitButton > button[kind="primary"] *,
button[data-testid="baseButton-primary"] * {
    color: #ffffff !important;
    fill: #ffffff !important;
}
.stButton > button[kind="primary"]:hover,
.stFormSubmitButton > button[kind="primary"]:hover,
button[data-testid="baseButton-primary"]:hover {
    filter: brightness(1.05);
    transform: translateY(-1px);
    color: #ffffff !important;
    box-shadow: 0 6px 18px rgba(79, 70, 229, 0.40),
                0 1px 0 rgba(255, 255, 255, 0.22) inset;
}
.stButton > button[kind="primary"]:hover *,
.stFormSubmitButton > button[kind="primary"]:hover *,
button[data-testid="baseButton-primary"]:hover * {
    color: #ffffff !important;
    fill: #ffffff !important;
}

/* ===== Inputs / textarea / select =============================== */
input[type="text"], input[type="number"], input[type="password"],
.stTextInput input, .stTextArea textarea,
.stNumberInput input, .stSelectbox > div > div,
[data-baseweb="input"] input, [data-baseweb="select"] > div,
[data-baseweb="textarea"] textarea {
    border-radius: 10px !important;
    border: 1px solid var(--pv-border) !important;
    background: #ffffff !important;
    color: var(--pv-text) !important;
    transition: border-color .15s ease, box-shadow .15s ease !important;
}
input::placeholder, textarea::placeholder { color: var(--pv-text-mute) !important; }
input:focus, textarea:focus,
.stTextInput input:focus, .stTextArea textarea:focus,
.stNumberInput input:focus,
[data-baseweb="input"]:focus-within {
    border-color: var(--pv-brand) !important;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.14) !important;
    outline: none !important;
}
[data-baseweb="select"] svg { color: var(--pv-brand) !important; }

/* ===== Tabs ===================================================== */
.stTabs [data-baseweb="tab-list"] {
    gap: 4px;
    border-bottom: 1px solid var(--pv-border);
}
.stTabs [data-baseweb="tab"] {
    background: transparent !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 10px 18px !important;
    color: var(--pv-text-soft) !important;
    font-weight: 600 !important;
    transition: color .15s ease;
}
.stTabs [data-baseweb="tab"]:hover { color: var(--pv-brand) !important; }
.stTabs [aria-selected="true"] {
    color: var(--pv-brand) !important;
    border-bottom: 2px solid var(--pv-brand) !important;
}

/* ===== Radio ==================================================== */
.stRadio > div { gap: 6px; }
.stRadio label { color: var(--pv-text) !important; }

/* ===== File uploader ============================================ */
[data-testid="stFileUploaderDropzone"],
[data-testid="stFileUploader"] section {
    border-radius: 12px !important;
    border: 1.5px dashed rgba(79, 70, 229, 0.30) !important;
    background: rgba(79, 70, 229, 0.03) !important;
    color: var(--pv-text-soft) !important;
    transition: all .18s ease;
}
[data-testid="stFileUploaderDropzone"]:hover {
    border-color: var(--pv-brand) !important;
    background: var(--pv-brand-soft) !important;
}

/* ===== Progress / status =======================================
   All progress bars use a soft cyan→sky-blue gradient (no red).
   We target every variant Streamlit/baseweb may render: .stProgress
   children, role=progressbar, [data-baseweb="progress-bar"], and
   the Streamlit status / spinner widgets. */
.stProgress > div > div > div > div,
.stProgress div[role="progressbar"] > div,
[data-testid="stProgress"] > div > div > div > div,
[data-testid="stProgressBar"] > div > div > div > div,
[data-baseweb="progress-bar"] > div > div,
div[role="progressbar"] > div {
    background: linear-gradient(90deg, #7dd3fc 0%, #38bdf8 50%, #06b6d4 100%) !important;
    background-color: #38bdf8 !important;
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.32) !important;
}
/* Track (the unfilled portion) — light translucent blue */
.stProgress > div > div > div,
[data-testid="stProgress"] > div > div > div,
[data-testid="stProgressBar"] > div > div > div,
[data-baseweb="progress-bar"] > div,
div[role="progressbar"] {
    background: rgba(125, 211, 252, 0.18) !important;
}
/* Streamlit status widget primary color override (also used to be red) */
[data-testid="stStatusWidget"] [data-baseweb="progress-bar"] > div > div,
[data-testid="stStatus"] [data-baseweb="progress-bar"] > div > div {
    background: linear-gradient(90deg, #7dd3fc, #38bdf8) !important;
}

/* ===== Captions / small text =================================== */
.stCaption, [data-testid="stCaptionContainer"] {
    color: var(--pv-text-mute) !important;
    font-size: 0.88rem !important;
}

/* ===== Hero block (for Quick-Create page) ====================== */
.pv-hero {
    text-align: center;
    padding: 2.4rem 0 2rem 0;
    position: relative;
}
.pv-hero h1 {
    font-family: 'Inter', sans-serif !important;
    font-size: 3rem !important;
    font-weight: 800 !important;
    background: linear-gradient(90deg, var(--pv-brand) 0%, var(--pv-brand-2) 50%, var(--pv-accent) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.02em !important;
    margin-bottom: 0.8rem !important;
}
.pv-hero p.lead {
    font-size: 1.10rem !important;
    color: var(--pv-text-soft) !important;
    margin: 0 auto;
    max-width: 680px;
    line-height: 1.55;
}

/* ===== Section title =========================================== */
.pv-section-title {
    font-family: 'Inter', sans-serif;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--pv-text);
    letter-spacing: -0.01em;
    margin: 0 0 0.3rem 0;
    display: flex;
    align-items: center;
}
.pv-section-title::before {
    content: "";
    display: inline-block;
    width: 4px;
    height: 22px;
    background: linear-gradient(180deg, var(--pv-brand), var(--pv-brand-2));
    margin-right: 12px;
    border-radius: 2px;
}
.pv-section-sub {
    font-size: 0.95rem;
    color: var(--pv-text-soft);
    margin-bottom: 0.8rem;
    margin-left: 16px;
}

/* ===== Links =================================================== */
a, a:visited {
    color: var(--pv-brand) !important;
    text-decoration: none !important;
}
a:hover {
    text-decoration: underline !important;
    text-underline-offset: 3px;
}

/* ===== Divider ================================================= */
hr {
    border: none !important;
    border-top: 1px solid var(--pv-border) !important;
    margin: 1.2rem 0 !important;
}

/* ===== Alerts / info / warning ================================= */
[data-testid="stAlert"] {
    background: var(--pv-surface) !important;
    border: 1px solid var(--pv-border) !important;
    border-radius: 12px !important;
    color: var(--pv-text) !important;
    box-shadow: var(--pv-shadow-sm);
}
[data-testid="stAlert"] * { color: var(--pv-text) !important; }
[data-testid="stAlert"][data-baseweb="notification"][kind="info"],
.stAlert[data-baseweb="notification"][kind="info"] {
    border-left: 3px solid var(--pv-brand) !important;
    background: var(--pv-brand-soft) !important;
}
[data-testid="stAlert"][data-baseweb="notification"][kind="success"],
.stAlert[data-baseweb="notification"][kind="success"] {
    border-left: 3px solid var(--pv-success) !important;
    background: rgba(16, 185, 129, 0.06) !important;
}
[data-testid="stAlert"][kind="warning"] {
    border-left: 3px solid var(--pv-warning) !important;
    background: rgba(245, 158, 11, 0.06) !important;
}
[data-testid="stAlert"][kind="error"] {
    border-left: 3px solid var(--pv-danger) !important;
    background: rgba(239, 68, 68, 0.06) !important;
}

/* ===== Universal text contrast pass ============================ */
section[data-testid="stMain"], section[data-testid="stMain"] *,
section[data-testid="stSidebar"], section[data-testid="stSidebar"] * {
    color: var(--pv-text);
}
/* But never override gradient brand / hero / topbar styles */
.pv-topbar .brand-name, .pv-hero h1 { color: transparent !important; }

/* Markdown body text */
.stMarkdown, .stMarkdown p, .stMarkdown li, .stMarkdown span,
.stMarkdown em {
    color: var(--pv-text) !important;
}
.stMarkdown strong { color: var(--pv-text) !important; font-weight: 700; }
.stMarkdown code {
    background: var(--pv-brand-soft) !important;
    color: var(--pv-brand) !important;
    padding: 1px 6px !important;
    border-radius: 6px !important;
    font-family: 'JetBrains Mono', monospace !important;
    border: 1px solid rgba(79, 70, 229, 0.18);
    font-size: 0.92em !important;
}
.stMarkdown pre {
    background: #0f172a !important;
    border: 1px solid #1e293b !important;
    border-radius: 12px !important;
    color: #e2e8f0 !important;
}
.stMarkdown pre code {
    background: transparent !important;
    border: none !important;
    color: #e2e8f0 !important;
}
.stMarkdown blockquote {
    border-left: 3px solid var(--pv-brand) !important;
    background: var(--pv-brand-soft) !important;
    color: var(--pv-text-soft) !important;
    border-radius: 6px;
    padding: 8px 14px !important;
}
.stMarkdown h1, .stMarkdown h2, .stMarkdown h3,
.stMarkdown h4, .stMarkdown h5, .stMarkdown h6 {
    color: var(--pv-text) !important;
}
/* Markdown tables */
.stMarkdown table { border-color: var(--pv-border) !important; }
.stMarkdown th {
    background: var(--pv-surface-2) !important;
    color: var(--pv-text) !important;
    border-color: var(--pv-border) !important;
}
.stMarkdown td {
    color: var(--pv-text) !important;
    border-color: var(--pv-border) !important;
}

/* Labels of every input widget */
label, .stTextInput label, .stTextArea label, .stNumberInput label,
.stSelectbox label, .stMultiSelect label, .stRadio label,
.stCheckbox label, .stSlider label, .stFileUploader label,
.stDateInput label, .stTimeInput label, .stColorPicker label,
[data-testid="stWidgetLabel"], [data-testid="stWidgetLabel"] * {
    color: var(--pv-text) !important;
    font-weight: 500 !important;
}
[data-testid="stWidgetLabel"] [class*="Required"] {
    color: var(--pv-danger) !important;
}

/* Selectbox dropdown popover */
[data-baseweb="popover"], [data-baseweb="menu"], ul[role="listbox"] {
    background: #ffffff !important;
    border: 1px solid var(--pv-border) !important;
    border-radius: 12px !important;
    box-shadow: var(--pv-shadow-lg) !important;
    color: var(--pv-text) !important;
}
[data-baseweb="menu"] li, ul[role="listbox"] li, li[role="option"] {
    color: var(--pv-text) !important;
    background: transparent !important;
}
li[role="option"]:hover, [data-baseweb="menu"] li:hover {
    background: var(--pv-brand-soft) !important;
    color: var(--pv-brand) !important;
}
li[role="option"][aria-selected="true"] {
    background: rgba(79, 70, 229, 0.14) !important;
    color: var(--pv-brand) !important;
}
/* Selected display value in select control */
[data-baseweb="select"] [data-baseweb="tag"] {
    background: var(--pv-brand-soft) !important;
    color: var(--pv-brand) !important;
    border: 1px solid rgba(79, 70, 229, 0.20) !important;
    border-radius: 8px;
}
[data-baseweb="select"] input { color: var(--pv-text) !important; }
[data-baseweb="select"] div[role="combobox"] { color: var(--pv-text) !important; }

/* Number input +/- step buttons */
.stNumberInput button, [data-baseweb="input"] button {
    background: var(--pv-surface-2) !important;
    color: var(--pv-brand) !important;
    border-color: var(--pv-border) !important;
}
.stNumberInput button:hover { background: var(--pv-brand-soft) !important; }

/* Checkboxes / radios */
.stCheckbox [role="checkbox"], .stRadio [role="radio"] {
    border-color: var(--pv-border-strong) !important;
    background: #ffffff !important;
}
.stCheckbox [role="checkbox"][aria-checked="true"],
.stRadio [role="radio"][aria-checked="true"] {
    background: linear-gradient(135deg, var(--pv-brand), var(--pv-brand-2)) !important;
    border-color: var(--pv-brand) !important;
}
.stCheckbox [role="checkbox"] svg,
.stRadio [role="radio"] svg { color: #ffffff !important; }

/* Sliders */
.stSlider [data-baseweb="slider"] [role="slider"] {
    background: linear-gradient(135deg, var(--pv-brand), var(--pv-brand-2)) !important;
    border: 2px solid #ffffff !important;
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.32) !important;
}
.stSlider [data-baseweb="slider"] div[role="progressbar"] {
    background: linear-gradient(90deg, var(--pv-brand), var(--pv-brand-2)) !important;
}
.stSlider [data-baseweb="slider"] {
    background: rgba(79, 70, 229, 0.14) !important;
}

/* Metrics — needed for History stats */
[data-testid="stMetric"] {
    background: var(--pv-surface) !important;
    border: 1px solid var(--pv-border) !important;
    border-radius: 12px !important;
    padding: 1rem 1.2rem !important;
    box-shadow: var(--pv-shadow-sm);
}
[data-testid="stMetricValue"] {
    color: var(--pv-brand) !important;
    font-family: 'Inter', sans-serif !important;
    font-weight: 800 !important;
    letter-spacing: -0.01em !important;
}
[data-testid="stMetricLabel"] {
    color: var(--pv-text-mute) !important;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.74rem !important;
    font-weight: 600 !important;
}
[data-testid="stMetricDelta"] {
    color: var(--pv-text-soft) !important;
}

/* File uploader file chips */
[data-testid="stFileUploaderFile"] {
    background: var(--pv-brand-soft) !important;
    border: 1px solid rgba(79, 70, 229, 0.18) !important;
    border-radius: 10px !important;
    color: var(--pv-text) !important;
}
[data-testid="stFileUploaderFileName"] { color: var(--pv-text) !important; }
[data-testid="stFileUploaderDropzoneInstructions"] *,
[data-testid="stFileUploaderDropzone"] * { color: var(--pv-text-soft) !important; }
[data-testid="stFileUploaderDropzone"] small { color: var(--pv-text-mute) !important; }
[data-testid="stFileUploaderDropzone"] button {
    background: linear-gradient(90deg, var(--pv-brand), var(--pv-brand-2)) !important;
    color: #ffffff !important;
    border: none !important;
    font-weight: 600 !important;
}

/* Tooltip / help icon */
[data-baseweb="tooltip"], [data-testid="stTooltipContent"] {
    background: #1d2433 !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 8px !important;
    box-shadow: var(--pv-shadow-lg);
    padding: 6px 10px !important;
    font-size: 0.85rem !important;
}
[data-baseweb="tooltip"] *, [data-testid="stTooltipContent"] * {
    color: #ffffff !important;
}
[data-testid="stTooltipIcon"] svg { color: var(--pv-text-mute) !important; }

/* Date / time pickers */
[data-baseweb="calendar"] {
    background: #ffffff !important;
    color: var(--pv-text) !important;
    border: 1px solid var(--pv-border) !important;
}
[data-baseweb="calendar"] * { color: var(--pv-text) !important; }

/* Data tables / dataframes */
[data-testid="stDataFrame"] {
    background: var(--pv-surface) !important;
    border-radius: 12px !important;
    border: 1px solid var(--pv-border) !important;
    box-shadow: var(--pv-shadow-sm);
}
[data-testid="stDataFrame"] [role="cell"] { color: var(--pv-text) !important; }
[data-testid="stDataFrame"] [role="columnheader"] {
    color: var(--pv-text) !important;
    background: var(--pv-surface-2) !important;
}

/* Status / spinner */
[data-testid="stStatusWidget"], [data-testid="stStatus"] {
    background: var(--pv-surface) !important;
    border: 1px solid var(--pv-border) !important;
    border-radius: 12px !important;
    color: var(--pv-text) !important;
    box-shadow: var(--pv-shadow-sm);
}
.stSpinner > div { color: var(--pv-brand) !important; }

/* Code blocks (st.code) */
[data-testid="stCodeBlock"] {
    background: #0f172a !important;
    border: 1px solid #1e293b !important;
    border-radius: 12px !important;
}
[data-testid="stCodeBlock"] code,
[data-testid="stCodeBlock"] pre,
[data-testid="stCodeBlock"] span {
    color: #e2e8f0 !important;
    font-family: 'JetBrains Mono', monospace !important;
}

/* Disabled state */
button:disabled, .stButton > button:disabled,
input:disabled, textarea:disabled {
    opacity: 0.55 !important;
    cursor: not-allowed !important;
    color: var(--pv-text-mute) !important;
}

/* Scrollbars */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
    background: rgba(79, 70, 229, 0.18);
    border-radius: 6px;
    border: 2px solid transparent;
    background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover { background: rgba(79, 70, 229, 0.36); }

/* Image / video container */
.stImage img, [data-testid="stImage"] img {
    border-radius: 12px;
    box-shadow: var(--pv-shadow-md);
    border: 1px solid var(--pv-border);
}
video {
    border-radius: 12px;
    box-shadow: var(--pv-shadow-md);
    border: 1px solid var(--pv-border);
}

/* Audio player — leave native (looks fine on light bg) */

/* Caption text override */
small, .stCaption {
    color: var(--pv-text-mute) !important;
}
</style>
"""


def _build_persistent_loader() -> str:
    """One-time loader that installs fonts + theme CSS into the parent <head>.

    Streamlit reruns inject `<style>` into the iframe body each time, which
    causes a flicker on every page switch (re-parse + Google Fonts re-fetch).
    We instead inject ONCE into `window.parent.document.head` with stable
    IDs — subsequent reruns find the nodes already there and skip work,
    eliminating the flash.

    Note: nothing is rendered into the iframe body except a small <script>,
    so reruns don't replay any expensive style work.
    """
    # Strip the outer <style> tags so we can inject as textContent
    raw_css = _THEME_CSS.strip()
    if raw_css.startswith("<style>"):
        raw_css = raw_css[len("<style>"):]
    if raw_css.endswith("</style>"):
        raw_css = raw_css[:-len("</style>")]
    # Escape backticks/backslashes for embedding in a JS template literal
    js_safe_css = raw_css.replace("\\", "\\\\").replace("`", "\\`")
    return f"""
<script>
(function() {{
  try {{
    var doc = window.parent.document;
    var head = doc.head;
    if (!head) return;

    // 1. Font preconnects + stylesheet (skip if already inserted)
    if (!doc.getElementById('pv-font-preconnect')) {{
      var pc1 = doc.createElement('link');
      pc1.id = 'pv-font-preconnect';
      pc1.rel = 'preconnect';
      pc1.href = 'https://fonts.googleapis.com';
      head.appendChild(pc1);

      var pc2 = doc.createElement('link');
      pc2.rel = 'preconnect';
      pc2.href = 'https://fonts.gstatic.com';
      pc2.crossOrigin = 'anonymous';
      head.appendChild(pc2);
    }}
    if (!doc.getElementById('pv-font-stylesheet')) {{
      var fl = doc.createElement('link');
      fl.id = 'pv-font-stylesheet';
      fl.rel = 'stylesheet';
      fl.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Orbitron:wght@600;700;800;900&display=swap';
      head.appendChild(fl);
    }}

    // 2. Background paint — kill the brief white flash on rerun
    if (!doc.getElementById('pv-bg-paint')) {{
      var bg = doc.createElement('style');
      bg.id = 'pv-bg-paint';
      bg.textContent = 'html, body {{ background:#f7f8fc !important; }}';
      head.appendChild(bg);
    }}

    // 3. Main theme stylesheet — inject once, reuse across reruns
    var existing = doc.getElementById('pv-theme-css');
    if (!existing) {{
      var st = doc.createElement('style');
      st.id = 'pv-theme-css';
      st.textContent = `{js_safe_css}`;
      head.appendChild(st);
    }}
  }} catch (e) {{ /* ignore */ }}
}})();
</script>
"""


def inject_theme() -> None:
    """Inject the global light theme — idempotent across page switches.

    On the FIRST page load this installs the stylesheet into the parent
    document's <head> with a stable id. Subsequent reruns (page switches)
    detect the existing node and do nothing, so there is no re-parse, no
    Google Fonts re-fetch, and no visible flicker.

    We also keep an inline <style> as a first-paint guarantee — it's
    cheap to re-parse but ensures every rerun has styled content even
    before the persistent <head> injection finishes.
    """
    # 1. First-paint guarantee inside the iframe — re-parsed on rerun
    #    but already cached, so no font re-fetch occurs once the parent
    #    head has the same stylesheet id loaded.
    st.markdown(_THEME_CSS, unsafe_allow_html=True)
    # 2. Persistent install into parent <head> — runs the script via a
    #    components iframe (which guarantees execution, unlike markdown).
    try:
        from streamlit.components.v1 import html as _components_html
        _components_html(_build_persistent_loader(), height=0, width=0)
    except Exception:
        # Fallback: try markdown — works on older streamlit versions
        st.markdown(_build_persistent_loader(), unsafe_allow_html=True)
    _inject_panel_marker()


# Streamlit 1.30+ no longer emits a stable testid on bordered containers;
# the border itself is on an inner emotion-styled <div>. We mark every
# such container with `.pv-panel` at runtime so our CSS can target them
# precisely without leaking onto plain layout blocks.
_PANEL_MARKER_JS = """
<script>
(function() {
  const ROOT_DOC = window.parent.document;
  const TAG = 'pv-panel';

  function hasRealBorder(el) {
    const cs = ROOT_DOC.defaultView.getComputedStyle(el);
    if (!cs) return false;
    const w = parseFloat(cs.borderTopWidth || '0');
    const style = cs.borderTopStyle;
    return w >= 1 && style && style !== 'none' && style !== 'hidden';
  }

  function tagPanels() {
    const blocks = ROOT_DOC.querySelectorAll(
      'div[data-testid="stVerticalBlock"]'
    );
    blocks.forEach(b => {
      if (b.classList.contains(TAG)) return;
      // Skip blocks that live inside the topbar (e.g. the language
      // selector slot) — they should never be styled as glass cards.
      if (b.closest('.pv-topbar')) return;
      if (hasRealBorder(b)) b.classList.add(TAG);
    });
  }

  // Initial pass
  tagPanels();

  // Re-tag on any DOM change (Streamlit reruns / lazy renders)
  if (!window.__pv_panel_observer__) {
    const obs = new MutationObserver(() => tagPanels());
    obs.observe(ROOT_DOC.body, { childList: true, subtree: true });
    window.__pv_panel_observer__ = obs;
  }
})();
</script>
"""


def _inject_panel_marker() -> None:
    """Inject the runtime panel-tagger script."""
    st.markdown(_PANEL_MARKER_JS, unsafe_allow_html=True)


# Sci-fi inline brand mark — extruded hexagonal HUD frame, beveled neon Z,
# multi-layer highlights & shadows for a glassy 3D feel. Mirrors
# resources/logo.svg.
_LOGO_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="pv-logo-stroke" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7dd3fc"/>
      <stop offset="40%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <radialGradient id="pv-logo-fill" cx="38%" cy="22%" r="85%">
      <stop offset="0%" stop-color="#c7d2fe" stop-opacity="0.55"/>
      <stop offset="45%" stop-color="#4f46e5" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0.30"/>
    </radialGradient>
    <linearGradient id="pv-logo-z" x1="0" y1="18" x2="0" y2="46" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="22%" stop-color="#67e8f9"/>
      <stop offset="55%" stop-color="#a78bfa"/>
      <stop offset="85%" stop-color="#6d28d9"/>
      <stop offset="100%" stop-color="#3b0764"/>
    </linearGradient>
    <linearGradient id="pv-logo-gleam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="pv-logo-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="0.9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="pv-logo-drop" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/>
      <feOffset dx="0" dy="1.4" result="o"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="pv-logo-hex-clip">
      <polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5"/>
    </clipPath>
  </defs>
  <polygon points="32,4.5 58,18.5 58,47.5 32,62.5 6,47.5 6,18.5"
           fill="#1e1b4b" opacity="0.45" filter="url(#pv-logo-drop)"/>
  <polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5"
           fill="url(#pv-logo-fill)" stroke="url(#pv-logo-stroke)"
           stroke-width="2" stroke-linejoin="round"/>
  <g clip-path="url(#pv-logo-hex-clip)">
    <ellipse cx="24" cy="14" rx="22" ry="9" fill="#ffffff" opacity="0.18"/>
  </g>
  <path d="M 9 18.5 L 32 5.2 L 55 18.5" fill="none" stroke="#bae6fd"
        stroke-opacity="0.75" stroke-width="0.9" stroke-linecap="round"/>
  <path d="M 9 46 L 32 59 L 55 46" fill="none" stroke="#0f0a3d"
        stroke-opacity="0.55" stroke-width="0.8" stroke-linecap="round"/>
  <polygon points="32,9 51.5,20.5 51.5,43.5 32,55 12.5,43.5 12.5,20.5"
           fill="none" stroke="#a5b4fc" stroke-width="0.55"
           stroke-opacity="0.5" stroke-dasharray="2 2"/>
  <g stroke="#22d3ee" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.95">
    <path d="M 12 17 L 12 13 L 16 13"/>
    <path d="M 52 47 L 52 51 L 48 51"/>
  </g>
  <g>
    <circle cx="9.5" cy="32" r="1.3" fill="#67e8f9"/>
    <circle cx="9.5" cy="32" r="0.6" fill="#ffffff"/>
    <circle cx="54.5" cy="32" r="1.3" fill="#67e8f9"/>
    <circle cx="54.5" cy="32" r="0.6" fill="#ffffff"/>
    <circle cx="32" cy="6.5" r="1" fill="#c4b5fd"/>
    <circle cx="32" cy="57.5" r="1" fill="#c4b5fd"/>
  </g>
  <path d="M 19 21.5 L 47 21.5 L 47 26.5 L 29.5 40.5 L 47 40.5 L 47 45.5 L 19 45.5 L 19 40.5 L 36.5 26.5 L 19 26.5 Z"
        fill="#1e1b4b" opacity="0.55"/>
  <g filter="url(#pv-logo-glow)">
    <path d="M 18 20 L 46 20 L 46 25 L 28.5 39 L 46 39 L 46 44 L 18 44 L 18 39 L 35.5 25 L 18 25 Z"
          fill="url(#pv-logo-z)" stroke="#ffffff" stroke-opacity="0.6"
          stroke-width="0.55" stroke-linejoin="miter"/>
  </g>
  <path d="M 18 20.6 L 46 20.6" stroke="#ffffff" stroke-opacity="0.85"
        stroke-width="0.7" stroke-linecap="round"/>
  <path d="M 18 43.5 L 46 43.5" stroke="#1e1b4b" stroke-opacity="0.55"
        stroke-width="0.7" stroke-linecap="round"/>
  <rect x="18" y="20" width="28" height="2.6" fill="url(#pv-logo-gleam)"/>
  <line x1="22" y1="32" x2="42" y2="32" stroke="#22d3ee"
        stroke-width="0.8" stroke-opacity="0.7" stroke-dasharray="1.5 2"/>
</svg>"""


def render_topbar(
    brand_name: str = "ZPL",
    brand_suffix: str = "Video Studio",
    logo_text: str = "Z",
    tag: str = "",
    meta: str = "",
) -> None:
    """Render a sticky light-theme top navigation bar."""
    meta_html = (
        f'<span class="meta"><span class="pulse"></span>{meta}</span>'
        if meta else ""
    )
    tag_html = f'<span class="tag">{tag}</span>' if tag else ""
    st.markdown(
        f"""
        <div class="pv-topbar">
          <div class="brand">
            <span class="logo" aria-label="{brand_name}">{_LOGO_SVG}</span>
            <span class="brand-name">{brand_name}</span>
            <span class="brand-sub">{brand_suffix}</span>
          </div>
          {tag_html}
          <div class="spacer"></div>
          {meta_html}
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_hero(title: str, subtitle: str = "") -> None:
    """Render a centered hero block."""
    sub_html = f'<p class="lead">{subtitle}</p>' if subtitle else ""
    st.markdown(
        f'<div class="pv-hero"><h1>{title}</h1>{sub_html}</div>',
        unsafe_allow_html=True,
    )


def render_section_title(title: str, subtitle: str = "") -> None:
    """Render a left-aligned section heading with brand accent bar."""
    sub_html = f'<div class="pv-section-sub">{subtitle}</div>' if subtitle else ""
    st.markdown(
        f'<div class="pv-section-title">{title}</div>{sub_html}',
        unsafe_allow_html=True,
    )
