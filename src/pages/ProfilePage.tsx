import type { StatusLevel } from "../App";
import { cx } from "../lib/cx";
import { BRAND_AUTHOR, BRAND_COPYRIGHT } from "../data/targets";

type Props = {
  version: string;
  status: string;
  level: StatusLevel;
  onQuit: () => void;
};

export function ProfilePage({ version, status, level, onQuit }: Props) {
  const statusTone =
    level === "err" ? "badge-error" : level === "ok" ? "badge-success" : "badge-neutral";

  return (
    <>
      <h1 className="settings-section-title">个人中心</h1>

      <div className="settings-card-block">
        <h2 className="settings-card-heading">账号信息</h2>
        <div className="settings-panel">
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">状态</div>
              <div className="settings-row-desc">本地工具 · 无需登录 · 所有注入均在本机完成</div>
            </span>
            <span className="settings-row-control">
              <span className={cx("badge", statusTone)}>{status}</span>
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">版本</div>
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
              <div className="settings-row-desc">
                Copyright © {BRAND_COPYRIGHT} · 详见随包的 LICENSE 与 NOTICE
              </div>
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
