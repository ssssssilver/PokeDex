param(
  [Parameter(Mandatory = $true)][string]$Bucket,
  [string]$Prefix = "pokechill",
  [switch]$SkipDataSync,
  [switch]$SkipAssetSync,
  [switch]$SkipDeckSync,
  [string]$Ossutil = "ossutil"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-NodeTool([string]$Tool, [string[]]$Arguments = @()) {
  & node (Join-Path $RepoRoot $Tool) @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Tool failed with exit code $LASTEXITCODE" }
}

if (-not $SkipDataSync) {
  Invoke-NodeTool "tools\sync-self-hosted-cache.js"
  Invoke-NodeTool "tools\sync-ptcg-data.js"
  Invoke-NodeTool "tools\sync-pocket-data.js"
}
if (-not $SkipDeckSync) {
  Invoke-NodeTool "tools\sync-hot-decks.js"
}
if (-not $SkipAssetSync) {
  Invoke-NodeTool "tools\sync-oss-assets.js"
}

Invoke-NodeTool "tools\build-oss-snapshot.js"
& (Join-Path $PSScriptRoot "publish-oss-static.ps1") -Bucket $Bucket -Prefix $Prefix -Ossutil $Ossutil
if ($LASTEXITCODE -ne 0) { throw "OSS publish failed with exit code $LASTEXITCODE" }
