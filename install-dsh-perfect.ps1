# install-dsh-perfect.ps1 — DSH 完美破甲（随包 xingshu-armor 插件）
#
# 随包的 kits\dsh-perfect 是「星枢破甲」DSH 插件（xingshu-armor v0.4.3），
# 自带 Node 运行环境自动下载（scripts/ensure-runtime.ps1）。
#
# 与其它目标的差异：本目标不注入提示词文件，而是把插件装进
# %USERPROFILE%\.dsh\plugins\xingshu-armor 并给 profile 打 Cordis 补丁。
#
# 用法：
#   .\install-dsh-perfect.ps1              # 安装
#   .\install-dsh-perfect.ps1 -Uninstall   # 卸载

[CmdletBinding()]
param(
    [switch]$Uninstall,
    # 与其他目标保持接口一致；本目标不使用提示词文件
    [string]$SourcePrompt,
    [string]$SkillsSource,
    [switch]$RestoreMemory
)

$ErrorActionPreference = 'Stop'

# 统一 UTF-8 输出，避免宿主按 GBK 解码成乱码
try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch { }

$here = $PSScriptRoot
$kit = Join-Path $here 'kits\dsh-perfect'
if (-not (Test-Path -LiteralPath $kit)) {
    # 打包后脚本位于 resources\，随包目录同级
    $kit = Join-Path (Split-Path $PSCommandPath -Parent) 'kits\dsh-perfect'
}
if (-not (Test-Path -LiteralPath $kit)) {
    Write-Host "[X] 随包缺少 DSH 插件目录：$kit" -ForegroundColor Red
    exit 1
}

# 宿主进程不是交互式控制台：让插件安装脚本不要弹「按回车退出」也不要问序号
$env:XS_SILENT = '1'

# 预先选好 profile，避免插件脚本进入交互分支
if (-not $env:DSH_PROFILE) {
    $profilesRoot = Join-Path $HOME '.dsh\profiles'
    if (Test-Path -LiteralPath $profilesRoot) {
        foreach ($name in @('web', 'default', 'desktop')) {
            $cand = Join-Path $profilesRoot $name
            if (Test-Path -LiteralPath (Join-Path $cand 'package.json')) {
                $env:DSH_PROFILE = $name
                break
            }
        }
    }
}

$target = if ($Uninstall -or $RestoreMemory) { 'uninstall.ps1' } else { 'install.ps1' }
$scriptPath = Join-Path $kit $target
if (-not (Test-Path -LiteralPath $scriptPath)) {
    Write-Host "[X] 缺少插件脚本：$scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host ("==> DSH 完美破甲：" + $(if ($Uninstall -or $RestoreMemory) { '卸载' } else { '安装' })) -ForegroundColor Cyan
Write-Host ("    插件目录：" + $kit)
if ($env:DSH_PROFILE) { Write-Host ("    目标 profile：" + $env:DSH_PROFILE) }

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath
$code = $LASTEXITCODE

if ($code -ne 0) {
    Write-Host ("[X] 插件脚本退出码 " + $code) -ForegroundColor Red
}
exit $code
