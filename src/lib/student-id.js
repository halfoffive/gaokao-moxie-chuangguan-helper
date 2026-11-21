/**
 * 文件名刻意避开 "fingerprint"：部分隐私扩展会按资源名拦截，导致整页空白。
 * 学号指纹：学生端 uidOf(code) = crc5('GM2026|' + code.toUpperCase())。
 * 指纹只有 5 位十六进制（20 bit），不是可逆加密；同指纹可能对应大量学号。
 * 这里提供正向计算和在指定学号前缀内穷举候选，供核对使用。
 */

import { crc5 } from './codec.js';

export const FINGERPRINT_SALT = 'GM2026|';
const FINGERPRINT_PATTERN = /^[0-9a-f]{5}$/;
const PREFIX_PATTERN = /^\d{4,9}$/;
const MAX_MATCHES = 2000;

export const isFingerprint = (value) => FINGERPRINT_PATTERN.test(String(value ?? '').trim().toLowerCase());

export const fingerprintOf = (studentCode) =>
  crc5(FINGERPRINT_SALT + String(studentCode ?? '').trim().toUpperCase());

/**
 * 在 prefix + 剩余数字（补足 10 位）中搜索目标指纹。
 * prefix 至少 4 位，因此最多扫描 100 万个学号；结果可能不唯一。
 */
export const findFingerprintMatches = ({ fingerprint, prefix }) => {
  const target = String(fingerprint ?? '').trim().toLowerCase();
  const head = String(prefix ?? '').trim();

  if (!FINGERPRINT_PATTERN.test(target)) {
    return { ok: false, error: '指纹应为 5 位十六进制。', matches: [], searched: 0, truncated: false };
  }
  if (!PREFIX_PATTERN.test(head)) {
    return { ok: false, error: '学号前缀应为 4–9 位数字。', matches: [], searched: 0, truncated: false };
  }

  const width = 10 - head.length;
  const total = 10 ** width;
  const matches = [];

  for (let index = 0; index < total; index += 1) {
    const candidate = head + String(index).padStart(width, '0');
    if (fingerprintOf(candidate) === target) {
      matches.push(candidate);
      if (matches.length >= MAX_MATCHES) break;
    }
  }

  return { ok: true, matches, searched: total, truncated: matches.length >= MAX_MATCHES };
};
