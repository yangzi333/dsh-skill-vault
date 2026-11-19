# dsh-skill-vault 安装脚本
#   1) 复制插件到 ~/.dsh/plugins/dsh-skill-vault
#   2) 在 profile 的 package.json 里登记 dependency + bundle（先备份）
#   3) 在 profile 目录跑 pnpm install（pnpm 不在 PATH 时自动用 DSH 自带的 pnpm）
#   4) 校验 node_modules 里真的链接上了，避免「bundle 无法解析」的启动报错
# 幂等：重复跑只会刷新文件与登记项。加 -WhatIfOnly 只打印计划不动盘。

[CmdletBinding()]
param(
    [string]$ProfileDir = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop'),
    [string]$PluginDir = (Join-Path $env:USERPROFILE '.dsh\plugins\dsh-skill-vault'),
    [string]$Source = '',
    [switch]$SkipInstall,
    [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'
$pkgName = 'dsh-skill-vault'

function Write-Step([string]$text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Write-Warn([string]$text) { Write-Host "!!  $text" -ForegroundColor Yellow }

# ---------- 1. 复制插件 ----------
if ([string]::IsNullOrWhiteSpace($Source)) { $Source = if ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { (Get-Location).Path } }
$manifest = Join-Path $Source 'package.json'
if (-not (Test-Path -LiteralPath $manifest)) {
    throw "源目录里没有 package.json：$Source"
}
Write-Step "源目录 $Source"
Write-Step "目标目录 $PluginDir"
if (-not $WhatIfOnly) {
    if (Test-Path -LiteralPath $PluginDir) { Remove-Item -LiteralPath $PluginDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $PluginDir | Out-Null
    Copy-Item -Path (Join-Path $Source '*') -Destination $PluginDir -Recurse -Force
    foreach ($junk in @('install.ps1', 'install.cmd', 'uninstall.ps1', 'uninstall.cmd')) {
        $p = Join-Path $PluginDir $junk
        if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force }
    }
}

# ---------- 2. 改 profile package.json ----------
$profilePkg = Join-Path $ProfileDir 'package.json'
if (-not (Test-Path -LiteralPath $profilePkg)) {
    throw "找不到 profile 的 package.json：$profilePkg（用 -ProfileDir 指定正确的 profile）"
}
$raw = Get-Content -LiteralPath $profilePkg -Raw -Encoding UTF8
$json = $raw | ConvertFrom-Json

if ($null -eq $json.dependencies) {
    $json | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{}) -Force
}
$linkSpec = 'link:' + ($PluginDir -replace '\\', '/')
$json.dependencies | Add-Member -NotePropertyName $pkgName -NotePropertyValue $linkSpec -Force

if ($null -eq $json.dsh) {
    $json | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) -Force
}
if ($null -eq $json.dsh.profile) {
    $json.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{}) -Force
}
$bundles = @()
if ($null -ne $json.dsh.profile.bundles) { $bundles = @($json.dsh.profile.bundles) }
if ($bundles -notcontains $pkgName) { $bundles += $pkgName }
$json.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue $bundles -Force

Write-Step "登记 dependency: $pkgName -> $linkSpec"
Write-Step "登记 bundle: $pkgName"

if ($WhatIfOnly) {
    Write-Step "WhatIfOnly：不写盘、不装链接"
    $json | ConvertTo-Json -Depth 20
    return
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$profilePkg.bak-skillvault-$stamp"
Copy-Item -LiteralPath $profilePkg -Destination $backup -Force
Write-Step "已备份到 $backup"

$out = $json | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($profilePkg, $out + "`n", (New-Object System.Text.UTF8Encoding($false)))
Write-Step "已写入 $profilePkg"

# ---------- 3. 找 pnpm：PATH -> corepack -> DSH 自带 ----------
function Resolve-Pnpm {
    $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($null -ne $cmd) { return @{ Kind = 'exe'; Path = $cmd.Source } }

    $corepack = Get-Command corepack -ErrorAction SilentlyContinue
    if ($null -ne $corepack) { return @{ Kind = 'corepack'; Path = $corepack.Source } }

    # DSH 桌面端自带的 pnpm.cjs，用它的 node 跑
    $pnpmCandidates = @()
    if ($env:DSH_PNPM_CJS) { $pnpmCandidates += $env:DSH_PNPM_CJS }
    $appRoots = @(
        'G:\Deepseek Harness',
        (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'),
        (Join-Path $env:ProgramFiles 'DeepSeek Harness')
    )
    foreach ($root in $appRoots) {
        $pnpmCandidates += (Join-Path $root 'resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.cjs')
    }
    $nodeCandidates = @()
    if ($env:DSH_DESKTOP_NODE_EXECUTABLE) { $nodeCandidates += $env:DSH_DESKTOP_NODE_EXECUTABLE }
    foreach ($root in $appRoots) {
        $nodeCandidates += (Join-Path $root 'DeepSeek Harness.exe')
    }
    $pnpmCjs = $pnpmCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    $nodeExe = $nodeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($pnpmCjs -and $nodeExe) {
        return @{ Kind = 'node'; Path = $nodeExe; Pnpm = $pnpmCjs }
    }
    return $null
}

if ($SkipInstall) {
    Write-Step "跳过 pnpm install（-SkipInstall）"
} else {
    $runner = Resolve-Pnpm
    if ($null -eq $runner) {
        Write-Warn "没找到 pnpm / corepack / DSH 自带 pnpm。手动执行："
        Write-Host "   cd `"$ProfileDir`"; pnpm install" -ForegroundColor Yellow
    } else {
        Write-Step "在 profile 目录安装链接（runner: $($runner.Kind)）"
        Push-Location -LiteralPath $ProfileDir
        try {
            switch ($runner.Kind) {
                'exe' { & $runner.Path install --prefer-offline }
                'corepack' { & $runner.Path pnpm install --prefer-offline }
                'node' {
                    $env:ELECTRON_RUN_AS_NODE = '1'
                    try { & $runner.Path $runner.Pnpm install --prefer-offline } finally { Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue }
                }
            }
            if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "pnpm install 退出码 $LASTEXITCODE" }
        } finally {
            Pop-Location
        }
    }
}

# ---------- 4. 校验链接 ----------
$linked = Join-Path $ProfileDir "node_modules\$pkgName"
if (Test-Path -LiteralPath $linked) {
    $target = (Get-Item -LiteralPath $linked -Force).Target
    Write-Step "已链接：node_modules\$pkgName -> $target"
    Write-Step "完成。重启 DeepSeek Harness 后侧边栏出现「技能库」。"
    Write-Host "   自检端点： http://127.0.0.1:59893/skill-vault/ping" -ForegroundColor DarkGray
} else {
    Write-Warn "node_modules\$pkgName 还不存在 —— 启动时会报『cannot resolve profile bundle』。"
    Write-Warn "在 $ProfileDir 里手动跑一次： pnpm install"
    exit 1
}
