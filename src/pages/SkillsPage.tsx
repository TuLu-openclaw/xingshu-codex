import { useEffect, useState } from "react";

import type { Skill } from "../lib/hs";
import { cx } from "../lib/cx";

type Props = {
  skills: Skill[];
  onSave: (disabled: string[]) => void;
  onReload: () => void;
};

export function SkillsPage({ skills, onSave, onReload }: Props) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const s of skills) next[s.name] = s.enabled;
    setEnabled(next);
  }, [skills]);

  const total = skills.length;
  const onCount = skills.filter((s) => enabled[s.name]).length;

  const toggle = (name: string) => setEnabled((prev) => ({ ...prev, [name]: !prev[name] }));
  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const s of skills) next[s.name] = value;
    setEnabled(next);
  };
  const save = () => onSave(skills.filter((s) => !enabled[s.name]).map((s) => s.name));

  return (
    <>
      <h1 className="settings-section-title">Skills 管理</h1>

      <div className="settings-card-block">
        <div className="settings-card-heading-row">
          <div>
            <h2 className="settings-card-heading">技能列表</h2>
            <p className="settings-card-description">
              勾选 = 启用，取消 = 禁用。保存后需重启 Codex 生效。
            </p>
          </div>
          <span className="badge badge-neutral">
            共 {total} 个 · 启用 {onCount} · 禁用 {total - onCount}
          </span>
        </div>

        <div className="app-inline-actions app-inline-actions-top">
          <button type="button" className="btn btn-secondary" onClick={() => setAll(true)}>
            全选
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setAll(false)}>
            一键关闭
          </button>
          <button type="button" className="btn btn-ghost" onClick={onReload}>
            重新读取
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            保存
          </button>
        </div>

        {total === 0 ? (
          <p className="settings-card-description">未在 ~/.codex/skills 下找到技能目录。</p>
        ) : (
          <div className="settings-panel">
            {skills.map((s) => (
              <button
                key={s.name}
                type="button"
                className="settings-row app-row-button"
                onClick={() => toggle(s.name)}
              >
                <span className="settings-row-copy">
                  <div className="settings-row-title">{s.name}</div>
                  <div className="settings-row-desc">{s.desc}</div>
                </span>
                <span className="settings-row-control">
                  <span className={cx("settings-toggle", enabled[s.name] && "on")}>
                    <span className="settings-toggle-thumb" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

      </div>
    </>
  );
}
