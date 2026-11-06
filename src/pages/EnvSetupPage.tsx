import { useCallback, useEffect, useRef, useState } from "react";

import { APP_NAME } from "../data/targets";
import { hs } from "../lib/hs";

type Props = {
  /** 环境就绪后进入主界面 */
  onDone: () => void;
};

type Step = { key: string; label: string; hint: string };

const STEPS: Step[] = [
  { key: "arch", label: "识别本机架构", hint: "x64 / arm64 / x86" },
  { key: "node", label: "准备 Node 运行环境", hint: "缺少或过旧时自动下载 LTS 版" },
  { key: "npm", label: "准备 npm / pnpm", hint: "插件安装依赖的包管理器" },
  { key: "check", label: "校验可用性", hint: "版本与可执行性检查" },
];

export function EnvSetupPage({ onDone }: Props) {
  const [log, setLog] = useState("");
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState("");
  const [step, setStep] = useState(0);
  const logRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const off = hs.onLog((p) => {
      setLog((prev) => (prev + p.text).slice(-20000));
    });
    return off;
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // 日志里出现的阶段关键词 → 推进进度条
  useEffect(() => {
    const s = log.toLowerCase();
    if (/runtime_ok|node\.exe/.test(s)) setStep(4);
    else if (/pnpm/.test(s)) setStep(3);
    else if (/npm/.test(s)) setStep(2);
    else if (/node/.test(s)) setStep(1);
  }, [log]);

  const run = useCallback(async () => {
    setRunning(true);
    setFailed("");
    setLog("");
    setStep(0);
    try {
      const res = await hs.envPrepare();
      if (res.ok) {
        setStep(STEPS.length);
        const st = await hs.envStatus();
        if (st.ready) {
          setTimeout(onDone, 500);
          return;
        }
        setFailed("运行环境准备完成，但 Node 版本仍低于 22，请检查网络后重试。");
      } else {
        setFailed(res.error || res.out || "运行环境准备失败，请查看下方日志。");
      }
    } catch (e) {
      setFailed("运行环境准备失败：" + String((e as Error)?.message || e));
    } finally {
      setRunning(false);
    }
  }, [onDone]);

  useEffect(() => {
    // 进页面就自动开始，不用用户点
    run();
  }, [run]);

  return (
    <div className="env-screen">
      <div className="env-card">
        <div className="env-head">
          <div className="env-mark">枢</div>
          <div>
            <h1>正在准备破甲运行环境</h1>
            <p>首次使用会按你的机器架构下载 Node 运行时，之后复用，不会重复下载。</p>
          </div>
        </div>

        <ol className="env-steps">
          {STEPS.map((s, i) => {
            const done = step > i;
            const active = step === i && running;
            return (
              <li key={s.key} className={done ? "done" : active ? "active" : ""}>
                <span className="env-dot">{done ? "✓" : i + 1}</span>
                <span className="env-step-copy">
                  <b>{s.label}</b>
                  <i>{s.hint}</i>
                </span>
                <span className="env-step-state">{done ? "完成" : active ? "进行中" : "等待"}</span>
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
          <button type="button" className="env-btn primary" disabled={running} onClick={run}>
            {running ? "正在准备…" : failed ? "重试" : "重新准备"}
          </button>
          {failed ? (
            <button type="button" className="env-btn ghost" onClick={onDone}>
              先跳过，稍后再说
            </button>
          ) : null}
        </div>

        <p className="env-foot">
          {APP_NAME} · 运行环境位于 %LOCALAPPDATA%\XingshuArmor\runtime，不修改系统 PATH。
        </p>
      </div>
    </div>
  );
}
