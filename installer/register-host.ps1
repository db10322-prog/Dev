# T-3 — 크롬 네이티브 메시징 호스트를 윈도우 레지스트리에 등록.
# 사용법: powershell -ExecutionPolicy Bypass -File installer/register-host.ps1 -ExtensionId <크롬 확장 ID>
#   확장 ID는 chrome://extensions 에서 "압축해제된 확장 프로그램을 로드"한 뒤 표시되는 값.
param(
    [Parameter(Mandatory = $true)]
    [string]$ExtensionId
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$NativeHostDir = Join-Path $RepoRoot "native-host"
$ManifestSrc = Join-Path $NativeHostDir "manifest.json"
$ManifestOut = Join-Path $NativeHostDir "manifest.generated.json"
$HostBat = Join-Path $NativeHostDir "host.bat"

if (-not (Test-Path $HostBat)) {
    throw "host.bat 을 찾을 수 없음: $HostBat"
}

# manifest.json 의 __EXTENSION_ID__ 플레이스홀더와 상대경로를 실제 값으로 치환.
$manifestContent = Get-Content $ManifestSrc -Raw
$manifestContent = $manifestContent -replace "__EXTENSION_ID__", $ExtensionId
$manifestContent = $manifestContent -replace '"path": "host\.bat"', ('"path": "' + ($HostBat -replace '\\', '\\\\') + '"')
Set-Content -Path $ManifestOut -Value $manifestContent -Encoding utf8NoBOM

$RegKeyPath = "HKCU:\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.fakenewsagent.host"
New-Item -Path $RegKeyPath -Force | Out-Null
Set-ItemProperty -Path $RegKeyPath -Name "(Default)" -Value $ManifestOut

Write-Host "등록 완료:"
Write-Host "  레지스트리 키: $RegKeyPath"
Write-Host "  매니페스트:    $ManifestOut"
Write-Host "  host.bat:      $HostBat"
Write-Host ""
Write-Host "확인: chrome://extensions 에서 확장을 리로드한 뒤, Electron 앱을 실행하고 크롬에서 뉴스 기사를 연 상태로 캐릭터를 클릭해 테스트하세요."
