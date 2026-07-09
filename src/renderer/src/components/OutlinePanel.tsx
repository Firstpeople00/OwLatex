import { useState } from 'react'
import { useStore } from '../store/store'
import { Icon } from './Icon'

export default function OutlinePanel(): JSX.Element | null {
  const outline = useStore((s) => s.outline)
  const requestGoto = useStore((s) => s.requestGoto)
  const projectRoot = useStore((s) => s.projectRoot)
  const [open, setOpen] = useState(true)

  if (!projectRoot) return null

  return (
    <div className="outline">
      <div className="outline-header" onClick={() => setOpen((o) => !o)}>
        <span className="panel-title">
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
          大纲
        </span>
      </div>
      {open && (
        <div className="outline-body">
          {outline.length === 0 ? (
            <div className="outline-empty">无章节</div>
          ) : (
            outline.map((it, i) => (
              <div
                key={i}
                className="outline-row"
                style={{ paddingLeft: 8 + it.level * 14 }}
                onClick={() => void requestGoto(it.file, it.line)}
                title={`${it.file}:${it.line}`}
              >
                {it.title}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
