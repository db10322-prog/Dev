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
# -Encoding UTF8 필수: Windows PowerShell 5.1의 Get-Content 기본 인코딩은 BOM 없는 UTF-8
# 파일을 시스템 코드페이지(한국어 Windows에서는 CP949)로 잘못 읽어 한글이 깨진다.
$manifestContent = Get-Content $ManifestSrc -Raw -Encoding UTF8
$manifestContent = $manifestContent -replace "__EXTENSION_ID__", $ExtensionId
# JSON 이스케이프는 원본 백슬래시 1개당 2개(\\)여야 한다. PowerShell 단일따옴표 문자열은
# 이스케이프를 안 하므로 replacement에 '\\'(문자 2개)를 그대로 쓰면 된다 — '\\\\'(4개)를 쓰면
# JSON 파싱 후 경로에 백슬래시가 2배로 남는 버그가 생김(실제로 겪었음).
$escapedPath = $HostBat -replace '\\', '\\'
$manifestContent = $manifestContent -replace '"path": "host\.bat"', ('"path": "' + $escapedPath + '"')
# Windows PowerShell 5.1엔 utf8NoBOM 인코딩이 없음(PowerShell 7+ 전용) — BOM 없는 UTF-8을
# 직접 써야 크롬 네이티브 메시징 호스트가 이 JSON을 깨지지 않고 읽는다.
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($ManifestOut, $manifestContent, $Utf8NoBom)

$RegKeyPath = "HKCU:\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.fakenewsagent.host"
New-Item -Path $RegKeyPath -Force | Out-Null
Set-ItemProperty -Path $RegKeyPath -Name "(Default)" -Value $ManifestOut

Write-Host "등록 완료:"
Write-Host "  레지스트리 키: $RegKeyPath"
Write-Host "  매니페스트:    $ManifestOut"
Write-Host "  host.bat:      $HostBat"
Write-Host ""
Write-Host "확인: chrome://extensions 에서 확장을 리로드한 뒤, Electron 앱을 실행하고 크롬에서 뉴스 기사를 연 상태로 캐릭터를 클릭해 테스트하세요."
