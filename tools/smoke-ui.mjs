#!/usr/bin/env node
/**
 * UI 冒烟测试：不开浏览器，直接跑一遍 UI 源码的装载 + 每个面板的渲染，
 * 专抓 "X is not defined / 组件未定义 / 渲染时抛异常" 这类只有点开界面才会暴露的问题。
 *
 *   node tools/smoke-ui.mjs                        # 测 engine/ui-client.latest.txt
 *   node tools/smoke-ui.mjs <path-to-ui-source>
 *
 * 依赖：无。用桩 React（createElement/useState/useEffect/useRef…）执行组件函数。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SRC_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'engine', 'ui-client.latest.txt')

let src = fs.readFileSync(SRC_PATH, 'utf8')
if (src.charCodeAt(0) === 0xfeff) src = src.slice(1)

const problems = []
let nodes = 0
const seen = new Set()

const ReactStub = {
  createElement(type, props) {
    if (type === undefined) throw new Error('createElement 收到 undefined —— 多半是某个组件/常量没定义')
    if (type === null) throw new Error('createElement 收到 null')
    if (typeof type !== 'function' && typeof type !== 'string') throw new Error('非法组件类型: ' + String(type))
    const children = Array.prototype.slice.call(arguments, 2)
    return { type: type, props: props || {}, children: children }
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
  useState(init) { let v = typeof init === 'function' ? init() : init; const set = (n) => { v = typeof n === 'function' ? n(v) : n }; return [v, set] },
  useEffect() { },
  useLayoutEffect() { },
  useRef(v) { return { current: v === undefined ? null : v } },
  useMemo(fn) { try { return fn() } catch (e) { return undefined } },
  useCallback(fn) { return fn },
  useReducer(_r, init) { return [init, () => { }] },
  createContext(def) { return { Provider: 'ctx', Consumer: 'ctx', _currentValue: def } },
  Fragment: 'Fragment',
  StrictMode: 'StrictMode',
}
const consoleStub = { log() { }, warn() { }, error() { }, info() { } }
const hostStub = { call: async () => ({ ok: false, error: 'smoke' }) }
const stylesStub = { insert: () => () => { } }

function captureScope(code) {
  const marker = 'return {\n  apply(ctx) {'
  if (!code.includes(marker)) return code
  const names = ['Card', 'Pips', 'XpWidget', 'Sect', 'ChoiceBox', 'LevelSet', 'ManualEdit', 'StatusPanel', 'EquipPanel',
    'Bag', 'RulesPanel', 'Multiclass', 'Wizard', 'Detail', 'MapPanel', 'LogView', 'LogRow', 'DiceBar', 'PartyView']
  return code.replace(marker, 'globalThis.__UI_SCOPE__ = { ' + names.join(', ') + ' }\n' + marker)
}

const FIXTURE = {
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
  inventory: [{ key: 'torch', name: '火把', qty: 3, kind: 'gear' }, { key: 'explorersPack', name: '探险家套装', kind: 'pack', container: true, contents: [{ key: 'ration', name: '干粮', qty: 10 }] }],
}

function walk(node, depth) {
  if (node === null || node === undefined || typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return
  nodes++
  if (Array.isArray(node)) { node.forEach((n) => walk(n, depth)); return }
  if (typeof node === 'object' && node.type) {
    const label = typeof node.type === 'function' ? (node.type.name || 'anonymous') : String(node.type)
    if (typeof node.type === 'function') {
      if (depth > 16) return
      if (seen.has(label)) return
      seen.add(label)
      let out
      try {
        const isClass = !!(node.type.prototype && typeof node.type.prototype.render === 'function')
        if (isClass) { const inst = new node.type(node.props || {}); out = inst.render() }
        else out = node.type(node.props || {})
      } catch (e) { problems.push('组件 ' + label + '() 渲染异常：' + (e && e.message || e)); return }
      walk(out, depth + 1)
      return
    }
    const kids = (node.children || []).concat(node.props && node.props.children ? node.props.children : [])
    kids.forEach((k) => walk(k, depth))
    return
  }
  if (typeof node === 'object' && node.props) walk(node.props.children, depth)
}

// ---- 1) 装载 ----
let factory
try {
  factory = new Function('React', 'host', 'styles', 'console', captureScope(src))
} catch (e) {
  console.log('✘ UI 源码语法错误：' + e.message)
  process.exit(1)
}
let plugin
try { plugin = factory(ReactStub, hostStub, stylesStub, consoleStub) } catch (e) {
  console.log('✘ UI 源码执行失败：' + e.message)
  process.exit(1)
}
if (!plugin || typeof plugin.apply !== 'function') { console.log('✘ UI 插件形状不对（缺 apply）'); process.exit(1) }

// ---- 2) 挂载（走一遍 apply + registerTab 路径）----
let registered = null
const ctxStub = {
  effect(fn) { const d = fn(); return () => { if (typeof d === 'function') d() } },
  get(name) { return name === 'betterSidebar' ? { registerTab(spec) { registered = spec; return () => { } } } : undefined },
  timer: { interval: () => () => { } },
  logger: consoleStub,
}
try { plugin.apply(ctxStub) } catch (e) { problems.push('apply() 抛异常：' + (e && e.message || e)) }
if (!registered) problems.push('没有注册页签（betterSidebar.registerTab 未被调用）')

// ---- 3) 逐个面板渲染 ----
const scope = globalThis.__UI_SCOPE__ || {}
const rendered = []
const tryRender = (name, props) => {
  const fn = scope[name]
  if (typeof fn !== 'function') { problems.push('面板 ' + name + ' 不存在（作用域里找不到）'); return }
  const label = name
  let out
  try { out = fn(props || {}) } catch (e) { problems.push(name + '() 渲染异常：' + (e && e.message || e)); return }
  const before = problems.length
  walk(out, 0)
  rendered.push(name + (problems.length > before ? ' ✘' : ' ✔'))
}
tryRender('Card', { title: 'x', items: [] })
tryRender('XpWidget', { s: FIXTURE })
tryRender('LevelSet', { s: FIXTURE })
tryRender('ManualEdit', { s: FIXTURE })
tryRender('StatusPanel', { s: FIXTURE })
tryRender('EquipPanel', { s: FIXTURE })
tryRender('Bag', { s: FIXTURE })
tryRender('Multiclass', { s: FIXTURE })
tryRender('RulesPanel', {})
tryRender('Detail', { s: FIXTURE })
tryRender('MapPanel', {})
tryRender('LogView', { party: [] })
tryRender('Wizard', {})
tryRender('PartyView', {})
if (registered) { try { walk(registered.component(), 0); rendered.push('侧栏页签 ✔') } catch (e) { problems.push('侧栏页签渲染异常：' + (e && e.message || e)) } }

// ---- 4) 结果 ----
console.log('UI 源码：' + SRC_PATH)
console.log('源码 ' + Buffer.byteLength(src) + ' B ｜ 遍历节点 ' + nodes + ' 个 ｜ 渲染面板 ' + rendered.length + ' 个')
console.log('面板：' + rendered.join('，'))
if (problems.length) {
  console.log('\n✘ 发现 ' + problems.length + ' 个问题：')
  problems.slice(0, 25).forEach((p) => console.log('  · ' + p))
  process.exit(1)
}
console.log('\n✔ 冒烟通过：所有面板都能渲染，没有未定义引用')
