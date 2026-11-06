# 星枢破甲工具 · 安装版构建脚本
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\installer\build-installer.ps1
#   powershell ... -Payload release\星枢破甲工具-便携版-5.0.0.zip -Out release\星枢破甲工具-安装版-5.0.0.exe
#
# 原理：先用 csc 把 Installer.cs 编成一个极小 stub（带品牌图标与版本信息），
# 再把便携版 zip 追加到 stub 末尾，最后写 32 字节 trailer（magic + 偏移 + 长度）。
# 运行时 stub 从自身尾部读出 zip 区段，用 System.IO.Compression 解压到
# %LOCALAPPDATA%\星枢破甲工具，建快捷方式、写卸载注册表项、生成卸载脚本。
#
# 不需要 NSIS / Inno / electron-builder，纯 .NET Framework（Windows 自带）。

[CmdletBinding()]
param(
    [string]$Payload = "",
    [string]$Out = "",
    [string]$Icon = "",
    [string]$Version = "5.0.0"
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$here = $PSScriptRoot

if (-not $Payload) { $Payload = Join-Path $root ("release\星枢破甲工具-便携版-$Version.zip") }
if (-not $Out) { $Out = Join-Path $root ("release\星枢破甲工具-安装版-$Version.exe") }
if (-not $Icon) { $Icon = Join-Path $root 'build\icon.ico' }

foreach ($f in @($Payload, $Icon, (Join-Path $here 'Installer.cs'))) {
    if (-not (Test-Path -LiteralPath $f)) { throw "缺少文件: $f" }
}

$csc = @(
    'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe',
    'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $csc) { throw '找不到 csc.exe（.NET Framework 4.x 自带）' }

$stub = Join-Path $here 'stub.exe'
Write-Host "[1/3] 编译 stub ..."
& $csc /nologo /target:winexe /platform:x64 /codepage:65001 /win32icon:$Icon `
    /out:$stub /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll `
    (Join-Path $here 'Installer.cs')
if ($LASTEXITCODE -ne 0) { throw "csc 编译失败: $LASTEXITCODE" }

Write-Host "[2/3] 追加载荷 ..."
$stubSize = (Get-Item -LiteralPath $stub).Length
$payloadSize = (Get-Item -LiteralPath $Payload).Length
if (Test-Path -LiteralPath $Out) { Remove-Item -LiteralPath $Out -Force }

$out = [IO.File]::Open($Out, [IO.FileMode]::Create)
try {
    $s = [IO.File]::OpenRead($stub); $s.CopyTo($out); $s.Dispose()
    $s = [IO.File]::OpenRead($Payload); $s.CopyTo($out); $s.Dispose()
    $trailer = [Text.Encoding]::ASCII.GetBytes('XSHUPKG1') +
        [BitConverter]::GetBytes([int64]$stubSize) +
        [BitConverter]::GetBytes([int64]$payloadSize) +
        (New-Object byte[] 8)
    $out.Write($trailer, 0, $trailer.Length)
} finally {
    $out.Dispose()
}

$final = (Get-Item -LiteralPath $Out).Length
Write-Host ("[3/3] 完成: " + $Out)
Write-Host ("      {0} bytes（stub {1} + 载荷 {2} + trailer 32）" -f $final, $stubSize, $payloadSize)
if ($final -ne ($stubSize + $payloadSize + 32)) { throw '产物大小不符，trailer 写入异常' }
Write-Host ("      SHA256: " + (Get-FileHash -LiteralPath $Out -Algorithm SHA256).Hash)
