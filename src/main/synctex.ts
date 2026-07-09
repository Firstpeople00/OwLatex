import { spawn } from 'child_process'
import { dirname, join } from 'path'

// ponytail: 与 compiler 同一默认；texBin 缺省时回退到 MiKTeX
const DEFAULT_TEX_BIN = 'D:\\Environments\\Tex\\MikTeX\\miktex\\bin\\x64'

function run(bin: string, args: string[], cwd: string): Promise<string> {
  return new Promise((res) => {
    let out = ''
    const c = spawn(join(bin, 'synctex.exe'), args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, PATH: `${bin};${process.env.PATH ?? ''}` }
    })
    c.stdout.on('data', (d) => (out += d.toString()))
    c.on('error', () => res(''))
    c.on('close', () => res(out))
  })
}

const num = (s: string, re: RegExp): number => Number(s.match(re)?.[1] ?? 0)

// 源码 -> PDF（坐标为 PDF 点，左上角原点）
export async function synctexView(
  pdf: string,
  file: string,
  line: number,
  texBin?: string
): Promise<{ page: number; x: number; y: number; w: number; h: number } | null> {
  const out = await run(texBin || DEFAULT_TEX_BIN, ['view', '-i', `${line}:0:${file}`, '-o', pdf], dirname(pdf))
  const page = out.match(/^Page:(\d+)/m)
  if (!page) return null
  return {
    page: Number(page[1]),
    x: num(out, /^h:([\d.]+)/m),
    y: num(out, /^v:([\d.]+)/m),
    w: num(out, /^W:([\d.]+)/m),
    h: num(out, /^H:([\d.]+)/m)
  }
}

// PDF -> 源码
export async function synctexEdit(
  pdf: string,
  page: number,
  x: number,
  y: number,
  texBin?: string
): Promise<{ file: string; line: number } | null> {
  const out = await run(texBin || DEFAULT_TEX_BIN, ['edit', '-o', `${page}:${x}:${y}:${pdf}`], dirname(pdf))
  const file = out.match(/^Input:(.+)$/m)
  const line = out.match(/^Line:(\d+)/m)
  if (!file || !line) return null
  return { file: file[1].trim(), line: Number(line[1]) }
}
