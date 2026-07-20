import { useStore } from '../store/store'
import { Icon } from './Icon'

function baseName(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

export default function TabBar(): JSX.Element | null {
  const openFiles = useStore((s) => s.openFiles)
  const activeFile = useStore((s) => s.activeFile)
  const dirty = useStore((s) => s.dirty)
  const buffers = useStore((s) => s.buffers)
  if (openFiles.length === 0) return null
  return (
    <div className="tabbar">
      {openFiles.map((p) => {
        const active = p === activeFile
        const isDirty = active ? dirty : buffers[p]?.dirty
        return (
          <div
            key={p}
            className={`tab${active ? ' active' : ''}${isDirty ? ' dirty' : ''}`}
            title={p}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                void useStore.getState().closeFile(p) // 中键关闭
              }
            }}
            onClick={() => void useStore.getState().openFile(p)}
          >
            <span className="tab-name">{baseName(p)}</span>
            <button
              className="tab-close"
              title="关闭"
              onClick={(e) => {
                e.stopPropagation()
                void useStore.getState().closeFile(p)
              }}
            >
              <span className="tab-x">
                <Icon name="win-close" size={12} />
              </span>
              <span className="tab-dot" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
