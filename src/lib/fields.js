/**
 * 表单字段元数据：只负责中文标签、输入类型和简短提示。
 * 真正的字段顺序与类型在 codec.js 中，避免两处各自定义。
 */

export const IDENTITY_FIELDS = [
  { key: 'c', label: '班级', type: 'text', hint: '成绩单上的班级' },
  { key: 'n', label: '姓名', type: 'text', hint: '成绩码里的姓名' },
  { key: 'u', label: '学号指纹', type: 'text', hint: '学号经单向散列后的 5 位，不是学号本身' },
  { key: 'dv', label: '设备标识', type: 'text', hint: '生成成绩码那台设备的随机标识' },
];

export const SCORE_FIELDS = [
  { key: 's', label: '得分', type: 'number', suffix: '分' },
  { key: 'r', label: '总正确率', type: 'number', suffix: '%' },
  { key: 'wr', label: '提笔验字', type: 'number', suffix: '%' },
  { key: 'mc', label: '最高连击', type: 'number' },
  { key: 't', label: '总题数', type: 'number', suffix: '题' },
  { key: 'tc', label: '用时', type: 'number', suffix: '秒' },
  { key: 'w', label: '周次', type: 'number', suffix: '周' },
  { key: 'k', label: '周键', type: 'text', placeholder: '2026-W47' },
  { key: 'd', label: '成绩日期', type: 'text', placeholder: '2026-11-21' },
  { key: 'k2', label: '本周第几次', type: 'number', suffix: '次' },
];

export const FLAG_FIELDS = [
  { key: 'f', label: '练习模式', hint: '不计分' },
  { key: 'sw', label: '本机换过账号', hint: '设备换人标记' },
];
