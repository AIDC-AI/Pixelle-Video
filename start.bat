@echo off
set PATH=C:\Users\hp\anaconda3\envs\pixelle-video\Scripts;C:\Users\hp\anaconda3\envs\pixelle-video;%PATH%
cd /d %~dp0
C:\Users\hp\anaconda3\envs\pixelle-video\python.exe -m streamlit run web/app.py
