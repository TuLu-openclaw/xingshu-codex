"use strict";
/*
  星枢 · 卡密授权客户端（微验 wy.llua.cn）

  协议与官方 C++ 示例一致：
    POST http://wy.llua.cn/api/?id=kmlogon
    body: app=<appid>&data=<hex(RC4(查询串, rc4key))>
    响应: hex → RC4 解密 → JSON
    查询串: kami=..&markcode=..&t=..&sign=..&value=..
    sign = md5("kami=..&markcode=..&t=..&" + appkey)
    成功判定: code === 78562 且 check === md5(String(time) + appkey + value)

  本地只保存卡密与到期时间，签名防手改；不采集任何用户数据。
*/

const crypto = require("node:crypto");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const CONF = {
  host: "wy.llua.cn",
  appid: "21636",
  appkey: "d68Xg8R697RRXgMx",
  rc4key: "d0a0331047d2ab11d7deafbb9fad96a1",
  success: 78562,
  timeout: 15000,
};

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

/** 二进制串（每字符 0-255）→ hex */
function binToHex(bin) {
  let out = "";
  for (let i = 0; i < bin.length; i++) out += (bin.charCodeAt(i) & 0xff).toString(16).padStart(2, "0");
  return out;
}

/** hex → 二进制串 */
function hexToBin(hex) {
  let out = "";
  for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  return out;
}

// ---------- HTTP ----------

function post(pathname, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: CONF.host,
        path: pathname,
        method: "POST",
        timeout: CONF.timeout,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "XingShuKit/5.0",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
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
  const hex = String(raw || "").trim();
  if (!hex) throw new Error("服务器返回为空");
  const plain = rc4(hexToBin(hex), CONF.rc4key);
  const text = Buffer.from(plain, "latin1").toString("utf8");
  return JSON.parse(text);
}

// ---------- 本机标识 ----------

function dataDir() {
  // 由调用方（main.cjs）注入 app.getPath('userData')，未注入时退回 APPDATA
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

/** 展示用设备码：每 4 位一组 */
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
  return md5([fields.kami, fields.vip, fields.device, CONF.appkey].join("|"));
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
  // 手改检测：签名不符直接当未激活
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

/** 本地状态：未激活 / 已激活 / 已过期 */
function state() {
  const rec = readLicense();
  const device = deviceCode();
  if (!rec) return { active: false, status: "none", device };
  const vip = Number(rec.vip) || 0;
  const now = Math.floor(Date.now() / 1000);
  const expired = rec.ktype === "code" ? vip > 0 && vip < now : Number(rec.num) <= 0;
  return {
    active: !expired,
    status: expired ? "expired" : "active",
    device,
    kamiMasked: maskKami(rec.kami),
    vip,
    ktype: rec.ktype,
    num: rec.num,
    activatedAt: rec.activatedAt,
    lastCheck: rec.lastCheck,
  };
}

function maskKami(kami) {
  const s = String(kami || "");
  if (s.length <= 8) return s;
  return s.slice(0, 4) + "-****-****-" + s.slice(-4);
}

// ---------- 业务 ----------

async function notice() {
  try {
    const raw = await post(`/api/?id=notice`, `app=${CONF.appid}`);
    const j = decode(raw);
    if (j && j.code === 200 && j.msg) return { ok: true, text: String(j.msg.app_gg || "") };
    return { ok: false, text: "" };
  } catch (e) {
    return { ok: false, text: "", error: e.message };
  }
}

async function activate(kamiRaw) {
  const kami = String(kamiRaw || "").trim();
  if (!kami) return { ok: false, message: "请输入激活码" };
  if (kami.length < 6) return { ok: false, message: "激活码格式不正确" };

  const device = deviceId();
  const t = Math.floor(Date.now() / 1000);
  const value = String(Math.floor(Math.random() * 900000) + 100000);
  const s = md5(`kami=${kami}&markcode=${device}&t=${t}&${CONF.appkey}`);
  const qs = `kami=${kami}&markcode=${device}&t=${t}&sign=${s}&value=${value}`;
  const payload = `app=${CONF.appid}&data=${binToHex(rc4(qs, CONF.rc4key))}`;

  let json;
  try {
    json = decode(await post(`/api/?id=kmlogon`, payload));
  } catch (e) {
    return { ok: false, message: e.message };
  }

  if (!json || json.code !== CONF.success) {
    const msg = typeof json?.msg === "string" ? json.msg : "激活码无效或已被使用";
    return { ok: false, message: msg, code: json && json.code };
  }

  // 防重放：服务器回传的 time 必须与本机一致
  const srvTime = Number(json.time) || 0;
  if (srvTime && Math.abs(srvTime - t) > 120) {
    return { ok: false, message: "本机时间偏差过大，请校准系统时间后重试" };
  }
  const expect = md5(String(json.time) + CONF.appkey + value);
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

/** 重新联网校验已保存的卡密（续费/换机后用） */
async function reverify() {
  const rec = readLicense();
  if (!rec) return { ok: false, message: "本机尚未激活" };
  const res = await activate(rec.kami);
  if (res.ok) return res;
  return { ok: false, message: res.message, state: state() };
}

module.exports = {
  CONF,
  rc4,
  md5,
  decode,
  post,
  notice,
  activate,
  reverify,
  state,
  deviceCode,
  readLicense,
  clearLicense,
  maskKami,
};
