import { useRef } from 'react'
import { useStore } from '../store/store'

// 全局输入/确认弹窗（文件树右键、菜单新建/重命名共用，读 store.prompt）
export default function PromptModal(): JSX.Element | null {
  const prompt = useStore((s) => s.prompt)
  const closePrompt = useStore((s) => s.closePrompt)
  const inputRef = useRef<HTMLInputElement>(null)
  if (!prompt) return null

  const confirm = (): void => {
    const v = inputRef.current?.value ?? ''
    closePrompt()
    void prompt.onOk(v.trim())
  }

  return (
    <div className="modal-overlay" onClick={closePrompt}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{prompt.title}</div>
        {!prompt.confirm && (
          <input
            ref={inputRef}
            className="modal-input"
            autoFocus
            defaultValue={prompt.value}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm()
              if (e.key === 'Escape') closePrompt()
            }}
          />
        )}
        <div className="modal-actions">
          <button onClick={closePrompt}>取消</button>
          <button className="primary" onClick={confirm}>
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
