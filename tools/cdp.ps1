# Headless Edge を CDP で操作する小さなハーネス（このアプリの検証用）。
# もとは eiyo-kanri_research\cdp.ps1 にあったが、そのフォルダごと無くなったので tools\ に置き直した。
#
# 使い方:
#   tools\cdp.ps1 -Url <url> [-Eval <js>] [-Shot <png>] [-Width 820] [-Height 1180]
#                 [-WaitMs 2500] [-Steps @('js1','js2')] [-Media print] [-Gesture]
#
# 覚え書き:
#   ・JSON は ConvertFrom-Json で読む。JavaScriptSerializer は Windows の更新で
#     System.Web.UI.WebResourceAttribute を読めず落ちるようになった（2026-10 実測）。
#   ・-Media print で印刷時の見た目を確かめられる。-Gesture はファイル選択など
#     「ユーザー操作の中でしか動かない」API を試すとき。
#   ・落ちた後に msedge が残ると次回 WebSocket がつながらない。finally で片付ける。
param(
  [string]$Url, [string]$Eval = "", [string]$Shot = "", [int]$Width = 820, [int]$Height = 1180,
  [int]$WaitMs = 2500, [string[]]$Steps = @(), [int]$Port = 9377, [switch]$Gesture, [string]$Media = ""
)
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$profileDir = Join-Path $PSScriptRoot "_cdpprofile"
$proc = Start-Process -FilePath $edge -PassThru -ArgumentList @(
  "--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=$Port",
  "--remote-allow-origins=*", "--user-data-dir=`"$profileDir`"", "--window-size=$Width,$Height", "about:blank")
try {
  $targets = $null
  for ($i = 0; $i -lt 40; $i++) {
    try { $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json" -TimeoutSec 2; if ($targets) { break } }
    catch { Start-Sleep -Milliseconds 300 }
  }
  $page = $targets | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  $script:id = 0
  function Send-Cdp([string]$method, $params) {
    $script:id++
    $msg = @{ id = $script:id; method = $method; params = $params } | ConvertTo-Json -Depth 8 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(, $bytes)), 'Text', $true, [Threading.CancellationToken]::None).Wait()
    while ($true) {
      $ms = New-Object IO.MemoryStream
      do {
        $buf = New-Object byte[] 262144
        $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $buf)
        $r = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None).Result
        $ms.Write($buf, 0, $r.Count)
      } while (-not $r.EndOfMessage)
      $text = [Text.Encoding]::UTF8.GetString($ms.ToArray())
      if ($text -match ('"id":' + $script:id + '[,}]')) { return ($text | ConvertFrom-Json) }
    }
  }
  function Eval-Js([string]$js) {
    $r = Send-Cdp "Runtime.evaluate" @{ expression = $js; awaitPromise = $true; returnByValue = $true; userGesture = [bool]$Gesture }
    if ($r.result.exceptionDetails) { return "EXCEPTION: " + ($r.result.exceptionDetails | ConvertTo-Json -Depth 6 -Compress) }
    return $r.result.result.value
  }
  Send-Cdp "Emulation.setDeviceMetricsOverride" @{ width = $Width; height = $Height; deviceScaleFactor = 1; mobile = $false } | Out-Null
  Send-Cdp "Page.navigate" @{ url = $Url } | Out-Null
  Start-Sleep -Milliseconds $WaitMs
  foreach ($s in $Steps) { $v = Eval-Js $s; if ($v) { "STEP> $v" }; Start-Sleep -Milliseconds 700 }
  if ($Media) { Send-Cdp "Emulation.setEmulatedMedia" @{ media = $Media } | Out-Null; Start-Sleep -Milliseconds 400 }
  if ($Eval) { Eval-Js $Eval }
  if ($Shot) {
    $r = Send-Cdp "Page.captureScreenshot" @{ format = "png" }
    [IO.File]::WriteAllBytes($Shot, [Convert]::FromBase64String($r.result.data))
    "saved $Shot"
  }
} finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |
    Where-Object { $_.CommandLine -like "*_cdpprofile*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
