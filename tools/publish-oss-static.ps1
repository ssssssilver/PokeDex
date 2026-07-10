param(
  [Parameter(Mandatory = $true)][string]$Bucket,
  [string]$Prefix = "pokechill",
  [string]$OutputDir = "",
  [string]$DataDir = "",
  [string]$Ossutil = "ossutil",
  [switch]$SkipAssets
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDir) { $OutputDir = Join-Path $RepoRoot "dist\oss" }
if (-not $DataDir) { $DataDir = Join-Path $RepoRoot "server\.data" }
$OutputDir = [IO.Path]::GetFullPath($OutputDir)
$DataDir = [IO.Path]::GetFullPath($DataDir)
$ManifestPath = Join-Path $OutputDir "manifest.json"

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
  throw "OSS snapshot manifest was not found: $ManifestPath"
}
if (-not (Get-Command $Ossutil -ErrorAction SilentlyContinue)) {
  throw "ossutil was not found. Install and configure Alibaba Cloud ossutil first."
}

$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$Version = [string]$Manifest.version
$ReleaseDir = Join-Path $OutputDir ("releases\" + $Version)
if (-not (Test-Path -LiteralPath $ReleaseDir -PathType Container)) {
  throw "Release directory was not found: $ReleaseDir"
}

$CleanPrefix = $Prefix.Trim("/")
$RootUri = if ($CleanPrefix) { "oss://$Bucket/$CleanPrefix" } else { "oss://$Bucket" }

function Copy-OssDirectory([string]$Source, [string]$Destination) {
  if (-not (Test-Path -LiteralPath $Source -PathType Container)) { return }
  $SourceWithSlash = $Source.TrimEnd([char[]]"\/") + [IO.Path]::DirectorySeparatorChar
  & $Ossutil cp -r -u -j 10 $SourceWithSlash $Destination
  if ($LASTEXITCODE -ne 0) { throw "ossutil failed while uploading $Source" }
}

Write-Host "Uploading immutable release $Version ..."
Copy-OssDirectory $ReleaseDir "$RootUri/releases/$Version/"

if (-not $SkipAssets) {
  Copy-OssDirectory (Join-Path $DataDir "oss-assets") "$RootUri/assets/"
  Copy-OssDirectory (Join-Path $DataDir "artwork") "$RootUri/assets/pokemon/artwork/"
  Copy-OssDirectory (Join-Path $RepoRoot "server\assets\local-pokemon") "$RootUri/assets/local-pokemon/"
  Copy-OssDirectory (Join-Path $DataDir "projectpokemon-3d\images\normal") "$RootUri/assets/pokemon/3d/normal/"
  Copy-OssDirectory (Join-Path $DataDir "projectpokemon-3d\images\shiny") "$RootUri/assets/pokemon/3d/shiny/"
}

Write-Host "Switching manifest last ..."
& $Ossutil cp -f $ManifestPath "$RootUri/manifest.json" --cache-control "no-cache" --content-type "application/json"
if ($LASTEXITCODE -ne 0) { throw "ossutil failed while switching manifest.json" }

Write-Host "Published $Version to $RootUri"
