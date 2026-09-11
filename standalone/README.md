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

界面是 **IDE 式工作区**：地图、角色卡、战斗记录、规则速查、战况统计、建卡向导都是独立面板，
可以拖动分隔条调大小、折叠、最大化、在四个槽位（左/中/右/底）之间自由摆放，布局自动存到 `data/workspace.json`。

| 模块 | 说明 |
|---|---|
| **工作区** | 多面板 + 可拖拽分隔条 + 面板折叠/最大化 + 槽位移动（面板标题栏「⋯」）+ 顶部「面板 ▾」增删 + 一键重置布局 |
| **AI 对话** | 内置 DM 对话面板：**AI 可以直接调用这座桥上的全部能力**（42 个：规则书检索、模组检索、怪物数值解析、角色卡读写、战斗记录、战术地图、掷骰，以及 `plugins/` 扩展）。它掷的骰子、改的血量、摆的地图会**真实落盘**，你侧栏立刻能看到。工具调用过程在气泡下方逐条列出。 |
| **⚙ 设置** | 在这里填 API：Base URL（兼容 OpenAI 的 `/chat/completions`）+ API Key + 模型名，另有温度、每轮最大工具步数、补充指令；带「测试连接」和快捷 Base URL（openai / deepseek / moonshot / openrouter / ollama / lmstudio）。密钥写在 `data/ai.json`（也可用环境变量 `DND5E_AI_KEY` 覆盖）。 |
| **角色** | 建卡向导（SRD 范围内、购点、种族/职业/子职/背景/法术/装备全流程）、角色卡详情、升级到任意等级（子职/专长/法术/兼职）、装备栏、背包（套装可展开、逐件取出）、状态栏、手动改数值 |
| **🗺 战术地图** | 5 尺格网格、12 种地形（地面/岩壁/溪水·困难/荆棘·困难+半掩体/高地/洞口/门/木板/树/火堆/碎石/虚空）、可拖动单位（带 HP 血条）、拖动即折算距离并记账、点两格测距（5-10-5 规则 + 对角简化）、选中单位显示速度可达区、**自适应缩放**（格子自动填满面板，改窗口大小会重算）、导出 SVG |
| **🎲 战斗记录** | 骰子栏（骰式/优势/劣势/按角色预设定制）、时间线（轮次/攻击/伤害/治疗/移动/状态分色）、轮次推进、自动刷新、按角色或类型筛选，落盘 `data/combat-log.json` |
| **规则书** | 内置索引 **6803 条 / 39 本**（玩家手册、城主指南、怪物图鉴、XGE、TCE、模组、第三方…），关键词检索 + 按 id 读全文 |
| **模组** | **624 条 / 37 本**（含凡戴尔失落矿坑与破碎方尖碑的图鉴与魔法物品）；`mod.statblock` 能把图鉴条目解析成 AC/HP/速度/六维/CR/动作的结构化数值 |
| **战况统计** | 从战斗记录算每人攻击次数、命中率、重击、伤害、治疗、移动总尺数（示例插件） |
| **扩展插件** | `plugins/*.mjs` 自动挂到同一座桥上：遭遇战统计、规则速查、**地图导出 SVG + 外置图像模型调用** |

### AI 怎么接

1. 右上角或 AI 面板里的 **「⚙ 设置」** → 填 **Base URL / API Key / 模型** → 保存 → 「测试连接」。
   - OpenAI：`https://api.openai.com/v1`
   - DeepSeek：`https://api.deepseek.com/v1`
   - 本地：Ollama `http://127.0.0.1:11434/v1`、LM Studio `http://127.0.0.1:1234/v1`（本地模型不需要密钥）
2. 回到 **💬 AI 对话** 面板说话即可。AI 每轮会自己决定调用哪些工具，工具调用过程显示在回复下方。

AI 拿到的能力清单（`{"op":"ai.tools"}` 可查）：

```
角色：party.list / party.sheet / pc.apply / levelset.* / sheet.* / build.* …
骰子：roll.dice（优势劣势、弃骰；会写入战斗记录）
战斗记录：log.list / log.append / log.set
地图：map.get / map.set / map.terrain.set / map.token.add|move|update|remove / map.measure
规则书：rules.stats / rules.search / rules.read
模组：mod.list / mod.search / mod.read / mod.statblock（图鉴 → AC/HP/六维/CR/动作）
扩展：ext.encounter.stats / ext.rule.lookup / ext.image.map|list|provider|generate
```

系统提示里还会注入**当前真实状态**（战役与轮次、每人 HP 与状态与 id、地图名与全部单位坐标/HP），
所以 AI 一开口就知道现在轮到谁、谁快死了、谁站在哪个格子。相关 op：`ai.chat`（支持 `dryRun`）、`ai.history`、`ai.clear`、`ai.test`、`ai.tools`。

### 工作区怎么用

- **调大小**：拖面板之间的分隔条（竖条调左右宽度，横条调上下高度）。左侧/右侧宽度、底栏高度、同栏内面板比例都会记住。
- **折叠/最大化**：面板标题栏的 `▾` 和 `⤢`；最大化后按「还原布局」回来。
- **换位置**：面板标题栏 `⋯` → 选「移到槽位」（左/中/右/底，也可以让同一面板同时出现在多个槽位）。
- **加面板**：右上角「面板 ▾」→ 点未显示的面板（如「规则速查」「战况统计」「新建角色」）。
- **重置**：右上角「重置布局」，或 `node tools/dnd-api.mjs ws.reset '{}'`。
- 布局改动会自动写入 `data/workspace.json`；想在两边同步就把这个文件拷过去。


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
