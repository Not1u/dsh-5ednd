# dsh-5ednd

D&D 5e 跑团套件 —— 面向各类 Harness（DSH Desktop / MCP / CLI）的角色卡、规则引擎与规则书检索器。

> 三层架构：**核心（core）零依赖** → **适配器（adapters）对接具体 Harness** → **数据（rules / characters）纯 JSON**。

## 功能

| 模块 | 说明 |
|---|---|
| **角色卡 UI** | 侧栏页签「D&D 角色」：列表 / 详情（特性悬停、法术伸缩、法术位菱形、状态栏、装备栏、背包卡片、等级调整、手动调整数值、兼职、升级选项） |
| **建卡向导** | 种族 / 职业 / 子职业（含龙种·地形等子选项）/ 背景 / 27 点购点 / 技能 / 法术 / 起始装备 |
| **规则引擎** | AC 与攻击推导、法术位（含兼职合并）、升级逐项补选、状态（15 种 5e 状态）、装备与自定物品 |
| **规则查找器** | 从本地规则书语料建立索引，支持关键词检索、按书过滤、条目全文展开 |
| **AI DM 工具** | `dnd_sheet` / `dnd_items` / `dnd_equip` / `dnd_conditions` 等，让 AI 直接按描述改写角色状态 |
| **离线测试** | 假 harness 回归（`tools/test-host.mjs`），改代码先本地跑，不靠线上撞错 |

## 目录结构

```
core/           零依赖核心：规则检索、配置解析、能力探测
adapters/       各 Harness 适配层（DSH 动态插件 / 持久插件 / MCP / CLI）
rules/          规则数据：职业、种族、背景、武器护甲、法术(0-9环)、子职业、专长、特性
characters/     角色档案（demo 模板：矮人战士 / 矮人牧师 / 高等精灵法师）
schema/         数据 Schema（character.v1）
tools/          索引器、检索 CLI、迁移脚本、离线测试
engine/         开发用源码快照（host / client）与校验脚本
data/rules-index/  ← 规则书索引（本地生成，不入库，见下）
```

## 快速开始

```bash
# 1) 生成规则书索引（需要你本地合法持有的规则书 HTML/CHM 语料）
node tools/index-rules.mjs --source "<规则书根目录>"        # 默认 PHB/DMG/PHB24/DMG24/速查/XGE/TCE
node tools/index-rules.mjs --source "<规则书根目录>" --all  # 全部书目

# 2) 检索
node tools/find-rules.mjs --stats
node tools/find-rules.mjs "擒抱"
node tools/find-rules.mjs "长休" --book 玩家手册
node tools/find-rules.mjs --read 玩家手册:15

# 3) 离线回归测试
node tools/test-host.mjs
node tools/test-equip.mjs
```

## 配置

数据根目录解析顺序（`core/config.mjs`）：

1. 环境变量 `DND5E_DATA_ROOT`
2. 仓库根目录的 `config.json`（`{ "dataRoot": "...", "indexDir": "..." }`）
3. 默认：仓库根目录

**不硬编码任何绝对路径**，换机器 / 换目录只需改配置。

## 兼容性策略（声明范围 + 能力探测 + 降级）

- **声明**：`engines.node >= 20`；插件声明 `dsh.client.platform = web`；peer 依赖使用宽松范围。
- **探测**：`core/capabilities.mjs` 启动时探测 `harness.handle` / `fs` 读写 / `tools` 服务 / Sidebar 服务 / timer 服务 / 主题 token，缺失即降级而非崩溃：

  | 缺失能力 | 降级行为 |
  |---|---|
  | Sidebar 服务 | UI 输出到独立面板或静态 HTML 状态页 |
  | `tools` 服务 | 使用内置 `node:fs` 直接读写档案 |
  | timer 服务 | 关闭自动热重载，改为手动刷新 |
  | 主题 token | 回退到内置默认配色 |

- **数据向前兼容**：档案带 `schemaVersion`，迁移脚本（`tools/migrate-*.mjs`）逐步升级，新字段一律可选。
- **版本锚点**：`dsh.json` 记录已验证的 DSH 版本，不匹配时给出明确提示。

## 许可与版权

- **代码**：MIT。
- **规则数据**（`rules/*.json`）：基于 SRD 5.1（CC-BY-4.0）整理，署名见 `NOTICE.md`。
- **规则书原文索引**（`data/rules-index/`）：**不随仓库分发**。由使用者用自己合法持有的规则书语料本地生成（`tools/index-rules.mjs`），仅存于本机，请勿公开上传。
