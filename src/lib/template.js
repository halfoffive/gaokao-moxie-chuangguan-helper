/**
 * 成绩码初始示例与周次工具。
 * weekNo / weekKey / todayKey 与学生端保持一致，包括 todayKey 使用 UTC 日期的细节。
 */

export const weekNo = (date = new Date()) => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
};

export const weekKey = (date = new Date()) =>
  date.getFullYear() + '-W' + String(weekNo(date)).padStart(2, '0');

export const todayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export const makeTemplatePayload = (date = new Date()) => ({
  v: 1,
  c: '测试班',
  n: '测试号',
  w: weekNo(date),
  k: weekKey(date),
  d: todayKey(date),
  s: 0,
  r: 0,
  wr: 0,
  t: 0,
  tc: 0,
  e: [],
  k2: 1,
  mc: 0,
  f: 0,
  u: '00000',
  dv: 'D00000000',
  sw: 0,
});
