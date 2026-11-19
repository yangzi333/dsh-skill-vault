# dsh-skill-vault 卸载脚本：从 profile 移除登记项并删插件目录（不碰 ~/.dsh/skills）。

[CmdletBinding()]
param(
    [string]$ProfileDir = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop'),
    [string]$PluginDir = (Join-Path $env:USERPROFILE '.dsh\plugins\dsh-skill-vault'),
    [switch]$KeepPluginDir,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$pkgName = 'dsh-skill-vault'

function Write-Step([string]$text) { Write-Host "==> $text" -ForegroundColor Cyan }

$profilePkg = Join-Path $ProfileDir 'package.json'
if (Test-Path -LiteralPath $profilePkg) {
    $raw = Get-Content -LiteralPath $profilePkg -Raw -Encoding UTF8
    $json = $raw | ConvertFrom-Json
    $changed = $false

    if ($null -ne $json.dependencies -and $null -ne $json.dependencies.$pkgName) {
        $json.dependencies.PSObject.Properties.Remove($pkgName)
        $changed = $true
        Write-Step "移除 dependency: $pkgName"
    }
    if ($null -ne $json.dsh -and $null -ne $json.dsh.profile -and $null -ne $json.dsh.profile.bundles) {
        $bundles = @($json.dsh.profile.bundles) | Where-Object { $_ -ne $pkgName }
        $json.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue @($bundles) -Force
        $changed = $true
        Write-Step "移除 bundle: $pkgName"
    }

    if ($changed) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        Copy-Item -LiteralPath $profilePkg -Destination "$profilePkg.bak-skillvault-$stamp" -Force
        $out = $json | ConvertTo-Json -Depth 20
        [System.IO.File]::WriteAllText($profilePkg, $out + "`n", (New-Object System.Text.UTF8Encoding($false)))
        Write-Step "已写入 $profilePkg（备份 .bak-skillvault-$stamp）"
    } else {
        Write-Step "profile 里没有 $pkgName 的登记项"
    }
}

if (-not $KeepPluginDir -and (Test-Path -LiteralPath $PluginDir)) {
    Remove-Item -LiteralPath $PluginDir -Recurse -Force
    Write-Step "已删除 $PluginDir"
}

if ($SkipInstall) { return }
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if ($null -ne $pnpm) {
    Push-Location -LiteralPath $ProfileDir
    try { & pnpm install } finally { Pop-Location }
    Write-Step "链接已刷新"
} else {
    Write-Host "!! 没找到 pnpm，手动执行： cd `"$ProfileDir`"; pnpm install" -ForegroundColor Yellow
}

Write-Step "完成。重启 DeepSeek Harness 生效。"
