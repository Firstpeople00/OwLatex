import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { tags as t } from '@lezer/highlight'
import { autocompletion } from '@codemirror/autocomplete'
import { linter, lintGutter, forceLinting } from '@codemirror/lint'
import { useStore } from '../store/store'
import { latexCompletions } from '../latex-complete'
import { parseLog } from '../parse-log'
import { setEditorView, wrapSelection } from '../editor-view'
import { Icon } from './Icon'

// 编译错误 → 当前文件的红波浪线（从 store 的日志取，按 activeFile 过滤）
function latexLint(view: EditorView): { from: number; to: number; severity: 'error'; message: string }[] {
  const { log, mainFile, activeFile } = useStore.getState()
  if (!activeFile) return []
  return parseLog(log, mainFile)
    .filter(
      (p) =>
        p.severity === 'error' && p.line && p.file && p.file.toLowerCase() === activeFile.toLowerCase()
    )
    .map((p) => {
      const ln = view.state.doc.line(Math.min(p.line as number, view.state.doc.lines))
      return { from: ln.from, to: ln.to, severity: 'error' as const, message: p.message }
    })
}

/**
 * CodeMirror 6 命令式封装：切换 activeFile 时销毁旧视图、用新文件内容重建。
 * 编辑通过 store.setSource 同步（并标记 dirty）。
 */
// 用 CSS 变量做主题：data-theme 切换时跟随，无需重建编辑器
const cmTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--bg-primary)', color: 'var(--text)' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-faint)',
    border: 'none'
  },
  '.cm-activeLine': { backgroundColor: 'var(--bg-hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--bg-hover)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--bg-active)'
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text)',
    boxShadow: 'var(--shadow)'
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--bg-active)',
    color: 'var(--text)'
  }
})

const cmHighlight = HighlightStyle.define([
  { tag: t.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.keyword, t.tagName, t.typeName, t.controlKeyword], color: 'var(--syn-keyword)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syn-string)' },
  { tag: [t.number, t.literal, t.atom], color: 'var(--syn-number)' },
  { tag: [t.bracket, t.brace, t.punctuation], color: 'var(--text-muted)' }
])

export default function Editor(): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const activeFile = useStore((s) => s.activeFile)
  const setSource = useStore((s) => s.setSource)
  const gotoLine = useStore((s) => s.gotoLine)
  const log = useStore((s) => s.log)

  useEffect(() => {
    if (!parentRef.current || !activeFile) {
      viewRef.current?.destroy()
      viewRef.current = null
      return
    }
    const updateListener = EditorView.updateListener.of((u) => {
      if (u.docChanged) setSource(u.state.doc.toString())
      if (u.selectionSet || u.docChanged) {
        useStore.setState({
          cursorLine: u.state.doc.lineAt(u.state.selection.main.head).number
        })
      }
    })
    const state = EditorState.create({
      doc: useStore.getState().source,
      extensions: [
        basicSetup,
        StreamLanguage.define(stex),
        autocompletion({ override: [latexCompletions] }),
        linter(latexLint, { delay: 150 }),
        lintGutter(),
        keymap.of([
          { key: 'Mod-s', run: () => (void useStore.getState().saveActive(), true) },
          { key: 'Mod-b', run: () => (wrapSelection('\\textbf{', '}'), true) },
          { key: 'Mod-i', run: () => (wrapSelection('\\textit{', '}'), true) }
        ]),
        cmTheme,
        syntaxHighlighting(cmHighlight),
        EditorView.lineWrapping,
        updateListener
      ]
    })
    const view = new EditorView({ state, parent: parentRef.current })
    viewRef.current = view
    setEditorView(view)
    return () => {
      view.destroy()
      viewRef.current = null
      setEditorView(null)
    }
  }, [activeFile, setSource])

  // 问题面板点击：滚动并选中对应行
  useEffect(() => {
    const v = viewRef.current
    if (!v || !gotoLine) return
    const line = v.state.doc.line(Math.min(gotoLine, v.state.doc.lines))
    v.dispatch({
      selection: { anchor: line.from, head: line.to },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' })
    })
    v.focus()
    useStore.setState({ gotoLine: null })
  }, [gotoLine, activeFile])

  // 编译完成（log 变化）后刷新红波浪线
  useEffect(() => {
    if (viewRef.current) forceLinting(viewRef.current)
  }, [log])

  if (!activeFile) {
    return (
      <div className="editor-empty">
        <Icon name="file-text" size={40} />
        <p>从左侧文件树打开一个 .tex 文件</p>
      </div>
    )
  }
  return <div ref={parentRef} className="editor" />
}
