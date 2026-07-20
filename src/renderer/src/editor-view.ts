import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { undo, redo, selectAll } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'

// 当前活动的 CodeMirror 视图（由 Editor 设置），供菜单的编辑/插入/格式命令调用
let view: EditorView | null = null
export function setEditorView(v: EditorView | null): void {
  view = v
}
function focused(): EditorView | null {
  view?.focus()
  return view
}

/** 在光标处插入（有选区则替换） */
export function insertAtCursor(text: string): void {
  const v = focused()
  if (v) v.dispatch(v.state.replaceSelection(text))
}

/** 用 before/after 包裹每段选区；空选区把光标放中间 */
export function wrapSelection(before: string, after: string): void {
  const v = focused()
  if (!v) return
  v.dispatch(
    v.state.changeByRange((range) => {
      const sel = v.state.sliceDoc(range.from, range.to)
      const anchor = range.from + before.length
      return {
        changes: { from: range.from, to: range.to, insert: before + sel + after },
        range: EditorSelection.range(anchor, range.empty ? anchor : anchor + sel.length)
      }
    })
  )
}

export const editorUndo = (): void => void (focused() && undo(view!))
export const editorRedo = (): void => void (focused() && redo(view!))
export const editorSelectAll = (): void => void (focused() && selectAll(view!))
export const editorFind = (): void => void (focused() && openSearchPanel(view!))

// 常用插入片段（工具栏与顶栏菜单共用）
export const SNIP_TABLE =
  '\\begin{table}[ht]\n  \\centering\n  \\begin{tabular}{cc}\n    a & b \\\\\n    c & d \\\\\n  \\end{tabular}\n  \\caption{}\n  \\label{}\n\\end{table}\n'
export const SNIP_ITEMIZE = '\\begin{itemize}\n  \\item \n\\end{itemize}\n'
export const SNIP_ENUM = '\\begin{enumerate}\n  \\item \n\\end{enumerate}\n'
