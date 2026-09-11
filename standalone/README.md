# SoloTRPG

**单人跑团独立运行器** —— 把规则书、模组、角色卡、战术地图、战斗记录都装进一个本地服务，
AI 当 DM，你只需要一个浏览器。**不依赖 DSH，也不依赖本机安装 Node。**

## 两种启动方式

```
双击  SoloTRPG.exe          ← 打包好的单文件程序（内含 Node 运行时，88 MB）
```

```bash
node server.mjs            # 或用 Node 直接跑（开发/调试用），默认 http://127.0.0.1:4620
```

**打包成 exe**（已构建好，需要重建时）：

```bash
npm run icon        # 生成 app/icon.ico（纯 Node 画的 d20 图标）
npm run build:exe   # Node SEA：Node 运行时 + 启动器 + 图标 → SoloTRPG.exe
```

exe 的行为：定位同目录的数据 → 起服务 → 等端口就绪 → 自动打开浏览器 → 关闭控制台窗口即停止。
端口已在跑时会直接打开浏览器，不会重复起服务（`SOLOTRPG_NO_BROWSER=1` 可禁用自动开浏览器）。

> exe 需要与 `server.mjs`、`engine/`、`rules/`、`data/`、`characters/`、`plugins/` 放在同一层目录，整个文件夹就是"绿色版"，拷到任何地方都能跑。首次运行 Windows 可能提示"未知发布者"（未签名），点"仍要运行"即可。

---

## 现在有什么

| 模块 | 说明 |
|---|---|
| **角色** | 建卡向导（SRD 范围内、购点、种族/职业/子职/背景/法术/装备全流程）、角色卡详情、升级到任意等级（子职/专长/法术/兼职）、装备栏、背包（套装可展开、逐件取出）、状态栏、手动改数值 |
| **🗺 战术地图** | 5 尺格网格、12 种地形（地面/岩壁/溪水·困难/荆棘·困难+半掩体/高地/洞口/门/木板/树/火堆/碎石/虚空）、可拖动单位（带 HP 血条）、拖动即折算距离并记账、点两格测距（5-10-5 规则 + 对角简化）、选中单位显示速度可达区、缩放、全屏（Esc 退出）、导出 SVG |
| **🎲 战斗记录** | 骰子栏（骰式/优势/劣势/按角色预设定制）、时间线（轮次/攻击/伤害/治疗/移动/状态分色）、轮次推进、自动刷新、按角色或类型筛选，落盘 `data/combat-log.json` |
| **规则书** | 内置索引 **6803 条 / 39 本**（玩家手册、城主指南、怪物图鉴、XGE、TCE、模组、第三方…），关键词检索 + 按 id 读全文 |
| **模组** | **624 条 / 37 本**（含凡戴尔失落矿坑与破碎方尖碑的图鉴与魔法物品）；`mod.statblock` 能把图鉴条目解析成 AC/HP/速度/六维/CR/动作的结构化数值 |
| **扩展插件** | `plugins/*.mjs` 自动挂到同一座桥上：遭遇战统计、规则速查、**地图导出 SVG + 外置图像模型调用** |

## 目录

```
SoloTRPG/
  SoloTRPG.exe            ★ 打包好的单文件程序（内含 Node 运行时）
  server.mjs              独立运行器（HTTP 服务 + 引擎装载 + 插件装载，均支持热重载）
  config.json             端口 / 绑定地址 / 数据根目录
  start.bat               双击启动（优先用 exe，没有则回退到 node）
  app/                    外壳页面（index.html + mount.js + app.css + vendor/react + icon.ico）
  engine/                 引擎源码（ui-host.latest.txt / ui-client.latest.txt）★ 核心
  rules/                  SRD 数据（种族/职业/法术/子职/专长/特性/套装）
  data/rules-index/       规则书与模组索引（jsonl + manifest）
  data/map.json           战术地图
  data/combat-log.json    战斗记录
  characters/             角色卡
  plugins/                扩展插件
  tools/                  sync-from-repo · health · smoke-ui · dnd-api · seed-demo-map · build-exe · make-icon
  build/                  构建中间产物（SEA blob、postject/resedit，勿删也行）
```

## 常用命令

```bash
npm start                                   # = node server.mjs
npm run build:exe                           # 重新打包 exe
node tools/health.mjs                       # 接口体检：页面、核心 op、插件、读写落盘
node tools/smoke-ui.mjs                     # UI 冒烟：不开浏览器，渲染全部 15 个面板，抓未定义引用
node tools/dnd-api.mjs tools.list '{}'      # 命令行调桥上任意 op
node tools/dnd-api.mjs mod.statblock '{"title":"熊地精"}'
node tools/sync-from-repo.mjs               # 从开发仓库同步外壳/引擎/规则/模组/插件（单向）
node tools/sync-from-repo.mjs --force       # 连角色卡/地图/战斗记录一起覆盖
```

## 接口 = 扩展点

所有能力都在一座同源 HTTP 桥上：

```
POST /api            {op, args} → {ok, value}        （/dnd5e/api 是同一路由的别名）
GET  /files/<path>   查看仓库内文件（例如导出的地图 SVG）
GET  /health         健康检查 + 已注册 op 与插件
```

- 发现能力：`{"op":"tools.list"}`（核心 op，按组分类）、`{"op":"ext.list"}`（插件 op）。
- AI / 脚本 / 插件走的是同一座桥，**数据留在磁盘上，按需取用**，不往上下文里塞全文。
- 加功能不用改核心：往 `plugins/` 丢一个 `.mjs`（导出 `ops` 或 `setup(api)`），改完自动热重载。

```js
// plugins/my-plugin.mjs
export const name = 'my-plugin'
export const ops = {
  'ext.my.op': async (args, api) => ({ ok: true, n: (await api.readJson('data/combat-log.json')).entries.length }),
}
```

## 与开发仓库的关系

`E:\HarnessTarvern\dnd5e` 是开发源（也是 GitHub 仓库），本目录是**可运行的产品形态**：

```
开发仓库  ── node tools/sync-from-repo.mjs ──▶  SoloTRPG（运行）
   standalone/  →  外壳（server / 页面 / 打包脚本）
   engine/ rules/ plugins/ tools/ characters/ data/
```

- 同一份 `engine/ui-client.latest.txt` 既是 DSH 侧栏插件的 UI，也是这里整页应用的 UI。
- 引擎与插件都按 mtime 热重载：改 `engine/` 或 `plugins/` 下的文件，**刷新页面即生效，不用重启**。
- 角色卡、地图、战斗记录默认**不覆盖**（sync 时加 `--force` 才会），避免手滑清掉存档。

## 说明

- 需要 Node ≥ 20（用到 `fetch`、`node:crypto`）。
- React 运行库放在 `app/vendor/`（React 18.3.1 UMD，随目录自带，可离线运行）。
- 规则书索引版权归原作者与出版方，仅供本地单人跑团自用；见 `NOTICE.md`。
