// core/config.mjs — 数据根目录解析（零硬编码路径）
// 顺序: 环境变量 DND5E_DATA_ROOT > 仓库 config.json > 仓库根目录
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(HERE, '..')

function readConfigFile() {
  const p = path.join(REPO_ROOT, 'config.json')
  if (!fs.existsSync(p)) return {}
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch (e) { return {} }
}

export function resolvePaths(overrides = {}) {
  const cfg = readConfigFile()
  const rawRoot = overrides.dataRoot || process.env.DND5E_DATA_ROOT || cfg.dataRoot || '.'
  const dataRoot = path.isAbsolute(rawRoot) ? rawRoot : path.resolve(REPO_ROOT, rawRoot)
  const rawIndex = overrides.indexDir || process.env.DND5E_INDEX_DIR || cfg.indexDir || 'data/rules-index'
  const indexDir = path.isAbsolute(rawIndex) ? rawIndex : path.resolve(dataRoot, rawIndex)
  return {
    repoRoot: REPO_ROOT,
    dataRoot,
    indexDir,
    rulesDir: path.join(dataRoot, 'rules'),
    charactersDir: path.join(dataRoot, 'characters'),
    verifiedDshVersion: cfg.verifiedDshVersion || null,
  }
}

export function findIndexDir() {
  const candidates = [resolvePaths().indexDir, path.join(REPO_ROOT, 'data', 'rules-index')]
  for (const c of candidates) if (fs.existsSync(path.join(c, 'manifest.json'))) return c
  return candidates[0]
}
