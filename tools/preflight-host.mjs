// tools/preflight-host.mjs — 预检 profile 插件 host 半：注册路由并用假 req/res 走通一次真实 op
import path from 'node:path'
import fs from 'node:fs'
import { EventEmitter } from 'node:events'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mod = await import(new URL('../adapters/dsh-profile/lib/index.js', import.meta.url).href)

let route = null
const ctx = {
  get: (name) => (name === 'fs' ? {
    resolve: async (p) => p,
    readText: async (p) => fs.readFileSync(p, 'utf8'),
    listDir: async (d) => fs.readdirSync(d).map((n) => ({ name: n })),
    readDir: async (d) => fs.readdirSync(d),
  } : undefined),
  effect: (fn) => { const d = fn(); return () => { if (typeof d === 'function') d() } },
  logger: { info: (m) => console.log('   [log] ' + m), warn: (m) => console.log('   [warn] ' + m), error: (m) => console.log('   [err] ' + m) },
  webServer: { register: (def) => { route = def; return () => { } } },
}

const plugin = mod.default || mod
console.log('plugin name=' + plugin.name + ' inject=' + JSON.stringify(plugin.inject))
const dispose = plugin.apply(ctx, { dataRoot: ROOT })

if (!route) { console.log('FAIL: no route registered'); process.exit(1) }
console.log('ok: route ' + route.kind + ' ' + route.path)

const callApi = (op, args) => new Promise((resolve) => {
  const req = new EventEmitter()
  req.method = 'POST'
  const res = {
    statusCode: 0, headers: {}, body: '',
    setHeader(k, v) { this.headers[k] = v },
    end(t) { this.body = t; resolve({ status: this.statusCode, body: this.body }) },
  }
  route.handler(req, res)
  const payload = JSON.stringify({ op: op, args: args === undefined ? null : args })
  req.emit('data', payload)
  req.emit('end')
})

const stats = await callApi('rules.stats', {})
const sj = JSON.parse(stats.body)
console.log('rules.stats -> status ' + stats.status + ' ok=' + sj.ok + ' total=' + (sj.value && sj.value.total) + ' books=' + (sj.value && (sj.value.books || []).length))
if (!sj.ok || !sj.value || !sj.value.total) { console.log('FAIL: rules.stats'); process.exit(1) }

const search = await callApi('rules.search', { query: '擒抱', limit: 3 })
const ss = JSON.parse(search.body)
console.log('rules.search -> ok=' + ss.ok + ' hits=' + ((ss.value && ss.value.items) || []).length + ' first=' + ((((ss.value || {}).items || [])[0] || {}).title || '-'))
if (!ss.ok || !((ss.value || {}).items || []).length) { console.log('FAIL: rules.search'); process.exit(1) }

const sheet = await callApi('party.sheet', { id: 'pc-turiel-mistveil' })
const sh = JSON.parse(sheet.body)
console.log('party.sheet -> ok=' + sh.ok + ' AC=' + (sh.value && sh.value.ac) + ' Lv=' + (sh.value && sh.value.level))
if (!sh.ok) { console.log('FAIL: party.sheet'); process.exit(1) }

const bad = await callApi('nope', {})
console.log('unknown op -> ' + bad.body)
if (typeof dispose === 'function') dispose()
console.log('PREFLIGHT PASSED (host bridge)')
