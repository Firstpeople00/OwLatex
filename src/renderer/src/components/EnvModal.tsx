import { useStore } from '../store/store'
import { Icon } from './Icon'

// 运行环境检测：LaTeX（编译必需）/ Pandoc（导出用），缺失可一键 winget 安装
export default function EnvModal(): JSX.Element | null {
  const open = useStore((s) => s.envModalOpen)
  const st = useStore((s) => s.envStatus)
  const installing = useStore((s) => s.envInstalling)
  const installEnv = useStore((s) => s.installEnv)
  const pickTexBin = useStore((s) => s.pickTexBin)
  const closeEnvModal = useStore((s) => s.closeEnvModal)
  if (!open) return null

  const row = (
    label: string,
    ok: boolean | undefined,
    target: 'miktex' | 'pandoc',
    installLabel: string
  ): JSX.Element => (
    <div className="env-row">
      <span className="env-label">{label}</span>
      {ok ? (
        <span className="env-ok">
          <Icon name="check" size={14} /> 已安装
        </span>
      ) : (
        <span className="env-actions">
          <button disabled={!!installing} onClick={() => void installEnv(target)}>
            {installing === target ? '安装中…' : installLabel}
          </button>
          <button className="linklike" onClick={() => void window.api.openEnvDownload(target)}>
            手动下载
          </button>
        </span>
      )}
    </div>
  )

  return (
    <div className="modal-overlay" onClick={closeEnvModal}>
      <div className="modal env-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">运行环境检测</div>
        {row('LaTeX 环境（编译必需）', st?.hasTeX, 'miktex', '安装 MiKTeX')}
        {row('Pandoc（Word/MD/HTML 导出）', st?.hasPandoc, 'pandoc', '安装 Pandoc')}
        {installing && (
          <div className="env-hint">
            正在联网下载安装 {installing === 'miktex' ? 'MiKTeX' : 'Pandoc'}
            （首次较大，可能数分钟；若弹出 UAC 授权请允许）…
          </div>
        )}
        {st && !st.hasWinget && (
          <div className="env-hint">未检测到 winget，请用「手动下载」自行安装。</div>
        )}
        <div className="env-hint">
          已装 LaTeX 却没检测到？
          <button className="linklike" onClick={() => void pickTexBin()}>
            手动指定 TeX 路径…
          </button>
        </div>
        <div className="modal-actions">
          <button onClick={closeEnvModal}>关闭</button>
        </div>
      </div>
    </div>
  )
}
