import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { dirname, basename, join } from 'path'
import { tmpdir } from 'os'

/**
 * 编译引擎：直接调用原生 pdflatex.exe（不用 latexmk，因 MiKTeX 不带 Perl）。
 * Phase 2：工程模型——就地编译。cwd 设为主文件所在目录，
 * 这样 \input/\include、图片、refs.bib 等相对路径都能解析。
 * ⚠️ MiKTeX 不在系统 PATH，故按绝对路径调用并注入 PATH。
 * ⚠️ 就地编译：若主文件目录含中文/空格，pdflatex 可能失败（后续用英文 junction 兜底）。
 * Phase 3 设置面板会支持切换 xelatex / lualatex。
 */
const DEFAULT_TEX_BIN = 'D:\\Environments\\Tex\\MikTeX\\miktex\\bin\\x64'
const MAX_PASSES = 3

function getTexBinDir(): string {
  return process.env.MYLATEX_TEX_BIN || DEFAULT_TEX_BIN
}

export interface CompileResult {
  success: boolean
  /** 编译成功时的 PDF 字节，经 IPC 结构化克隆传给 renderer */
  pdf?: Uint8Array
  log: string
  durationMs: number
  passes: number
}

interface PassResult {
  code: number | null
  out: string
}

function runEngine(
  engine: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<PassResult> {
  return new Promise((resolve) => {
    let out = ''
    const child = spawn(engine, args, { cwd, env, windowsHide: true })
    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (out += d.toString()))
    child.on('error', (err) => resolve({ code: null, out: `SPAWN ERROR: ${err.message}` }))
    child.on('close', (code) => resolve({ code, out }))
  })
}

/**
 * 编译指定主文件（绝对路径）。就地编译：cwd = 主文件所在目录。
 * texBin：可选，指定 TeX 发行版 bin 目录（MiKTeX / TeX Live 切换）；缺省回退到环境变量/默认。
 */
export async function compileMainFile(
  mainFile: string,
  texBinOverride?: string,
  engineName = 'pdflatex'
): Promise<CompileResult> {
  const start = Date.now()
  const cwd = dirname(mainFile)
  const name = basename(mainFile)
  const job = name.replace(/\.tex$/i, '')

  const texBin = texBinOverride || getTexBinDir()
  const engine = join(texBin, `${engineName}.exe`)
  const env = { ...process.env, PATH: `${texBin};${process.env.PATH ?? ''}` }
  const args = [
    '-synctex=1',
    '-interaction=nonstopmode',
    '-halt-on-error',
    '-file-line-error',
    name
  ]

  let aggregateLog = ''
  let pass = 0
  let lastCode: number | null = null
  let ranBibtex = false

  // latexmk-lite：最多 MAX_PASSES 遍，日志出现 "Rerun" 就再跑一遍（交叉引用/目录）
  for (pass = 1; pass <= MAX_PASSES; pass++) {
    const res = await runEngine(engine, args, cwd, env)
    aggregateLog += `\n===== pass ${pass} (exit ${res.code}) =====\n${res.out}`
    lastCode = res.code
    if (res.code !== 0) break
    // 首遍后：若用了 \bibliography 则跑一次 bibtex，并强制再编译并入 .bbl
    if (!ranBibtex) {
      ranBibtex = true
      const aux = await fs.readFile(join(cwd, `${job}.aux`), 'utf8').catch(() => '')
      if (/\\bibdata/.test(aux)) {
        const b = await runEngine(join(texBin, 'bibtex.exe'), [job], cwd, env)
        aggregateLog += `\n===== bibtex (exit ${b.code}) =====\n${b.out}`
        continue
      }
    }
    const logText = await fs.readFile(join(cwd, `${job}.log`), 'utf8').catch(() => '')
    if (!/Rerun/i.test(logText)) break
  }

  let pdf: Uint8Array | undefined
  try {
    pdf = await fs.readFile(join(cwd, `${job}.pdf`))
  } catch {
    pdf = undefined
  }

  const success = lastCode === 0 && !!pdf
  // 调试落盘（固定临时位置，便于排查任意工程的编译失败）
  void fs
    .writeFile(
      join(tmpdir(), 'mylatex-debug.log'),
      `mainFile=${mainFile}\ncwd=${cwd}\nsuccess=${success}\nlastExit=${lastCode}\npasses=${pass}\npdfBytes=${pdf ? pdf.length : 0}\n${aggregateLog}`,
      'utf8'
    )
    .catch(() => {})

  return {
    success,
    pdf,
    log: aggregateLog || `引擎无法启动，请检查 TeX bin 路径：${texBin}`,
    durationMs: Date.now() - start,
    passes: pass
  }
}
