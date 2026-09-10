// adapters/dsh-profile/lib/client.js — profile 常驻插件（client 半，占位实现）
//
// 说明（重要）：
//   动态插件的 client 半由 DSH 运行器注入 React / host / styles 等 builtin，
//   而 profile 常驻插件的 client 半必须是**自包含的浏览器 ESM**（现有插件如
//   dsh-better-sidebar 都用 tsdown 打包成单文件）。
//   本仓库暂不引入构建链，因此这里先提供占位实现：仅注册一个极简侧栏页签，
//   用于验证「插件已常驻加载」；完整界面仍由动态插件（engine/ui-client.latest.txt）
//   提供。接入方式见 adapters/dsh-profile/README.md。
export const name = 'dsh-5ednd-client'

export function apply(ctx) {
  try {
    const sidebar = ctx.get ? ctx.get('betterSidebar') : undefined
    if (!sidebar || typeof sidebar.registerTab !== 'function') {
      console.warn('[dsh-5ednd] betterSidebar service unavailable — UI tab skipped')
      return
    }
    const React = ctx.get ? ctx.get('react') : undefined
    const h = React && React.createElement
    const component = h
      ? () => h('div', { style: { padding: 12, fontSize: 13, lineHeight: 1.6 } }, [
        h('div', { key: 't', style: { fontWeight: 700, marginBottom: 6 } }, 'dsh-5ednd 已常驻'),
        h('div', { key: 'a', style: { opacity: .75 } }, '规则检索工具已注册（dnd_search_rules / dnd_read_rule）。'),
        h('div', { key: 'b', style: { opacity: .75 } }, '完整角色卡界面由动态插件提供；打包构建后此处将直接渲染 UI。'),
      ])
      : () => null
    sidebar.registerTab({ id: 'dsh5ednd:status', title: 'D&D 5e', single: true, component })
  } catch (e) {
    console.warn('[dsh-5ednd] client apply failed: ' + (e && e.message || e))
  }
}

export default { name, apply }
