// tools/build-adapter.mjs — 把 engine/ui-client.latest.txt 打包成 profile 插件可用的 lib/client.js
// 契约取自官方插件模板（dsh-image-gen / dsh-better-sidebar）：
//   client 半 = CJS，包在 window.__ModuleLoader__.load({ id, factory: (require) => {...} }) 中，
//   react / @deepseek-ai/* 由宿主 require 提供，其余代码全部内联。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_ID = 'dsh-5ednd'
const API_PATH = '/dnd5e/api'
const UI_SRC = path.join(ROOT, 'engine', 'ui-client.latest.txt')
const OUT = path.join(ROOT, 'adapters', 'dsh-profile', 'lib', 'client.js')

const uiBody = fs.readFileSync(UI_SRC, 'utf8')

const banner = 'window.__ModuleLoader__.load({ id: "' + PLUGIN_ID + '", factory: (require) => {'
const intro = 'var module = { exports: {} }; var exports = module.exports;'
const footer = 'return module.exports; } });'

const prelude = [
  intro,
  "const React = require('react')",
  "const __apiPath = '" + API_PATH + "'",
  'const host = {',
  '  call: async function (name, args) {',
  '    const body = JSON.stringify({ op: name, args: args === undefined ? null : args })',
  "    const res = await fetch(__apiPath, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body })",
  "    if (!res.ok) throw new Error('[dsh-5ednd] http ' + res.status)",
  '    const data = await res.json()',
  '    if (!data || data.ok !== true) throw new Error((data && data.error) || "rpc failed: " + name)',
  '    return data.value',
  '  }',
  '}',
  'const styles = {',
  '  insert: function (css) {',
  "    const el = document.createElement('style')",
  '    el.setAttribute("data-dsh-5ednd", "1")',
  '    el.textContent = css',
  '    document.head.appendChild(el)',
  '    return function () { if (el.parentNode) el.parentNode.removeChild(el) }',
  '  }',
  '}',
  'const __makeUI = function (React, host, styles, console) {',
].join('\n')

const bridge = [
  '}',
  'const __ui = __makeUI(React, host, styles, window.console)',
  'module.exports = {',
  '  name: "' + PLUGIN_ID + '-client",',
  "  inject: ['betterSidebar'],",
  '  apply: function (ctx) {',
  '    const inner = __ui && typeof __ui.apply === "function" ? __ui.apply(ctx) : undefined',
  '    return inner',
  '  }',
  '}',
].join('\n')

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, [banner, prelude, uiBody, bridge, footer].join('\n'), 'utf8')
const size = fs.statSync(OUT).size
console.log('built ' + path.relative(ROOT, OUT) + '  ' + (size / 1024).toFixed(1) + ' KB (UI ' + (uiBody.length / 1024).toFixed(1) + ' KB)')
