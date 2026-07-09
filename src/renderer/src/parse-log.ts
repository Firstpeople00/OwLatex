export interface Problem {
  severity: 'error' | 'warning'
  file?: string
  line?: number
  message: string
}

function dirOf(p: string): string {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return i >= 0 ? p.slice(0, i) : ''
}

// 解析 pdflatex 日志（-file-line-error 给出 文件:行: 消息）
export function parseLog(log: string, mainFile: string | null): Problem[] {
  const cwd = mainFile ? dirOf(mainFile) : ''
  const out: Problem[] = []
  const seen = new Set<string>()
  const add = (p: Problem): void => {
    const k = `${p.severity}|${p.file ?? ''}|${p.line ?? ''}|${p.message}`
    if (!seen.has(k)) {
      seen.add(k)
      out.push(p)
    }
  }
  for (const ln of log.split(/\r?\n/)) {
    let m = ln.match(/^(.*?\.\w+):(\d+): (.*)$/)
    if (m) {
      const f = m[1].replace(/^\.\//, '')
      const abs = /^[a-zA-Z]:[\\/]/.test(f) ? f : `${cwd}\\${f}`
      add({ severity: 'error', file: abs.replace(/\//g, '\\'), line: +m[2], message: m[3].trim() })
      continue
    }
    m = ln.match(/^! (.+)$/)
    if (m) {
      add({ severity: 'error', message: m[1].trim() })
      continue
    }
    m = ln.match(/^(?:LaTeX|LaTeX Font|Package \S+|Class \S+) Warning: (.*)$/)
    if (m) {
      const lm = m[1].match(/on input line (\d+)/)
      add({ severity: 'warning', line: lm ? +lm[1] : undefined, message: m[1].trim() })
    }
  }
  return out
}
