import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { useStore } from './store/store'

// 常用命令（不含反斜杠）
const COMMANDS = [
  'section', 'subsection', 'subsubsection', 'paragraph', 'chapter',
  'textbf', 'textit', 'texttt', 'emph', 'underline', 'item',
  'label', 'ref', 'eqref', 'autoref', 'pageref', 'cite', 'citep', 'citet',
  'begin', 'end', 'frac', 'sqrt', 'sum', 'int', 'left', 'right',
  'includegraphics', 'caption', 'footnote', 'newcommand', 'renewcommand',
  'documentclass', 'usepackage', 'title', 'author', 'maketitle',
  'tableofcontents', 'bibliography', 'bibliographystyle', 'input', 'include'
]

const ENVIRONMENTS = [
  'itemize', 'enumerate', 'description', 'equation', 'align', 'gather',
  'figure', 'table', 'tabular', 'center', 'quote', 'verbatim', 'abstract',
  'document', 'matrix', 'bmatrix', 'pmatrix', 'cases', 'split',
  'theorem', 'proof', 'lemma', 'definition'
]

// LaTeX 补全源：环境 / \ref 标签 / 命令
export function latexCompletions(ctx: CompletionContext): CompletionResult | null {
  const env = ctx.matchBefore(/\\(?:begin|end)\{[\w*]*/)
  if (env) {
    return {
      from: env.from + env.text.indexOf('{') + 1,
      options: ENVIRONMENTS.map((e) => ({ label: e, type: 'class' }))
    }
  }

  // \ref 家族 → 全工程 \label（store.labels）+ 当前文档（含尚未编译的新标签）
  const ref = ctx.matchBefore(/\\(?:ref|eqref|autoref|pageref|cref|Cref)\{[\w:.-]*/)
  if (ref) {
    const docLabels = [...ctx.state.doc.toString().matchAll(/\\label\{([^}]+)\}/g)].map((m) => m[1])
    const all = [...new Set([...docLabels, ...useStore.getState().labels])]
    return {
      from: ref.from + ref.text.indexOf('{') + 1,
      options: all.map((l) => ({ label: l, type: 'variable' }))
    }
  }

  // \cite 家族 → 工程 .bib 的 key（支持逗号分隔多个）
  const cite = ctx.matchBefore(/\\(?:cite|citep|citet|citeauthor|citeyear|parencite|textcite)\{[\w:,.\s-]*/)
  if (cite) {
    const sep = Math.max(cite.text.lastIndexOf('{'), cite.text.lastIndexOf(','))
    return {
      from: cite.from + sep + 1,
      options: useStore.getState().bibKeys.map((k) => ({ label: k, type: 'constant' }))
    }
  }

  const cmd = ctx.matchBefore(/\\[a-zA-Z]*/)
  if (cmd && cmd.from < cmd.to) {
    return { from: cmd.from + 1, options: COMMANDS.map((c) => ({ label: c, type: 'keyword' })) }
  }
  return null
}
