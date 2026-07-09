export const TEMPLATES: Record<string, { file: string; content: string }> = {
  'article (英文)': {
    file: 'article.tex',
    content:
      '\\documentclass{article}\n\\usepackage{amsmath}\n\\title{Title}\n\\author{Author}\n\\begin{document}\n\\maketitle\n\nHello.\n\n\\end{document}\n'
  },
  '中文 (ctex, 需用 xelatex)': {
    file: 'main-zh.tex',
    content:
      '\\documentclass{ctexart}\n\\usepackage{amsmath}\n\\title{标题}\n\\author{作者}\n\\begin{document}\n\\maketitle\n\n你好，世界。\n\n\\end{document}\n'
  },
  'beamer (幻灯片)': {
    file: 'slides.tex',
    content:
      '\\documentclass{beamer}\n\\title{Title}\n\\author{Author}\n\\begin{document}\n\\frame{\\titlepage}\n\\begin{frame}{First}\nHello.\n\\end{frame}\n\\end{document}\n'
  }
}

export function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base.toLowerCase())) return base
  const dot = base.lastIndexOf('.')
  const stem = base.slice(0, dot)
  const ext = base.slice(dot)
  for (let i = 2; ; i++) {
    const n = `${stem}-${i}${ext}`
    if (!taken.has(n.toLowerCase())) return n
  }
}
