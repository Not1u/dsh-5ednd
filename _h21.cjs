const fs = require('fs')
const p = 'engine/ui-host.latest.txt'
let s = fs.readFileSync(p, 'utf8')
let n = 0
const rep = (a, b, all) => {
  if (s.indexOf(a) < 0) { console.log('未命中: ' + a.slice(0, 70).replace(/\n/g, ' ')); return }
  if (all) { const c = s.split(a).length - 1; s = s.split(a).join(b); n += c; console.log('  ×' + c + ' ' + a.slice(0, 50).replace(/\n/g, ' ')) }
  else { s = s.replace(a, b); n++ }
}

// 1) persist 里记录写入时间
rep(`    const persist = async (pc) => {
      overlay.set(pc.id, pc)`,
`    const overlayAt = new Map()
    const persist = async (pc) => {
      overlay.set(pc.id, pc)
      try { overlayAt.set(String(pc.id), Date.now()) } catch (e) { }`)
rep(`    const fsRead = async (p) => { const fs = ctx.get('fs'); const t = await fs.resolve(p); let s = await fs.readText(t); if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); return s }`,
`    const fsRead = async (p) => { const fs = ctx.get('fs'); const t = await fs.resolve(p); let s = await fs.readText(t); if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); return s }
    // 统一读角色：优先内存缓存，但**磁盘文件更新（例如 AI 或脚本直接改档）时自动失效重读**
    const readPc = async (idOrFile) => {
      const safe = String(idOrFile).replace(/[^A-Za-z0-9._-]/g, '')
      const path = CHAR_DIR + '/' + safe + '.json'
      const cached = overlay.get(safe) || overlay.get(String(idOrFile))
      if (cached) {
        try {
          const fs2 = ctx.get('fs')
          const abs = await fs2.resolve(path)
          const st = fs2.stat ? await fs2.stat(abs) : null
          const at = overlayAt.get(String(cached.id || safe)) || 0
          if (st && st.mtimeMs && st.mtimeMs > at + 50) { overlay.delete(safe); overlay.delete(String(cached.id || safe)); return JSON.parse(await fsRead(path)) }
        } catch (e) { }
        return cached
      }
      return JSON.parse(await fsRead(path))
    }`)

// 2) 把所有「缓存优先」的读法换成 readPc
rep("const pc = overlay.get(String(spec.id)) ? overlay.get(String(spec.id)) : JSON.parse(await fsRead(CHAR_DIR + '/' + safe + '.json'))", "const pc = await readPc(safe)", true)
rep("const pc = overlay.get(String(id)) ? overlay.get(String(id)) : JSON.parse(await fsRead(CHAR_DIR + '/' + safe + '.json'))", "const pc = await readPc(safe)", true)
rep("const pc = overlay.get(id0) ? overlay.get(id0) : JSON.parse(await fsRead(CHAR_DIR + '/' + n))", "const pc = await readPc(n)", true)
rep("const pc = JSON.parse(await fsRead(CHAR_DIR + '/' + safe + '.json'))", "const pc = await readPc(safe)", true)

// 3) 新增 pc.forget：手动丢弃缓存（外部改档后可立即生效）
rep("    unreg.push(harness.handle('pc.repair', async (args) => {",
`    unreg.push(harness.handle('pc.forget', async (args) => {
      try {
        const a = args || {}
        const before = overlay.size
        if (a.id) { const safe = String(a.id).replace(/[^A-Za-z0-9._-]/g, ''); overlay.delete(safe); overlay.delete(String(a.id)) }
        else overlay.clear()
        return { ok: true, cleared: before - overlay.size, summary: '已丢弃 ' + (a.id ? ('角色 ' + a.id) : '全部角色') + ' 的内存缓存（下次读取走磁盘）' }
      } catch (e) { return { ok: false, error: String(e && e.message || e) } }
    }))
    unreg.push(harness.handle('pc.repair', async (args) => {`)

fs.writeFileSync(p, s, 'utf8')
console.log('宿主补丁 ' + n + ' 处')
