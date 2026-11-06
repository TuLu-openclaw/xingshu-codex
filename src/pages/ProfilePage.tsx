import { useState } from "react";

import type { StatusLevel } from "../App";
import { cx } from "../lib/cx";
import { BRAND_AUTHOR, BRAND_COPYRIGHT } from "../data/targets";
import type { LicenseState } from "../lib/hs";

type Props = {
  version: string;
  status: string;
  level: StatusLevel;
  license: LicenseState;
  onReverify: () => Promise<{ ok: boolean; message: string }>;
  onDeactivate: () => void;
  onQuit: () => void;
};

function fmtDate(ts?: number) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function daysLeft(ts?: number) {
  if (!ts) return 0;
  return Math.max(0, Math.floor((ts * 1000 - Date.now()) / 86400000));
}

export function ProfilePage({
  version,
  status,
  level,
  license,
  onReverify,
  onDeactivate,
  onQuit,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState("");
  const statusTone =
    level === "err" ? "badge-error" : level === "ok" ? "badge-success" : "badge-neutral";

  const reverify = async () => {
    setBusy(true);
    setTip("");
    const res = await onReverify();
    setTip(res.message);
    setBusy(false);
  };

  return (
    <>
      <h1 className="settings-section-title">个人中心</h1>

      <div className="settings-card-block">
        <div className="settings-card-heading-row">
          <div>
            <h2 className="settings-card-heading">授权信息</h2>
            <p className="settings-card-description">卡密与本机绑定，一码一机；续费或换机后点「重新验证」。</p>
          </div>
          <span className={cx("badge", license.active ? "badge-success" : "badge-error")}>
            {license.active ? "有效" : "已过期"}
          </span>
        </div>

        <div className="settings-panel">
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">卡密</div>
            </span>
            <span className="settings-row-control">
              <span className="badge badge-neutral">{license.kamiMasked || "—"}</span>
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">到期时间</div>
            </span>
            <span className="settings-row-control">{fmtDate(license.vip)}</span>
          </div>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">设备码</div>
              <div className="settings-row-desc">换机时把它发给技术支持，后台迁移授权</div>
            </span>
            <span className="settings-row-control">
              <span className="badge badge-neutral">{license.device || "—"}</span>
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">上次校验</div>
            </span>
            <span className="settings-row-control">
              {license.lastCheck ? String(license.lastCheck).replace("T", " ").slice(0, 16) : "—"}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">运行状态</div>
            </span>
            <span className="settings-row-control">
              <span className={cx("badge", statusTone)}>{status}</span>
            </span>
          </div>
        </div>

        <div className="app-inline-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={reverify}>
            {busy ? "正在校验…" : "重新验证"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDeactivate}>
            解除本机授权
          </button>
        </div>
        {tip ? (
          <p className="settings-card-description" style={{ marginTop: 8 }}>
            {tip}
          </p>
        ) : null}
      </div>

      <div className="settings-card-block">
        <h2 className="settings-card-heading">版本</h2>
        <div className="settings-panel">
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">当前版本</div>
            </span>
            <span className="settings-row-control">
              <span className="badge badge-neutral">{version ? "v" + version : "—"}</span>
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">署名</div>
              <div className="settings-row-desc">本工具由 {BRAND_COPYRIGHT} 维护与分发</div>
            </span>
            <span className="settings-row-control">
              <span className="badge badge-neutral">{BRAND_AUTHOR}</span>
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">版权</div>
              <div className="settings-row-desc">Copyright © {BRAND_COPYRIGHT} · 详见 LICENSE 与 NOTICE</div>
            </span>
          </div>
        </div>
      </div>

      <div className="settings-card-block">
        <h2 className="settings-card-heading">偏好</h2>
        <div className="app-inline-actions">
          <button type="button" className="btn btn-ghost" onClick={onQuit}>
            退出工具
          </button>
        </div>
      </div>
    </>
  );
}
