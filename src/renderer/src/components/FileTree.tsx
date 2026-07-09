import { useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useStore } from '../store/store'
import { Icon } from './Icon'
import { TEMPLATES, uniqueName } from '../templates'

const TEXT_EXT = /\.(tex|bib|cls|sty|txt|md|bst|tikz|def|cfg)$/i

function fileIcon(name: string): string {
  const n = name.toLowerCase()
  if (n.endsWith('.bib')) return 'book'
  if (/\.(png|jpe?g|gif|svg|eps)$/.test(n)) return 'image'
  if (n.endsWith('.tex')) return 'file-text'
  return 'file'
}

interface CtxMenu {
  x: number
  y: number
  node: FileNode | null // null = 空白处
}

type MenuItem = 'sep' | { label: string; onClick: () => void; danger?: boolean }

function TreeNode({
  node,
  depth,
  onContext
}: {
  node: FileNode
  depth: number
  onContext: (e: ReactMouseEvent, node: FileNode) => void
}): JSX.Element {
  const [open, setOpen] = useState(depth < 1)
  const activeFile = useStore((s) => s.activeFile)
  const mainFile = useStore((s) => s.mainFile)
  const openFile = useStore((s) => s.openFile)

  const pad = { paddingLeft: 8 + depth * 14 }

  if (node.type === 'dir') {
    return (
      <>
        <div
          className="tree-row"
          style={pad}
          onClick={() => setOpen((o) => !o)}
          onContextMenu={(e) => onContext(e, node)}
        >
          <span className="chevron">
            <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
          </span>
          <span className="icon">
            <Icon name={open ? 'folder-open' : 'folder'} size={15} />
          </span>
          <span className="label">{node.name}</span>
        </div>
        {open &&
          node.children?.map((c) => (
            <TreeNode key={c.path} node={c} depth={depth + 1} onContext={onContext} />
          ))}
      </>
    )
  }

  const isActive = node.path === activeFile
  const isMain = node.path === mainFile
  const clickable = TEXT_EXT.test(node.name)

  return (
    <div
      className={`tree-row file${isActive ? ' active' : ''}${clickable ? '' : ' dim'}`}
      style={pad}
      onClick={() => clickable && openFile(node.path)}
      onContextMenu={(e) => onContext(e, node)}
      title={node.path}
    >
      <span className="chevron" />
      <span className="icon">
        <Icon name={fileIcon(node.name)} size={15} />
      </span>
      <span className="label">{node.name}</span>
      {isMain && (
        <span className="main-badge" title="主文件">
          <Icon name="star" size={13} />
        </span>
      )}
    </div>
  )
}

export default function FileTree(): JSX.Element {
  const projectRoot = useStore((s) => s.projectRoot)
  const tree = useStore((s) => s.tree)
  const openProject = useStore((s) => s.openProject)
  const setMainFile = useStore((s) => s.setMainFile)
  const compile = useStore((s) => s.compile)
  const newFile = useStore((s) => s.newFile)
  const openFile = useStore((s) => s.openFile)
  const refreshTree = useStore((s) => s.refreshTree)
  const renameItem = useStore((s) => s.renameItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const createFolder = useStore((s) => s.createFolder)
  const openPrompt = useStore((s) => s.openPrompt)
  const [ctx, setCtx] = useState<CtxMenu | null>(null)
  const [tplOpen, setTplOpen] = useState(false)

  const createTpl = async (t: { file: string; content: string }): Promise<void> => {
    setTplOpen(false)
    if (!projectRoot) return
    const name = uniqueName(t.file, new Set(tree.map((n) => n.name.toLowerCase())))
    await newFile(`${projectRoot}\\${name}`, t.content)
  }

  const onContext = (e: ReactMouseEvent, node: FileNode): void => {
    e.preventDefault()
    e.stopPropagation()
    setCtx({ x: e.clientX, y: e.clientY, node })
  }
  const onBlankContext = (e: ReactMouseEvent): void => {
    e.preventDefault()
    setCtx({ x: e.clientX, y: e.clientY, node: null })
  }

  const copy = (text: string): void => void window.api.writeClipboard(text)
  const relPath = (p: string): string => (projectRoot ? p.slice(projectRoot.length + 1) : p)
  const askNew = (dir: string, folder: boolean): void =>
    openPrompt({
      title: folder ? '新建文件夹' : '新建文件',
      value: '',
      onOk: async (name) => {
        if (!name) return
        if (folder) await createFolder(dir, name)
        else await newFile(`${dir}\\${name}`, '')
      }
    })
  const askRename = (node: FileNode): void =>
    openPrompt({
      title: '重命名',
      value: node.name,
      onOk: async (name) => {
        if (name && name !== node.name) await renameItem(node.path, name)
      }
    })
  const askDelete = (node: FileNode): void =>
    openPrompt({
      title: `删除 “${node.name}”？将移到回收站。`,
      value: '',
      confirm: true,
      onOk: async () => deleteItem(node.path)
    })

  const menuItems = (): MenuItem[] => {
    const n = ctx?.node
    if (!n) {
      return [
        { label: '新建文件', onClick: () => projectRoot && askNew(projectRoot, false) },
        { label: '新建文件夹', onClick: () => projectRoot && askNew(projectRoot, true) },
        'sep',
        { label: '刷新', onClick: () => void refreshTree() },
        { label: '在资源管理器中显示', onClick: () => projectRoot && void window.api.reveal(projectRoot) }
      ]
    }
    const items: MenuItem[] = []
    if (n.type === 'dir') {
      items.push({ label: '新建文件', onClick: () => askNew(n.path, false) })
      items.push({ label: '新建文件夹', onClick: () => askNew(n.path, true) })
    } else {
      if (TEXT_EXT.test(n.name)) items.push({ label: '打开', onClick: () => void openFile(n.path) })
      if (n.name.toLowerCase().endsWith('.tex'))
        items.push({
          label: '设为主文件',
          onClick: () => {
            setMainFile(n.path)
            void compile()
          }
        })
    }
    items.push('sep')
    items.push({ label: '重命名', onClick: () => askRename(n) })
    items.push({ label: '删除', onClick: () => askDelete(n), danger: true })
    items.push('sep')
    items.push({ label: '复制路径', onClick: () => copy(n.path) })
    items.push({ label: '复制相对路径', onClick: () => copy(relPath(n.path)) })
    items.push({ label: '在资源管理器中显示', onClick: () => void window.api.reveal(n.path) })
    return items
  }

  const rootName = projectRoot ? projectRoot.replace(/\\/g, '/').split('/').pop() : null

  return (
    <div className="filetree" onClick={() => ctx && setCtx(null)}>
      <div className="filetree-header">
        <span className="ft-title">{rootName ?? '资源管理器'}</span>
        <span className="ft-actions">
          {projectRoot && (
            <button className="ft-open" title="从模板新建" onClick={() => setTplOpen((o) => !o)}>
              <Icon name="plus" size={16} />
            </button>
          )}
          <button className="ft-open" onClick={() => void openProject()} title="打开文件夹">
            <Icon name="folder-open" size={16} />
          </button>
          {tplOpen && (
            <div className="tpl-menu">
              {Object.entries(TEMPLATES).map(([k, t]) => (
                <button key={k} onClick={() => void createTpl(t)}>
                  {k}
                </button>
              ))}
            </div>
          )}
        </span>
      </div>

      {!projectRoot ? (
        <div className="filetree-empty">
          <button className="open-folder-btn" onClick={() => void openProject()}>
            打开文件夹
          </button>
          <p>选择一个 LaTeX 工程目录开始</p>
        </div>
      ) : (
        <div className="filetree-body" onContextMenu={onBlankContext}>
          {tree.map((n) => (
            <TreeNode key={n.path} node={n} depth={0} onContext={onContext} />
          ))}
        </div>
      )}

      {ctx && (
        <div className="ctx-menu" style={{ left: ctx.x, top: ctx.y }} onClick={(e) => e.stopPropagation()}>
          {menuItems().map((it, i) =>
            it === 'sep' ? (
              <div key={i} className="ctx-sep" />
            ) : (
              <button
                key={i}
                className={it.danger ? 'danger' : ''}
                onClick={() => {
                  it.onClick()
                  setCtx(null)
                }}
              >
                {it.label}
              </button>
            )
          )}
        </div>
      )}

    </div>
  )
}
