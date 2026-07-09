import { useEffect, useRef } from 'react'
import { useStore } from '../store/store'

/**
 * 防抖自动编译：仅在有未保存改动（dirty）时，停止输入 delay 毫秒后触发。
 * 打开文件（dirty=false）不会触发，避免无谓编译；首次编译由 openProject 主动调用。
 */
export function useDebouncedCompile(delay = 1500): void {
  const source = useStore((s) => s.source)
  const activeFile = useStore((s) => s.activeFile)
  const compile = useStore((s) => s.compile)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!activeFile || !useStore.getState().dirty || !useStore.getState().autoCompile) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void compile(), delay)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [source, activeFile, compile, delay])
}
