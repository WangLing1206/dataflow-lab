<#
  tts-sapi.ps1 · 用 Windows 内置语音（SAPI）离线合成解说
  用法：powershell -ExecutionPolicy Bypass -File tools/tts-sapi.ps1 -Dir <临时目录>
  该目录下需有 segments.json：[{ file, voice, rate, text }]
#>
param([Parameter(Mandatory = $true)][string]$Dir)

Add-Type -AssemblyName System.Speech

$jsonPath = Join-Path $Dir 'segments.json'
$raw = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
$segs = $raw | ConvertFrom-Json

foreach ($seg in $segs) {
  $out = Join-Path $Dir $seg.file
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.SetOutputToWaveFile($out)
  try { $synth.SelectVoice($seg.voice) } catch { }
  $synth.Rate = [int]$seg.rate
  $synth.Volume = 100
  $synth.Speak($seg.text)
  $synth.Dispose()
  Write-Output ("ok " + $seg.file)
}
