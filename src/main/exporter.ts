import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { basename, join } from 'path'

export interface ExportResult {
  ok: boolean
  message: string
}

const COMMON_PANDOC = [
  'C:\\Program Files\\Pandoc\\pandoc.exe',
  join(process.env.LOCALAPPDATA ?? '', 'Pandoc', 'pandoc.exe')
]

function tryRun(cmd: string): Promise<boolean> {
  return new Promise((res) => {
    const c = spawn(cmd, ['--version'], { windowsHide: true })
    c.on('error', () => res(false))
    c.on('close', (code) => res(code === 0))
  })
}

/** 检测 pandoc：常见安装路径 + PATH。返回可执行路径或 null。 */
export async function findPandoc(): Promise<string | null> {
  for (const p of COMMON_PANDOC) if (existsSync(p)) return p
  if (await tryRun('pandoc')) return 'pandoc'
  return null
}

/** pandoc 转换：LaTeX → docx/md/html。cwd=工程目录，含 refs.bib 时启用文献。 */
export function runPandoc(
  pandoc: string,
  mainFile: string,
  out: string,
  dir: string,
  hasBib: boolean
): Promise<ExportResult> {
  const args = [basename(mainFile), '-o', out, '--resource-path', dir]
  if (hasBib) args.push('--citeproc', '--bibliography', join(dir, 'refs.bib'))
  return new Promise((res) => {
    let err = ''
    const c = spawn(pandoc, args, { cwd: dir, windowsHide: true })
    c.stderr.on('data', (d) => (err += d.toString()))
    c.on('error', (e) => res({ ok: false, message: `无法运行 Pandoc：${e.message}` }))
    c.on('close', (code) =>
      res(
        code === 0
          ? { ok: true, message: `已导出 ${out}` }
          : { ok: false, message: err.split('\n')[0] || '转换失败' }
      )
    )
  })
}

/** 用系统 Compress-Archive 打包工程为 zip（无 npm 依赖）。 */
export function runZip(root: string, out: string): Promise<ExportResult> {
  return new Promise((res) => {
    let err = ''
    const c = spawn(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${root}\\*' -DestinationPath '${out}' -Force`
      ],
      { windowsHide: true }
    )
    c.stderr.on('data', (d) => (err += d.toString()))
    c.on('error', (e) => res({ ok: false, message: e.message }))
    c.on('close', (code) =>
      res(
        code === 0
          ? { ok: true, message: `已导出 ${out}` }
          : { ok: false, message: err.split('\n')[0] || '打包失败' }
      )
    )
  })
}
