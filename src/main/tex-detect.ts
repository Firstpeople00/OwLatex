import { spawn } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { dirname, join } from 'path'

export interface Distro {
  id: string
  name: string
  binDir: string
  available: boolean
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((res) => {
    let out = ''
    const c = spawn(cmd, args, { windowsHide: true })
    c.stdout.on('data', (d) => (out += d.toString()))
    c.on('error', () => res(''))
    c.on('close', () => res(out))
  })
}

// 1) PATH：where pdflatex/xelatex → 其所在目录（多数正常安装会把 TeX 加进 PATH）
async function fromPath(): Promise<string[]> {
  const dirs: string[] = []
  for (const exe of ['pdflatex', 'xelatex']) {
    const out = await run('where', [exe])
    for (const line of out.split(/\r?\n/)) {
      const p = line.trim()
      if (/\.exe$/i.test(p) && existsSync(p)) dirs.push(dirname(p))
    }
  }
  return dirs
}

// 2) 注册表：卸载项里 DisplayName 含 MiKTeX / TeX Live 的 InstallLocation
async function fromRegistry(): Promise<string[]> {
  const ps =
    "$k='HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'," +
    "'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'," +
    "'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*';" +
    "Get-ItemProperty $k -EA SilentlyContinue | " +
    "Where-Object { $_.DisplayName -match 'MiKTeX|TeX Live' } | " +
    'ForEach-Object { $_.InstallLocation }'
  const out = await run('powershell', ['-NoProfile', '-Command', ps])
  const dirs: string[] = []
  for (const loc of out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
    dirs.push(
      join(loc, 'miktex', 'bin', 'x64'), // MiKTeX
      join(loc, 'miktex', 'bin'),
      join(loc, 'bin', 'windows'), // TeX Live
      loc
    )
  }
  return dirs
}

// 3) 常见安装位置兜底
function commonPaths(): string[] {
  const la = process.env.LOCALAPPDATA ?? ''
  const up = process.env.USERPROFILE ?? ''
  const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const list = [
    join(pf, 'MiKTeX', 'miktex', 'bin', 'x64'),
    join(pf86, 'MiKTeX', 'miktex', 'bin', 'x64'),
    join(la, 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'),
    join(up, 'AppData', 'Local', 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'),
    'D:\\Environments\\Tex\\MikTeX\\miktex\\bin\\x64'
  ]
  for (const root of ['C:\\texlive', 'D:\\texlive']) {
    try {
      for (const year of readdirSync(root)) list.push(join(root, year, 'bin', 'windows'))
    } catch {
      /* 无该目录 */
    }
  }
  return list
}

let cache: Distro[] | null = null

/** 探测本机 TeX 发行版（memoize）。每个 id 只保留首个命中（PATH 优先）。 */
export async function detectDistros(): Promise<Distro[]> {
  if (cache) return cache
  const cands = [...(await fromPath()), ...(await fromRegistry()), ...commonPaths()]
  const seenDir = new Set<string>()
  const seenId = new Set<string>()
  const out: Distro[] = []
  for (const raw of cands) {
    const dir = raw.replace(/[\\/]+$/, '')
    const key = dir.toLowerCase()
    if (seenDir.has(key)) continue
    seenDir.add(key)
    if (!existsSync(join(dir, 'pdflatex.exe'))) continue
    const isTL = /texlive/i.test(dir)
    const id = isTL ? 'texlive' : 'miktex'
    if (seenId.has(id)) continue
    seenId.add(id)
    out.push({ id, name: isTL ? 'TeX Live' : 'MiKTeX', binDir: dir, available: true })
  }
  cache = out
  return out
}

export function clearDistroCache(): void {
  cache = null
}

/** 编译/synctex 的默认 bin：首个检测到的；都没有则空串（spawn 走 PATH）。 */
export async function defaultTexBinDir(): Promise<string> {
  return (await detectDistros())[0]?.binDir ?? ''
}
