import { useCallback, useEffect, useState } from "react";

import { APP_VERSION } from "../data/targets";
import { hs, type LicenseState } from "../lib/hs";
import "./../styles/activation.css";

type Props = {
  license: LicenseState;
  onActivated: (s: LicenseState) => void;
};

const FALLBACK_NOTICE = "企业批量授权与换机服务请联系技术支持，工作日 9:00–21:00 在线。";

export function ActivationPage({ license, onActivated }: Props) {
  const [kami, setKami] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okText, setOkText] = useState("");
  const [notice, setNotice] = useState(FALLBACK_NOTICE);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    hs.licenseNotice()
      .then((r) => {
        if (alive && r.ok && r.text.trim()) setNotice(r.text.trim());
      })
      .catch(() => {
        /* 公告拿不到就用本地兜底文案 */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (license.status === "expired") setError("本机授权已过期，请续费后重新激活。");
    if (license.configured === false) setError(license.configError || "授权服务未配置，无法激活。");
  }, [license.status, license.configured, license.configError]);

  const submit = useCallback(async () => {
    if (busy) return;
    setError("");
    setOkText("");
    setBusy(true);
    try {
      const res = await hs.licenseActivate(kami);
      if (res.ok && res.state) {
        setOkText("激活成功，正在进入工作台…");
        setTimeout(() => onActivated(res.state as LicenseState), 600);
      } else {
        setError(res.message || "激活失败，请稍后重试");
      }
    } catch (e) {
      setError("激活请求失败：" + String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  }, [busy, kami, onActivated]);

  const copyDevice = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(license.device);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setOkText("复制失败，请手动选中设备码复制");
    }
  }, [license.device]);

  return (
    <div className="activation-shell">
      <aside className="ax-brand">
        <div className="ax-wordmark">
          <div className="ax-mark">枢</div>
          <div className="ax-wordmark-txt">
            <b>星枢科技</b>
            <span>XINGSHU TECHNOLOGY</span>
          </div>
        </div>

        <div className="ax-brand-body">
          <div className="ax-product">企业授权版 · 本地部署</div>
          <h1>星枢破甲工具</h1>
          <p className="ax-lead">
            面向安全研究团队的多端指令层审计工具。所有注入与还原均在本机完成，
            不采集、不上传任何用户数据。
          </p>

          <ul className="ax-facts">
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              九个目标端统一管理，安装与卸载可逆
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 3 7v6c0 5 3.5 8.5 9 9 5.5-.5 9-4 9-9V7l-9-5Z" />
              </svg>
              卡密授权与本机设备绑定，一码一机
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M7 9h10M7 14h6" />
              </svg>
              随包逆向工作台，二十三项能力开箱可用
            </li>
          </ul>
        </div>

        <div className="ax-brand-foot">
          <span>v{APP_VERSION} · Release</span>
          <span>© 2026 星枢[未来科技]</span>
        </div>
      </aside>

      <main className="ax-panel">
        <div className="ax-form">
          <div className="ax-eyebrow">PRODUCT ACTIVATION</div>
          <h2>激活本机授权</h2>
          <p className="ax-sub">输入你购买的卡密完成激活。首次激活后，本机会被记录为授权设备。</p>

          <div className="ax-field">
            <div className="ax-label">
              <span>设备码</span>
              <button type="button" className="ax-linkbtn" onClick={copyDevice}>
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <div className="ax-device">
              <code>{license.device}</code>
              <span className="ax-device-note">用于售后换机</span>
            </div>
          </div>

          <label className="ax-field">
            <span className="ax-label">
              <span>激活码</span>
              <span className="ax-device-note">区分大小写</span>
            </span>
            <input
              className={"ax-input" + (error ? " is-error" : "")}
              type="text"
              value={kami}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              spellCheck={false}
              autoComplete="off"
              maxLength={64}
              onChange={(e) => setKami(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </label>

          <button type="button" className="ax-submit" disabled={busy || !kami || license.configured === false} onClick={submit}>
            {busy ? "正在校验…" : "立即激活"}
          </button>

          {error ? (
            <div className="ax-status err">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto", marginTop: 2 }}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16.5v.5" />
              </svg>
              <span>{error}</span>
            </div>
          ) : null}

          {!error && okText ? (
            <div className="ax-status ok">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto", marginTop: 2 }}>
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>{okText}</span>
            </div>
          ) : null}

          <p className="ax-hint">激活需要联网校验一次。成功后可在「个人中心 → 授权信息」查看到期时间并重新验证。</p>

          <div className="ax-notice">
            <div className="ax-notice-head">
              <span className="ax-dot" />
              系统公告
            </div>
            <p>{notice}</p>
          </div>

          <p className="ax-legal">激活即表示你已阅读并同意《软件使用协议》。本工具仅限授权范围内的安全研究使用。</p>
        </div>
      </main>
    </div>
  );
}
