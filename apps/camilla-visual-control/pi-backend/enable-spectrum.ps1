$ErrorActionPreference = "Stop"
$base = "http://piht.local:5005"
$names = @("camilladsp-tv.yml", "camilladsp-spotify.yml")

foreach ($name in $names) {
  $config = Invoke-RestMethod "$base/api/getconfigfile?name=$([uri]::EscapeDataString($name))"
  $backupBody = @{
    filename = "$name.pre-spectrum-20260728"
    config = $config
  } | ConvertTo-Json -Depth 100 -Compress
  Invoke-WebRequest -UseBasicParsing "$base/api/saveconfigfile" -Method Post -ContentType "application/json" -Body $backupBody | Out-Null
  $config.devices.playback.device = "camilla_tee"
  $json = $config | ConvertTo-Json -Depth 100 -Compress
  Invoke-WebRequest -UseBasicParsing "$base/api/validateconfig" -Method Post -ContentType "application/json" -Body $json | Out-Null
  $saveBody = @{filename = $name; config = $config} | ConvertTo-Json -Depth 100 -Compress
  Invoke-WebRequest -UseBasicParsing "$base/api/saveconfigfile" -Method Post -ContentType "application/json" -Body $saveBody | Out-Null
}

$original = Invoke-RestMethod "$base/api/getconfig"
$next = $original | ConvertTo-Json -Depth 100 | ConvertFrom-Json
$next.devices.playback.device = "camilla_tee"

try {
  $body = @{config = $next} | ConvertTo-Json -Depth 100 -Compress
  Invoke-WebRequest -UseBasicParsing "$base/api/setconfig" -Method Post -ContentType "application/json" -Body $body | Out-Null
  Start-Sleep -Seconds 3
  $status = Invoke-RestMethod "$base/api/status"
  if ($status.cdsp_status -ne "RUNNING") {
    throw "CamillaDSP state: $($status.cdsp_status)"
  }
  [pscustomobject]@{
    State = $status.cdsp_status
    Load = $status.processingload
    Playback = $next.devices.playback.device
  }
} catch {
  $rollback = @{config = $original} | ConvertTo-Json -Depth 100 -Compress
  Invoke-WebRequest -UseBasicParsing "$base/api/setconfig" -Method Post -ContentType "application/json" -Body $rollback | Out-Null
  throw
}
