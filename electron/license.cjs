"use strict";
/*
  星枢 · 卡密授权客户端（微验 wy.llua.cn）

  协议与官方 C++ 示例一致：
    POST http://<host>/api/?id=kmlogon
    body: app=<appid>&data=<hex(RC4(查询串, rc4key))>
    响应: hex → RC4 解密 → JSON
    查询串: kami=..&markcode=..&t=..&sign=..&value=..
    sign = md5("kami=..&markcode=..&t=..&" + appkey)
    成功判定: code === success 且 check === md5(String(time) + appkey + value)

  配置不写在代码里：从 license.config.json 读（开发时在项目根，打包后在 resources/），
  或由环境变量 XS_LICENSE_CONFIG 指定。配置文件不入库，见 license.config.example.json。

  本地只保存卡密与到期时间，签名防手改；不采集任何用户数据。
*/

const crypto = require("node:crypto");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// ---------- 配置 ----------

/** 依次尝试的配置位置；找到第一个合法文件即用。 */
function configCandidates() {
  const list = [];
  if (process.env.XS_LICENSE_CONFIG) list.push(process.env.XS_LICENSE_CONFIG);
  if (process.resourcesPath) list.push(path.join(process.resourcesPath, "license.config.json"));
  list.push(path.join(__dirname, "..", "license.config.json")); // 开发：项目根
  list.push(path.join(process.cwd(), "license.config.json"));
  return list;
}

let cached = null;

/**
 * 读授权配置。缺文件 / 缺字段都返回 error，而不是抛异常 ——
 * 这样未配置时应用仍能启动，只是激活会明确提示「未配置授权服务」。
 */
function loadConfig() {
  if (cached) return cached;
  const tried = [];
  for (const file of configCandidates()) {
    if (!file) continue;
    tried.push(file);
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    if (!raw || typeof raw !== "object") continue;
    const conf = {
      host: String(raw.host || "wy.llua.cn"),
      appid: String(raw.appid || ""),
      appkey: String(raw.appkey || ""),
      rc4key: String(raw.rc4key || ""),
      success: Number(raw.success || 0),
      timeout: Number(raw.timeout || 15000),
    };
    if (!conf.appid || !conf.appkey || !conf.rc4key || !conf.success) {
      cached = { ok: false, error: `授权配置不完整：${file}`, conf: null, file };
      return cached;
    }
    cached = { ok: true, conf, file, error: "" };
    return cached;
  }
  cached = {
    ok: false,
    conf: null,
    file: "",
    error: "未找到授权配置 license.config.json（需含 host/appid/appkey/rc4key/success）",
    tried,
  };
  return cached;
}

function conf() {
  const c = loadConfig();
  if (!c.ok) throw new Error(c.error);
  return c.conf;
}

// ---------- 密码学 ----------

function rc4(text, key) {
  const s = new Array(256);
  let j = 0;
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    const t = s[i];
    s[i] = s[j];
    s[j] = t;
  }
  let i = 0;
  let k = 0;
  let out = "";
  for (let n = 0; n < text.length; n++) {
    i = (i + 1) % 256;
    k = (k + s[i]) % 256;
    const t = s[i];
    s[i] = s[k];
    s[k] = t;
    out += String.fromCharCode(text.charCodeAt(n) ^ s[(s[i] + s[k]) % 256]);
  }
  return out;
}

const md5 = (s) => crypto.createHash("md5").update(s, "utf8").digest("hex");

function binToHex(bin) {
  let out = "";
  for (let i = 0; i < bin.length; i++) out += (bin.charCodeAt(i) & 0xff).toString(16).padStart(2, "0");
  return out;
}

function hexToBin(hex) {
  let out = "";
  for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  return out;
}

// ---------- HTTP ----------

function post(pathname, body) {
  const c = conf();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: c.host,
        path: pathname,
        method: "POST",
        timeout: c.timeout,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "XingShuKit/5.0",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    req.on("timeout", () => req.destroy(new Error("请求超时，请检查网络后重试")));
    req.on("error", (e) => reject(new Error("网络错误：" + e.message)));
    req.write(body);
    req.end();
  });
}

function decode(raw) {
  const c = conf();
  const hex = String(raw || "").trim();
  if (!hex) throw new Error("服务器返回为空");
  const plain = rc4(hexToBin(hex), c.rc4key);
  return JSON.parse(Buffer.from(plain, "latin1").toString("utf8"));
}

// ---------- 本机标识 ----------

function dataDir() {
  const base = process.env.XS_USERDATA || path.join(process.env.APPDATA || os.homedir(), "xingshu-kit");
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return base;
}

function deviceId() {
  const file = path.join(dataDir(), "device.id");
  try {
    const v = fs.readFileSync(file, "utf8").trim();
    if (v) return v;
  } catch {
    /* 首次运行 */
  }
  const id = crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 32);
  try {
    fs.writeFileSync(file, id, "utf8");
  } catch {
    /* 只读目录时降级为内存值 */
  }
  return id;
}

function deviceCode() {
  const id = deviceId();
  return (id.match(/.{1,4}/g) || []).slice(0, 4).join("-");
}

// ---------- 本地授权 ----------

const LICENSE_FILE = "license.dat";

function licensePath() {
  return path.join(dataDir(), LICENSE_FILE);
}

function sign(fields) {
  // 用 appkey 参与签名；appkey 缺失时退化为固定盐，保证旧记录还能验
  const secret = loadConfig().ok ? loadConfig().conf.appkey : "xingshu-local";
  return md5([fields.kami, fields.vip, fields.device, secret].join("|"));
}

function saveLicense(data) {
  const record = {
    kami: data.kami,
    vip: data.vip,
    ktype: data.ktype || "code",
    num: data.num || 0,
    device: data.device || deviceId(),
    activatedAt: data.activatedAt || new Date().toISOString(),
    lastCheck: new Date().toISOString(),
  };
  record.sign = sign(record);
  fs.writeFileSync(licensePath(), JSON.stringify(record, null, 2), "utf8");
  return record;
}

function readLicense() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(licensePath(), "utf8"));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || !raw.kami) return null;
  if (raw.sign !== sign(raw)) return null;
  return raw;
}

function clearLicense() {
  try {
    fs.unlinkSync(licensePath());
  } catch {
    /* 本来就没有 */
  }
}

function maskKami(kami) {
  const s = String(kami || "");
  if (s.length <= 8) return s;
  return s.slice(0, 4) + "-****-****-" + s.slice(-4);
}

function state() {
  const rec = readLicense();
  const device = deviceCode();
  const cfg = loadConfig();
  const base = { device, configured: cfg.ok, configError: cfg.ok ? "" : cfg.error };
  if (!rec) return { active: false, status: "none", ...base };
  const vip = Number(rec.vip) || 0;
  const now = Math.floor(Date.now() / 1000);
  const expired = rec.ktype === "code" ? vip > 0 && vip < now : Number(rec.num) <= 0;
  return {
    active: !expired,
    status: expired ? "expired" : "active",
    ...base,
    kamiMasked: maskKami(rec.kami),
    vip,
    ktype: rec.ktype,
    num: rec.num,
    activatedAt: rec.activatedAt,
    lastCheck: rec.lastCheck,
  };
}

// ---------- 业务 ----------

async function notice() {
  try {
    const c = conf();
    const raw = await post(`/api/?id=notice`, `app=${c.appid}`);
    const j = decode(raw);
    if (j && j.code === 200 && j.msg) return { ok: true, text: String(j.msg.app_gg || "") };
    return { ok: false, text: "" };
  } catch (e) {
    return { ok: false, text: "", error: e.message };
  }
}

async function activate(kamiRaw) {
  const cfg = loadConfig();
  if (!cfg.ok) return { ok: false, message: cfg.error };

  const kami = String(kamiRaw || "").trim();
  if (!kami) return { ok: false, message: "请输入激活码" };
  if (kami.length < 6) return { ok: false, message: "激活码格式不正确" };

  const c = cfg.conf;
  const device = deviceId();
  const t = Math.floor(Date.now() / 1000);
  const value = String(Math.floor(Math.random() * 900000) + 100000);
  const s = md5(`kami=${kami}&markcode=${device}&t=${t}&${c.appkey}`);
  const qs = `kami=${kami}&markcode=${device}&t=${t}&sign=${s}&value=${value}`;
  const payload = `app=${c.appid}&data=${binToHex(rc4(qs, c.rc4key))}`;

  let json;
  try {
    json = decode(await post(`/api/?id=kmlogon`, payload));
  } catch (e) {
    return { ok: false, message: e.message };
  }

  if (!json || json.code !== c.success) {
    const msg = typeof json?.msg === "string" ? json.msg : "激活码无效或已被使用";
    return { ok: false, message: msg, code: json && json.code };
  }

  const srvTime = Number(json.time) || 0;
  if (srvTime && Math.abs(srvTime - t) > 120) {
    return { ok: false, message: "本机时间偏差过大，请校准系统时间后重试" };
  }
  const expect = md5(String(json.time) + c.appkey + value);
  if (json.check && expect !== json.check) {
    return { ok: false, message: "服务器校验值不匹配，请稍后重试" };
  }

  const msg = json.msg || {};
  const ktype = String(msg.ktype || "code");
  const vip = Number(msg.vip) || 0;
  const num = Number(msg.num) || 0;
  if (ktype === "code" && vip > 0 && vip < Math.floor(Date.now() / 1000)) {
    return { ok: false, message: "该激活码已过期" };
  }

  const rec = saveLicense({ kami, vip, ktype, num, device });
  return { ok: true, message: "激活成功", state: state(), record: rec };
}

async function reverify() {
  const rec = readLicense();
  if (!rec) return { ok: false, message: "本机尚未激活" };
  return activate(rec.kami);
}

module.exports = {
  loadConfig,
  notice,
  activate,
  reverify,
  state,
  deviceCode,
  readLicense,
  clearLicense,
  maskKami,
  rc4,
  md5,
};
