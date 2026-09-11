#!/usr/bin/env node
/**
 * UI 冒烟测试（两段式，不开浏览器）：
 *   1) 基础：用桩 React 装载 UI 源码，逐个渲染全部面板，抓 "X is not defined / 组件未定义 / 渲染异常"。
 *   2) 深度：给核心 op 灌入假数据，**两遍渲染** Workspace（先跑 effect，等异步回来，再渲染一次），
 *      然后对真实工作区结构做断言：地图格子数、单位数、战斗记录条数、面板槽位等。
 *
 *   node tools/smoke-ui.mjs                        # 测 engine/ui-client.latest.txt
 *   node tools/smoke-ui.mjs <path-to-ui-source>
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SRC_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'engine', 'ui-client.latest.txt')

let src = fs.readFileSync(SRC_PATH, 'utf8')
if (src.charCodeAt(0) === 0xfeff) src = src.slice(1)

const problems = []
const notes = []
let nodes = 0
const seen = new Set()

// ---------- 假数据 ----------
const SHEET = {
  id: 'pc-test', name: '测试角色', level: 3, xp: 900, xpNext: 2700, xpPrev: 900, race: '矮人·山丘',
  classes: ['战士 Lv3'], clsKeys: ['fighter'], hp: { cur: 24, max: 31, temp: 0 }, ac: 18, acOverride: null,
  acBreakdown: '链甲 16 ｜ 盾牌 +2', pb: 2, dc: null, attack: null, hitDice: '3d10',
  mods: { str: 3, dex: 1, con: 3, int: 0, wis: 1, cha: -1 }, saves: { str: 5, dex: 1, con: 5, int: 0, wis: 1, cha: -1 },
  saveProfs: ['str', 'con'],
  weaponStats: { main: { key: 'longsword', name: '长剑', damage: '1d8', dmgType: 'slashing', ability: 'str', attack: 5, dmgBonus: 3 }, off: null },
  equipment: { armor: { key: 'chainMail', name: '链甲', base: 16, dexCap: 0 }, shield: { key: 'shield', name: '盾牌', acBonus: 2 }, mainHand: { key: 'longsword', name: '长剑', damage: '1d8', dmgType: 'slashing' }, offHand: null, worn: [] },
  conditions: [{ key: 'prone', name: '倒地', desc: '' }], conditionCatalog: [{ key: 'prone', name: '倒地', desc: '只能爬行' }, { key: 'exhaustion', name: '力竭', level: 1, desc: '等级' }],
  resources: [{ name: '回气', max: 1, note: '短休恢复' }],
  subclass: { name: '勇士', picks: {}, features: [{ name: '强化重击', desc: '19-20 重击' }] },
  choices: { pactBoon: null, invocations: [], feats: ['巨武斗士'] },
  features: { race: [{ name: '黑暗视觉', desc: '60 尺' }], class: [{ name: '回气', desc: '' }], background: [{ name: '军人', desc: '' }] },
  spells: [{ key: 'magicMissile', name: '魔法飞弹', level: 1, school: '塑能', time: '1 动作', range: '120 尺', duration: '立即', fx: '3d4+3 力场' }],
  slots: [{ lv: 1, max: 2 }],
  legend: null,
  inventory: [{ key: 'torch', name: '火把', qty: 3, kind: 'gear' }, { key: 'explorersPack', name: '探险家套装', kind: 'pack', container: true, contents: [{ key: 'ration', name: '干粮', qty: 10 }] }],
}
const W = 8, H = 5
const MAP = {
  ok: true, name: '测试地图', campaign: 'x', w: W, h: H, cell: 5,
  terrain: Array.from({ length: H }, (_, y) => (y === 0 ? '#'.repeat(W) : ('.'.repeat(W - 2) + '~~'))),
  tokens: [
    { id: 'pc-turiel', name: '图里尔', kind: 'pc', x: 1, y: 1, hp: 3, max: 7, speed: 30, size: 1, note: '' },
    { id: 'gb-a', name: '地精A', kind: 'enemy', x: 4, y: 2, hp: 6, max: 7, speed: 30, size: 1, note: '' },
  ],
  legend: [['.', '地面'], ['#', '岩壁'], ['~', '溪水·困难']],
}
const LOG = {
  ok: true, campaign: '测试战役', round: 2, total: 3,
  entries: [
    { id: 'e1', round: 1, kind: 'turn', actor: 'DM', text: 'R1', detail: '' },
    { id: 'e2', round: 1, kind: 'attack', actor: '图里尔', text: '火焰箭 → 地精A', detail: '1d20+5 → [10] +5 = 15 命中' },
    { id: 'e3', round: 2, kind: 'move', actor: '布洛林', text: 'B2 → C3', detail: '移动 5 尺（1 格）' },
  ],
}
const PARTY = { ok: true, items: [{ id: 'pc-test', name: '测试角色', race: '矮人', cls: '战士3', level: 3, hp: 24, max: 31 }] }
const WS = { ok: true, layout: null }  // 由 UI 自身默认布局兜底

const CANNED = {
  'ws.get': WS, 'party.list': PARTY, 'party.sheet': { ok: true, sheet: SHEET }, 'map.get': MAP, 'log.list': LOG,
  'rules.stats': { ok: true, total: 6803, books: [{ book: '玩家手册', entries: 166 }] },
  'rules.search': { ok: true, items: [{ id: 'r1', title: '战斗', book: '玩家手册', snippet: '…' }] },
  'ext.encounter.stats': { ok: true, rows: [{ actor: '图里尔', attacks: 3, hits: 1, hitRate: '33%', crits: 0, damage: 9, healed: 0, feet: 15 }] },
  'ext.image.map': { ok: true, summary: '已导出 data/images/map-test.svg' },
  'build.options': { ok: true, races: [], classes: [], backgrounds: [], weapons: [], armor: [], packs: [] },
}

// ---------- 桩 React（带每组件状态格 + effect 立即执行）----------
const stateStore = new Map()
let hookIdx = 0
let curComp = ''
const cleanups = []
const ReactStub = {
  createElement(type, props) {
    if (type === undefined) throw new Error('createElement 收到 undefined —— 多半是某个组件/常量没定义')
    if (type === null) throw new Error('createElement 收到 null')
    if (typeof type !== 'function' && typeof type !== 'string') throw new Error('非法组件类型: ' + String(type))
    const children = Array.prototype.slice.call(arguments, 2)
    const p = Object.assign({}, props || {})
    if (children.length) p.children = children.length === 1 ? children[0] : children
    return { type: type, props: p, children: children, key: (props && props.key !== undefined) ? props.key : null }
  },
  Component: class Component {
    constructor(props) { this.props = props || {}; this.state = {}; this.context = null }
    setState(s) { this.state = Object.assign({}, this.state, typeof s === 'function' ? s(this.state, this.props) : s) }
    componentDidCatch() { }
    render() { return null }
  },
  PureComponent: class PureComponent {
    constructor(props) { this.props = props || {}; this.state = {} }
    setState(s) { this.state = Object.assign({}, this.state, typeof s === 'function' ? s(this.state, this.props) : s) }
    render() { return null }
  },
  useState(init) {
    const key = curComp + '#' + (hookIdx++)
    if (!stateStore.has(key)) stateStore.set(key, typeof init === 'function' ? init() : init)
    const set = (v) => { stateStore.set(key, typeof v === 'function' ? v(stateStore.get(key)) : v) }
    return [stateStore.get(key), set]
  },
  useEffect(fn) { try { const d = fn(); if (typeof d === 'function') cleanups.push(d) } catch (e) { problems.push('useEffect 异常：' + (e && e.message || e)) } },
  useLayoutEffect() { },
  useRef(v) { const key = curComp + '@ref#' + (hookIdx++); if (!stateStore.has(key)) stateStore.set(key, { current: v === undefined ? null : v }); return stateStore.get(key) },
  useMemo(fn) { try { return fn() } catch (e) { return undefined } },
  useCallback(fn) { return fn },
  useReducer(_r, init) { return [init, () => { }] },
  createContext(def) { return { Provider: 'ctx', Consumer: 'ctx', _currentValue: def } },
  Fragment: 'Fragment',
  StrictMode: 'StrictMode',
}
const RENDERED = []
const consoleStub = { log() { }, warn() { }, error() { }, info() { } }
const hostStub = {
  call: async (op) => {
    RENDERED.push(op)
    if (Object.prototype.hasOwnProperty.call(CANNED, op)) return CANNED[op]
    return { ok: false, error: 'no canned data for ' + op }
  },
}
const stylesStub = { insert: () => () => { } }

function captureScope(code) {
  const marker = 'return {\n  apply(ctx) {'
  if (!code.includes(marker)) return code
  const names = ['Card', 'Pips', 'XpWidget', 'Sect', 'ChoiceBox', 'LevelSet', 'ManualEdit', 'StatusPanel', 'EquipPanel',
    'Bag', 'RulesPanel', 'Multiclass', 'Wizard', 'Detail', 'MapPanel', 'LogView', 'LogRow', 'DiceBar', 'PartyView',
    'Workspace', 'Roster', 'SheetHost', 'StatsPanel', 'PanelFrame', 'PANEL_DEFS', 'DEFAULT_LAYOUT', 'normLayout',
    'slotOf', 'inLayout', 'cellDist', 'cloneLayout', 'TERRAIN', 'WS_SLOTS']
  return code.replace(marker, 'globalThis.__UI_SCOPE__ = { ' + names.join(', ') + ' }\n' + marker)
}

function invoke(fn, props) {
  const isClass = !!(fn.prototype && typeof fn.prototype.render === 'function')
  curComp = fn.name || 'anonymous'
  hookIdx = 0
  if (isClass) { const inst = new fn(props || {}); return inst.render() }
  return fn(props || {})
}

let collector = null
function walk(node, depth) {
  if (node === null || node === undefined || typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return
  nodes++
  if (Array.isArray(node)) { node.forEach((n) => walk(n, depth)); return }
  if (typeof node === 'object' && node.type) {
    const label = typeof node.type === 'function' ? (node.type.name || 'anonymous') : String(node.type)
    if (typeof node.type === 'function') {
      if (depth > 18) return
      const p = node.props || {}
      const key = label + ':' + depth + ':' + String(p.id || p.title || p.name || (node.key !== null && node.key !== undefined ? node.key : ''))
      if (seen.has(key)) return
      seen.add(key)
      let out
      try { out = invoke(node.type, node.props) } catch (e) { problems.push('组件 ' + label + '() 渲染异常：' + (e && e.message || e)); return }
      walk(out, depth + 1)
      return
    }
    if (collector && typeof node.props.className === 'string') collector.push(node.props.className)
    // 只走 children：桩 createElement 里 props.children 与 children 指向同一批对象，两个都走会指数膨胀
    const kids = (node.children && node.children.length) ? node.children : (node.props.children ? [].concat(node.props.children) : [])
    kids.forEach((k) => walk(k, depth))
    return
  }
  if (typeof node === 'object' && node.props) walk(node.props.children, depth)
}

function countByType(node, matches, acc) {
  if (node === null || node === undefined) return acc
  if (Array.isArray(node)) { node.forEach((n) => countByType(n, matches, acc)); return acc }
  if (typeof node !== 'object') return acc
  const cls = node.props && node.props.className
  if (typeof cls === 'string' && matches(cls)) acc.push(node)
  // 只走 children（桩 createElement 里 props.children 与 children 是同一批引用，重复走会指数膨胀）
  ;[].concat(node.children || []).forEach((k) => countByType(k, matches, acc))
  return acc
}
function histogram(node, hist) {
  if (!node) return hist
  if (Array.isArray(node)) { node.forEach((n) => histogram(n, hist)); return hist }
  if (typeof node !== 'object') return hist
  const cls = node.props && node.props.className
  if (typeof cls === 'string') { const k = cls.split(' ')[0]; hist[k] = (hist[k] || 0) + 1 }
  ;[].concat(node.children || []).forEach((k) => histogram(k, hist))
  return hist
}

// ---------- 1) 装载 ----------
let factory
try { factory = new Function('React', 'host', 'styles', 'console', captureScope(src)) }
catch (e) { console.log('✘ UI 源码语法错误：' + e.message); process.exit(1) }
let plugin
try { plugin = factory(ReactStub, hostStub, stylesStub, consoleStub) }
catch (e) { console.log('✘ UI 源码执行失败：' + e.message); process.exit(1) }
if (!plugin || typeof plugin.apply !== 'function') { console.log('✘ UI 插件形状不对（缺 apply）'); process.exit(1) }

// ---------- 2) 挂载 ----------
const tabs = []
const ctxStub = {
  effect(fn) { const d = fn(); return () => { if (typeof d === 'function') d() } },
  get(name) { return name === 'betterSidebar' ? { registerTab(spec) { tabs.push(spec); return () => { } } } : undefined },
  timer: { interval: () => () => { } },
  logger: consoleStub,
}
try { plugin.apply(ctxStub) } catch (e) { problems.push('apply() 抛异常：' + (e && e.message || e)) }
if (!tabs.length) problems.push('没有注册页签（betterSidebar.registerTab 未被调用）')

// ---------- 3) 基础：逐个面板 ----------
const scope = globalThis.__UI_SCOPE__ || {}
const rendered = []
const tryRender = (name, props) => {
  const fn = scope[name]
  if (typeof fn !== 'function') { problems.push('面板 ' + name + ' 不存在（作用域里找不到）'); return }
  let out
  try { out = invoke(fn, props || {}) } catch (e) { problems.push(name + '() 渲染异常：' + (e && e.message || e)); return }
  const before = problems.length
  walk(out, 0)
  rendered.push(name + (problems.length > before ? ' ✘' : ' ✔'))
}
stateStore.clear()
tryRender('Card', { title: 'x', items: [] })
tryRender('XpWidget', { s: SHEET })
tryRender('LevelSet', { s: SHEET })
tryRender('ManualEdit', { s: SHEET })
tryRender('StatusPanel', { s: SHEET })
tryRender('EquipPanel', { s: SHEET })
tryRender('Bag', { s: SHEET })
tryRender('Multiclass', { s: SHEET })
tryRender('RulesPanel', {})
tryRender('Detail', { s: SHEET })
tryRender('MapPanel', { bare: true })
tryRender('LogView', { party: [], bare: true })
tryRender('Roster', { activeId: 'pc-test', onPick() { }, onOpen() { }, rev: 0 })
tryRender('SheetHost', { activeId: 'pc-test', rev: 0 })
tryRender('StatsPanel', {})
tryRender('PanelFrame', { id: 'map', layout: scope.DEFAULT_LAYOUT, collapsed: false, isMax: false, onCollapse() { }, onMax() { }, onClose() { }, onMove() { }, onAddTo() { } })
tryRender('Wizard', {})
tryRender('PartyView', {})
tryRender('Workspace', {})
for (const t of tabs) { try { walk(t.component(), 0); rendered.push('页签 ' + t.title + ' ✔') } catch (e) { problems.push('页签 ' + t.title + ' 渲染异常：' + (e && e.message || e)) } }

// ---------- 4) 深度：两遍渲染真工作区 ----------
const deep = { ok: true, detail: [] }
async function deepWorkspace() {
  stateStore.clear()
  const Workspace = scope.Workspace
  if (typeof Workspace !== 'function') { deep.ok = false; deep.detail.push('找不到 Workspace'); return }
  let out
  try { out = invoke(Workspace, {}) } catch (e) { deep.ok = false; deep.detail.push('第一遍渲染异常：' + (e && e.message || e)); return }
  await new Promise((r) => setTimeout(r, 30))          // 等 call() 的 promise 落地
  try { out = invoke(Workspace, {}) } catch (e) { deep.ok = false; deep.detail.push('第二遍渲染异常：' + (e && e.message || e)); return }
  const before = problems.length
  seen.clear()
  collector = []
  try { walk(out, 0) } catch (e) { deep.ok = false; deep.detail.push('遍历异常：' + (e && e.message || e)); return }
  const seenCls = collector
  collector = null
  if (problems.length > before) { deep.ok = false; deep.detail.push('渲染期报错 ' + (problems.length - before) + ' 条'); return }

  const has = (p) => seenCls.filter((c) => c === p).length
  const starts = (p) => seenCls.filter((c) => c.indexOf(p) === 0).length
  const cells = starts('dndp-cell')
  const toks = has('dndp-tok') + starts('dndp-tok ')
  const rows = starts('dndp-logrow')
  const panels = starts('dndp-panel')
  const titles = has('dndp-ptitle')
  const splitters = starts('dndp-ws-split')
  const roster = has('dndp-ritem')

  deep.detail.push('地图格 ' + cells + '（期望 ' + (W * H) + '）')
  deep.detail.push('地图单位 ' + toks + '（期望 2）')
  deep.detail.push('战斗记录行 ' + rows + '（期望 3）')
  deep.detail.push('面板 ' + panels + ' 个，标题栏 ' + titles + ' 个，分隔条 ' + splitters + ' 条')
  deep.detail.push('角色列表项 ' + roster + '（期望 1）')

  const bad = []
  if (cells !== W * H) bad.push('地图格子数不符')
  if (toks !== 2) bad.push('地图单位数不符')
  if (rows !== 3) bad.push('战斗记录行数不符')
  if (titles < 3) bad.push('默认布局应至少 3 个面板标题栏')
  if (splitters < 3) bad.push('分隔条数量不足')
  if (!bad.length) notes.push('深度渲染：地图 ' + cells + ' 格 / ' + toks + ' 单位，记录 ' + rows + ' 行，面板 ' + panels + ' 个，分隔条 ' + splitters + ' 条')
  else { deep.ok = false; bad.forEach((b) => deep.detail.push('✘ ' + b)) }

  const calls = {}
  RENDERED.forEach((c) => { calls[c] = (calls[c] || 0) + 1 })
  deep.detail.push('渲染期调用：' + Object.keys(calls).map((k) => k + '×' + calls[k]).join('、'))
  const hist = {}
  seenCls.forEach((c) => { const k = c.split(' ')[0]; hist[k] = (hist[k] || 0) + 1 })
  deep.detail.push('类名直方图：' + Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => k + '×' + v).join('、'))
}

// ---------- 5) 纯函数 ----------
function pureChecks() {
  const cd = scope.cellDist
  if (typeof cd !== 'function') { problems.push('cellDist 不存在'); return }
  const d1 = cd({ x: 0, y: 0 }, { x: 3, y: 4 })
  const d2 = cd({ x: 0, y: 0 }, { x: 2, y: 2 })
  if (d1.cells !== 4 || d1.feetSimple !== 20 || d1.feetStandard !== 25) problems.push('cellDist(3,4) 结果不对：' + JSON.stringify(d1))
  if (d2.feetStandard !== 15) problems.push('cellDist(2,2) 应为 15 尺（5-10-5）：' + JSON.stringify(d2))
  const nl = scope.normLayout
  if (typeof nl === 'function') {
    const l = nl({ slots: { left: { panels: ['roster', 'bogus'] } } })
    if (l.slots.left.panels.join(',') !== 'roster') problems.push('normLayout 未剔除非法面板 id')
    if (!l.slots.center || !Array.isArray(l.weights.center)) problems.push('normLayout 未补全缺失槽位')
  }
  const slotOf = scope.slotOf
  if (typeof slotOf === 'function' && slotOf(nl(scope.DEFAULT_LAYOUT), 'map') !== 'center') problems.push('默认布局里 map 应该在 center')
}

await deepWorkspace()
pureChecks()

// ---------- 结果 ----------
console.log('UI 源码：' + SRC_PATH)
console.log('源码 ' + Buffer.byteLength(src) + ' B ｜ 基础遍历节点 ' + nodes + ' 个 ｜ 渲染面板 ' + rendered.length + ' 个')
console.log('面板：' + rendered.join('，'))
console.log('')
console.log((deep.ok ? '✔' : '✘') + ' 深度渲染（工作区两遍渲染 + 断言）')
deep.detail.forEach((d) => console.log('   · ' + d))
if (notes.length) notes.forEach((n) => console.log('   ★ ' + n))
if (problems.length) {
  console.log('\n✘ 发现 ' + problems.length + ' 个问题：')
  problems.slice(0, 25).forEach((p) => console.log('  · ' + p))
  process.exit(1)
}
if (!deep.ok) process.exit(1)
console.log('\n✔ 冒烟全部通过')
// 面板里有 setInterval 轮询，桩环境里不会自己退出，显式结束
process.exit(0)
