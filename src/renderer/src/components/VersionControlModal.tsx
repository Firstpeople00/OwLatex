import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import { Icon } from './Icon'
import DiffView from './DiffView'

function relTime(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return '刚刚'
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

const NAV: { group?: string; items: { id: string; label: string }[] }[] = [
  { items: [{ id: 'history', label: '版本历史' }] },
  {
    group: '设置',
    items: [
      { id: 'auto', label: '自动快照' },
      { id: 'storage', label: '存储' },
      { id: 'about', label: '关于' }
    ]
  }
]

export default function VersionControlModal(): JSX.Element | null {
  const s = useStore()
  const [nav, setNav] = useState('history')
  const [draftAuto, setDraftAuto] = useState(s.autoSnapshot)
  const [info, setInfo] = useState<{ sizeBytes: number; count: number } | null>(null)

  const refreshInfo = (): void => {
    if (s.projectRoot) void window.api.versionInfo(s.projectRoot).then(setInfo).catch(() => {})
  }

  // 打开时：同步草稿 + 拉存储信息
  useEffect(() => {
    if (s.vcOpen) {
      setDraftAuto(s.autoSnapshot)
      refreshInfo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.vcOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') s.closeVC()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s.closeVC])

  if (!s.vcOpen) return null

  const settingsDirty = draftAuto !== s.autoSnapshot
  const apply = (): void => s.setAutoSnapshot(draftAuto)
  const ok = (): void => {
    apply()
    s.closeVC()
  }
  const handleClear = async (): Promise<void> => {
    if (!window.confirm('确定清空全部版本历史？此操作不可恢复。')) return
    await s.clearVersions()
    refreshInfo()
  }

  return (
    <div className="modal-overlay" onClick={() => s.closeVC()}>
      <div className="vc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vc-titlebar">
          版本控制
          <button className="vc-close" title="关闭" onClick={() => s.closeVC()}>
            <Icon name="win-close" size={14} />
          </button>
        </div>
        <div className="vc-body">
          <nav className="vc-nav">
            {NAV.map((g, gi) => (
              <div key={gi} className="vc-nav-group">
                {g.group && <div className="vc-nav-title">{g.group}</div>}
                {g.items.map((it) => (
                  <button
                    key={it.id}
                    className={`vc-nav-item${nav === it.id ? ' active' : ''}`}
                    onClick={() => {
                      setNav(it.id)
                      s.closeDiff()
                    }}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="vc-main">
            {s.diffView ? (
              <DiffView diff={s.diffView} onBack={() => s.closeDiff()} />
            ) : (
              <>
                {nav === 'history' && (
              <div className="vc-page">
                <div className="vc-page-head">
                  <h3>版本历史</h3>
                  <button className="vc-btn" onClick={() => s.saveVersion()}>
                    <Icon name="plus" size={13} />
                    保存版本
                  </button>
                </div>
                {s.versions.length === 0 ? (
                  <div className="vc-empty">暂无版本，点「保存版本」建第一个，或编译后自动生成。</div>
                ) : (
                  <div className="vc-vlist">
                    {s.versions.map((v, i) => {
                      const parent = s.versions[i + 1]
                      return (
                        <div key={v.oid} className="ver-row" title={v.name}>
                          <div className="ver-info">
                            <span className="ver-name">{v.name}</span>
                            <span className="ver-meta">
                              <span className={`ver-badge ver-${v.kind}`}>
                                {v.kind === 'auto' ? '自动' : '手动'}
                              </span>
                              {relTime(v.timestamp)}
                            </span>
                          </div>
                          <div className="ver-actions">
                            <button
                              title="与当前对比"
                              onClick={() => void s.compareVersion(v.oid, 'WORKDIR', v.name, '当前')}
                            >
                              <Icon name="compare" size={15} />
                            </button>
                            <button
                              title={parent ? '与上一版对比' : '已是最早版本'}
                              disabled={!parent}
                              onClick={() =>
                                parent && void s.compareVersion(parent.oid, v.oid, parent.name, v.name)
                              }
                            >
                              <Icon name="history" size={15} />
                            </button>
                            <button title="恢复到此版本" onClick={() => void s.restoreVersion(v.oid, v.name)}>
                              <Icon name="undo" size={15} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {nav === 'auto' && (
              <div className="vc-page">
                <h3>自动快照</h3>
                <label className="vc-toggle">
                  <input
                    type="checkbox"
                    checked={draftAuto}
                    onChange={(e) => setDraftAuto(e.target.checked)}
                  />
                  <span>编译成功后自动保存版本</span>
                </label>
                <p className="vc-hint">
                  开启后，每次编译成功都会自动留存一版；内容无改动时会自动跳过，不产生空版本。修改后点「确定」或「应用」生效。
                </p>
              </div>
            )}

            {nav === 'storage' && (
              <div className="vc-page">
                <h3>存储</h3>
                <div className="vc-info-table">
                  <div>
                    <span>版本库体积</span>
                    <b>{info ? fmtSize(info.sizeBytes) : '…'}</b>
                  </div>
                  <div>
                    <span>版本数</span>
                    <b>{info ? info.count : '…'}</b>
                  </div>
                  <div>
                    <span>位置</span>
                    <b className="vc-path">工程内 .mylatex/versions</b>
                  </div>
                </div>
                <p className="vc-hint">版本按内容去重存储，未改动的文件/图片跨版本只存一份，占用很小。</p>
                <button className="vc-btn vc-danger" onClick={() => void handleClear()}>
                  清空全部版本历史
                </button>
              </div>
            )}

            {nav === 'about' && (
              <div className="vc-page">
                <h3>关于</h3>
                <div className="vc-info-table">
                  <div>
                    <span>引擎</span>
                    <b>内置 Git（isomorphic-git，零安装）</b>
                  </div>
                  <div>
                    <span>版本库</span>
                    <b className="vc-path">工程内 .mylatex/versions</b>
                  </div>
                  <div>
                    <span>版本数</span>
                    <b>{s.versions.length}</b>
                  </div>
                </div>
                <p className="vc-hint">
                  版本历史保存在工程目录内，随工程一起拷贝/备份；与你自己的 .git 互不干扰。
                </p>
              </div>
                )}
              </>
            )}
          </div>
        </div>

        {settingsDirty && (
          <div className="vc-footer">
            <button className="primary" onClick={ok}>
              确定
            </button>
            <button onClick={() => s.closeVC()}>取消</button>
            <button onClick={apply}>应用</button>
          </div>
        )}
      </div>
    </div>
  )
}
