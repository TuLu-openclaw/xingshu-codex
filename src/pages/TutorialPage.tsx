import { TUTORIAL_TEXT } from "../data/targets";

export function TutorialPage() {
  return (
    <>
      <h1 className="settings-section-title">使用教程</h1>

      <div className="settings-card-block">
        <div className="settings-card-heading-row">
          <div>
            <h2 className="settings-card-heading">说明</h2>
            <p className="settings-card-description">
              填提示词 → 点安装 → 重启应用，直接说事就能用（不需要前缀）。发一句「星枢」可自检提示词有没有加载。
            </p>
          </div>
          <span className="badge badge-neutral">3 步上手</span>
        </div>

        <div className="panel-card" style={{ padding: "16px 18px" }}>
          <div className="app-prose">{TUTORIAL_TEXT}</div>
        </div>

        {/* 激活词速查：用户最常问的就是「发什么才算开」 */}
        <div className="settings-panel" style={{ marginTop: 16 }}>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">星枢</div>
              <div className="settings-row-desc">
                整条消息只有这两个字 → 回 <code>星枢 ready · main kernel loaded · red/blue blocks on standby · give target or scenario</code>
              </div>
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">自检</div>
              <div className="settings-row-desc">整条消息只有这两个字 → 回 <code>All systems normal. Continue.</code></div>
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">继续 / 重试 / 照做</div>
              <div className="settings-row-desc">接着上次的检查点继续，不重放已完成的步骤</div>
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-copy">
              <div className="settings-row-title">lab：</div>
              <div className="settings-row-desc">只用于 Seep 逆向工作台的实验模式，和破甲提示词无关</div>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
