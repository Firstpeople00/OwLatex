// 版本差异视图（内嵌在版本控制面板内，非弹窗）
const STATUS_LABEL: Record<string, string> = { added: '新增', removed: '删除', modified: '修改' }

type Row = { type: 'add' | 'del' | 'ctx'; text: string }

function toRows(hunks: DiffPart[]): Row[] {
  const rows: Row[] = []
  for (const h of hunks) {
    const type = h.added ? 'add' : h.removed ? 'del' : 'ctx'
    const parts = h.value.split('\n')
    if (parts.length && parts[parts.length - 1] === '') parts.pop()
    for (const t of parts) rows.push({ type, text: t })
  }
  return rows
}

export default function DiffView({
  diff,
  onBack
}: {
  diff: { aName: string; bName: string; files: DiffFile[] }
  onBack: () => void
}): JSX.Element {
  return (
    <div className="diffview">
      <div className="diffview-head">
        <button className="vc-back" onClick={onBack}>
          ← 返回
        </button>
        <span className="diff-title">
          对比：<b>{diff.aName}</b> → <b>{diff.bName}</b>
        </span>
      </div>
      <div className="diffview-body">
        {diff.files.length === 0 ? (
          <div className="diff-empty">两个版本内容一致，无差异。</div>
        ) : (
          diff.files.map((f) => (
            <div key={f.path} className="diff-file">
              <div className={`diff-file-head df-${f.status}`}>
                <span className="df-badge">{STATUS_LABEL[f.status]}</span>
                {f.path}
              </div>
              {f.hunks ? (
                <div className="diff-lines">
                  {toRows(f.hunks).map((r, i) => (
                    <div key={i} className={`dl dl-${r.type}`}>
                      <span className="dl-sign">
                        {r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' '}
                      </span>
                      <span className="dl-text">{r.text || ' '}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="diff-binary">（非文本文件，内容已{STATUS_LABEL[f.status]}）</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
