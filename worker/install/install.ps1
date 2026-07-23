# Chatwright CLI installer — the canonical Windows install path:
#
#   irm https://chatwright.dev/install.ps1 | iex
#
# Downloads the requested (default: latest) GoReleaser release artifact from
# github.com/chatwright/cli, verifies its SHA-256 against the release's
# checksums file, installs chatwright.exe under
# $env:LOCALAPPDATA\Programs\chatwright, and adds that directory to the
# user's PATH if missing.
#
# Environment overrides:
#   CHATWRIGHT_VERSION  release tag to install (e.g. v0.1.0); default: latest
#
# Alternative: go install chatwright.dev/cli/cmd/chatwright@latest

$ErrorActionPreference = 'Stop'

$repo = 'chatwright/cli'

$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -ne 'AMD64') {
  throw "install.ps1: unsupported architecture '$arch' — Windows releases are amd64-only; try: go install chatwright.dev/cli/cmd/chatwright@latest"
}

$version = $env:CHATWRIGHT_VERSION
if (-not $version) {
  $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
  $version = $latest.tag_name
  if (-not $version) { throw "install.ps1: could not determine the latest release of $repo" }
}
$bareVersion = $version -replace '^v', ''

$archive = "chatwright_${bareVersion}_windows_amd64.zip"
$checksums = "chatwright_${bareVersion}_checksums.txt"
$base = "https://github.com/$repo/releases/download/$version"

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("chatwright-install-" + [System.Guid]::NewGuid())
New-Item -ItemType Directory -Path $workDir | Out-Null
try {
  Write-Host "Downloading chatwright $version (windows/amd64)..."
  Invoke-WebRequest -Uri "$base/$archive" -OutFile (Join-Path $workDir $archive)
  Invoke-WebRequest -Uri "$base/$checksums" -OutFile (Join-Path $workDir $checksums)

  $checksumLine = Get-Content (Join-Path $workDir $checksums) | Where-Object { $_ -match [regex]::Escape($archive) }
  if (-not $checksumLine) { throw "install.ps1: no checksum for $archive in $checksums" }
  $expected = ($checksumLine -split '\s+')[0].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 (Join-Path $workDir $archive)).Hash.ToLowerInvariant()
  if ($expected -ne $actual) { throw "install.ps1: checksum mismatch for ${archive}: expected $expected, got $actual" }

  Expand-Archive -Path (Join-Path $workDir $archive) -DestinationPath $workDir -Force

  $installDir = Join-Path $env:LOCALAPPDATA 'Programs\chatwright'
  New-Item -ItemType Directory -Path $installDir -Force | Out-Null
  Copy-Item -Path (Join-Path $workDir 'chatwright.exe') -Destination (Join-Path $installDir 'chatwright.exe') -Force

  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (($userPath -split ';') -notcontains $installDir) {
    [Environment]::SetEnvironmentVariable('Path', "$userPath;$installDir", 'User')
    Write-Host "Added $installDir to your user PATH (restart your terminal to pick it up)."
  }

  Write-Host 'Installed:'
  & (Join-Path $installDir 'chatwright.exe') version
} finally {
  Remove-Item -Recurse -Force $workDir -ErrorAction SilentlyContinue
}
