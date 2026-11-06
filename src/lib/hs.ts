/** preload 暴露的 IPC 接口的类型包装。 */

export type InstalledMap = Record<string, string | boolean>;

export type InstallResult = {
  ok: boolean;
  code: number;
  out: string;
  timedOut: boolean;
  installed: InstalledMap;
  error?: string;
};

/** 重启 Codex：out 是 PowerShell 的原样输出，失败时 error 里带可读原因。 */
export type RestartResult = { ok: boolean; code?: number; out?: string; error?: string };

export type Skill = { name: string; desc: string; enabled: boolean };

/** memory/ 下正在使用的提示词文件；null = 用户还没填内容。 */
export type MemoryPrompt = { path: string; name: string; chars: number } | null;

/** 随包 Seep 逆向工作台状态。 */
export type SeepState = {
  /** 随包工具链是否完整（resources/seep-kit/setup/install.ps1 存在）。 */
  kit: boolean;
  /** 是否已部署到 ~/.pi/agent（mcp.json 里有 seep 条目）。 */
  installed: boolean;
  /** 随包工作台版本号。 */
  version: string;
};

export type AppState = {
  installed: InstalledMap;
  version: string;
};

export type LogPayload = { label: string; text: string };
export type StatusPayload = { label: string; state: "running" | "idle" };
export type NotifyPayload = { level: "info" | "warn"; text: string };

/** 本机授权状态（卡密）。 */
export type LicenseState = {
  active: boolean;
  status: "none" | "active" | "expired";
  device: string;
  /** 授权服务配置是否就绪（缺 license.config.json 时为 false） */
  configured?: boolean;
  configError?: string;
  kamiMasked?: string;
  vip?: number;
  ktype?: "code" | "num";
  num?: number;
  activatedAt?: string;
  lastCheck?: string;
};

export type ActivateResult = {
  ok: boolean;
  message: string;
  state?: LicenseState;
  code?: number;
};

export type NoticeResult = { ok: boolean; text: string; error?: string };

/** 破甲运行环境（随包插件下载的 Node 运行时）。 */
export type EnvStatus = { ready: boolean; node: string; version: string; major: number };

export type HsApi = {
  state(): Promise<AppState>;
  memory(): Promise<MemoryPrompt>;
  install(targetId: string): Promise<InstallResult>;
  uninstall(targetId: string): Promise<InstallResult>;
  /** 装回原始记忆（仅 WorkBuddy）：还原安装前的记忆档案，保留技能库。 */
  restoreMemory(targetId: string): Promise<InstallResult>;
  restartCodex(): Promise<RestartResult>;
  seepState(): Promise<SeepState>;
  seepInstall(): Promise<InstallResult>;
  seepUninstall(): Promise<InstallResult>;
  seepVerify(): Promise<InstallResult>;
  listSkills(): Promise<Skill[]>;
  saveSkills(disabled: string[]): Promise<{ ok: boolean; error?: string }>;
  openQQ(url: string): Promise<{ ok: boolean }>;
  quit(): Promise<{ ok: boolean }>;
  win(action: "minimize" | "maximize" | "close"): Promise<{ ok: boolean }>;
  licenseState(): Promise<LicenseState>;
  licenseNotice(): Promise<NoticeResult>;
  licenseActivate(kami: string): Promise<ActivateResult>;
  licenseReverify(): Promise<ActivateResult>;
  licenseDeactivate(): Promise<LicenseState>;
  licenseDevice(): Promise<string>;
  envStatus(): Promise<EnvStatus>;
  envPrepare(): Promise<InstallResult>;
  onLog(cb: (p: LogPayload) => void): () => void;
  onStatus(cb: (p: StatusPayload) => void): () => void;
  onNotify(cb: (p: NotifyPayload) => void): () => void;
};

declare global {
  interface Window {
    hs: HsApi;
  }
}

export const hs: HsApi = window.hs;
