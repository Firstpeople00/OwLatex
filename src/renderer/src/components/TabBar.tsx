import { useEffect, useRef } from 'react'
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
  const barRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // 切换/新开标签时，把活动标签滚进可见区域（否则右侧标签会被遮住）
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [activeFile, openFiles.length])

  if (openFiles.length === 0) return null
  return (
    <div
      className="tabbar"
      ref={barRef}
      // 竖向滚轮 → 横向滚动标签
      onWheel={(e) => {
        const el = barRef.current
        if (el) el.scrollLeft += e.deltaY || e.deltaX
      }}
    >
      {openFiles.map((p) => {
        const active = p === activeFile
        const isDirty = active ? dirty : buffers[p]?.dirty
        return (
          <div
            key={p}
            ref={active ? activeRef : undefined}
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
