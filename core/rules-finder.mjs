// core/rules-finder.mjs — 零依赖规则检索核心（可用于任何 harness）
// 索引目录由 tools/index-rules.mjs 生成：manifest.json + <book>.jsonl
import fs from 'node:fs'
import path from 'node:path'

const cache = new Map()

export function loadManifest(indexDir) {
  const p = path.join(indexDir, 'manifest.json')
  if (!fs.existsSync(p)) return { books: [], missing: true }
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

export function loadBook(indexDir, jsonlName) {
  if (cache.has(jsonlName)) return cache.get(jsonlName)
  const p = path.join(indexDir, jsonlName)
  const list = []
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try { list.push(JSON.parse(line)) } catch (e) { }
    }
  }
  cache.set(jsonlName, list)
  return list
}

export function allEntries(indexDir) {
  const m = loadManifest(indexDir)
  const out = []
  for (const b of m.books) out.push.apply(out, loadBook(indexDir, b.jsonl))
  return out
}

const countOf = (hay, needle) => { let n = 0, i = 0; const h = hay.toLowerCase(), nd = needle.toLowerCase(); while ((i = h.indexOf(nd, i)) !== -1) { n++; i += nd.length } return n }

export function snippet(text, term, width = 70) {
  const i = text.toLowerCase().indexOf(String(term).toLowerCase())
  if (i < 0) return text.slice(0, width * 2)
  const start = Math.max(0, i - width)
  return (start > 0 ? '…' : '') + text.slice(start, i + width * 2).replace(/\n/g, ' ') + '…'
}

export function search(indexDir, query, opts = {}) {
  const terms = String(query || '').trim().split(/[\s,，]+/).filter(Boolean)
  if (!terms.length) return []
  const limit = Number(opts.limit) || 12
  const books = opts.book ? [opts.book] : null
  const manifest = loadManifest(indexDir)
  const entries = allEntries(indexDir).filter(e => !books || books.includes(e.book))
  const hits = []
  for (const e of entries) {
    let score = 0, ok = true
    for (const t of terms) {
      const inTitle = countOf(e.title, t)
      const inText = countOf(e.text, t)
      if (!inTitle && !inText) { ok = false; break }
      score += inTitle * 12 + Math.min(inText, 40)
    }
    if (!ok) continue
    if (e.title.toLowerCase().includes(terms[0].toLowerCase())) score += 8
    hits.push({ id: e.id, book: e.book, title: e.title, file: e.file, chars: e.text.length, score, snippet: snippet(e.text, terms[0]) })
  }
  hits.sort((a, b) => b.score - a.score || a.title.length - b.title.length)
  return hits.slice(0, limit)
}

export function read(indexDir, id) {
  const m = loadManifest(indexDir)
  for (const b of m.books) {
    const found = loadBook(indexDir, b.jsonl).find(e => e.id === id)
    if (found) return found
  }
  return null
}

export function stats(indexDir) {
  const m = loadManifest(indexDir)
  return { generatedAt: m.generatedAt, missing: !!m.missing, books: (m.books || []).map(b => ({ book: b.book, entries: b.entries, bytes: b.bytes })), total: (m.books || []).reduce((a, b) => a + b.entries, 0) }
}
