/**
 * 本机随机设备标识：格式与学生端 dv 一致（D + 8 位大写字母/数字）。
 * 只有用户点击「使用本机设备标识」时才读写 localStorage；
 * 如果同源页面已保存学生端的 gm_dev，优先复用它。
 */

export const DEVICE_STORAGE_KEY = 'gm_helper_device';
export const GAME_DEVICE_KEY = 'gm_dev';
const DEVICE_PATTERN = /^D[A-Z0-9]{8}$/;

const normalize = (value) => String(value ?? '').trim().toUpperCase();

export const makeDeviceId = () => {
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, '0').slice(0, 8);
  return 'D' + suffix;
};

export const readOrCreateDeviceId = (storage) => {
  try {
    const store = storage ?? globalThis.localStorage;
    if (!store) return makeDeviceId();

    const saved = normalize(store.getItem(DEVICE_STORAGE_KEY));
    if (DEVICE_PATTERN.test(saved)) return saved;

    const fromGame = normalize(store.getItem(GAME_DEVICE_KEY));
    const next = DEVICE_PATTERN.test(fromGame) ? fromGame : makeDeviceId();
    store.setItem(DEVICE_STORAGE_KEY, next);
    return next;
  } catch {
    // 隐私模式 / 禁用存储时仍然给一个本次可用的标识。
    return makeDeviceId();
  }
};
