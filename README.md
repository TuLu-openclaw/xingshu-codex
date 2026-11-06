# 星枢破甲工具（免费版）

> **版权：星枢[未来科技]　署名：星枢**
> 基于开源项目 `hanshuang-codex` 重构的品牌化版本，第三方组件与上游出处见 [NOTICE.md](NOTICE.md)。

独立项目，不依赖任何外部文件夹。界面沿用了 PI-Desktop 的设计系统（`src/styles/` 下的 tokens / ui-kit / settings 等样式表原样保留），
功能由 `electron/main.cjs` 调用同级目录的 PowerShell 脚本完成。

## 这个版本是什么

**提示词自带版**：提示词不随包分发，安装时从 `memory/` 目录读取 —— 把提示词正文粘进 `memory/星枢记忆.md`
（或该目录下任意非空 `.md`），安装时按目标注入。
技能库改用随包的 **Seep 逆向工作台**（`seep-kit/`）里的技能：
`apkseep` / `softseep` / `ida-reverse` / `client-license-validation-bypass` / `safe-skills`。

九个破甲目标（Codex / ZCode / Cursor / OpenCode / Claude / WorkBuddy 国际版 /
WorkBuddy 国内版 / DeepSeek Harness / 豆包）都可安装 / 卸载：

| 能力 | 入口 | 说明 |
|---|---|---|
| 安装 | 各目标页的安装按钮 | `install*.ps1 -SourcePrompt memory/星枢记忆.md` + 随包技能库 |
| 卸载 | 各目标页的卸载按钮 | `install*.ps1 -Uninstall` + `clear-injected-prompts.ps1` 兜底清扫 |
| 装回原始记忆 | 各目标页的「装回原始记忆」 | 还原安装前备份，技能库保留 |
| Skills 管理 | Skills 管理页 | 查看 / 启停本机 Codex 技能 |
| Seep 工作台 | Seep 逆向工作台页 | 部署 / 自检 / 卸载整条逆向工具链 |

OpenCode 的注入点是 `~/.config/opencode/AGENTS.md`（可用 `XDG_CONFIG_HOME` 改），
技能落 `~/.config/opencode/skills`（OpenCode 按 `{skill,skills}/**/SKILL.md` 发现）。

记忆文件为空时安装会直接报错，不会写入半成品。卸载与还原不依赖随包提示词文件
（脚本在卸载/还原模式下跳过提示词解析）；用户自己写进 AGENTS.md / CLAUDE.md /
记忆档案的内容一律保留。

## 目录

```
electron/     主进程、preload、PowerShell 调度、压缩守报、WorkBuddy 记忆守护
src/          渲染层（React）
  data/       目标与版本文档
  pages/      破甲详情页 / Skills 管理 / 使用教程 / 个人中心
  styles/     PI-Desktop 的样式表 + app.css
  assets/     界面用的字标图
scripts/      构建与图标脚本、残留清理
build/        图标源文件（png / ico）
install*.ps1  安装 / 卸载 / 装回原始记忆脚本（打包时随 extraResources 进包）
seep-kit/     随包的 Seep 逆向工作台（含 setup 安装/卸载/自检脚本与离线工具链）
memory/       提示词正文，安装时注入（打包时随 extraResources 进包）
```

## Seep 逆向工作台

`seep-kit/` 是原样随包的 [Seep-Reverse-Lab](https://github.com/angusdevgo/Seep-Reverse-Lab)
v1.6.0：MCP 服务（Radare2 / JADX / Apktool / Frida 封装）、9 个技能、战术知识库、
14 个脱敏案例工程与 MANUAL 手册。
界面上的「部署工作台」执行 `seep-kit/setup/install.ps1 -NonInteractive`：解压离线依赖 →
装 Python 依赖 → 写 `~/.pi/agent`（技能 / 提示词 / MCP）→ 生成 Claude Code / DSH / OpenCode 配置 → 自检。
「自检」与「卸载」分别走 `setup/verify.ps1 -Detailed` 与 `setup/uninstall.ps1 -Yes`。

> `seep-kit/` 采用 **GPL-3.0**，其 `LICENSE` 原样保留；本项目不对其重命名或再授权。

## 开发

```bash
npm install
npm run dev            # 起 Vite 开发服务器
npm run build          # 只构建渲染层到 dist/
npx electron .         # 跑起来（默认加载 dist/）
HS_DEV=1 npx electron .  # 连开发服务器
```

## 打包

```bash
npm run dist
```

产物落在本文件夹的 `release/`：

- `星枢破甲工具-便携版-<版本>.zip` —— 由 `win-unpacked` 直接打包，解压即用

便携版没有安装器，删文件夹不等于卸载干净：`portable-uninstall.ps1` + 同目录
`卸载-便携版.bat` 会一并清掉 `%APPDATA%\xingshu-free`、状态文件与快捷方式。

### 安装版（单文件 exe）

```powershell
# 先用 scripts\build.mjs 出便携版 zip，再把它包成自解压安装包
powershell -ExecutionPolicy Bypass -File scripts\installer\build-installer.ps1
```

产物：`release\星枢破甲工具-安装版-<版本>.exe`。

- 单文件自解压：`stub.exe`（csc 编译，带品牌图标与版本信息）+ 便携版 zip + 32 字节 trailer
- 安装到 `%LOCALAPPDATA%\星枢破甲工具`，建桌面 / 开始菜单快捷方式，写 HKCU 卸载项
- 支持静默：`/silent`、`/nolaunch`、`/dir <路径>`；提取自检：`/extract <目录>`
- 卸载：开始菜单「卸载」或 `设置 → 应用`，卸载脚本在安装目录 `uninstall.ps1`
- 不依赖 NSIS / Inno / electron-builder

换图标：替换 `build/icon.png`（512×512 方形 PNG）后重新 `npm run dist` 即可，
或直接跑 `python scripts/make-icon.py` / `python scripts/make-ico.py` 重建。

## 署名与许可证

- 版权：**星枢[未来科技]**（XingShu Future Technology）
- 署名：**星枢**
- 本项目原创部分按 [MIT](LICENSE) 授权；第三方组件按其各自许可证授权，见 [NOTICE.md](NOTICE.md)。

---

如有问题，请提交 issue；本工具仅在本机运行，不做任何联网上报。
