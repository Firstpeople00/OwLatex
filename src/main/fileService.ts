import { promises as fs } from 'fs'
import { join, basename } from 'path'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

// 不进入这些目录
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.mylatex'])
// 隐藏这些 LaTeX 中间产物（保留 .pdf / .bib / .tex 等）
const AUX_EXT = new Set([
  '.aux', '.log', '.out', '.toc', '.fls', '.fdb_latexmk',
  '.bbl', '.blg', '.lof', '.lot', '.nav', '.snm', '.vrb', '.idx', '.ilg', '.ind'
])

function isAuxFile(name: string): boolean {
  const lower = name.toLowerCase()
  if (lower.endsWith('.synctex.gz') || lower.endsWith('.synctex')) return true
  const dot = lower.lastIndexOf('.')
  return dot >= 0 && AUX_EXT.has(lower.slice(dot))
}

/** 递归读取目录树（已过滤中间产物与忽略目录），目录在前、按名排序 */
export async function readTree(dir: string): Promise<FileNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const nodes: FileNode[] = []
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name) || e.name.startsWith('.')) continue
      const full = join(dir, e.name)
      nodes.push({ name: e.name, path: full, type: 'dir', children: await readTree(full) })
    } else {
      if (isAuxFile(e.name) || e.name.startsWith('.')) continue
      nodes.push({ name: e.name, path: join(dir, e.name), type: 'file' })
    }
  }
  nodes.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1
  )
  return nodes
}

/** 自动探测主文件：优先含 \documentclass 的 .tex，再优先 basename=main.tex */
export async function detectMainFile(nodes: FileNode[]): Promise<string | null> {
  const texFiles: string[] = []
  const walk = (ns: FileNode[]): void => {
    for (const n of ns) {
      if (n.type === 'dir') walk(n.children ?? [])
      else if (n.name.toLowerCase().endsWith('.tex')) texFiles.push(n.path)
    }
  }
  walk(nodes)

  let fallback: string | null = null
  for (const f of texFiles) {
    const content = await fs.readFile(f, 'utf8').catch(() => '')
    if (/\\documentclass/.test(content)) {
      if (basename(f).toLowerCase() === 'main.tex') return f
      fallback = fallback ?? f
    }
  }
  return fallback ?? texFiles[0] ?? null
}

export async function readFileText(path: string): Promise<string> {
  return fs.readFile(path, 'utf8')
}

export async function writeFileText(path: string, content: string): Promise<void> {
  await fs.writeFile(path, content, 'utf8')
}

export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  await fs.rename(oldPath, newPath)
}

export async function makeDir(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true })
}
