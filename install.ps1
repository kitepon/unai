[CmdletBinding()]
param(
  [switch]$Uninstall,
  [ValidateSet('official', 'legacy')]
  [string]$Profile = 'official'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -lt 7) {
  throw 'unai installer requires PowerShell 7'
}

$repoUrl = 'https://github.com/kitepon/unai.git'
$dataDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'unai'
$wrapperMarker = '# unai installer managed wrapper'
$localSkill = if ($PSScriptRoot) {
  Join-Path $PSScriptRoot 'skills/unai/SKILL.md'
} else {
  $null
}

function Get-NormalizedPath {
  param([Parameter(Mandatory)][string]$Path)
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  if (Test-Path -LiteralPath $fullPath) {
    return (Resolve-Path -LiteralPath $fullPath).ProviderPath
  }
  return $fullPath
}

function Get-PathItem {
  param([Parameter(Mandatory)][string]$Path)
  return Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
}

function Test-OwnedLink {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$ExpectedTarget
  )
  $item = Get-PathItem -Path $Path
  if ($null -eq $item) { return $false }
  if ($item.LinkType -notin @('Junction', 'SymbolicLink')) { return $false }
  $target = @($item.Target)[0]
  if (-not $target) { return $false }
  if (-not [System.IO.Path]::IsPathRooted($target)) {
    $target = Join-Path (Split-Path -Parent $Path) $target
  }
  return (Get-NormalizedPath $target) -eq (Get-NormalizedPath $ExpectedTarget)
}

$commonTargets = @(
  (Join-Path $HOME '.claude/skills/unai'),
  (Join-Path $HOME '.grok/skills/unai'),
  (Join-Path $HOME '.cursor/skills/unai')
)
$officialCodexTarget = Join-Path $HOME '.agents/skills/unai'
$legacyCodexTarget = Join-Path $HOME '.codex/skills/unai'
$binDir = Join-Path $HOME '.local/bin'
$cliTarget = Join-Path $binDir 'unai.ps1'

# uninstallはclone/pullより先に処理し、このinstallerのcloneを指す配線だけを外す。
if ($Uninstall) {
  $uninstallSourceDir = if ($localSkill -and (Test-Path -LiteralPath $localSkill -PathType Leaf)) {
    $PSScriptRoot
  } else {
    $dataDir
  }
  $skillSource = Join-Path $uninstallSourceDir 'skills/unai'
  foreach ($target in @($commonTargets + $officialCodexTarget + $legacyCodexTarget)) {
    if (Test-OwnedLink -Path $target -ExpectedTarget $skillSource) {
      Remove-Item -LiteralPath $target -Force
      Write-Output "外した: $target"
    }
  }
  if (Test-Path -LiteralPath $cliTarget -PathType Leaf) {
    $head = @(Get-Content -LiteralPath $cliTarget -TotalCount 2)
    $expectedOwner = "# unai installer source: $(Get-NormalizedPath $uninstallSourceDir)"
    if ($head.Count -ge 2 -and $head[0] -eq $wrapperMarker -and $head[1] -eq $expectedOwner) {
      Remove-Item -LiteralPath $cliTarget -Force
      Write-Output "外した: $cliTarget"
    }
  }
  Write-Output "完了。このinstallerが繋いだ面だけを外した。実体 ($uninstallSourceDir) は残っている。"
  exit 0
}

$sourceOverride = $env:UNAI_INSTALL_SOURCE_DIR
if ($sourceOverride) {
  $overrideSkill = Join-Path $sourceOverride 'skills/unai/SKILL.md'
  if (-not (Test-Path -LiteralPath $overrideSkill -PathType Leaf)) {
    throw "UNAI_INSTALL_SOURCE_DIR does not contain skills/unai/SKILL.md: $sourceOverride"
  }
  $sourceDir = Get-NormalizedPath $sourceOverride
} elseif ($localSkill -and (Test-Path -LiteralPath $localSkill -PathType Leaf)) {
  $sourceDir = Get-NormalizedPath $PSScriptRoot
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
$codexTarget = if ($Profile -eq 'official') { $officialCodexTarget } else { $legacyCodexTarget }
$codexOpposite = if ($Profile -eq 'official') { $legacyCodexTarget } else { $officialCodexTarget }

function Install-SkillTarget {
  param([Parameter(Mandatory)][string]$Target)
  $parent = Split-Path -Parent $Target
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  $item = Get-PathItem -Path $Target
  if ($null -ne $item) {
    if ($item.LinkType -notin @('Junction', 'SymbolicLink')) {
      Write-Output "skip: $Target （実ファイルがあるため上書きしない）"
      return
    }
    Remove-Item -LiteralPath $Target -Force
  }
  New-Item -ItemType Junction -Path $Target -Target $skillSource | Out-Null
  Write-Output "繋いだ: $Target"
}

foreach ($target in $commonTargets) {
  Install-SkillTarget -Target $target
}

# Codexの公式面と旧面は同居させない。同じcloneの反対面だけは移行時に外す。
$codexOppositeItem = Get-PathItem -Path $codexOpposite
if ($null -ne $codexOppositeItem) {
  if (Test-OwnedLink -Path $codexOpposite -ExpectedTarget $skillSource) {
    $targetBlocked = $false
    $targetItem = Get-PathItem -Path $codexTarget
    if ($null -ne $targetItem) {
      $targetBlocked = $targetItem.LinkType -notin @('Junction', 'SymbolicLink')
    }
    if ($targetBlocked) {
      Write-Output "skip: $codexTarget （実ファイルがあるため反対profileを保持）"
    } else {
      Remove-Item -LiteralPath $codexOpposite -Force
      Write-Output "外した: $codexOpposite （反対profileの重複）"
      New-Item -ItemType Directory -Path (Split-Path -Parent $codexTarget) -Force | Out-Null
      Install-SkillTarget -Target $codexTarget
    }
  } else {
    Write-Output "skip: $codexTarget （反対profileに別のunaiがある: $codexOpposite）"
  }
} else {
  New-Item -ItemType Directory -Path (Split-Path -Parent $codexTarget) -Force | Out-Null
  Install-SkillTarget -Target $codexTarget
}

New-Item -ItemType Directory -Path $binDir -Force | Out-Null
$cliPath = Join-Path $sourceDir 'bin/unai.mjs'
$escapedCliPath = $cliPath.Replace("'", "''")
$wrapper = @(
  $wrapperMarker,
  "# unai installer source: $(Get-NormalizedPath $sourceDir)",
  "& node '$escapedCliPath' @args",
  'exit $LASTEXITCODE'
) -join "`n"
$canWriteCli = $true
$cliItem = Get-PathItem -Path $cliTarget
if ($null -ne $cliItem) {
  if ($cliItem.LinkType -in @('Junction', 'SymbolicLink')) {
    Remove-Item -LiteralPath $cliTarget -Force
  } elseif ($cliItem.PSIsContainer) {
    $canWriteCli = $false
  } else {
    $firstLine = Get-Content -LiteralPath $cliTarget -TotalCount 1
    $canWriteCli = $firstLine -eq $wrapperMarker
  }
}
if ($canWriteCli) {
  Set-Content -LiteralPath $cliTarget -Value $wrapper -Encoding utf8NoBOM
  Write-Output "繋いだ: $cliTarget"
} else {
  Write-Output "skip: $cliTarget （実ファイルがあるため上書きしない）"
}

& node $cliPath factory-diagnostics --json --profile $Profile
$diagnosticsExit = $LASTEXITCODE
if (-not $canWriteCli -or $diagnosticsExit -ne 0) {
  [Console]::Error.WriteLine('error: unaiのinstall projectionがreadyではない')
  exit 1
}

Write-Output '完了。4ホストのskill projectionはready。更新は同じinstallerの再実行でよい。'
