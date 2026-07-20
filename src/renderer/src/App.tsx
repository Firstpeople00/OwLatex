import { useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import FileTree from './components/FileTree'
import OutlinePanel from './components/OutlinePanel'
import Editor from './components/Editor'
import EditorToolbar from './components/EditorToolbar'
import TabBar from './components/TabBar'
import PdfPreview from './components/PdfPreview'
import ProblemsPanel from './components/ProblemsPanel'
import MenuBar from './components/MenuBar'
import PromptModal from './components/PromptModal'
import Toast from './components/Toast'
import EnvModal from './components/EnvModal'
import { useDebouncedCompile } from './hooks/useDebouncedCompile'
import { useStore } from './store/store'

export default function App(): JSX.Element {
  useDebouncedCompile(1500)
  const theme = useStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // 启动：先加载可用发行版（确定编译引擎），再按 MYLATEX_OPEN_DIR 自动打开（开发/测试用）
  // PDF 缩放快捷键：Ctrl +/= 放大，Ctrl − 缩小，Ctrl 0 适应宽度
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        useStore.getState().zoomBy(10)
      } else if (e.key === '-') {
        e.preventDefault()
        useStore.getState().zoomBy(-10)
      } else if (e.key === '0') {
        e.preventDefault()
        useStore.getState().zoomReset()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    window.api.onProjectChanged(() => void useStore.getState().refreshTree())
    void (async () => {
      await useStore.getState().loadDistros()
      void useStore.getState().loadPandoc()
      // 首次启动检测运行环境：缺 LaTeX（编译必需）则自动弹出安装引导
      await useStore.getState().checkEnv()
      if (useStore.getState().envStatus?.hasTeX === false) {
        useStore.setState({ envModalOpen: true })
      }
      const dir = await window.api.startupDir()
      if (dir) await useStore.getState().openPath(dir)
    })()
  }, [])

  return (
    <div className="app">
      <MenuBar />
      <PanelGroup direction="horizontal" className="panels">
        <Panel defaultSize={18} minSize={10} maxSize={40}>
          <div className="left-pane">
            <FileTree />
            <OutlinePanel />
          </div>
        </Panel>
        <PanelResizeHandle className="resize-handle" />
        <Panel defaultSize={41} minSize={15}>
          <div className="editor-pane">
            <TabBar />
            <EditorToolbar />
            <Editor />
            <ProblemsPanel />
          </div>
        </Panel>
        <PanelResizeHandle className="resize-handle" />
        <Panel defaultSize={41} minSize={15}>
          <PdfPreview />
        </Panel>
      </PanelGroup>
      <PromptModal />
      <EnvModal />
      <Toast />
    </div>
  )
}
