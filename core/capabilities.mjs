// core/capabilities.mjs — 能力探测与降级策略（兼容性策略②）
// 目标：同一套核心在 DSH 动态插件 / profile 常驻插件 / 纯 Node CLI / MCP 下都能跑，
// 缺什么能力就降级，而不是崩溃。

export function probe(ctx, harness) {
  const has = (fn) => typeof fn === 'function'
  const svc = (name) => { try { return ctx && typeof ctx.get === 'function' ? ctx.get(name) : undefined } catch (e) { return undefined } }

  const fsSvc = svc('fs')
  const toolsSvc = svc('tools')
  const sidebar = svc('betterSidebar')
  const timer = svc('timer')

  return {
    // Host 侧
    hostHalf: !!harness && has(harness.handle),
    fsRead: !!(fsSvc && has(fsSvc.readText)),
    fsWrite: !!(fsSvc && (has(fsSvc.writeText) || has(fsSvc.write))),
    tools: !!(toolsSvc && has(toolsSvc.execute)),
    nodeFs: typeof process !== 'undefined' && !!(process.versions && process.versions.node) && !isBrowser(),
    // Client 侧
    clientHalf: typeof window !== 'undefined',
    sidebarTabs: !!(sidebar && has(sidebar.registerTab)),
    timers: !!(timer && has(timer.interval)),
    themeTokens: typeof document !== 'undefined' ? hasCssVar('--dsw-alias-brand-primary') : false,
  }
}

function isBrowser() { return typeof window !== 'undefined' && typeof window.document !== 'undefined' }
function hasCssVar(name) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim().length > 0 } catch (e) { return false }
}

// 每个能力的降级说明，便于在日志/UI 中提示用户
export const DEGRADATIONS = {
  fsRead: '无法通过宿主读文件，将改用内置 node:fs（Node 环境）或只读本地索引',
  fsWrite: '无法通过宿主写文件，改动将只保留在内存中（请用 AI 工具 dnd_save 落盘）',
  tools: '缺少 tools 服务，落盘改走内置 node:fs；若也没有，则仅内存生效',
  sidebarTabs: '缺少侧栏服务，UI 将降级为独立面板 / 静态状态页',
  timers: '缺少 timer 服务，关闭自动热重载（改为手动刷新）',
  themeTokens: '未检测到主题 token，使用内置默认配色',
}

export function describe(probeResult) {
  const lines = []
  for (const k of Object.keys(DEGRADATIONS)) {
    if (!probeResult[k]) lines.push('- ' + DEGRADATIONS[k])
  }
  return lines.length ? lines.join('\n') : '全部能力可用'
}
