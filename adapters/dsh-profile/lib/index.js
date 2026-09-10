// adapters/dsh-profile/lib/index.js — profile 常驻插件（host 半）
//
// 职责：把仓库 core/ 的能力注册成常驻工具（重启后仍在），并（在宿主提供时）
// 暴露给客户端的 RPC 服务。所有业务逻辑都在仓库 core/ 与 tools/ 中，本文件只做适配。
import path from 'node:path'
import fsSync from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const name = 'dsh-5ednd'
export const inject = ['tools']

const HERE = path.dirname(fileURLToPath(import.meta.url))

function resolveRepoRoot(config) {
  if (config && typeof config.dataRoot === 'string' && config.dataRoot.length) return config.dataRoot.replace(/[\\/]+$/, '')
  if (process.env.DND5E_DATA_ROOT) return process.env.DND5E_DATA_ROOT.replace(/[\\/]+$/, '')
  // adapters/dsh-profile/lib → 仓库根
  return path.resolve(HERE, '..', '..', '..')
}

const obj = (props, required = []) => {
  const out = { type: 'object', properties: {}, required }
  for (const k of Object.keys(props || {})) out.properties[k] = props[k]
  return out
}
const textRender = (args, value) => [{ type: 'text', text: String((value && value.summary) || '') }]

export function apply(ctx, config = {}) {
  const repoRoot = resolveRepoRoot(config)
  const indexDir = (config && config.indexDir) || path.join(repoRoot, 'data', 'rules-index')
  const register = (tool) => ctx.tools.register(tool)

  const loadFinder = async () => import(pathToFileURL(path.join(repoRoot, 'core', 'rules-finder.mjs')).href)
  const loadFs = async () => import(pathToFileURL(path.join(repoRoot, 'core', 'characters.mjs')).href).catch(() => null)

  ctx.logger?.info?.('[dsh-5ednd] repo=' + repoRoot + ' index=' + indexDir + ' indexExists=' + fsSync.existsSync(path.join(indexDir, 'manifest.json')))

  register({
    name: 'dnd_search_rules',
    description: 'Search the local D&D 5e rulebook index; returns matching sections with snippets.',
    parameters: obj({ query: { type: 'string' }, book: { type: 'string' }, limit: { type: 'number' } }, ['query']),
    output: { schema: obj({ ok: { type: 'boolean' }, summary: { type: 'string' } }, ['ok', 'summary']), render: textRender },
    async execute(args) {
      try {
        const f = await loadFinder()
        const hits = f.search(indexDir, args.query, { limit: Number(args.limit) || 8, book: args.book || undefined })
        if (!hits.length) return { ok: true, summary: '未命中（索引目录：' + indexDir + '）' }
        return { ok: true, summary: hits.map((h, i) => (i + 1) + '. [' + h.book + '] ' + h.title + ' (id ' + h.id + ')\n   ' + h.snippet.replace(/\s+/g, ' ').slice(0, 180)).join('\n') }
      } catch (e) { return { ok: false, summary: 'search failed: ' + (e && e.message || e) } }
    },
  })

  register({
    name: 'dnd_read_rule',
    description: 'Read a full rulebook section by id from dnd_search_rules.',
    parameters: obj({ id: { type: 'string' } }, ['id']),
    output: { schema: obj({ ok: { type: 'boolean' }, summary: { type: 'string' } }, ['ok', 'summary']), render: textRender },
    async execute(args) {
      try {
        const f = await loadFinder()
        const e = f.read(indexDir, args.id)
        return e ? { ok: true, summary: '【' + e.book + '】' + e.title + '\n' + e.text } : { ok: false, summary: '未找到 ' + args.id }
      } catch (e) { return { ok: false, summary: 'read failed: ' + (e && e.message || e) } }
    },
  })
}

export default { name, inject, apply }
