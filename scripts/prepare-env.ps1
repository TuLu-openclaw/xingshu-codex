# prepare-env.ps1 — 破甲运行环境一键准备（Node / Python / pip 依赖）
#
# 激活成功后由主进程调用，全部静默：
#   1) Node ≥ 22 + npm + pnpm        —— 复用随包 DSH 插件的 ensure-runtime.ps1
#   2) Python ≥ 3.9 + pip            —— 优先用系统 python；没有就下官方 embeddable 包（免安装、免管理员）
#   3) pip 依赖                      —— mcp / pytest / frida-tools（Seep 工作台与 Hook 需要）
#
# 参数：
#   -DryRun   只检测不下载不安装（排障用）
#   -SkipPip  只准备运行时，不装 pip 依赖
#   -IndexUrl 指定 pip 源
#
# 输出约定：进度行原样打到 stdout，关键结果行以 NODE_OK / PYTHON_OK / DEPS_OK 开头。

[CmdletBinding()]
param(
    [string]$KitRoot,
    [string]$IndexUrl,
    [switch]$SkipPip,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch { }

$here = $PSScriptRoot
if (-not $KitRoot) { $KitRoot = Join-Path (Split-Path $here -Parent) 'kits\dsh-perfect' }
if (-not $env:LOCALAPPDATA) { throw '未找到 LOCALAPPDATA' }
$RuntimeRoot = Join-Path $env:LOCALAPPDATA 'XingshuArmor'
$PythonRoot = Join-Path $RuntimeRoot 'python'
$PyVersion = '3.12.8'
$MirrorIndex = 'https://pypi.tuna.tsinghua.edu.cn/simple'

function Write-Step([string]$m) { Write-Host ("==> " + $m) -ForegroundColor Cyan }
function Write-Ok([string]$m) { Write-Host ("    [OK] " + $m) -ForegroundColor Green }
function Write-Warn2([string]$m) { Write-Host ("    [!!] " + $m) -ForegroundColor Yellow }

function Invoke-Native {
    # 原生命令的 stderr 在 $ErrorActionPreference=Stop 下会被当成终止错误，
    # 这里单独降级为 Continue，只认退出码。
    param([string]$Exe, [string[]]$Arguments)
    $prev = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $Exe @Arguments 2>&1 | Out-Null
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Get-Arch {
    $a = $env:PROCESSOR_ARCHITEW6432
    if (-not $a) { $a = $env:PROCESSOR_ARCHITECTURE }
    switch ($a.ToUpperInvariant()) {
        'ARM64' { return 'arm64' }
        'AMD64' { return 'x64' }
        'X64' { return 'x64' }
        'X86' { return 'x86' }
        default { throw "无法识别系统架构：$a" }
    }
}

# ---------------------------------------------------------------- 1) Node
Write-Step '检查 Node 运行环境'
$ensure = Join-Path $KitRoot 'scripts\ensure-runtime.ps1'
if (Test-Path -LiteralPath $ensure) {
    if ($DryRun) {
        Write-Host '    [dry-run] 跳过 Node 实际准备'
    } else {
        try {
            . $ensure
            $rt = Ensure-XingshuRuntime
            if ($rt -and $rt.NodePath) {
                Write-Ok ("Node 就绪：" + $rt.NodePath)
                Write-Host ("NODE_OK " + $rt.NodePath)
            } else {
                Write-Warn2 'Node 未就绪'
            }
        } catch {
            Write-Warn2 ("Node 准备失败：" + $_.Exception.Message)
        }
    }
} else {
    Write-Warn2 ("缺少 ensure-runtime.ps1：" + $ensure)
}

# ---------------------------------------------------------------- 2) Python
Write-Step '检查 Python 运行环境'

function Test-PythonAt([string]$exe) {
    if (-not $exe -or -not (Test-Path -LiteralPath $exe)) { return $null }
    try {
        $v = (& $exe --version 2>&1 | Out-String).Trim()
    } catch { return $null }
    if ($v -notmatch 'Python\s+(\d+)\.(\d+)') { return $null }
    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 9)) { return $null }
    return [pscustomobject]@{ Path = $exe; Version = ("$major.$minor") }
}

$python = $null
$sysPy = Get-Command python.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($sysPy) { $python = Test-PythonAt $sysPy.Source }
if (-not $python) {
    $cached = Join-Path $PythonRoot 'python.exe'
    $python = Test-PythonAt $cached
}

if ($python) {
    Write-Ok ("复用已有 Python " + $python.Version + "：" + $python.Path)
} elseif ($DryRun) {
    Write-Warn2 '系统没有 Python（dry-run 不下载）'
} else {
    $arch = Get-Arch
    $zipName = "python-$PyVersion-embed-$arch.zip"
    $url = "https://www.python.org/ftp/python/$PyVersion/$zipName"
    Write-Host ("    系统未安装 Python，下载便携运行时：" + $zipName)
    New-Item -ItemType Directory -Force -Path $PythonRoot | Out-Null
    $zipPath = Join-Path $RuntimeRoot $zipName
    try {
        Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing -TimeoutSec 300
        if (Test-Path -LiteralPath $PythonRoot) {
            Get-ChildItem -LiteralPath $PythonRoot -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }
        Expand-Archive -LiteralPath $zipPath -DestinationPath $PythonRoot -Force
        Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue

        # embeddable 默认禁用 site-packages：改 ._pth 打开，pip 装的包才 import 得到
        $pth = Get-ChildItem -LiteralPath $PythonRoot -Filter 'python*._pth' -File | Select-Object -First 1
        if ($pth) {
            $lines = Get-Content -LiteralPath $pth.FullName
            if ($lines -notcontains 'Lib\site-packages') { $lines += 'Lib\site-packages' }
            if ($lines -notcontains 'import site') { $lines += 'import site' }
            Set-Content -LiteralPath $pth.FullName -Value $lines -Encoding ASCII
        }

        $getPip = Join-Path $RuntimeRoot 'get-pip.py'
        Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $getPip -UseBasicParsing -TimeoutSec 120
        Invoke-Native (Join-Path $PythonRoot 'python.exe') @($getPip, '--no-warn-script-location') | Out-Null
        Remove-Item -LiteralPath $getPip -Force -ErrorAction SilentlyContinue

        $python = Test-PythonAt (Join-Path $PythonRoot 'python.exe')
        if ($python) { Write-Ok ("便携 Python 就绪：" + $python.Path) }
        else { Write-Warn2 '便携 Python 安装失败' }
    } catch {
        Write-Warn2 ("Python 下载/安装失败：" + $_.Exception.Message)
    }
}

if ($python) { Write-Host ("PYTHON_OK " + $python.Path + " " + $python.Version) }

# ---------------------------------------------------------------- 3) pip 依赖
if (-not $SkipPip -and $python) {
    Write-Step '安装 pip 依赖（mcp / pytest / frida-tools）'
    if ($DryRun) {
        Write-Host '    [dry-run] 跳过 pip install'
    } else {
        $pkgs = @('mcp>=1.20,<1.29', 'pytest', 'frida-tools')
        $failed = @()
        foreach ($pkg in $pkgs) {
            Write-Host ("    pip install " + $pkg)
            $code = Invoke-Native $python.Path @('-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', $pkg)
            if ($code -ne 0) {
                Write-Warn2 ("默认源失败，换清华源：" + $pkg)
                $extra = @()
                if ($IndexUrl) { $extra = @('-i', $IndexUrl) } else { $extra = @('-i', $MirrorIndex) }
                $code = Invoke-Native $python.Path (@('-m', 'pip', 'install', '--quiet', '--disable-pip-version-check') + $extra + @($pkg))
            }
            if ($code -eq 0) { Write-Ok ($pkg + ' 已安装') } else { $failed += $pkg }
        }
        if ($failed.Count -eq 0) {
            Write-Host 'DEPS_OK all'
        } else {
            Write-Warn2 ('未装成功：' + ($failed -join ', '))
            Write-Host ('DEPS_PARTIAL ' + ($failed -join ','))
        }
    }
} elseif ($SkipPip) {
    Write-Warn2 '已跳过 pip 依赖（-SkipPip）'
}

Write-Step '准备完成'
exit 0
