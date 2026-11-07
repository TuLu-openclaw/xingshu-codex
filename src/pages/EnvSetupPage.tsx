import { useCallback, useEffect, useRef, useState } from "react";
import { hs } from "../lib/hs";
import { APP_NAME } from "../data/targets";

/**
 * 运行环境准备（Node / Python / pip 依赖）。
 *
 * 关键设计：
 * - 不是必须的。只有「豆包注入守护」「DSH 完美破甲」「Seep 工作台」需要 Node；
 *   其余目标（Codex / Claude / Cursor / OpenCode / ZCode / WorkBuddy / DSH）纯文件注入，不依赖运行时。
 * - 弱机器默认走「轻量」：只准备 Node，跳过 pip 依赖（frida-tools 那种几百 MB 的重活）。
 * - 日志节流：pip / npm 输出很密，逐块 setState 会把界面刷到卡死，这里 150ms 合并一次。
 */

const STEPS = [
  { key: "arch", label: "识别本机架构", hint: "x64 / arm64 / x86" },
  { key: "node", label: "准备 Node 运行环境", hint: "缺少或过旧时自动下载 LTS 版" },
  { key: "pnpm", label: "准备 npm / pnpm", hint: "插件安装依赖的包管理器" },
  { key: "python", label: "准备 Python 运行环境", hint: "优先复用系统 Python，缺则下载便携版" },
  { key: "pip", label: "安装 pip 依赖", hint: "mcp / pytest / frida-tools（轻量模式会跳过）" },
  { key: "verify", label: "校验可用性", hint: "版本与可执行性检查" },
];

type Props = {
  onDone: () => void;
};

export function EnvSetupPage({ onDone }: Props) {
  const [log, setLog] = useState("");
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState("");
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"lite" | "full">("lite");
  const logRef = useRef<HTMLPreElement | null>(null);
  const bufRef = useRef("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const off = hs.onLog((p) => {
      bufRef.current = (bufRef.current + p.text).slice(-20000);
      if (timerRef.current != null) return;
      // 150ms 合并一次，避免高频输出把渲染打满
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const chunk = bufRef.current;
        bufRef.current = "";
        setLog((prev) => (prev + chunk).slice(-20000));
      }, 150);
    });
    return () => {
      off();
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // 日志里出现的阶段关键词 → 推进进度条（对应 prepare-env.ps1 的输出）
  useEffect(() => {
    const s = log.toLowerCase();
    if (/deps_ok/.test(s)) setStep(6);
    else if (/pip install|deps_partial/.test(s)) setStep(4);
    else if (/python_ok|python 运行环境/.test(s)) setStep(4);
    else if (/node_ok|ensure-runtime|node 运行环境/.test(s)) setStep(1);
  }, [log]);

  const run = useCallback(
    async (which: "lite" | "full") => {
      setRunning(true);
      setFailed("");
      setLog("");
      setStep(0);
      setMode(which);
      try {
        const res = await hs.envPrepare({ lite: which === "lite" });
        if (res.ok) {
          setStep(STEPS.length);
          const st = await hs.envStatus();
          if (st.ready) {
            setTimeout(onDone, 500);
            return;
          }
          setFailed("准备完成了，但 Node 版本仍低于 22，请检查网络后重试。");
          return;
        }
        setFailed(res.error || res.out || "环境准备没有跑起来，请查看下方日志。");
      } catch (e) {
        setFailed("环境准备失败：" + String((e as Error)?.message || e));
      } finally {
        setRunning(false);
      }
    },
    [onDone],
  );

  useEffect(() => {
    // 进页面就先跑轻量版（只装 Node），重活让用户自己点
    run("lite");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="env-screen">
      <div className="env-card">
        <div className="env-head">
          <div className="env-mark">枢</div>
          <div>
            <h1>运行环境准备</h1>
            <p>
              不是必须的：只有「豆包」「DSH 完美破甲」「Seep 工作台」需要 Node；
              其它目标只写配置文件，不需要运行时。弱机器建议只点「轻量」。
            </p>
          </div>
        </div>

        <ol className="env-steps">
          {STEPS.map((s, i) => {
            const skipped = mode === "lite" && s.key === "pip";
            const done = step > i;
            const active = step === i && running;
            return (
              <li key={s.key} className={done ? "done" : active ? "active" : ""}>
                <span className="env-dot">{done ? "✓" : i + 1}</span>
                <span className="env-step-copy">
                  <b>{s.label}</b>
                  <i>{s.hint}</i>
                </span>
                <span className="env-step-state">
                  {skipped ? "已跳过" : done ? "完成" : active ? "进行中" : "等待"}
                </span>
              </li>
            );
          })}
        </ol>

        <pre className="env-log" ref={logRef}>
          {log || "等待开始…"}
        </pre>

        {failed ? (
          <div className="env-error">
            <b>准备失败</b>
            <span>{failed}</span>
          </div>
        ) : null}

        <div className="env-actions">
          <button
            type="button"
            className="env-btn primary"
            disabled={running}
            onClick={() => run("lite")}
          >
            {running && mode === "lite" ? "正在准备…" : "只装 Node（轻量）"}
          </button>
          <button
            type="button"
            className="env-btn ghost"
            disabled={running}
            onClick={() => run("full")}
          >
            完整准备（含 pip 依赖）
          </button>
          <button type="button" className="env-btn ghost" disabled={running} onClick={onDone}>
            跳过，先不用
          </button>
        </div>

        <p className="env-foot">
          {APP_NAME} · 运行环境位于 %LOCALAPPDATA%\XingshuArmor\runtime，不修改系统 PATH。
          完整准备会装 frida-tools 等较大依赖，弱机器可能卡顿，建议一次只做轻量。
        </p>
      </div>
    </div>
  );
}
