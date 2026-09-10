// tools/preflight-client.mjs — 用假 __ModuleLoader__ / 假 ctx 预检 profile 插件 client 包
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundle = fs.readFileSync(path.join(ROOT, 'adapters', 'dsh-profile', 'lib', 'client.js'), 'utf8')

let captured = null
const fakeReact = { createElement: (t, p, ...c) => ({ t, p, c }) , useState: (v) => [v, () => { }], useEffect: () => { }, useRef: () => ({ current: null }) }
const fakeRequire = (id) => { if (id === 'react' || id === 'react/jsx-runtime') return fakeReact; throw new Error('unexpected require: ' + id) }

const styleEls = []
const fakeDocument = {
  createElement: () => ({ setAttribute() { }, removeChild() { }, style: {}, textContent: '', appendChild() { } }),
  head: { appendChild: (el) => styleEls.push(el) },
  documentElement: {},
}

const win = {
  __ModuleLoader__: { load: (def) => { captured = def } },
  console: { log() { }, warn() { }, error() { } },
  localStorage: { getItem: () => null, setItem: () => { } },
  innerWidth: 1200, innerHeight: 900,
}
const fakeFetch = async () => ({ ok: true, json: async () => ({ ok: true, value: { ok: true, items: [] } }) })

const run = new Function('window', 'document', 'fetch', 'localStorage', 'console', bundle)
run(win, fakeDocument, fakeFetch, win.localStorage, win.console)

if (!captured || typeof captured.factory !== 'function') { console.log('FAIL: bundle did not call __ModuleLoader__.load with a factory'); process.exit(1) }
console.log('ok: __ModuleLoader__.load id=' + captured.id)

const mod = captured.factory(fakeRequire)
const plugin = mod && mod.default && !mod.apply ? mod.default : mod
if (!plugin || typeof plugin.apply !== 'function') { console.log('FAIL: exported plugin has no apply()'); process.exit(1) }
console.log('ok: plugin name=' + plugin.name + ' inject=' + JSON.stringify(plugin.inject))

let tab = null
const effects = []
const fakeCtx = {
  get: (n) => (n === 'betterSidebar' ? { registerTab: (d) => { tab = d; return () => { } } } : undefined),
  effect: (fn) => { const d = fn(); effects.push(d); return () => { if (typeof d === 'function') d() } },
  on: () => () => { }, logger: { info() { }, warn() { }, error() { } },
}

try {
  const dispose = plugin.apply(fakeCtx)
  console.log('ok: apply() ran without throwing')
  if (tab) console.log('ok: registerTab id=' + tab.id + ' title=' + tab.title + ' component=' + (typeof tab.component))
  else console.log('WARN: no tab registered (betterSidebar stub not hit)')
  if (typeof tab?.component === 'function') {
    const el = tab.component({ scope: {} })
    console.log('ok: component() returned ' + (el && el.t === undefined && typeof el === 'object' ? 'element-ish' : typeof el))
  }
  if (typeof dispose === 'function') { dispose(); console.log('ok: disposer callable') }
} catch (e) {
  console.log('FAIL: apply() threw ' + (e && e.message || e))
  process.exit(1)
}
console.log('PREFLIGHT PASSED')
