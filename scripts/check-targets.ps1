# check-targets.ps1 — 逐个目标体检：应用是否存在、注入点状态、提示词长度 vs 已知上限
#
# 用法：powershell -ExecutionPolicy Bypass -File scripts\check-targets.ps1
# 只读：不写任何文件，不改配置。

[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'
try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch { }

$home_ = $HOME
$memDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'memory'

function Get-Len([string]$name) {
    $p = Join-Path $memDir $name
    if (-not (Test-Path -LiteralPath $p)) { return @{ ok = $false; chars = 0 } }
    $t = [IO.File]::ReadAllText($p)
    return @{ ok = $true; chars = $t.Trim().Length }
}

$main = Get-Len '星枢记忆.md'
$doubao = Get-Len '豆包破甲.md'
$wb = Get-Len 'WorkBuddy破甲.md'

function Fmt-Bool($b) { if ($b) { '存在' } else { '—' } }

$rows = @()

function Add-Row($name, $app, $inject, $state, $limit) {
    $script:rows += [pscustomobject]@{
        目标     = $name
        应用     = $app
        注入点   = $inject
        当前注入 = $state
        提示词   = $limit
    }
}

# ---------- Codex ----------
$codex = Join-Path $home_ '.codex'
$cfg = Join-Path $codex 'config.toml'
$agents = Join-Path $codex 'AGENTS.md'
$st = Join-Path $codex 'managed-prompts\install-state.json'
$hasPointer = (Test-Path $cfg) -and ((Get-Content $cfg -Raw -ErrorAction SilentlyContinue) -match 'model_instructions_file')
$hasBlock = (Test-Path $agents) -and ((Get-Content $agents -Raw -ErrorAction SilentlyContinue) -match '星枢破甲注入开始')
Add-Row 'Codex' (Fmt-Bool (Test-Path $codex)) (Fmt-Bool ((Test-Path $cfg) -or (Test-Path $agents))) `
    $(if ($hasPointer -or $hasBlock) { '已注入' } else { '未注入' }) `
    ("主提示词 $($main.chars) 字符 / 无硬上限（文件级）")

# ---------- ZCode ----------
$zcode = Join-Path $home_ '.zcode'
$zcAgents = Join-Path $zcode 'AGENTS.md'
Add-Row 'ZCode' (Fmt-Bool (Test-Path $zcode)) (Fmt-Bool (Test-Path $zcode)) `
    $(if ((Test-Path $zcAgents) -and ((Get-Content $zcAgents -Raw -EA SilentlyContinue) -match '星枢')) { '已注入' } else { '未注入' }) `
    ("主提示词 $($main.chars) 字符 / 无硬上限（文件级）")

# ---------- Cursor ----------
$curRules = Join-Path $home_ '.cursor\rules'
$curCount = 0
if (Test-Path $curRules) { $curCount = @(Get-ChildItem $curRules -Filter *.mdc -EA SilentlyContinue).Count }
$legacy = Join-Path $home_ '.cursorrules'
Add-Row 'Cursor' (Fmt-Bool ((Test-Path $home_ '.cursor') -or (Test-Path $legacy))) (Fmt-Bool ((Test-Path $curRules) -or (Test-Path $legacy))) `
    ("规则文件 $curCount 个") ("主提示词 $($main.chars) 字符 / 未验证客户端上限")

# ---------- OpenCode ----------
$ocDir = Join-Path $home_ '.config\opencode'
$ocAgents = Join-Path $ocDir 'AGENTS.md'
Add-Row 'OpenCode' (Fmt-Bool (Test-Path $ocDir)) (Fmt-Bool (Test-Path $ocAgents)) `
    $(if ((Test-Path $ocAgents) -and ((Get-Content $ocAgents -Raw -EA SilentlyContinue) -match '星枢')) { '已注入' } else { '未注入' }) `
    ("主提示词 $($main.chars) 字符 / 无硬上限（文件级）")

# ---------- Claude ----------
$clDir = Join-Path $home_ '.claude'
$clMd = Join-Path $clDir 'CLAUDE.md'
Add-Row 'Claude' (Fmt-Bool (Test-Path $clDir)) (Fmt-Bool (Test-Path $clMd)) `
    $(if ((Test-Path $clMd) -and ((Get-Content $clMd -Raw -EA SilentlyContinue) -match '星枢')) { '已注入' } else { '未注入' }) `
    ("主提示词 $($main.chars) 字符 / 无硬上限（文件级）")

# ---------- WorkBuddy ----------
$wbDirs = @((Join-Path $home_ '.workbuddy-ai'), (Join-Path $home_ '.workbuddy')) | Where-Object { Test-Path $_ }
$wbMem = @()
foreach ($d in $wbDirs) { $wbMem += @(Get-ChildItem (Join-Path $d 'memory') -Filter '*_memory.md' -EA SilentlyContinue) }
Add-Row 'WorkBuddy' (Fmt-Bool ($wbDirs.Count -gt 0)) (Fmt-Bool ($wbMem.Count -gt 0)) `
    ("记忆档案 $($wbMem.Count) 个") ("精简版 $($wb.chars) 字符 / 上限 10000")

# ---------- DeepSeek Harness ----------
$dsh = Join-Path $home_ '.dsh'
$dshAgents = Join-Path $dsh 'AGENTS.md'
Add-Row 'DeepSeek Harness' (Fmt-Bool (Test-Path $dsh)) (Fmt-Bool (Test-Path $dshAgents)) `
    $(if ((Test-Path $dshAgents) -and ((Get-Content $dshAgents -Raw -EA SilentlyContinue) -match 'XINGSHU-INJECT')) { '已注入' } else { '未注入' }) `
    ("主提示词 $($main.chars) 字符 / 无硬上限（文件级）")

# ---------- DSH 完美破甲 ----------
$plugin = Join-Path $dsh 'plugins\xingshu-armor'
$plugState = if (Test-Path $plugin) { '插件已落盘' } else { '未安装' }
Add-Row 'DSH 完美破甲' (Fmt-Bool (Test-Path $dsh)) (Fmt-Bool (Test-Path $plugin)) $plugState `
    ("插件内置提示词 / 依赖 Node+pnpm（已自动准备）")

# ---------- 豆包 ----------
$dbState = Join-Path $home_ '.doubao\managed-prompts\state.json'
$dbInfo = '未注入'
if (Test-Path $dbState) {
    try {
        $j = Get-Content $dbState -Raw | ConvertFrom-Json
        $dbInfo = "已注入 $($j.chars) 字符"
    } catch { $dbInfo = '状态文件存在但不可解析' }
}
Add-Row '豆包' (Fmt-Bool ((Test-Path (Join-Path $env:LOCALAPPDATA 'Doubao')) -or (Get-Process Doubao -EA SilentlyContinue))) `
    (Fmt-Bool (Test-Path $dbState)) $dbInfo `
    ("精简版 $($doubao.chars) 字符 / 上限 12000")

# ---------- 输出 ----------
Write-Host ""
Write-Host "星枢破甲工具 · 目标体检（只读）" -ForegroundColor Cyan
Write-Host ("提示词：主 $($main.chars) 字符 · 豆包精简 $($doubao.chars) · WorkBuddy 精简 $($wb.chars)") -ForegroundColor DarkGray
Write-Host ""
$rows | Format-Table -AutoSize | Out-String -Width 200 | Write-Host

$need = @($rows | Where-Object { $_.当前注入 -eq '未注入' -or $_.应用 -eq '—' })
Write-Host ("检查 $($rows.Count) 个目标，需要处理 $($need.Count) 个。") -ForegroundColor $(if ($need.Count -eq 0) { 'Green' } else { 'Yellow' })
