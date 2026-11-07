import { useCallback, useEffect, useMemo, useState } from "react";

import {
  APP_NAME,
  APP_VERSION,
  TARGETS,
  DISCLAIMER_TEXT,
  DISCLAIMER_TITLE,
  QQ_LINK,
  RELAY_LINK,
  HELP_LINK,
} from "./data/targets";
import {
  hs,
  type InstalledMap,
  type LicenseState,
  type EnvStatus,
  type MemoryPrompt,
  type SeepState,
  type Skill,
} from "./lib/hs";
import { cx } from "./lib/cx";
import {
  IconBookOpen,
  IconBot,
  IconChat,
  IconCheck,
  IconCircleAlert,
  IconCode,
  IconDatabase,
  IconDownload,
  IconGlobe,
  IconHelp,
  IconListChecks,
  IconSparkles,
  IconTerminal,
  IconUser,
  IconWorkflow,
} from "./components/icons";
import brandMark from "./assets/brand.png";
import { InstallPage } from "./pages/InstallPage";
import { SeepPage } from "./pages/SeepPage";
import { SkillsPage } from "./pages/SkillsPage";
import { TutorialPage } from "./pages/TutorialPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ActivationPage } from "./pages/ActivationPage";
import { EnvSetupPage } from "./pages/EnvSetupPage";

type ViewId = string; // target id | "skills" | "tutorial" | "profile"
export type StatusLevel = "idle" | "busy" | "ok" | "err";

/** 每个目标一个图标，全部取自 PI-Desktop 的 icons.tsx。 */
const TARGET_ICONS: Record<string, typeof IconSparkles> = {
  codex: IconSparkles,
  zcode: IconTerminal,
  cursor: IconCode,
  opencode: IconWorkflow,
  claude: IconBot,
  workbuddy: IconGlobe,
  dsh: IconDatabase,
  "dsh-perfect": IconWorkflow,
  doubao: IconChat,
};

export function App() {
  const [consent, setConsent] = useState(false);
  const [view, setView] = useState<ViewId>("codex");
  const [installed, setInstalled] = useState<InstalledMap>({});
  const [skills, setSkills] = useState<Skill[]>([]);
  const [memory, setMemory] = useState<MemoryPrompt>(null);
  const [seep, setSeep] = useState<SeepState>({ kit: false, installed: false, version: "" });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("就绪");
  const [level, setLevel] = useState<StatusLevel>("idle");
  const [logText, setLogText] = useState("");

  // 日志属于哪次操作：切到别的目标时不要把上一个目标的日志混进来
  const [runTarget, setRunTarget] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [toastLevel, setToastLevel] = useState<"success" | "error">("success");
  /** 本机卡密授权状态；null = 读取中。 */
  const [license, setLicense] = useState<LicenseState | null>(null);
  /** 破甲运行环境（Node）；null = 检测中。 */
  const [env, setEnv] = useState<EnvStatus | null>(null);

  // 启动先读授权；未激活 / 已过期都进激活页
  useEffect(() => {
    hs.licenseState()
      .then(setLicense)
      .catch(() => setLicense({ active: false, status: "none", device: "" }));
  }, []);

  // 激活后再检测运行环境；没有就在准备屏里自动下载
  useEffect(() => {
    if (!license?.active) return;
    hs.envStatus()
      .then(setEnv)
      .catch(() => setEnv({ ready: false, node: "", version: "", major: 0 }));
  }, [license?.active]);

  // 窗口标题跟随变体（免费版 / 付费版 Pro）
  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  useEffect(() => {
    hs.state().then((s) => {
      setInstalled(s.installed || {});
    });
    hs.listSkills().then(setSkills);
    hs.memory().then(setMemory);
    hs.seepState().then(setSeep);
  }, []);

  useEffect(() => {
    const offLog = hs.onLog((p) => setLogText((prev) => (prev + p.text).slice(-20000)));
    const offStatus = hs.onStatus((p) => {
      setBusy(p.state === "running");
      setStatus(p.label);
      setLevel(p.state === "running" ? "busy" : "idle");
    });
    const offNotify = hs.onNotify((p) => setToast(p.text));
    return () => {
      offLog();
      offStatus();
      offNotify();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const reloadSkills = useCallback(() => {
    hs.listSkills().then(setSkills);
  }, []);

  const runUninstall = useCallback(async (targetId: string) => {
    setRunTarget(targetId);
    setLogText("");
    setStatus("正在卸载 …");
    setLevel("busy");
    setBusy(true);
    let res;
    try { res = await hs.uninstall(targetId); } catch (e) { setStatus("卸载失败：" + String((e as Error)?.message || e)); setLevel("err"); setBusy(false); return; }
    setInstalled(res.installed || {});
    setStatus(res.ok ? "已卸载 · 技能已一并清除" : "卸载失败（退出码 " + res.code + "）");
    setLevel(res.ok ? "ok" : "err");
    setBusy(false);
    reloadSkills();
  }, [reloadSkills]);

  // 安装：提示词取 memory/ 里 user 自己填的那份，技能库取随包的 Seep 工作台
  const runInstall = useCallback(async (targetId: string) => {
    setRunTarget(targetId);
    setLogText("");
    setStatus("正在安装 …");
    setLevel("busy");
    setBusy(true);
    let res;
    try { res = await hs.install(targetId); } catch (e) { setStatus("安装失败：" + String((e as Error)?.message || e)); setLevel("err"); setBusy(false); return; }
    setInstalled(res.installed || {});
    if (res.ok) {
      setStatus("已安装 · 提示词与技能库已写入");
      setLevel("ok");
    } else {
      setStatus("安装失败（退出码 " + res.code + "）");
      setLevel("err");
      const reason = res.error || res.out || "";
      if (reason.includes("记忆文件为空")) {
        setToastLevel("error");
        setToast("记忆文件为空：请先把提示词粘进 memory 目录下的 .md 文件");
      }
    }
    setBusy(false);
    reloadSkills();
  }, [reloadSkills]);

  /** Seep 工作台三个动作共用：装 / 卸 / 自检，结束后刷新状态。 */
  const runSeep = useCallback(
    async (action: "install" | "uninstall" | "verify") => {
      setLogText("");
      const label = { install: "正在部署 Seep 工作台 …", uninstall: "正在卸载 Seep 工作台 …", verify: "正在自检 …" }[action];
      setStatus(label);
      setLevel("busy");
      setBusy(true);
      let res;
      try {
        res =
          action === "install"
            ? await hs.seepInstall()
            : action === "uninstall"
              ? await hs.seepUninstall()
              : await hs.seepVerify();
      } catch (e) {
        setStatus("Seep 工作台操作失败：" + String((e as Error)?.message || e));
        setLevel("err");
        setBusy(false);
        return;
      }
      if (res.ok) {
        setStatus(
          action === "install" ? "Seep 工作台已部署" : action === "uninstall" ? "Seep 工作台已卸载" : "自检完成",
        );
        setLevel("ok");
      } else {
        setStatus((action === "verify" ? "自检失败" : action === "install" ? "部署失败" : "卸载失败") + "（退出码 " + res.code + "）");
        setLevel("err");
      }
      setBusy(false);
      hs.seepState().then(setSeep);
      reloadSkills();
    },
    [reloadSkills],
  );

  // 装回原始记忆：只把安装前的记忆换回来，技能库保留（仅 WorkBuddy 有这个按钮）
  const runRestoreMemory = useCallback(async (targetId: string) => {
    setLogText("");
    setStatus("正在装回原始记忆 …");
    setLevel("busy");
    setBusy(true);
    let res;
    try { res = await hs.restoreMemory(targetId); } catch (e) { setStatus("装回失败：" + String((e as Error)?.message || e)); setLevel("err"); setBusy(false); return; }
    setInstalled(res.installed || {});
    setStatus(res.ok ? "原始记忆已装回 · 自动重注入已暂停" : "装回失败（退出码 " + res.code + "）");
    setLevel(res.ok ? "ok" : "err");
    setBusy(false);
  }, []);

  const runRestart = useCallback(async () => {
    setStatus("正在重启 Codex …");
    setLevel("busy");
    let res;
    try { res = await hs.restartCodex(); } catch (e) { setStatus("重启失败：" + String((e as Error)?.message || e)); setLevel("err"); return; }
    if (res.ok) {
      setStatus("Codex 已重启");
      setLevel("ok");
    } else {
      setStatus("重启失败：" + (res.error || "未知错误"));
      setLevel("err");
    }
  }, []);

  const saveSkills = useCallback(
    async (disabled: string[]) => {
      let res;
      try { res = await hs.saveSkills(disabled); } catch (e) { setStatus("保存失败：" + String((e as Error)?.message || e)); setLevel("err"); setToastLevel("error"); setToast("保存失败：" + String((e as Error)?.message || e)); return; }
      if (res.ok) {
        setStatus("Skills 配置已保存 — 重启 Codex 生效");
        setLevel("ok");
        // Skills 页看不到底部状态行，补一个全局提示
        setToastLevel("success");
        setToast("Skills 配置已保存 · 重启 Codex 生效");
        reloadSkills();
      } else {
        setStatus("保存失败：" + (res.error || "无法写入 config.toml"));
        setLevel("err");
        setToastLevel("error");
        setToast("保存失败：" + (res.error || "无法写入 config.toml"));
      }
    },
    [reloadSkills],
  );

  const current = useMemo(() => TARGETS.find((t) => t.id === view), [view]);
  // hs.openQQ 是通用的 http(s) 外链桥（主进程走 shell.openExternal），中转站链接复用同一通道。
  const openLink = (url: string) => hs.openQQ(url);
  const openQQ = () => openLink(QQ_LINK);
  const openRelay = () => openLink(RELAY_LINK);
  const openHelp = () => openLink(HELP_LINK);

  const navItem = (id: ViewId, label: string, Icon: typeof IconSparkles) => (
    <button
      key={id}
      type="button"
      className={cx("settings-nav-item", view === id && "active")}
      onClick={() => setView(id)}
    >
      <span className="settings-nav-icon">
        <Icon size={16} />
      </span>
      <span className="settings-nav-label">{label}</span>
    </button>
  );

  // 授权门禁：未激活或已过期都先走激活页
  if (!license) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <div className="boot-mark">枢</div>
          <div className="boot-text">正在校验本机授权…</div>
        </div>
      </div>
    );
  }
  if (!license.active) {
    return <ActivationPage license={license} onActivated={setLicense} />;
  }

  // 手动进入「环境准备」：整屏跑一遍依赖准备（进页面就自动开始）
  if (view === "env") {
    return (
      <EnvSetupPage
        onDone={() => {
          hs.envStatus()
            .then((st) => {
              setEnv(st);
              setView(TARGETS[0].id);
            })
            .catch(() => setView(TARGETS[0].id));
        }}
      />
    );
  }

  // 运行环境不再做启动门禁：只有豆包 / DSH 完美破甲 / Seep 需要 Node，安装时各自自动准备。
  // 「环境与诊断」入口保留在侧栏，用户想手动修复/查看时才进去。

  return (
    <div className="app-shell settings-mode">
      <div className="settings-shell-full">
        <nav className="settings-nav">
          <div className="settings-nav-top">
            <div className="app-brand">
              <img className="app-brand-mark" src={brandMark} alt="" aria-hidden="true" draggable={false} />
              <div className="app-brand-copy">
                <div className="app-brand-name">{APP_NAME}</div>
                <div className="app-brand-meta">{"v" + APP_VERSION}</div>
              </div>
            </div>
          </div>

          <div className="settings-nav-scroll">
            <div className="settings-nav-group">
              <div className="settings-nav-group-label">破甲目标</div>
              {TARGETS.map((t) => navItem(t.id, t.nav, TARGET_ICONS[t.id] || IconSparkles))}
            </div>
            <div className="settings-nav-group">
              <div className="settings-nav-group-label">工具</div>
              {navItem("seep", "Seep 逆向工作台", IconDatabase)}
              {navItem("skills", "Skills 管理", IconListChecks)}
              {navItem("tutorial", "使用教程", IconBookOpen)}
              {navItem("env", "环境与诊断", IconDownload)}
              {/* 品牌推广入口：链接在 data/targets.ts 里配置，留空即不渲染 */}
              {QQ_LINK ? (
                <button type="button" className="settings-nav-item" onClick={openQQ}>
                  <span className="settings-nav-icon">
                    <IconChat size={16} />
                  </span>
                  <span className="settings-nav-label">加入QQ群</span>
                </button>
              ) : null}
              {RELAY_LINK ? (
                <button type="button" className="settings-nav-item" onClick={openRelay}>
                  <span className="settings-nav-icon">
                    <IconGlobe size={16} />
                  </span>
                  <span className="settings-nav-label">满血中转站</span>
                </button>
              ) : null}
              {HELP_LINK ? (
                <button type="button" className="settings-nav-item" onClick={openHelp}>
                  <span className="settings-nav-icon">
                    <IconHelp size={16} />
                  </span>
                  <span className="settings-nav-label">不会用点这里</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="app-nav-foot">
            <button
              type="button"
              className={cx("settings-nav-item", view === "profile" && "active")}
              onClick={() => setView("profile")}
            >
              <span className="settings-nav-icon">
                <IconUser size={16} />
              </span>
              <span className="settings-nav-label">个人中心</span>
            </button>
          </div>
        </nav>

        <div className="settings-content">
          {/* 顶部条：面包屑 + 状态徽标（与设计稿一致） */}
          <header className="settings-topbar">
            <div className="settings-crumb">
              破甲目标 / <b>{current ? current.nav : view === "seep" ? "Seep 逆向工作台" : view === "skills" ? "Skills 管理" : view === "tutorial" ? "使用教程" : view === "profile" ? "个人中心" : "环境与诊断"}</b>
            </div>
            <div className="settings-topbar-right">
              {current && installed[current.id] ? <span className="badge badge-success">已安装</span> : null}
              <span className="badge badge-neutral">{"v" + APP_VERSION}</span>
            </div>
          </header>
          <div className="settings-content-inner">
            {current && (
              <div className="settings-grid">
                <div className="settings-main">
                  <InstallPage
                    key={current.id}
                    target={current}
                    installed={installed[current.id]}
                    memory={memory}
                    busy={busy}
                    status={status}
                    level={level}
                    logText={runTarget === (current?.id ?? "") ? logText : ""}
                    onInstall={() => runInstall(current.id)}
                    onUninstall={() => runUninstall(current.id)}
                    onRestoreMemory={() => runRestoreMemory(current.id)}
                    onRestart={runRestart}
                  />
                </div>
                <aside className="settings-rail">
                  <div className="rail-card">
                    <p className="rail-title">授权</p>
                    <div className="rail-row"><span>类型</span><span>企业授权</span></div>
                    <div className="rail-row"><span>卡密</span><span>{license?.kamiMasked || "—"}</span></div>
                    <div className="rail-row"><span>状态</span><span>{license?.status === "active" ? "已激活" : license?.status === "expired" ? "已过期" : "未激活"}</span></div>
                    <div className="rail-row"><span>设备码</span><span>{(license?.device || "").slice(0, 9) || "—"}</span></div>
                    <div className="rail-row"><span>最近校验</span><span>{license?.lastCheck ? String(license.lastCheck).slice(0, 10) : "—"}</span></div>
                  </div>
                  <div className="rail-card">
                    <p className="rail-title">操作顺序</p>
                    <ol className="rail-steps">
                      <li><span className="rail-n">1</span><span><b>先填提示词</b>把正文粘进 memory 目录的 .md 文件</span></li>
                      <li><span className="rail-n">2</span><span><b>再点安装</b>装完把目标应用彻底关闭再打开</span></li>
                      <li><span className="rail-n">3</span><span><b>要逆向能力</b>到 Seep 工作台部署一次工具链</span></li>
                    </ol>
                  </div>
                </aside>
              </div>
            )}
            {view === "seep" && (
              <SeepPage
                seep={seep}
                busy={busy}
                status={status}
                level={level}
                logText={runTarget === (current?.id ?? "") ? logText : ""}
                onInstall={() => runSeep("install")}
                onVerify={() => runSeep("verify")}
                onUninstall={() => runSeep("uninstall")}
              />
            )}
            {view === "skills" && (
              <SkillsPage skills={skills} onSave={saveSkills} onReload={reloadSkills} />
            )}
            {view === "tutorial" && <TutorialPage />}
            {view === "profile" && (
              <ProfilePage
                version={APP_VERSION}
                status={status}
                level={level}
                license={license}
                onReverify={async () => {
                  const r = await hs.licenseReverify();
                  if (r.state) setLicense(r.state);
                  return { ok: r.ok, message: r.message };
                }}
                onDeactivate={async () => {
                  const s = await hs.licenseDeactivate();
                  setLicense(s);
                }}
                onQuit={() => hs.quit()}
              />
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={cx("toast", toastLevel === "error" ? "toast-error-solid" : "toast-success-solid")}
          onClick={() => setToast(null)}
        >
          {toastLevel === "error" ? <IconCircleAlert size={16} /> : <IconCheck size={16} />}
          <span>{toast}</span>
        </div>
      )}

      {!consent && (
        <div className="overlay">
          <div className="dialog">
            <h2 className="settings-card-heading">{DISCLAIMER_TITLE}</h2>
            <div className="consent-body">{DISCLAIMER_TEXT}</div>
            <div className="app-inline-actions">
              <button type="button" className="btn btn-primary" onClick={() => setConsent(true)}>
                我同意 并接受所有条约
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => hs.quit()}>
                拒绝并退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
