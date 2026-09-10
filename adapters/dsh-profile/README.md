# adapters/dsh-profile — DSH profile 常驻插件（已可完整常驻）

把 dsh-5ednd 变成 **重启后自动加载** 的 profile 插件：侧栏页签「D&D 角色」+ 规则检索工具 + HTTP 桥。

## 组成

| 文件 | 角色 |
|---|---|
| `lib/index.js` | host 半：`ctx.webServer.register` 暴露同源接口 `POST /dnd5e/api`（`{op,args}` → `{ok,value}`）；op 的真实实现在仓库 `engine/ui-host.latest.txt`（与动态插件共用同一份源码），首次调用时载入 |
| `lib/client.js` | client 半：**构建产物**（CJS + `window.__ModuleLoader__.load` 包装，React 由宿主 require 提供），内联完整 UI，通过 `fetch('/dnd5e/api')` 取数 |
| `cordis.patch.yml` | bundle 挂载行（含 `dataRoot` / `indexDir` 配置） |
| `package.json` | `main` / `exports["./client"]` / `dsh.bundle.patch` / `dsh.client.platform=web` / `dsh.client.inject=['dsh-better-sidebar']` |

## 构建

```bash
node tools/build-adapter.mjs     # 由 engine/ui-client.latest.txt 生成 lib/client.js（零依赖）
```

改 UI 后重跑该命令即可；改 host 逻辑后重启 DSH（host 半会重新读取仓库源码）。

## 安装（profile 级）

```bash
# 方式 A：官方 CLI
dsh plugin --profile tavern add link:<repo>/adapters/dsh-profile

# 方式 B：手工
#   profiles/tavern/package.json: dependencies 增加 "dsh-5ednd": "link:<repo>/adapters/dsh-profile"
#   并把 "dsh-5ednd" 同时加入 dependencies 与 dsh.profile.bundles
#   然后在 profiles/tavern 执行 pnpm install
```
安装后需**重启 DSH** 才会加载。

## 卸载

```bash
dsh plugin --profile tavern remove dsh-5ednd     # 或 pnpm remove + 从 bundles 删除
```

## 验证清单

- [ ] 重启后侧栏出现「D&D 角色」页签且列表/详情正常（client 半已加载）
- [ ] 详情页可新增自定物品、换装、改状态（HTTP 桥通）
- [ ] 详情页底部「规则查找」可检索（索引已在仓库内）
- [ ] AI 侧 `dnd_search_rules` / `dnd_read_rule` 可用