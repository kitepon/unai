[CmdletBinding()]
param(
  [switch]$Uninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -lt 7) {
  throw 'unai installer requires PowerShell 7'
}

$repoUrl = 'https://github.com/kitepon/unai.git'
$dataDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'unai'
$localSkill = Join-Path $PSScriptRoot 'skills/unai/SKILL.md'

if ($PSScriptRoot -and (Test-Path -LiteralPath $localSkill -PathType Leaf)) {
  $sourceDir = $PSScriptRoot
} elseif (Test-Path -LiteralPath (Join-Path $dataDir '.git') -PathType Container) {
  & git -C $dataDir pull --ff-only
  if ($LASTEXITCODE -ne 0) { throw 'git pull failed' }
  $sourceDir = $dataDir
} else {
  & git clone --depth 1 $repoUrl $dataDir
  if ($LASTEXITCODE -ne 0) { throw 'git clone failed' }
  $sourceDir = $dataDir
}

$skillSource = Join-Path $sourceDir 'skills/unai'
$targets = @(
  (Join-Path $HOME '.claude/skills/unai'),
  (Join-Path $HOME '.codex/skills/unai'),
  (Join-Path $HOME '.agents/skills/unai'),
  (Join-Path $HOME '.grok/skills/unai'),
  (Join-Path $HOME '.cursor/skills/unai')
)
$binDir = Join-Path $HOME '.local/bin'
$cliTarget = Join-Path $binDir 'unai.ps1'
$wrapperMarker = '# unai installer managed wrapper'

if ($Uninstall) {
  foreach ($target in $targets) {
    if (Test-Path -LiteralPath $target) {
      $item = Get-Item -LiteralPath $target -Force
      if ($item.LinkType -in @('Junction', 'SymbolicLink')) {
        Remove-Item -LiteralPath $target -Force
        Write-Output "外した: $target"
      }
    }
  }
  if (Test-Path -LiteralPath $cliTarget -PathType Leaf) {
    $firstLine = Get-Content -LiteralPath $cliTarget -TotalCount 1
    if ($firstLine -eq $wrapperMarker) {
      Remove-Item -LiteralPath $cliTarget -Force
      Write-Output "外した: $cliTarget"
    }
  }
  Write-Output "完了。実体 ($sourceDir) は残っている。不要なら削除してよい。"
  exit 0
}

foreach ($target in $targets) {
  $hostRoot = Split-Path -Parent (Split-Path -Parent $target)
  if (-not (Test-Path -LiteralPath $hostRoot -PathType Container)) {
    Write-Output "skip: $target （ホスト未導入）"
    continue
  }
  $parent = Split-Path -Parent $target
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  if (Test-Path -LiteralPath $target) {
    $item = Get-Item -LiteralPath $target -Force
    if ($item.LinkType -notin @('Junction', 'SymbolicLink')) {
      Write-Output "skip: $target （実ファイルがあるため上書きしない）"
      continue
    }
    Remove-Item -LiteralPath $target -Force
  }
  New-Item -ItemType Junction -Path $target -Target $skillSource | Out-Null
  Write-Output "繋いだ: $target"
}

New-Item -ItemType Directory -Path $binDir -Force | Out-Null
$cliPath = Join-Path $sourceDir 'bin/unai.mjs'
$escapedCliPath = $cliPath.Replace("'", "''")
$wrapper = @(
  $wrapperMarker,
  "& node '$escapedCliPath' @args",
  'exit $LASTEXITCODE'
) -join "`n"
Set-Content -LiteralPath $cliTarget -Value $wrapper -Encoding utf8NoBOM
Write-Output "繋いだ: $cliTarget"
Write-Output '完了。更新は同じinstallerの再実行でよい。'
