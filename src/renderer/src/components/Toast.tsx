import { useStore } from '../store/store'

export default function Toast(): JSX.Element | null {
  const notice = useStore((s) => s.notice)
  if (!notice) return null
  return <div className="toast">{notice}</div>
}
