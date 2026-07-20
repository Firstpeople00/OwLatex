import { useState } from 'react'
import { useStore } from '../store/store'
import { Icon } from './Icon'
import {
  insertAtCursor,
  wrapSelection,
  editorUndo,
  editorRedo,
  editorFind,
  SNIP_TABLE,
  SNIP_ITEMIZE,
  SNIP_ENUM
} from '../editor-view'

// 常用数学符号 → 插入对应 LaTeX 命令（默认你在数学环境里）
const SYMBOLS: [string, string][] = [
  ['α', '\\alpha'], ['β', '\\beta'], ['γ', '\\gamma'], ['δ', '\\delta'],
  ['ε', '\\epsilon'], ['θ', '\\theta'], ['λ', '\\lambda'], ['μ', '\\mu'],
  ['π', '\\pi'], ['ρ', '\\rho'], ['σ', '\\sigma'], ['τ', '\\tau'],
  ['φ', '\\phi'], ['ψ', '\\psi'], ['ω', '\\omega'], ['Δ', '\\Delta'],
  ['Σ', '\\Sigma'], ['Π', '\\Pi'], ['Ω', '\\Omega'], ['∇', '\\nabla'],
  ['∑', '\\sum'], ['∏', '\\prod'], ['∫', '\\int'], ['∂', '\\partial'],
  ['√', '\\sqrt{}'], ['∞', '\\infty'], ['≤', '\\leq'], ['≥', '\\geq'],
  ['≠', '\\neq'], ['≈', '\\approx'], ['×', '\\times'], ['±', '\\pm'],
  ['·', '\\cdot'], ['→', '\\rightarrow'], ['⇒', '\\Rightarrow'], ['∈', '\\in'],
  ['⊂', '\\subset'], ['∀', '\\forall'], ['∃', '\\exists'], ['∝', '\\propto']
]

export default function EditorToolbar(): JSX.Element {
  const hasFile = useStore((s) => !!s.activeFile)
  const [menu, setMenu] = useState<'heading' | 'symbols' | null>(null)
  const close = (): void => setMenu(null)
  const pick = (fn: () => void): void => {
    fn()
    close()
  }

  const Btn = ({
    icon,
    text,
    title,
    onClick,
    cls
  }: {
    icon?: string
    text?: string
    title: string
    onClick: () => void
    cls?: string
  }): JSX.Element => (
    <button
      className={`tb-btn${cls ? ' ' + cls : ''}`}
      title={title}
      disabled={!hasFile}
      onMouseDown={(e) => e.preventDefault()} // 保持编辑器选区不丢
      onClick={onClick}
    >
      {icon ? <Icon name={icon} size={16} /> : text}
    </button>
  )

  return (
    <div className="editor-toolbar">
      {menu && <div className="tb-backdrop" onMouseDown={close} />}

      <Btn icon="undo" title="撤销 (Ctrl+Z)" onClick={editorUndo} />
      <Btn icon="redo" title="重做 (Ctrl+Y)" onClick={editorRedo} />
      <span className="tb-sep" />

      <div className="tb-group">
        <button
          className={`tb-btn${menu === 'heading' ? ' active' : ''}`}
          title="标题"
          disabled={!hasFile}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMenu(menu === 'heading' ? null : 'heading')}
        >
          <Icon name="heading" size={16} />
          <Icon name="chevron-down" size={12} />
        </button>
        {menu === 'heading' && (
          <div className="tb-menu">
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(() => wrapSelection('\\section{', '}'))}>节 section</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(() => wrapSelection('\\subsection{', '}'))}>小节 subsection</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(() => wrapSelection('\\subsubsection{', '}'))}>小小节 subsubsection</button>
          </div>
        )}
      </div>

      <Btn text="B" cls="tb-b" title="加粗 (Ctrl+B)" onClick={() => wrapSelection('\\textbf{', '}')} />
      <Btn text="I" cls="tb-i" title="斜体 (Ctrl+I)" onClick={() => wrapSelection('\\textit{', '}')} />
      <Btn text="U" cls="tb-u" title="下划线" onClick={() => wrapSelection('\\underline{', '}')} />
      <span className="tb-sep" />

      <Btn text="$" cls="tb-math" title="行内公式 $ $" onClick={() => wrapSelection('$', '$')} />
      <div className="tb-group">
        <button
          className={`tb-btn tb-math${menu === 'symbols' ? ' active' : ''}`}
          title="插入符号"
          disabled={!hasFile}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMenu(menu === 'symbols' ? null : 'symbols')}
        >
          Ω
        </button>
        {menu === 'symbols' && (
          <div className="tb-symbols">
            {SYMBOLS.map(([ch, cmd]) => (
              <button
                key={cmd}
                title={cmd}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(() => insertAtCursor(cmd))}
              >
                {ch}
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="tb-sep" />

      <Btn icon="link" title="链接 \href" onClick={() => insertAtCursor('\\href{}{}')} />
      <Btn icon="image" title="图片 \includegraphics" onClick={() => insertAtCursor('\\includegraphics[width=\\linewidth]{}')} />
      <Btn icon="table" title="表格" onClick={() => insertAtCursor(SNIP_TABLE)} />
      <Btn icon="list" title="无序列表" onClick={() => insertAtCursor(SNIP_ITEMIZE)} />
      <Btn icon="list-ordered" title="有序列表" onClick={() => insertAtCursor(SNIP_ENUM)} />
      <span className="tb-sep" />

      <Btn icon="book" title="引用 \cite" onClick={() => insertAtCursor('\\cite{}')} />
      <Btn icon="tag" title="交叉引用 \ref" onClick={() => insertAtCursor('\\ref{}')} />

      <button className="tb-btn tb-find" title="查找/替换 (Ctrl+F)" disabled={!hasFile} onMouseDown={(e) => e.preventDefault()} onClick={editorFind}>
        <Icon name="search" size={16} />
      </button>
    </div>
  )
}
