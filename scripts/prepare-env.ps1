# prepare-env.ps1 — 破甲运行环境准备（Node / npm / pnpm）
#
# 激活成功后由主进程调用：复用随包 DSH 插件里的 ensure-runtime.ps1，
# 按当前机器架构（x64 / arm64 / x86）下载官方 Node LTS，校验 SHA256 后
# 解压到 %LOCALAPPDATA%\XingshuArmor\runtime，不改系统 PATH。
#
# 输出约定：进度行原样打到 stdout，最后一行以 RUNTIME_OK 开头。

[CmdletBinding()]
param(
    [string]$KitRoot
)

$ErrorActionPreference = 'Stop'

try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch { }

$here = $PSScriptRoot
if (-not $KitRoot) {
    $KitRoot = Join-Path (Split-Path $here -Parent) 'kits\dsh-perfect'
}
$ensure = Join-Path $KitRoot 'scripts\ensure-runtime.ps1'
if (-not (Test-Path -LiteralPath $ensure)) {
    Write-Host "[X] 缺少运行环境脚本：$ensure" -ForegroundColor Red
    exit 1
}

Write-Host "==> 检查本机 Node 运行环境" -ForegroundColor Cyan

try {
    . $ensure
    $rt = Ensure-XingshuRuntime
} catch {
    Write-Host ("[X] 运行环境准备失败：" + $_.Exception.Message) -ForegroundColor Red
    exit 1
}

if (-not $rt -or -not $rt.NodePath) {
    Write-Host "[X] 运行环境未就绪：未取得 Node 路径" -ForegroundColor Red
    exit 1
}

Write-Host ("     Node : " + $rt.NodePath)
Write-Host ("     npm  : " + $rt.NpmPath)
if ($rt.PnpmPath) { Write-Host ("     pnpm : " + $rt.PnpmPath) }
Write-Host ("RUNTIME_OK " + $rt.NodePath)
exit 0
