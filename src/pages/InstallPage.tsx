import type { Target } from "../data/targets";
import { useEffect, useState } from "react";
import type { StatusLevel } from "../App";
import { hs, type MemoryPrompt } from "../lib/hs";
import { cx } from "../lib/cx";

type Props = {
  target: Target;
  installed?: string | boolean;
  memory: MemoryPrompt;
  busy: boolean;
  status: string;
  level: StatusLevel;
  logText: string;
  onInstall: () => void;
  onUninstall: () => void;
  onRestoreMemory: () => void;
  onRestart: () => void;
};

export function InstallPage({
  target,
  installed,
  memory,
  busy,
  status,
  level,
  logText,
  onInstall,
  onUninstall,
  onRestoreMemory,
  onRestart,
}: Props) {
  const isInstalled = Boolean(installed);
  const [downloadNote, setDownloadNote] = useState("");

  // 切目标就清掉上一条下载提示
  useEffect(() => { setDownloadNote(""); }, [target.id]);

  return (
    <>
      <h1 className="settings-section-title">{target.title}</h1>

      <div className="settings-card-block">
        <div className="settings-card-heading-row">
          <div>
            <h2 className="settings-card-heading">版本</h2>
            <p className="settings-card-description">{target.desc}</p>
          </div>
          <span className={cx("badge", isInstalled ? "badge-success" : "badge-neutral")}>
            {isInstalled
              ? "曾安装" + (typeof installed === "string" ? " · " + installed : "")
              : "未安装"}
          </span>
        </div>

        {/* 提示词来源：memory/ 下用户自己填的那一份 */}
        <div className="settings-panel">
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">
                {memory ? "记忆文件 · " + memory.name : "记忆文件 · 还没填"}
              </div>
              <div className="settings-row-desc">
                {memory
                  ? "已读取 " + memory.chars + " 字；安装时会连同 Seep 工作台技能库一起写入该目标。"
                  : "把提示词粘进随包的 memory 目录下的 .md 文件（默认「星枢记忆.md」）后再点安装。"}
              </div>
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">依赖</div>
              <div className="settings-row-desc">
                {target.requires
                  ? target.requires
                  : "无额外依赖：本目标只写配置文件与技能目录，不需要额外运行时。"}
              </div>
            </span>
          </div>
        </div>

        <div className="app-inline-actions">
          {target.downloadUrl ? (
            <button
              type="button"
              className="btn btn-secondary"
              title={target.downloadAltMode === "auto" && target.downloadAltUrl
                ? "主链接不通会自动改用备用线路下载"
                : undefined}
              onClick={() => {
                const url = target.downloadUrl as string;
                const alt = target.downloadAltMode === "auto" ? target.downloadAltUrl : undefined;
                hs.openDownload(url, alt)
                  .then((r) => {
                    if (r && r.ok && r.usedAlt) {
                      setDownloadNote("主链接不通，已自动改用备用线路下载");
                    }
                  })
                  .catch(() => hs.openQQ(url));
              }}
            >
              {target.downloadLabel || "下载应用"}
            </button>
          ) : null}
          {target.downloadAltUrl && target.downloadAltMode !== "auto" ? (
            <button
              type="button"
              className="btn btn-secondary"
              title="官方只提供最新版；这是第三方历史版本页，下载后请自行校验哈希并杀毒"
              onClick={() => hs.openQQ(target.downloadAltUrl as string)}
            >
              {target.downloadAltLabel || "历史版本"}
            </button>
          ) : null}
          {target.id === "codex" && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onRestart}>
              重启 Codex
            </button>
          )}
          {/* 安装：提示词来自 memory/，技能库来自随包的 Seep 工作台 */}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onInstall}>
            安装
          </button>
          {/* 装回原始记忆：只把注入的内容还原成原版，技能库保留 */}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={onRestoreMemory}
          >
            装回原始记忆
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onUninstall}>
            {target.uninstallLabel}
          </button>
        </div>
        {downloadNote ? (
          <p className="settings-card-description" style={{ marginTop: 10, color: "#0f7a4a" }}>
            {downloadNote}
          </p>
        ) : null}
      </div>

      <div className="settings-card-block">
        <div className="settings-card-heading-row">
          <div>
            <h2 className="settings-card-heading">运行状态</h2>
            <p className="settings-card-description">
              {status}
              {level === "err" ? "（详见下方日志）" : ""}
            </p>
          </div>
        </div>
        {logText ? (
          <div className="panel-card" style={{ padding: "12px 14px" }}>
            <pre className="app-pre">{logText}</pre>
          </div>
        ) : null}
      </div>
    </>
  );
}
