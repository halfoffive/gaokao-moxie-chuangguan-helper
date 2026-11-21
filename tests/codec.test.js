import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CODE_PREFIX,
  FIELD_ORDER,
  crc5,
  decodeBase64Url,
  encodeBase64Url,
  encodePayload,
  makeCode,
  normalizePayload,
  parseCode,
} from '../src/lib/codec.js';
import { makeTemplatePayload, todayKey, weekKey, weekNo } from '../src/lib/template.js';

// 这两组期望值由源 HTML 里的原始 b64e / crc / makeCode 实际运行得到，
// 不是本实现重新算出来的；用于锁定逐字节兼容性。
const FIXTURE = {
  v: 1,
  c: '测试班',
  n: '测试号',
  w: 47,
  k: '2026-W47',
  d: '2026-11-21',
  s: 730,
  r: 96,
  wr: 100,
  t: 76,
  tc: 812,
  e: ['霭|归园田居·其一', '暮|岳阳楼记'],
  k2: 3,
  mc: 18,
  f: 0,
  u: 'a1b2c',
  dv: 'D9F3A1C2',
  sw: 1,
};

const FIXTURE_CODE =
  'GM1.eyJ2IjoxLCJjIjoi5rWL6K-V54-tIiwibiI6Iua1i-ivleWPtyIsInciOjQ3LCJrIjoiMjAyNi1XNDciLCJkIjoiMjAyNi0xMS0yMSIsInMiOjczMCwiciI6OTYsIndyIjoxMDAsInQiOjc2LCJ0YyI6ODEyLCJlIjpbIumcrXzlvZLlm63nlLDlsYXCt-WFtuS4gCIsIuaarnzlsrPpmLPmpbzorrAiXSwiazIiOjMsIm1jIjoxOCwiZiI6MCwidSI6ImExYjJjIiwiZHYiOiJEOUYzQTFDMiIsInN3IjoxfQ.135c6';

const SECOND = {
  v: 1,
  c: '示例班',
  n: '示例学生',
  w: 1,
  k: '2026-W01',
  d: '2026-01-01',
  s: 0,
  r: 0,
  wr: 0,
  t: 0,
  tc: 0,
  e: [],
  k2: 1,
  mc: 0,
  f: 1,
  u: '00000',
  dv: 'D00000000',
  sw: 0,
};

const SECOND_CODE =
  'GM1.eyJ2IjoxLCJjIjoi56S65L6L54-tIiwibiI6IuekuuS-i-WtpueUnyIsInciOjEsImsiOiIyMDI2LVcwMSIsImQiOiIyMDI2LTAxLTAxIiwicyI6MCwiciI6MCwid3IiOjAsInQiOjAsInRjIjowLCJlIjpbXSwiazIiOjEsIm1jIjowLCJmIjoxLCJ1IjoiMDAwMDAiLCJkdiI6IkQwMDAwMDAwMCIsInN3IjowfQ.bf16d';

// 从学生端原脚本复制的参考实现，只用于测试对照。
const referenceMakeCode = (payload) => {
  const b64e = (value) => {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const crc = (value) => {
    let hash = 5381;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
    }
    return hash.toString(16).slice(0, 5).padStart(5, '0');
  };
  const body = b64e(JSON.stringify(payload));
  return 'GM1.' + body + '.' + crc(body);
};

test('原始算法生成的 fixture 可逐字节复现', () => {
  assert.equal(makeCode(FIXTURE), FIXTURE_CODE);
  assert.equal(makeCode(SECOND), SECOND_CODE);
  assert.equal(referenceMakeCode(FIXTURE), FIXTURE_CODE);
});

test('合法成绩码可解码，并保持 payload', () => {
  const parsed = parseCode(FIXTURE_CODE);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.payload, FIXTURE);
  assert.equal(encodePayload(parsed.payload), FIXTURE_CODE);
  assert.equal(parseCode('  ' + FIXTURE_CODE + '\n').ok, true);
});

test('与原始实现覆盖多个 payload / Unicode', () => {
  const payloads = [
    FIXTURE,
    SECOND,
    { ...FIXTURE, n: '示例🙂', e: ['𠮷|测试篇'] },
    { ...SECOND, s: 995, r: 100, wr: 100, t: 76, tc: 599 },
  ];
  for (const payload of payloads) {
    const code = makeCode(payload);
    assert.equal(code, referenceMakeCode(payload));
    const parsed = parseCode(code);
    assert.equal(parsed.ok, true);
    assert.equal(makeCode(parsed.payload), code);
  }
});

test('base64url / UTF-8 往返', () => {
  for (const value of ['', 'ABC', '测试班/测试号', '示例🙂𠮷', 'a'.repeat(300)]) {
    assert.equal(decodeBase64Url(encodeBase64Url(value)), value);
  }
  assert.match(CODE_PREFIX, /^GM1$/);
});

test('非法的格式 / 校验位 / 载荷分别报错', () => {
  assert.equal(parseCode('').error.code, 'empty');
  assert.equal(parseCode('hello').error.code, 'format');
  assert.equal(parseCode(FIXTURE_CODE.toUpperCase()).error.code, 'format');

  const last = FIXTURE_CODE.at(-1);
  const badChecksum = FIXTURE_CODE.slice(0, -1) + (last === '0' ? '1' : '0');
  assert.equal(parseCode(badChecksum).error.code, 'checksum');

  const badBase64Body = 'a';
  const badBase64 = 'GM1.' + badBase64Body + '.' + crc5(badBase64Body);
  assert.equal(parseCode(badBase64).error.code, 'payload');

  const notJsonBody = encodeBase64Url('not json');
  const notJson = 'GM1.' + notJsonBody + '.' + crc5(notJsonBody);
  assert.equal(parseCode(notJson).error.code, 'json');

  const primitiveBody = encodeBase64Url('42');
  const primitive = 'GM1.' + primitiveBody + '.' + crc5(primitiveBody);
  assert.equal(parseCode(primitive).error.code, 'object');
});

test('normalizePayload 规整已知字段并保留未知字段', () => {
  const normalized = normalizePayload({
    s: '12.9',
    r: '101',
    c: '示例班',
    e: 'not-an-array',
    extra: { keep: true },
  });

  assert.equal(normalized.s, 12);
  assert.equal(normalized.r, 101);
  assert.equal(normalized.c, '示例班');
  assert.deepEqual(normalized.e, []);
  assert.deepEqual(normalized.extra, { keep: true });
  assert.deepEqual(Object.keys(normalized), ['c', 's', 'r', 'e', 'extra']);
});

test('字段表与周次工具', () => {
  assert.deepEqual(FIELD_ORDER, [
    'v', 'c', 'n', 'w', 'k', 'd', 's', 'r', 'wr', 't', 'tc', 'e', 'k2', 'mc', 'f', 'u', 'dv', 'sw',
  ]);

  assert.equal(weekNo(new Date(2026, 0, 1)), 1);
  assert.equal(weekNo(new Date(2026, 10, 21)), 47);
  assert.equal(weekNo(new Date(2026, 11, 31)), 53);
  assert.equal(weekKey(new Date(2026, 10, 21)), '2026-W47');
  assert.equal(todayKey(new Date(Date.UTC(2026, 10, 21, 23, 30))), '2026-11-21');

  const template = makeTemplatePayload(new Date(2026, 10, 21, 12, 0));
  assert.equal(template.w, 47);
  assert.equal(template.k, '2026-W47');
  assert.equal(template.d, '2026-11-21');
  assert.equal(parseCode(encodePayload(template)).ok, true);
});
