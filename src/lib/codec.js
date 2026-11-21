/**
 * GM1 成绩码的纯函数编解码实现。
 * 算法、字段顺序和错误顺序都按学生端 v22 的 makeCode / parseCode 复刻，
 * 保证同一份成绩数据生成完全相同的字符串。
 */

export const CODE_PREFIX = 'GM1';

// 学生端 finish() 里对象 d 的键顺序；重新生成时必须保持一致。
export const FIELD_ORDER = Object.freeze([
  'v', 'c', 'n', 'w', 'k', 'd', 's', 'r', 'wr', 't', 'tc', 'e', 'k2', 'mc', 'f', 'u', 'dv', 'sw',
]);

// 这些字段在成绩码里是数字；其余是字符串（e 是字符串数组）。
export const NUMBER_FIELDS = new Set(['v', 'w', 's', 'r', 'wr', 't', 'tc', 'k2', 'mc', 'f', 'sw']);

const CODE_PATTERN = /^GM1\.([A-Za-z0-9_-]+)\.([0-9a-f]{5})$/;

const fail = (code, message) => ({ ok: false, error: { code, message } });

export const toInteger = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
};

// djb2 变体；游戏取十六进制的前 5 位，而不是常见的后 5 位。
export const crc5 = (text) => {
  const source = String(text);
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).slice(0, 5).padStart(5, '0');
};

export const encodeBase64Url = (text) => {
  const bytes = new TextEncoder().encode(String(text));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const decodeBase64Url = (encoded) => {
  let source = String(encoded).replace(/-/g, '+').replace(/_/g, '/');
  while (source.length % 4) {
    source += '=';
  }
  const binary = atob(source);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
};

export const makeCode = (payload) => {
  const body = encodeBase64Url(JSON.stringify(payload));
  return CODE_PREFIX + '.' + body + '.' + crc5(body);
};

/**
 * 解析字符串。错误顺序与游戏一致：格式 → 校验位 → base64 → JSON → 对象。
 * 成功时返回原始 payload；解析不会改写或重排字段。
 */
export const parseCode = (raw) => {
  const text = String(raw ?? '').trim();
  if (!text) {
    return fail('empty', '把学生发来的成绩码粘贴到这里，或直接改右侧数据生成一个。');
  }

  const matched = CODE_PATTERN.exec(text);
  if (!matched) {
    return fail('format', '格式不对：应以 GM1. 开头，并以 5 位小写十六进制校验码结尾。');
  }

  const [, body, checksum] = matched;
  if (crc5(body) !== checksum) {
    return fail('checksum', '校验位不符：成绩码可能被改动，或复制时漏掉了一部分。');
  }

  let json;
  try {
    json = decodeBase64Url(body);
  } catch {
    return fail('payload', '中段载荷无法按 base64url 解码，这条成绩码已损坏。');
  }

  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    return fail('json', '载荷不是合法的 JSON，无法读取成绩字段。');
  }

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return fail('object', '载荷不是成绩对象，无法读取字段。');
  }

  return { ok: true, payload, body, checksum };
};

const normalizeValue = (key, value) => {
  if (NUMBER_FIELDS.has(key)) return toInteger(value);
  if (key === 'e') return Array.isArray(value) ? value.map((item) => String(item)) : [];
  return value == null ? '' : String(value);
};

/**
 * 固定已知字段顺序，规整类型；未知字段原样追加，便于兼容未来版本。
 * 仅在“用表单生成”时使用，解码展示不会借此改写原码。
 */
export const normalizePayload = (payload) => {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const normalized = {};

  for (const key of FIELD_ORDER) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      normalized[key] = normalizeValue(key, source[key]);
    }
  }

  for (const [key, value] of Object.entries(source)) {
    if (!FIELD_ORDER.includes(key)) normalized[key] = value;
  }

  return normalized;
};

export const encodePayload = (payload) => makeCode(normalizePayload(payload));
