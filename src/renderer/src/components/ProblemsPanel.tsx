import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { parseLog } from '../parse-log'
import { Icon } from './Icon'

function baseName(p?: string): string {
  return p ? (p.replace(/\\/g, '/').split('/').pop() ?? p) : ''
}

export default function ProblemsPanel(): JSX.Element | null {
  const log = useStore((s) => s.log)
  const mainFile = useStore((s) => s.mainFile)
  const projectRoot = useStore((s) => s.projectRoot)
  const requestGoto = useStore((s) => s.requestGoto)
  const [open, setOpen] = useState(true)

  const problems = useMemo(() => parseLog(log, mainFile), [log, mainFile])
  if (!projectRoot) return null

  const errors = problems.filter((p) => p.severity === 'error').length
  const warns = problems.length - errors

  return (
    <div className="problems">
      <div className="problems-header" onClick={() => setOpen((o) => !o)}>
        <span className="panel-title">
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
          问题
        </span>
        <span className="problems-count">
          {errors > 0 && (
            <span className="c-err">
              <Icon name="alert-circle" size={13} /> {errors}
            </span>
          )}
          {warns > 0 && (
            <span className="c-warn">
              <Icon name="triangle-alert" size={13} /> {warns}
            </span>
          )}
          {problems.length === 0 && (
            <span className="c-ok">
              <Icon name="check" size={13} /> 无错误
            </span>
          )}
        </span>
      </div>
      {open && problems.length > 0 && (
        <div className="problems-body">
          {problems.map((p, i) => (
            <div
              key={i}
              className={`problem-row ${p.severity}${p.file ? '' : ' nojump'}`}
              onClick={() => p.file && void requestGoto(p.file, p.line)}
              title={p.file ? `${p.file}:${p.line}` : ''}
            >
              <span className="p-icon">
                <Icon name={p.severity === 'error' ? 'alert-circle' : 'triangle-alert'} size={14} />
              </span>
              {p.file && (
                <span className="p-loc">
                  {baseName(p.file)}:{p.line}
                </span>
              )}
              <span className="p-msg">{p.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
