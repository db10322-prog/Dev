@echo off
REM Chrome native messaging은 이 배치파일을 stdio 파이프와 함께 실행함.
REM node.exe 경로가 PATH에 없는 환경 대비, %~dp0 기준 상대경로로 host.js 호출.
node "%~dp0host.js"
