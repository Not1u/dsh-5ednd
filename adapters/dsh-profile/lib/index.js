// adapters/dsh-profile/lib/index.js — profile 常驻插件（host 半）
//
// 设计：本文件只是「薄桥」。
//   1) 用 ctx.webServer.register 暴露同源 HTTP 接口 /dnd5e/api（{op, args} → {ok, value}）；
//   2) op 的真实实现在仓库 engine/ui-host.latest.txt（与动态插件共用同一份源码），
//      首次调用时读取并用 new Function 载入（传入 DND5E_ROOT 使路径可移植）。
// 这样：常驻插件与动态插件共享一份业务逻辑，改逻辑只需改仓库文件 + 重启（或重新构建）。
import path from 'node:path'
import fsSync from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-5ednd'
export const inject = ['webServer', 'fs']

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..', '..')
const API_PATH = '/dnd5e/api'

const OPS = [
  'party.list', 'party.sheet', 'build.options', 'build.caster', 'build.create',
  'levelset.info', 'levelset.apply', 'sheet.equip', 'sheet.item.add', 'sheet.item.remove',
  'sheet.condition.set', 'sheet.pack.take', 'sheet.patch', 'multiclass.add', 'rules.stats', 'rules.search', 'rules.read', 'ui.source',
  'roll.dice', 'log.list', 'log.append', 'log.set', 'log.clear',
]

function sendJson(res, status, payload) {
  const text = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(text)
}

export function apply(ctx, config = {}) {
  const repoRoot = (config && typeof config.dataRoot === 'string' && config.dataRoot.length)
    ? config.dataRoot.replace(/[\\/]+$/, '')
    : (process.env.DND5E_DATA_ROOT ? process.env.DND5E_DATA_ROOT.replace(/[\\/]+$/, '') : REPO_ROOT)
  const hostSrc = path.join(repoRoot, 'engine', 'ui-host.latest.txt')

  // 直接落盘能力（profile 插件运行在 Node 侧，无需依赖 tools 作用域）
  const writeText = async (absPath, text) => {
    try { await mkdir(path.dirname(absPath), { recursive: true }); await writeFile(absPath, text, 'utf8'); return { ok: true } }
    catch (e) { return { ok: false, error: String(e && e.message || e) } }
  }

  const rec = {}
  let loaded = false
  let loadedAt = 0
  let innerDispose = null

  const ensure = () => {
    if (!fsSync.existsSync(hostSrc)) throw new Error('inner host source not found: ' + hostSrc)
    const mtime = fsSync.statSync(hostSrc).mtimeMs
    if (loaded && mtime === loadedAt) return
    if (loaded && typeof innerDispose === 'function') { try { innerDispose() } catch (e) { } ; innerDispose = null }
    loaded = false
    let src = fsSync.readFileSync(hostSrc, 'utf8')
    if (src.charCodeAt(0) === 0xfeff) src = src.slice(1)
    const recHarness = { handle: (n, f) => { rec[n] = f; return () => { } } }
    const factory = new Function('harness', 'ctx', 'console', 'DND5E_ROOT', 'DND5E_WRITE', src)
    const plugin = factory(recHarness, ctx, console, repoRoot, writeText)
    if (!plugin || typeof plugin.apply !== 'function') throw new Error('inner host shape invalid')
    const d = plugin.apply(ctx)
    if (typeof d === 'function') innerDispose = d
    loaded = true
    loadedAt = mtime
  }

  ctx.logger?.info?.('[dsh-5ednd] repo=' + repoRoot + ' api=' + API_PATH + ' index=' + fsSync.existsSync(path.join(repoRoot, 'data', 'rules-index', 'manifest.json')))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: API_PATH,
    handler: (req, res) => {
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' })
      let body = ''
      let tooLarge = false
      req.on('data', (chunk) => {
        body += chunk
        if (body.length > 8 * 1024 * 1024) { tooLarge = true; req.destroy() }
      })
      req.on('end', async () => {
        if (tooLarge) return sendJson(res, 413, { ok: false, error: 'payload too large' })
        let op = '', args = null
        try {
          const parsed = JSON.parse(body || '{}')
          op = String(parsed.op || '')
          args = parsed.args === undefined ? null : parsed.args
        } catch (e) { return sendJson(res, 400, { ok: false, error: 'bad json: ' + (e && e.message || e) }) }
        if (!op) return sendJson(res, 400, { ok: false, error: 'op required' })
        try {
          ensure()
          const fn = rec[op]
          if (typeof fn !== 'function') return sendJson(res, 200, { ok: false, error: 'unknown op: ' + op })
          const value = await fn(args || {})
          return sendJson(res, 200, { ok: true, value: value === undefined ? null : value })
        } catch (e) {
          return sendJson(res, 200, { ok: false, error: String(e && e.message || e) })
        }
      })
    },
  }), 'dsh-5ednd: api route')

  return () => { if (typeof innerDispose === 'function') { try { innerDispose() } catch (e) { } } }
}

export default { name, inject, apply }
