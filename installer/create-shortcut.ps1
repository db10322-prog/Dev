# T-4 — 바탕화면에 앱 실행 바로가기(.lnk) 생성 + (선택) 윈도우 시작 시 자동 실행 등록.
# 사용법: powershell -ExecutionPolicy Bypass -File installer/create-shortcut.ps1 [-AutoStart]
param(
    [switch]$AutoStart
)

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ElectronExe = Join-Path $RepoRoot "node_modules\.bin\electron.cmd"
$TargetArgs = "`"$RepoRoot`""

function New-AppShortcut([string]$LinkPath) {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($LinkPath)
    $Shortcut.TargetPath = $ElectronExe
    $Shortcut.Arguments = $TargetArgs
    $Shortcut.WorkingDirectory = $RepoRoot
    $Shortcut.Description = "뉴스 진위·편향 판별 AI 에이전트"
    $Shortcut.Save()
}

$DesktopPath = [Environment]::GetFolderPath("Desktop")
$DesktopLink = Join-Path $DesktopPath "뉴스 판별 에이전트.lnk"
New-AppShortcut $DesktopLink
Write-Host "바탕화면 바로가기 생성: $DesktopLink"

if ($AutoStart) {
    $StartupPath = [Environment]::GetFolderPath("Startup")
    $StartupLink = Join-Path $StartupPath "뉴스 판별 에이전트.lnk"
    New-AppShortcut $StartupLink
    Write-Host "윈도우 시작 시 자동 실행 등록: $StartupLink"
}

Write-Host ""
Write-Host "주의: 먼저 'npm install' 로 electron이 node_modules에 설치되어 있어야 바로가기가 동작합니다."
