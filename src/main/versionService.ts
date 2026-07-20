import * as git from 'isomorphic-git'
import * as fs from 'fs'
import { promises as fsp, existsSync } from 'fs'
import { join, dirname, relative, sep } from 'path'
import { diffLines } from 'diff'
import { readTree, type FileNode } from './fileService'

/**
 * 论文版本管理：内置 isomorphic-git（纯 JS，零安装）。
 * 版本库 gitdir 放在 <工程>/.mylatex/versions（与用户自己的 .git 分离，且已被文件树忽略）。
 * 快照按内容哈希去重——未改动的图片/文件跨版本只存一份。
 */

export interface VersionEntry {
  oid: string
  name: string
  kind: 'auto' | 'manual'
  timestamp: number // ms
}
export interface DiffPart {
  added: boolean
  removed: boolean
  value: string
}
export interface DiffFile {
  path: string
  status: 'added' | 'removed' | 'modified'
  hunks?: DiffPart[] // 仅文本文件有行级 diff；二进制（图片等）为 undefined
}

const AUTHOR = { name: 'OwLatex', email: 'owlatex@local' }
const gitdirOf = (root: string): string => join(root, '.mylatex', 'versions')

// 版本快照排除的产物（在 readTree 已滤中间产物基础上，再排除 .pdf/.synctex.gz）
function isExcluded(name: string): boolean {
  const l = name.toLowerCase()
  return l.endsWith('.pdf') || l.endsWith('.synctex.gz')
}
const relPosix = (root: string, abs: string): string => relative(root, abs).split(sep).join('/')
const isTextPath = (p: string): boolean => /\.(tex|bib|cls|sty|txt|md|log)$/i.test(p)

/** 当前应纳入版本的文件（相对 posix 路径）——复用 readTree 的过滤，再去掉 .pdf 等 */
async function trackedFiles(root: string): Promise<string[]> {
  const out: string[] = []
  const walk = (ns: FileNode[]): void => {
    for (const n of ns) {
      if (n.type === 'dir') walk(n.children ?? [])
      else if (!isExcluded(n.name)) out.push(relPosix(root, n.path))
    }
  }
  walk(await readTree(root))
  return out
}

export async function ensureRepo(root: string): Promise<void> {
  const gitdir = gitdirOf(root)
  if (!existsSync(join(gitdir, 'HEAD'))) {
    await fsp.mkdir(gitdir, { recursive: true })
    await git.init({ fs, dir: root, gitdir, defaultBranch: 'main' })
  }
}

async function headFiles(root: string, gitdir: string): Promise<string[]> {
  try {
    return await git.listFiles({ fs, dir: root, gitdir, ref: 'HEAD' })
  } catch {
    return [] // 尚无提交
  }
}

/**
 * 生成一次快照（stage 改动 + 删除消失文件 → commit）。
 * kind='auto' 且无任何改动时跳过（不产生空提交），返回 null。
 */
export async function snapshot(
  root: string,
  name: string,
  kind: 'auto' | 'manual'
): Promise<string | null> {
  await ensureRepo(root)
  const gitdir = gitdirOf(root)
  const files = new Set(await trackedFiles(root))
  const relevant = new Set([...files, ...(await headFiles(root, gitdir))])
  const matrix = await git.statusMatrix({ fs, dir: root, gitdir, filter: (f) => relevant.has(f) })

  let changed = false
  for (const [filepath, head, workdir] of matrix) {
    if (workdir === 0 && head === 1) {
      await git.remove({ fs, dir: root, gitdir, filepath }) // 已删除
      changed = true
    } else if (files.has(filepath)) {
      await git.add({ fs, dir: root, gitdir, filepath }) // 存在则暂存当前内容
      if (!(head === 1 && workdir === 1)) changed = true // 新增或修改
    }
  }
  if (kind === 'auto' && !changed) return null

  return git.commit({
    fs,
    dir: root,
    gitdir,
    author: AUTHOR,
    message: `${name}\n\nowlatex-kind: ${kind}`
  })
}

export async function listVersions(root: string): Promise<VersionEntry[]> {
  const gitdir = gitdirOf(root)
  if (!existsSync(join(gitdir, 'HEAD'))) return []
  let commits: Awaited<ReturnType<typeof git.log>>
  try {
    commits = await git.log({ fs, dir: root, gitdir })
  } catch {
    return [] // 无提交
  }
  return commits.map((c) => {
    const msg = c.commit.message
    const km = msg.match(/owlatex-kind:\s*(auto|manual)/)
    return {
      oid: c.oid,
      name: msg.split('\n')[0],
      kind: (km?.[1] as 'auto' | 'manual') ?? 'manual',
      timestamp: c.commit.author.timestamp * 1000
    }
  })
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** 对比两个版本；b 可为 'WORKDIR' 表示与当前工作区对比 */
export async function diff(root: string, a: string, b: string): Promise<DiffFile[]> {
  const gitdir = gitdirOf(root)
  const aFiles = await git.listFiles({ fs, dir: root, gitdir, ref: a })
  const bFiles = b === 'WORKDIR' ? await trackedFiles(root) : await git.listFiles({ fs, dir: root, gitdir, ref: b })
  const aSet = new Set(aFiles)
  const bSet = new Set(bFiles)
  const readA = async (f: string): Promise<Uint8Array> =>
    (await git.readBlob({ fs, dir: root, gitdir, oid: a, filepath: f })).blob
  const readB = async (f: string): Promise<Uint8Array> =>
    b === 'WORKDIR'
      ? new Uint8Array(await fsp.readFile(join(root, f)))
      : (await git.readBlob({ fs, dir: root, gitdir, oid: b, filepath: f })).blob

  const out: DiffFile[] = []
  for (const f of new Set([...aFiles, ...bFiles])) {
    const inA = aSet.has(f)
    const inB = bSet.has(f)
    const ca = inA ? await readA(f) : new Uint8Array()
    const cb = inB ? await readB(f) : new Uint8Array()
    if (inA && inB && bytesEqual(ca, cb)) continue // 未变化
    const status: DiffFile['status'] = !inA ? 'added' : !inB ? 'removed' : 'modified'
    const hunks = isTextPath(f)
      ? diffLines(Buffer.from(ca).toString('utf8'), Buffer.from(cb).toString('utf8')).map((p) => ({
          added: !!p.added,
          removed: !!p.removed,
          value: p.value
        }))
      : undefined
    out.push({ path: f, status, hunks })
  }
  out.sort((x, y) => x.path.localeCompare(y.path))
  return out
}

/** 版本库信息：体积（字节）+ 版本数 */
export async function repoInfo(root: string): Promise<{ sizeBytes: number; count: number }> {
  const gitdir = gitdirOf(root)
  let sizeBytes = 0
  const walk = async (d: string): Promise<void> => {
    for (const e of await fsp.readdir(d, { withFileTypes: true })) {
      const full = join(d, e.name)
      if (e.isDirectory()) await walk(full)
      else sizeBytes += (await fsp.stat(full)).size
    }
  }
  if (existsSync(gitdir)) await walk(gitdir)
  return { sizeBytes, count: (await listVersions(root)).length }
}

/** 清空全部版本历史（删除版本库；下次快照会自动重新初始化） */
export async function clearAll(root: string): Promise<void> {
  await fsp.rm(gitdirOf(root), { recursive: true, force: true })
}

/** 恢复到某版本：先自动备份当前 → 把该版本内容写回工作区 → 记一次“恢复”提交 */
export async function restore(root: string, oid: string): Promise<void> {
  const gitdir = gitdirOf(root)
  await snapshot(root, '回退前自动备份', 'auto') // 兜底，无改动会自动跳过

  const { commit } = await git.readCommit({ fs, dir: root, gitdir, oid })
  const targetName = commit.message.split('\n')[0]

  const targetFiles = await git.listFiles({ fs, dir: root, gitdir, ref: oid })
  const targetSet = new Set(targetFiles)
  for (const f of targetFiles) {
    const { blob } = await git.readBlob({ fs, dir: root, gitdir, oid, filepath: f })
    const abs = join(root, f)
    await fsp.mkdir(dirname(abs), { recursive: true })
    await fsp.writeFile(abs, Buffer.from(blob))
  }
  // 删除该版本不存在、但当前被追踪的文件
  for (const f of await trackedFiles(root)) {
    if (!targetSet.has(f)) await fsp.rm(join(root, f)).catch(() => {})
  }

  await snapshot(root, `恢复自「${targetName}」`, 'manual')
}
