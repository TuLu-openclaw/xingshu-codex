# -*- coding: utf-8 -*-
"""星枢破甲工具 · 打包脚本（Windows / CI 通用）

做四件事：
  1) 组出 release/win-unpacked（Electron 运行时 + resources/app + extraResources）
  2) 用 rcedit 写入品牌图标与版本信息
  3) 压成便携版 zip
  4) 调 scripts/installer/build-installer.ps1 出单文件安装版

用法：
  python scripts/package.py                   # 默认：便携版 + 安装版
  python scripts/package.py --skip-installer  # 只出便携版
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile

# CI（windows-latest）默认 stdout 是 cp1252，打中文会 UnicodeEncodeError，
# 这里统一改成 UTF-8；本地已支持时同样安全。
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE = os.path.join(ROOT, "release", "win-unpacked")
CACHE = os.path.join(ROOT, ".cache")
RCEDIT_URL = "https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe"
APP_EXE = "星枢破甲工具.exe"

COPY_FILES = [
    "install.ps1", "install-zcode.ps1", "install-cursor.ps1", "install-claude.ps1",
    "install-workbuddy.ps1", "install-doubao.ps1", "install-dsh.ps1",
    "install-opencode.ps1", "install-dsh-perfect.ps1",
]
COPY_DIRS = ["seep-kit", "memory", "kits"]
# 需要随包的运行时脚本（豆包注入守护等）
COPY_SCRIPTS = ["doubao-injector.js"]


def log(msg):
    print(msg, flush=True)


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def copytree(src, dst):
    if os.path.isdir(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore_dangling_symlinks=True)


def build_stage():
    electron = os.path.join(ROOT, "node_modules", "electron", "dist")
    if not os.path.isdir(electron):
        sys.exit("缺少 node_modules/electron/dist，请先 npm ci")
    if os.path.isdir(STAGE):
        shutil.rmtree(STAGE)
    shutil.copytree(electron, STAGE)
    log("[1/4] Electron 运行时已复制")

    res = os.path.join(STAGE, "resources")
    asar = os.path.join(res, "default_app.asar")
    if os.path.exists(asar):
        os.remove(asar)

    app_dir = os.path.join(res, "app")
    os.makedirs(app_dir, exist_ok=True)
    copytree(os.path.join(ROOT, "electron"), os.path.join(app_dir, "electron"))
    copytree(os.path.join(ROOT, "dist"), os.path.join(app_dir, "dist"))
    for f in ("package.json", "variant.json"):
        shutil.copy2(os.path.join(ROOT, f), os.path.join(app_dir, f))

    for f in COPY_FILES:
        src = os.path.join(ROOT, f)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(res, f))
        else:
            log("  [缺失] " + f)

    os.makedirs(os.path.join(res, "scripts"), exist_ok=True)
    for f in ("clear-injected-prompts.ps1", "prepare-env.ps1", *COPY_SCRIPTS):
        src = os.path.join(ROOT, "scripts", f)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(res, "scripts", f))
        else:
            log("  [缺失] scripts/" + f)

    icon = os.path.join(ROOT, "build", "icon.png")
    if os.path.exists(icon):
        shutil.copy2(icon, os.path.join(res, "icon.png"))

    lic = os.path.join(ROOT, "license.config.json")
    if os.path.exists(lic):
        shutil.copy2(lic, os.path.join(res, "license.config.json"))
        log("  已写入 license.config.json")
    else:
        log("  [!] 缺少 license.config.json —— 激活会提示未配置")

    for d in COPY_DIRS:
        src = os.path.join(ROOT, d)
        if os.path.isdir(src):
            copytree(src, os.path.join(res, d))
            log("  已复制 " + d)

    old = os.path.join(STAGE, "electron.exe")
    new = os.path.join(STAGE, APP_EXE)
    if not os.path.exists(old) and not os.path.exists(new):
        raise SystemExit("[错误] 打包目录里没有 electron.exe：" + STAGE + "（electron 依赖没装好？）")
    if os.path.exists(old):
        if os.path.exists(new):
            os.remove(new)
        os.rename(old, new)
    if not os.path.exists(new):
        raise SystemExit("[错误] 重命名后的主程序不存在：" + new)
    log("[2/4] 应用本体与资源就位")


def rcedit():
    exe = os.path.join(STAGE, APP_EXE)
    icon = os.path.join(ROOT, "build", "icon.ico")
    os.makedirs(CACHE, exist_ok=True)
    tool = os.path.join(CACHE, "rcedit-x64.exe")
    if not os.path.exists(tool):
        log("  下载 rcedit …")
        with urllib.request.urlopen(RCEDIT_URL, timeout=120) as r, open(tool, "wb") as f:
            shutil.copyfileobj(r, f)
    args = [
        tool, exe,
        "--set-icon", icon,
        "--set-file-version", "5.0.0.0",
        "--set-product-version", "5.0.0.0",
        "--set-version-string", "CompanyName", "星枢[未来科技]",
        "--set-version-string", "LegalCopyright", "Copyright © 星枢[未来科技]",
        "--set-version-string", "ProductName", "星枢破甲工具",
        "--set-version-string", "FileDescription", "星枢破甲工具",
        "--set-version-string", "OriginalFilename", APP_EXE,
        "--set-requested-execution-level", "asInvoker",
    ]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        msg = "rcedit 失败：" + (r.stderr or "")[:300]
        # CI 上必须成功，否则发出去就是个没图标没版本号的 exe
        if os.environ.get("REQUIRE_RCEDIT") == "1":
            raise SystemExit("[错误] " + msg)
        log("  [警告] " + msg)
    else:
        log("[3/4] 已写入 exe 图标与版本信息")


def make_zip(version):
    out = os.path.join(ROOT, "release", f"星枢破甲工具-便携版-{version}.zip")
    if os.path.exists(out):
        os.remove(out)
    n = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for root, _dirs, files in os.walk(STAGE):
            for f in files:
                p = os.path.join(root, f)
                z.write(p, os.path.relpath(p, STAGE))
                n += 1
    log(f"[4/4] 便携版 zip：{os.path.basename(out)}（{n} 个文件，{os.path.getsize(out)/1024/1024:.1f} MB）")
    return out


def make_installer(payload, version):
    """优先用 NSIS 出真正的安装包（向导页 / 目录选择 / 卸载项）；没有 NSIS 时退回自解压 stub。"""
    out = os.path.join(ROOT, "release", f"星枢破甲工具-安装版-{version}.exe")
    nsi = os.path.join(ROOT, "scripts", "installer", "xingshu.nsi")
    makensis = os.environ.get("MAKENSIS") or shutil.which("makensis")

    if makensis and os.path.exists(makensis) and os.path.exists(nsi):
        if os.path.exists(out):
            os.remove(out)
        cmd = [
            makensis, "/NOCD", "/INPUTCHARSET", "UTF8",
            f"/DAPP_VERSION={version}",
            "/DCOMPRESS_MODE=" + os.environ.get("NSIS_COMPRESS", "lzma"),
            os.path.relpath(nsi, ROOT),
        ]
        log("  NSIS 打包（首次约 3–8 分钟）…")
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
        if os.path.exists(out):
            log(f"  安装版：{os.path.basename(out)}（{os.path.getsize(out)/1024/1024:.1f} MB，NSIS）")
            return out
        log("  [警告] NSIS 构建失败，改用自解压 stub：" + ((r.stderr or r.stdout or "")[-400:]))
    else:
        log("  未找到 makensis，改用自解压 stub")

    ps = os.path.join(ROOT, "scripts", "installer", "build-installer.ps1")
    if not os.path.exists(ps):
        log("  [跳过] 没有 build-installer.ps1")
        return None
    cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps,
           "-Payload", payload, "-Out", out, "-Version", version,
           "-Icon", os.path.join(ROOT, "build", "icon.ico")]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        log("  [警告] 安装版构建失败：" + (r.stderr or r.stdout or "")[-400:])
        return None
    log("  安装版：" + os.path.basename(out))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-installer", action="store_true")
    args = ap.parse_args()

    pkg = read_json(os.path.join(ROOT, "package.json"))
    version = pkg["version"]
    os.makedirs(os.path.join(ROOT, "release"), exist_ok=True)

    build_stage()
    rcedit()
    zip_path = make_zip(version)
    if not args.skip_installer:
        make_installer(zip_path, version)

    log("完成。产物目录：release/")
    for f in sorted(os.listdir(os.path.join(ROOT, "release"))):
        p = os.path.join(ROOT, "release", f)
        if os.path.isfile(p):
            log(f"  {f}  {os.path.getsize(p)} bytes")


if __name__ == "__main__":
    main()
