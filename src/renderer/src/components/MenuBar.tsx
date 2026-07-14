import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import { Icon } from './Icon'
import { TEMPLATES, uniqueName } from '../templates'
import logo from '../../../images/logo-1.svg'
import {
  insertAtCursor,
  wrapSelection,
  editorUndo,
  editorRedo,
  editorSelectAll,
  editorFind
} from '../editor-view'

type Item =
  | 'sep'
  | {
      label: string
      onClick?: () => void
      shortcut?: string
      disabled?: boolean
      checked?: boolean
      submenu?: Item[]
    }

const STATUS_LABEL: Record<string, string> = {
  idle: '就绪',
  compiling: '编译中…',
  success: '编译成功',
  error: '编译失败'
}

const SNIP_TABLE =
  '\\begin{table}[ht]\n  \\centering\n  \\begin{tabular}{cc}\n    a & b \\\\\n    c & d \\\\\n  \\end{tabular}\n  \\caption{}\n  \\label{}\n\\end{table}\n'
const SNIP_ITEMIZE = '\\begin{itemize}\n  \\item \n\\end{itemize}\n'
const SNIP_ENUM = '\\begin{enumerate}\n  \\item \n\\end{enumerate}\n'

function baseName(p: string | null): string {
  return p ? (p.replace(/\\/g, '/').split('/').pop() ?? p) : ''
}

function MenuList({ items, onClose }: { items: Item[]; onClose: () => void }): JSX.Element {
  const [subOpen, setSubOpen] = useState<number | null>(null)
  return (
    <div className="menu-list">
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} className="menu-sep" />
        ) : (
          <div
            key={i}
            className="menu-item-wrap"
            onMouseEnter={() => setSubOpen(it.submenu ? i : null)}
          >
            <button
              className="menu-item"
              disabled={it.disabled}
              onClick={() => {
                if (it.submenu) return
                it.onClick?.()
                onClose()
              }}
            >
              <span className="mi-check">{it.checked ? <Icon name="check" size={13} /> : null}</span>
              <span className="mi-label">{it.label}</span>
              {it.shortcut && <span className="mi-shortcut">{it.shortcut}</span>}
              {it.submenu && (
                <span className="mi-arrow">
                  <Icon name="chevron-right" size={13} />
                </span>
              )}
            </button>
            {it.submenu && subOpen === i && (
              <div className="submenu">
                <MenuList items={it.submenu} onClose={onClose} />
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}

export default function MenuBar(): JSX.Element {
  const s = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const [maxed, setMaxed] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    window.api.onMaximizeChange(setMaxed)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hasProject = !!s.projectRoot
  const hasFile = !!s.activeFile
  const hasMain = !!s.mainFile

  const askNewRoot = (folder: boolean): void => {
    if (!s.projectRoot) return
    const root = s.projectRoot
    s.openPrompt({
      title: folder ? '新建文件夹' : '新建文件',
      value: '',
      onOk: async (name) => {
        if (!name) return
        if (folder) await s.createFolder(root, name)
        else await s.newFile(`${root}\\${name}`, '')
      }
    })
  }
  const createTpl = (key: string): void => {
    if (!s.projectRoot) return
    const t = TEMPLATES[key]
    const name = uniqueName(t.file, new Set(s.tree.map((n) => n.name.toLowerCase())))
    void s.newFile(`${s.projectRoot}\\${name}`, t.content)
  }

  const fileMenu: Item[] = [
    { label: '打开文件夹…', onClick: () => void s.openProject() },
    { label: '新建文件…', disabled: !hasProject, onClick: () => askNewRoot(false) },
    { label: '新建文件夹…', disabled: !hasProject, onClick: () => askNewRoot(true) },
    {
      label: '从模板新建',
      disabled: !hasProject,
      submenu: Object.keys(TEMPLATES).map((k) => ({ label: k, onClick: () => createTpl(k) }))
    },
    'sep',
    { label: '保存', shortcut: 'Ctrl+S', disabled: !hasFile, onClick: () => void s.saveActive() },
    {
      label: '导出',
      disabled: !hasMain,
      submenu: [
        { label: '导出 PDF…', onClick: () => void s.exportPdf() },
        { label: '导出源码 (.zip)…', onClick: () => void s.exportZip() },
        'sep',
        {
          label: 'Word (.docx)…',
          disabled: !s.pandocAvailable,
          onClick: () => void s.exportDoc('docx')
        },
        {
          label: 'Markdown (.md)…',
          disabled: !s.pandocAvailable,
          onClick: () => void s.exportDoc('md')
        },
        {
          label: 'HTML (.html)…',
          disabled: !s.pandocAvailable,
          onClick: () => void s.exportDoc('html')
        },
        ...(s.pandocAvailable
          ? []
          : ([{ label: '（Word/MD/HTML 需安装 Pandoc）', disabled: true }] as Item[]))
      ]
    },
    'sep',
    {
      label: '在资源管理器中显示工程',
      disabled: !hasProject,
      onClick: () => s.projectRoot && void window.api.reveal(s.projectRoot)
    }
  ]

  const editMenu: Item[] = [
    { label: '撤销', shortcut: 'Ctrl+Z', onClick: editorUndo },
    { label: '重做', shortcut: 'Ctrl+Y', onClick: editorRedo },
    'sep',
    { label: '查找/替换', shortcut: 'Ctrl+F', onClick: editorFind },
    { label: '全选', shortcut: 'Ctrl+A', onClick: editorSelectAll }
  ]

  const insertMenu: Item[] = [
    { label: '行内公式  $ $', onClick: () => wrapSelection('$', '$') },
    { label: '行间公式  \\[ \\]', onClick: () => wrapSelection('\\[ ', ' \\]') },
    'sep',
    { label: '图片', onClick: () => insertAtCursor('\\includegraphics[width=\\linewidth]{}') },
    { label: '表格', onClick: () => insertAtCursor(SNIP_TABLE) },
    'sep',
    { label: '引用 \\cite', onClick: () => insertAtCursor('\\cite{}') },
    { label: '交叉引用 \\ref', onClick: () => insertAtCursor('\\ref{}') },
    { label: '链接 \\href', onClick: () => insertAtCursor('\\href{}{}') },
    { label: '注释 %', onClick: () => insertAtCursor('% ') }
  ]

  const formatMenu: Item[] = [
    { label: '加粗', shortcut: 'Ctrl+B', onClick: () => wrapSelection('\\textbf{', '}') },
    { label: '斜体', shortcut: 'Ctrl+I', onClick: () => wrapSelection('\\textit{', '}') },
    { label: '下划线', onClick: () => wrapSelection('\\underline{', '}') },
    { label: '行内代码', onClick: () => wrapSelection('\\texttt{', '}') },
    'sep',
    { label: '无序列表', onClick: () => insertAtCursor(SNIP_ITEMIZE) },
    { label: '有序列表', onClick: () => insertAtCursor(SNIP_ENUM) },
    'sep',
    {
      label: '章节',
      submenu: [
        { label: '节 section', onClick: () => wrapSelection('\\section{', '}') },
        { label: '小节 subsection', onClick: () => wrapSelection('\\subsection{', '}') },
        { label: '小小节 subsubsection', onClick: () => wrapSelection('\\subsubsection{', '}') }
      ]
    }
  ]

  const viewMenu: Item[] = [
    {
      label: '主题',
      submenu: [
        { label: '浅色', checked: s.theme === 'light', onClick: () => s.setTheme('light') },
        { label: '深色', checked: s.theme === 'dark', onClick: () => s.setTheme('dark') }
      ]
    },
    {
      label: '编译引擎',
      submenu: (['pdflatex', 'xelatex', 'lualatex'] as const).map((e) => ({
        label: e,
        checked: s.engine === e,
        onClick: () => s.setEngine(e)
      }))
    },
    {
      label: 'TeX 发行版',
      submenu: s.distros
        .filter((d) => d.available)
        .map((d) => ({
          label: d.name,
          checked: s.selectedTexBin === d.binDir,
          onClick: () => s.setTexBin(d.binDir)
        }))
    },
    'sep',
    { label: '自动编译', checked: s.autoCompile, onClick: () => s.setAutoCompile(!s.autoCompile) }
  ]

  const helpMenu: Item[] = [
    { label: '检查运行环境…', onClick: () => s.openEnvModal() },
    {
      label: `关于 OwLatex（v${__APP_VERSION__}）`,
      onClick: () => s.notify(`OwLatex v${__APP_VERSION__} — 自研 LaTeX 编辑器`)
    }
  ]

  const menus = [
    { name: '文件', items: fileMenu },
    { name: '编辑', items: editMenu },
    { name: '插入', items: insertMenu },
    { name: '格式', items: formatMenu },
    { name: '视图', items: viewMenu },
    { name: '帮助', items: helpMenu }
  ]

  const statusClass = !hasProject ? 'idle' : s.status
  const statusText = !hasProject
    ? '未打开工程'
    : s.status === 'success'
      ? `编译成功 (${s.durationMs} ms)`
      : STATUS_LABEL[s.status]

  return (
    <div className="menubar">
      {open && <div className="menu-backdrop" onClick={() => setOpen(null)} />}
      <div className="menubar-left">
        <span className="app-logo">
          <img src={logo} className="logo-img" alt="" />
          OwLatex
        </span>
        {menus.map((m) => (
          <div key={m.name} className="topmenu">
            <button
              className={`topmenu-btn${open === m.name ? ' active' : ''}`}
              onClick={() => setOpen(open === m.name ? null : m.name)}
              onMouseEnter={() => open && setOpen(m.name)}
            >
              {m.name}
            </button>
            {open === m.name && (
              <div className="dropdown">
                <MenuList items={m.items} onClose={() => setOpen(null)} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="menubar-actions">
        <span className="main-file" title={s.mainFile ?? ''}>
          主文件：{s.mainFile ? baseName(s.mainFile) : '（未设）'}
        </span>
        <button
          className="compile-btn"
          onClick={() => void s.compile()}
          disabled={s.status === 'compiling' || !hasMain}
          title={!hasMain ? '先打开含 \\documentclass 的工程' : '编译主文件'}
        >
          编译
        </button>
        <button
          onClick={() => void s.syncForward()}
          disabled={!hasMain}
          title="源码光标 → 定位到 PDF（PDF 内双击可反向跳回源码）"
        >
          <Icon name="arrow-right" size={15} />
          PDF
        </button>
        <span className={`status status-${statusClass}`}>
          {s.status === 'compiling' ? <span className="spinner" /> : '●'} {statusText}
        </span>
        {s.dirty && <span className="dirty">● 未保存</span>}
      </div>

      <div className="win-controls">
        <button className="win-btn" title="最小化" onClick={() => window.api.minimizeWindow()}>
          <Icon name="win-min" size={15} />
        </button>
        <button
          className="win-btn"
          title={maxed ? '还原' : '最大化'}
          onClick={() => window.api.toggleMaximize()}
        >
          <Icon name={maxed ? 'win-restore' : 'win-max'} size={14} />
        </button>
        <button className="win-btn win-close" title="关闭" onClick={() => window.api.closeWindow()}>
          <Icon name="win-close" size={15} />
        </button>
      </div>
    </div>
  )
}
