# NOTICE · 第三方组件与上游出处

星枢破甲工具（星枢[未来科技]）在构建时包含、并在部分模块上衍生自下列第三方成果。
本文件是这些许可证生效的前提，随全部副本一并分发。

---

## 一、上游项目

| 组件 | 权利人 / 维护者 | 许可证 | 与本项目的关系 |
|---|---|---|---|
| `hanshuang-codex`（寒霜破甲工具） | [aimeoa](https://github.com/aimeoa/hanshuang-codex) | README 声明 MIT | 本项目以其为技术基线：注入架构、9 个目标的安装/卸载脚本、Electron 桌面壳与界面样式均源自该项目，经重命名、重构与界面改造后以「星枢破甲工具」发布 |
| `Seep-Reverse-Lab` v1.6.0（`seep-kit/`） | [angusdevgo](https://github.com/angusdevgo/Seep-Reverse-Lab) | **GPL-3.0** | 作为独立子目录整包分发，未做重命名，其 `LICENSE` 原样保留于 `seep-kit/LICENSE` |
| `apk-reverse`（`seep-kit/Tool/upstream/`） | [newliver666](https://github.com/newliver666/apk-reverse) | MIT | Seep 工作台内置镜像 |
| `Open-tgtylab`（`seep-kit/Tool/upstream/`） | [GeniusHu-tgty](https://github.com/GeniusHu-tgty/Open-tgtylab) | GPL-3.0 | Seep 工作台内置镜像 |
| `open-reverselab`（`seep-kit/Tool/upstream/`） | [LING71671](https://github.com/LING71671/open-reverselab) | GPL-3.0 | Seep 工作台内置镜像 |

> GPL-3.0 组件（`seep-kit/` 及其内部镜像）的著作权归各自权利人，本项目不对其主张任何权利，
> 亦未更改其许可证文本与署名。其完整源码可在上述上游仓库获得。

## 二、运行时与库

| 组件 | 许可证 |
|---|---|
| Electron | MIT |
| React / React DOM | MIT |
| Vite / @vitejs/plugin-react | MIT |
| electron-builder | MIT |
| TypeScript | Apache-2.0 |
| lucide-react | ISC |

## 三、字体

| 字体 | 许可证 | 授权文本位置 |
|---|---|---|
| Geist | SIL OFL 1.1 | `src/assets/fonts/licenses/OFL-Geist.txt` |
| Inter | SIL OFL 1.1 | `src/assets/fonts/licenses/OFL-Inter.txt` |
| Noto Sans SC | SIL OFL 1.1 | `src/assets/fonts/licenses/OFL-NotoSansSC.txt` |
| LXGW WenKai | SIL OFL 1.1 | `src/assets/fonts/licenses/OFL-LXGWWenKai.txt` |

## 四、署名约定

- **本项目原创部分**（品牌、界面改造、构建脚本、文档、图标、提示词整合）：
  Copyright © 2026 星枢[未来科技]，署名「星枢」，按 MIT 授权。
- **上游衍生部分**：保留上游署名，不因本项目改名而移除其权利人信息。
- 如需以上游名义二次分发 `seep-kit/`，请遵守其 GPL-3.0 条款（保留许可证、提供对应源码）。

## HarmonyOS Sans 字体

界面中文字体使用华为发布的 HarmonyOS Sans SC（官方声明免费商用）。
字体文件在构建时下载，许可文本见 src/assets/fonts/LICENSE-HarmonyOS-Sans.txt。
