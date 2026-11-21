import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEVICE_STORAGE_KEY,
  GAME_DEVICE_KEY,
  makeDeviceId,
  readOrCreateDeviceId,
} from '../src/lib/device.js';
import { fingerprintOf, findFingerprintMatches, isFingerprint } from '../src/lib/fingerprint.js';

const fakeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    map,
  };
};

test('本机设备标识格式正确、持久化且可复用', () => {
  for (let index = 0; index < 20; index += 1) {
    assert.match(makeDeviceId(), /^D[A-Z0-9]{8}$/);
  }

  const storage = fakeStorage();
  const first = readOrCreateDeviceId(storage);
  assert.match(first, /^D[A-Z0-9]{8}$/);
  assert.equal(storage.getItem(DEVICE_STORAGE_KEY), first);
  assert.equal(readOrCreateDeviceId(storage), first);

  const gameStorage = fakeStorage({ [GAME_DEVICE_KEY]: 'dabcdefgh' });
  assert.equal(readOrCreateDeviceId(gameStorage), 'DABCDEFGH');
  assert.equal(gameStorage.getItem(DEVICE_STORAGE_KEY), 'DABCDEFGH');

  const invalid = fakeStorage({ [DEVICE_STORAGE_KEY]: 'bad' });
  const repaired = readOrCreateDeviceId(invalid);
  assert.match(repaired, /^D[A-Z0-9]{8}$/);
  assert.equal(invalid.getItem(DEVICE_STORAGE_KEY), repaired);

  const denied = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
  };
  assert.match(readOrCreateDeviceId(denied), /^D[A-Z0-9]{8}$/);
});

test('学号指纹和原始 uidOf 的固定向量一致', () => {
  const vectors = {
    '1234567890': '44856',
    TEST01: 'a007f',
    '2024123456': '2978e',
    '2024000001': '26fdd',
  };
  for (const [code, expected] of Object.entries(vectors)) {
    assert.equal(fingerprintOf(code), expected);
  }
  assert.equal(fingerprintOf('test01'), 'a007f');
  assert.equal(isFingerprint('44856'), true);
  assert.equal(isFingerprint('4485'), false);
  assert.equal(isFingerprint('zzzzz'), false);
});

test('按学号前缀推算指纹候选', () => {
  const code = '2024123456';
  const target = fingerprintOf(code);
  assert.equal(target, '2978e');

  const result = findFingerprintMatches({ fingerprint: target, prefix: '202412345' });
  assert.equal(result.ok, true);
  assert.equal(result.searched, 10);
  assert.ok(result.matches.includes(code));
  for (const match of result.matches) {
    assert.equal(fingerprintOf(match), target);
    assert.match(match, /^202412345\d$/);
  }

  assert.equal(findFingerprintMatches({ fingerprint: 'zzzzz', prefix: '2024' }).ok, false);
  assert.equal(findFingerprintMatches({ fingerprint: target, prefix: '202' }).ok, false);
  assert.equal(findFingerprintMatches({ fingerprint: target, prefix: '2024123456' }).ok, false);
});
