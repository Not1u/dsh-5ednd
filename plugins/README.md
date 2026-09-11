# plugins/ — 桥上的扩展插件目录

这里是「所有接口都留着」的落点：任何放在本目录、以 `.mjs` 结尾的模块都会被 `/dnd5e/api` 自动挂载，
**不需要改核心代码**，也不需要重新打包。侧栏 UI、AI（DM）、你自己的脚本，走的是同一座桥。

## 最小插件

```js
export const name = 'my-plugin'

export const ops = {
  'ext.my.hello': async (args, api) => {
    return { ok: true, echo: args && args.who, repo: api.repoRoot }
  },
}
```

调用：

```bash
node tools/dnd-api.mjs ext.my.hello '{"who":"图里尔"}'
```

## setup 形态（可做初始化 / 返回额外 op）

```js
export const name = 'my-plugin'
export const setup = (api) => ({
  'ext.my.op': async (args) => ({ ok: true, rows: await api.readJson('data/combat-log.json').then(j => j.entries.length) }),
})
```

## api 能拿到什么

| 成员 | 说明 |
|---|---|
| `api.repoRoot` | 仓库根目录绝对路径（跨机器可移植） |
| `api.call(op, args)` | 调用**任意**已注册 op：核心 op（`party.list`、`map.get`、`roll.dice`…）或别的插件 op |
| `api.readJson(rel)` / `api.writeJson(rel, obj)` | 相对仓库根的 JSON 读写（自带 BOM 处理） |
| `api.log(msg)` | 写日志到宿主控制台 |

## 现成示例

| 文件 | op | 作用 |
|---|---|---|
| `encounter-stats.mjs` | `ext.encounter.stats` | 读战斗记录，统计每人攻击次数/命中率/伤害/治疗/移动距离 |
| `rule-lookup.mjs` | `ext.rule.lookup` | 关键词 → 直接返回规则书正文（内部编排 `rules.search` + `rules.read`） |

## 发现已加载的插件

```bash
node tools/dnd-api.mjs ext.list
```

返回核心 op 清单、已加载插件及其 op 名。加载失败（语法错误等）不会拖垮核心，只在 `ext.list` 里显示 `(加载失败)`。

## 约定

- 文件名不要以 `_` 开头（会被跳过，用于草稿）。
- op 名用 `ext.` 前缀，避免与核心 op 冲突。
- 返回 `{ ok: false, error: '...' }` 表示业务失败；抛异常会被桥接成 `{ ok: false, error }`。
- 插件按 mtime 热重载：改完文件下次调用即生效，**不用重启**。
