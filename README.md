# 成绩码编解码台

古诗文闯关学生端结算页「成绩码」的本地编解码工具。粘贴即可拆出所有字段，改动任一字段会立刻重算；还支持日期快捷、本机设备标识、学号指纹计算与候选推算。纯前端，不连接服务器。

## 快速开始

需要 Node.js 20.19 或更高版本（项目在 Node 24 上开发）。

```bash
npm install
npm run dev       # 本地开发，默认 http://127.0.0.1:5173
npm run build     # 生产构建，输出 dist/
npm run preview   # 预览生产构建
npm test          # 单元测试
```

技术栈：Vite 8、Vue 3（`<script setup>`）、Tailwind CSS 4。没有后端、路由或第三方 UI 组件。

## 怎么用

1. 打开页面，左侧会载入一条示例成绩码。
2. 把学生发来的成绩码粘贴到左侧文本框，右侧字段会自动拆开。
3. 修改班级、得分、错字记录等任意字段，左侧成绩码会立即重算。
4. 点「复制成绩码」即可发给学生或粘贴到收集表。
5. 成绩日期、周次、周键可以点「用今天」，或选一个日期一起更新。
6. 身份区的「使用本机设备标识」会复用本浏览器保存的随机 dv，没有就生成一个。
7. 学号指纹区可以正算「学号 → 指纹」，也可以按学号前缀列出与当前指纹相同的候选学号。

其他行为：

- 粘贴的合法成绩码会保留原文，不会因为解码被重排。
- 粘贴的码不合法时，状态栏会说明是格式、校验位、base64 还是 JSON 的问题；表单保留上一份合法数据，改动字段会重新生成。
- 成绩码里如果有本工具不认识的字段，会原样保留，并在表单底部提示。
- 清空输入框后，改动右侧字段仍然可以生成一条新成绩码。
- 不保存表单内容；只有点「使用本机设备标识」时会在 localStorage 写一个随机设备号（gm_helper_device），刷新后仍可复用。

## 成绩码格式

学生端结算页显示的字符串格式：

```
GM1.<base64url(JSON)>.<5 位校验>
```

- `GM1` 是格式版本前缀。
- 中段是成绩 JSON 的 UTF-8 字节经 base64url 编码的结果（无 `=` 填充）。
- 末段是 base64url 字符串的 djb2 散列：种子 5381，逐字符 `h = ((h << 5) + h + charCode) >>> 0`，取十六进制前 5 位，不足补 0。
- 这些规则和学生端源码里的 `makeCode` / `parseCode` 一致；`tests/codec.test.js` 里有由原函数实际生成的固定样例。

字段顺序固定为：

```
v, c, n, w, k, d, s, r, wr, t, tc, e, k2, mc, f, u, dv, sw
```

| 字段 | 含义 | 类型 |
| --- | --- | --- |
| `v` | 格式版本 | 数字 |
| `c` | 班级 | 字符串 |
| `n` | 姓名 | 字符串 |
| `w` | 周次 | 数字 |
| `k` | 周键，如 `2026-W47` | 字符串 |
| `d` | 成绩日期，如 `2026-11-21` | 字符串 |
| `s` | 得分 | 数字 |
| `r` | 总正确率（0–100） | 数字 |
| `wr` | 提笔验字正确率（0–100） | 数字 |
| `t` | 总题数 | 数字 |
| `tc` | 用时（秒） | 数字 |
| `e` | 错字记录，每条为「正确字\|篇名」 | 字符串数组 |
| `k2` | 本周第几次挑战 | 数字 |
| `mc` | 最高连击 | 数字 |
| `f` | 练习模式，0/1 | 数字 |
| `u` | 学号指纹，学号经单向散列得到的 5 位 | 字符串 |
| `dv` | 生成成绩码那台设备的标识 | 字符串 |
| `sw` | 本机换人标记，0/1 | 数字 |

字段缺失或未知时，工具不会擅自补默认值；生成时未知字段原样保留。

## 学号指纹

学生端的 `u` 字段由 `crc5("GM2026|" + 学号转大写)` 生成，只有 5 位十六进制。它**不是可逆加密**；而且这个 djb2 取前 5 位的做法对连续学号很不敏感，同一段连续学号常常得到完全相同的指纹。工具提供两个方向：

- **学号 → 指纹**：输入学号实时计算，可一键填入 `u`。
- **指纹 → 学号候选**：在指定学号前缀（4–9 位）内穷举，列出所有命中项。前缀越短范围越大；由于指纹碰撞，候选人可能成批相同，不能单独认定学生。拿到学号后做正向核对最可靠。

计算只在本机浏览器进行，不会上传，也不会保存名单。

## 目录结构

```
index.html
vite.config.js
src/
  App.vue                # 页面与双向同步
  components/
    FieldInput.vue       # 下划线字段输入
    StudentIdTool.vue    # 学号指纹计算与候选推算
  lib/
    codec.js             # 纯函数编解码
    device.js            # 本机随机设备标识
    fields.js            # 字段中文标签与提示
    student-id.js        # 学号指纹与范围搜索
    template.js          # 示例数据与周次工具
tests/
  codec.test.js
  features.test.js
  run.js
source-file/
  2026-11-20/            # 脱敏后的学生端参考页
```

编解码核心没有 Vue 或 DOM 依赖，浏览器和 Node 测试共用同一份实现。

## 关于学生端原文件

`source-file/2026-11-20/高考默写闯关_学生端.html` 是**脱敏参考版**：

- 真实学生姓名替换为「同学01」等占位名；
- 真实学号替换为占位号码；
- 腾讯文档收集表链接已清空；
- 题库和页面逻辑保留，方便核对成绩码格式。

含真实名单的原版仅保存在本地 `source-file/2026-11-20/.private/`，该目录已被 `.gitignore` 忽略，不进入仓库。工具运行时不读取这个 HTML，也不包含任何名单或学号。

## 故障排查

如果页面空白，控制台出现 `net::ERR_BLOCKED_BY_CLIENT`，且被拦资源名包含 `fingerprint`，通常是广告/隐私扩展按文件名拦截了模块。项目已把该模块改为 `student-id.js`，组件改为 `StudentIdTool.vue`；更新后请重启 `npm run dev` 并强制刷新页面。仍被拦截时，可把 `127.0.0.1:5173` 加入扩展白名单或临时停用扩展。

## 上传到 GitHub

本目录已经是 Git 仓库，并且配置了远端：

```
https://github.com/halfoffive/gaokao-moxie-chuangguan-helper
```

本地提交完成后，在能登录 GitHub 的终端执行：

```bash
git status
git remote -v
git push -u origin main
```

如果第一次 push 需要认证：

- 推荐让 Git Credential Manager 弹出浏览器登录；
- 或在 GitHub 创建 fine-grained personal access token（仓库 Contents 读写权限），push 时用户名填 GitHub 用户名、密码填 token；
- 或改用 SSH：

```bash
ssh-keygen -t ed25519 -C "你的 GitHub 邮箱"
# 把 ~/.ssh/id_ed25519.pub 加到 GitHub → Settings → SSH and GPG keys
ssh -T git@github.com
git remote set-url origin git@github.com:halfoffive/gaokao-moxie-chuangguan-helper.git
git push -u origin main
```

如果想传到另一个新仓库：在 GitHub 新建空仓库（不要勾 README / license / .gitignore），然后：

```bash
git remote set-url origin https://github.com/<你的用户名>/<新仓库名>.git
git push -u origin main
```

注意事项：

- 上传的是源码；`node_modules/`、`dist/`、`.cache/` 和含真实名单的 `.private/` 都被忽略。
- 仓库保持私有更稳妥；即使公开，仓库里也只有脱敏参考资料，没有学生身份数据。
- GitHub 上传不等于上线页面。要在线访问，可把 `npm run build` 的 `dist/` 部署到 Vercel、Netlify 或 GitHub Pages。

## 许可

Apache License 2.0，见 [LICENSE](LICENSE)。
