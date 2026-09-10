# adapters/dsh-profile — DSH profile 常驻插件

把 dsh-5ednd 变成 **重启后自动加载** 的 profile 插件（不再依赖动态插件）。

## 当前状态

| 部分 | 状态 | 说明 |
|---|---|---|
| `lib/index.js`（host 半） | ✅ 可用 | 注册 `dnd_search_rules` / `dnd_read_rule`，直接从仓库 `core/rules-finder.mjs` 读取本地索引 |
| `cordis.patch.yml` | ✅ 可用 | 声明 bundle 挂载行（含 `dataRoot` / `indexDir` 配置） |
| `package.json` | ✅ 可用 | `main` / `exports["./client"]` / `dsh.bundle.patch` / `dsh.client.platform=web` |
| `lib/client.js`（client 半） | ⚠️ 占位 | 仅注册一个状态页签；完整界面仍需自包含构建产物 |

## 为什么会卡在 client 半

动态插件的 client 半由 DSH 运行器注入 `React` / `host.call` / `styles.insert` 等 builtin；
**profile 常驻插件的 client 半必须是自包含的浏览器 ESM**（如 `dsh-better-sidebar` 用 tsdown 打包成单文件，
`lib/client.js` 1.2 MB 内含 React 使用代码与全部依赖）。

要把本仓库的 UI（`engine/ui-client.latest.txt`）变成常驻，有两条路：

1. **引入一次性构建链**（推荐）
   ```bash
   cd adapters/dsh-profile
   pnpm add -D tsdown react react-dom
   # 把 engine/ui-client.latest.txt 适配为 client.src.js（加 import React from 'react'）
   pnpm exec tsdown client.src.js --format esm --out-dir lib
   ```
   产物 `lib/client.js` 覆盖占位文件后，界面即完全常驻。

2. **保持动态 UI + 常驻 host**（零构建）
   host 半提供工具与数据接口，UI 继续用动态插件挂载（`engine/ui-host.latest.txt` + `ui-client.latest.txt`）。
   代价：DSH 重启后需要重新激活动态插件（但规则工具、AI 查规则、角色数据全部照常）。

## 安装（profile 级）

```bash
# 方式 A：官方 CLI（会自动把 dsh-5ednd 加入 dsh.profile.bundles）
dsh plugin --profile tavern add link:E:/HarnessTarvern/dnd5e/adapters/dsh-profile

# 方式 B：手工挂载
#   1) profiles/<name>/package.json 的 dependencies 加： "dsh-5ednd": "link:E:/HarnessTarvern/dnd5e/adapters/dsh-profile"
#   2) dependencies 与 dsh.profile.bundles 都要包含 "dsh-5ednd"
#   3) 在 profile 目录执行 pnpm install
```

## 卸载

```bash
dsh plugin --profile tavern remove dsh-5ednd     # 或用 pnpm remove 并从 bundles 中删除该行
```

## 配置

`cordis.patch.yml` 中的 `config`：

| 键 | 说明 |
|---|---|
| `dataRoot` | 数据根（rules / characters 所在），默认环境变量 `DND5E_DATA_ROOT`，再默认仓库根 |
| `indexDir` | 规则书索引目录，默认 `<dataRoot>/data/rules-index` |

## 验证清单

- [ ] 重启 DSH 后，`dnd_search_rules` 在工具列表中可见（AI DM 可直接查规则）
- [ ] 侧栏出现「D&D 5e」状态页签（证明 client 半已加载）
- [ ] 若接入构建产物：侧栏「D&D 角色」完整界面在重启后依然存在
