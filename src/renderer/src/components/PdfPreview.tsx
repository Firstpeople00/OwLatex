import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useStore } from '../store/store'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const PAD = 16 // .pdf-scroll padding，与 CSS 一致
const SCROLLBAR = 14
const BASE = 96 / 72 // 100% 缩放 = 实际大小（96 DPI）

/**
 * PDF 预览：顶部缩放条（适应宽度 / ± / 百分比）+ 缩放渲染。
 * scaleRef 为当前缩放，SyncTeX 像素↔PDF点 映射用它。双击 → 反向；store.pdfTarget → 正向。
 */
export default function PdfPreview(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const scaleRef = useRef(1.5)
  const renderTokenRef = useRef(0)
  const pdfData = useStore((s) => s.pdfData)
  const pdfTarget = useStore((s) => s.pdfTarget)
  const pdfZoom = useStore((s) => s.pdfZoom)
  const setPdfZoom = useStore((s) => s.setPdfZoom)
  const zoomBy = useStore((s) => s.zoomBy)
  const pdfPct = useStore((s) => s.pdfPct)

  const fitScale = useCallback(async (doc: PDFDocumentProxy): Promise<number> => {
    const c = containerRef.current
    if (!c) return scaleRef.current
    const w = (await doc.getPage(1)).getViewport({ scale: 1 }).width
    const avail = c.clientWidth - PAD * 2 - SCROLLBAR
    return Math.max(0.3, Math.min(6, avail / w))
  }, [])

  // 依当前模式（适应宽度 / 手动百分比）算出 scale，并更新百分比显示
  const computeScale = useCallback(
    async (doc: PDFDocumentProxy): Promise<void> => {
      const z = useStore.getState().pdfZoom
      const s = z !== null ? (z / 100) * BASE : await fitScale(doc)
      scaleRef.current = s
      useStore.setState({ pdfPct: Math.round((s / BASE) * 100) })
    },
    [fitScale]
  )

  const renderAll = useCallback(async (): Promise<void> => {
    const doc = docRef.current
    const c = containerRef.current
    if (!doc || !c) return
    const token = ++renderTokenRef.current
    const scale = scaleRef.current
    const frac = c.scrollHeight ? c.scrollTop / c.scrollHeight : 0
    c.innerHTML = ''
    // 按设备像素比原生渲染：DPR=1 即 1:1 最锐；HiDPI 匹配物理像素。封顶 2× 控内存。
    const outputScale = Math.min(window.devicePixelRatio || 1, 2)
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      if (token !== renderTokenRef.current) return // 被新的渲染取代
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.className = 'pdf-page'
      canvas.dataset.page = String(i)
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      c.appendChild(canvas)
      await page.render({
        canvasContext: ctx,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
      }).promise
    }
    if (token === renderTokenRef.current) c.scrollTop = frac * c.scrollHeight
  }, [])

  // 新 PDF：加载 → 算 scale → 渲染
  useEffect(() => {
    if (!pdfData) return
    let cancelled = false
    ;(async () => {
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfData) }).promise
      if (cancelled) return
      docRef.current = doc
      await computeScale(doc)
      await renderAll()
    })().catch((e) => console.error('PDF 渲染失败：', e))
    return () => {
      cancelled = true
    }
  }, [pdfData, computeScale, renderAll])

  // 缩放变化：重算 scale 并重渲染
  useEffect(() => {
    const doc = docRef.current
    if (!doc) return
    let cancelled = false
    ;(async () => {
      await computeScale(doc)
      if (!cancelled) await renderAll()
    })()
    return () => {
      cancelled = true
    }
  }, [pdfZoom, computeScale, renderAll])

  // 预览栏尺寸变化：仅"适应宽度"模式随宽度重算（防抖）
  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    let t: number | undefined
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t)
      t = window.setTimeout(async () => {
        const doc = docRef.current
        if (!doc || useStore.getState().pdfZoom !== null) return
        const s = await fitScale(doc)
        if (Math.abs(s - scaleRef.current) < 0.01) return
        scaleRef.current = s
        useStore.setState({ pdfPct: Math.round((s / BASE) * 100) })
        await renderAll()
      }, 150)
    })
    ro.observe(c)
    return () => {
      ro.disconnect()
      window.clearTimeout(t)
    }
  }, [fitScale, renderAll])

  // 正向：滚动到 synctex 位置并闪高亮
  useEffect(() => {
    const c = containerRef.current
    if (!c || !pdfTarget) return
    const scale = scaleRef.current
    const canvas = c.querySelector<HTMLElement>(`canvas[data-page="${pdfTarget.page}"]`)
    if (!canvas) return
    const top = canvas.offsetTop + pdfTarget.y * scale
    c.scrollTo({ top: top - c.clientHeight / 2, behavior: 'smooth' })

    const hl = document.createElement('div')
    hl.className = 'sync-highlight'
    hl.style.left = `${canvas.offsetLeft + pdfTarget.x * scale}px`
    hl.style.top = `${top}px`
    hl.style.width = `${Math.max(pdfTarget.w * scale, 40)}px`
    hl.style.height = `${Math.max(pdfTarget.h * scale, 12)}px`
    c.appendChild(hl)
    const timer = window.setTimeout(() => hl.remove(), 1300)
    useStore.setState({ pdfTarget: null })
    return () => window.clearTimeout(timer)
  }, [pdfTarget])

  // 反向：双击 → synctex edit → 跳源码
  const onDblClick = (e: ReactMouseEvent): void => {
    const el = e.target as HTMLElement
    if (el.tagName !== 'CANVAS') return
    const page = Number(el.dataset.page ?? 0)
    if (!page) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scaleRef.current
    const y = (e.clientY - rect.top) / scaleRef.current
    void useStore.getState().syncInverse(page, x, y)
  }

  return (
    <div className="pdf-pane">
      {pdfData && (
        <div className="pdf-toolbar">
          <button
            className={pdfZoom === null ? 'active' : ''}
            onClick={() => setPdfZoom(null)}
            title="适应预览栏宽度"
          >
            适应宽度
          </button>
          <button onClick={() => zoomBy(-10)} title="缩小">
            −
          </button>
          <span className="pdf-pct">{pdfPct}%</span>
          <button onClick={() => zoomBy(10)} title="放大">
            +
          </button>
        </div>
      )}
      <div className="pdf-scroll" ref={containerRef} onDoubleClick={onDblClick} />
    </div>
  )
}
