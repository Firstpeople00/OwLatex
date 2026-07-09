import { create } from 'zustand'

export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error'

export interface PromptState {
  title: string
  value: string
  confirm?: boolean
  onOk: (value: string) => void | Promise<void>
}

interface AppState {
  projectRoot: string | null
  tree: FileNode[]
  mainFile: string | null
  activeFile: string | null
  source: string
  dirty: boolean

  status: CompileStatus
  log: string
  durationMs: number
  pdfData: Uint8Array | null
  gotoLine: number | null
  cursorLine: number
  pdfTarget: { page: number; x: number; y: number; w: number; h: number } | null
  pdfZoom: number | null // null=适应宽度；数字=手动缩放百分比
  pdfPct: number // 当前实际显示百分比（PdfPreview 写入，供快捷键步进）
  setPdfZoom: (z: number | null) => void
  zoomBy: (delta: number) => void
  zoomReset: () => void
  bibKeys: string[]
  labels: string[]
  outline: { file: string; line: number; level: number; title: string }[]

  distros: TexDistro[]
  selectedTexBin: string | null

  theme: 'light' | 'dark'
  autoCompile: boolean
  engine: 'pdflatex' | 'xelatex' | 'lualatex'
  pandocAvailable: boolean
  notice: string | null
  prompt: PromptState | null
  envStatus: { hasTeX: boolean; hasPandoc: boolean; hasWinget: boolean } | null
  envModalOpen: boolean
  envInstalling: 'miktex' | 'pandoc' | null
  checkEnv: () => Promise<void>
  openEnvModal: () => void
  closeEnvModal: () => void
  installEnv: (target: 'miktex' | 'pandoc') => Promise<void>
  loadPandoc: () => Promise<void>
  notify: (msg: string) => void
  openPrompt: (p: PromptState) => void
  closePrompt: () => void
  exportPdf: () => Promise<void>
  exportZip: () => Promise<void>
  exportDoc: (format: 'docx' | 'md' | 'html') => Promise<void>
  setTheme: (t: 'light' | 'dark') => void
  setAutoCompile: (v: boolean) => void
  setEngine: (e: 'pdflatex' | 'xelatex' | 'lualatex') => void
  newFile: (path: string, content: string) => Promise<void>
  renameItem: (oldPath: string, newName: string) => Promise<void>
  deleteItem: (path: string) => Promise<void>
  createFolder: (dir: string, name: string) => Promise<void>

  loadOutline: () => Promise<void>
  requestGoto: (file: string | undefined, line: number | undefined) => Promise<void>
  syncForward: () => Promise<void>
  syncInverse: (page: number, x: number, y: number) => Promise<void>
  loadDistros: () => Promise<void>
  setTexBin: (bin: string) => void
  openProject: () => Promise<void>
  openPath: (path: string) => Promise<void>
  loadProject: (res: OpenProjectResult) => Promise<void>
  refreshTree: () => Promise<void>
  openFile: (path: string) => Promise<void>
  setSource: (s: string) => void
  saveActive: () => Promise<void>
  setMainFile: (path: string) => void
  compile: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  projectRoot: null,
  tree: [],
  mainFile: null,
  activeFile: null,
  source: '',
  dirty: false,

  status: 'idle',
  log: '',
  durationMs: 0,
  pdfData: null,
  gotoLine: null,
  cursorLine: 1,
  pdfTarget: null,
  pdfZoom: null,
  pdfPct: 100,
  setPdfZoom: (z) => set({ pdfZoom: z }),
  zoomBy: (delta) => {
    const { pdfZoom, pdfPct } = get()
    set({ pdfZoom: Math.max(25, Math.min(500, (pdfZoom ?? pdfPct) + delta)) })
  },
  zoomReset: () => set({ pdfZoom: null }),
  bibKeys: [],
  labels: [],
  outline: [],

  distros: [],
  selectedTexBin: localStorage.getItem('mylatex.texBin'),

  theme: (localStorage.getItem('mylatex.theme') as 'light' | 'dark') || 'light',
  autoCompile: localStorage.getItem('mylatex.autoCompile') !== 'false',
  engine: (localStorage.getItem('mylatex.engine') as 'pdflatex' | 'xelatex' | 'lualatex') || 'pdflatex',
  pandocAvailable: false,
  notice: null,
  prompt: null,
  envStatus: null,
  envModalOpen: false,
  envInstalling: null,

  checkEnv: async () => set({ envStatus: await window.api.checkEnv() }),
  openEnvModal: () => {
    void get().checkEnv()
    set({ envModalOpen: true })
  },
  closeEnvModal: () => set({ envModalOpen: false }),
  installEnv: async (target) => {
    set({ envInstalling: target })
    const r = await window.api.installEnv(target)
    set({ envInstalling: null })
    await get().checkEnv()
    await get().loadDistros()
    await get().loadPandoc()
    get().notify(r.ok ? `${target === 'miktex' ? 'MiKTeX' : 'Pandoc'} 安装完成` : r.message)
  },

  loadPandoc: async () => set({ pandocAvailable: await window.api.hasPandoc() }),
  notify: (msg) => {
    set({ notice: msg })
    setTimeout(() => {
      if (get().notice === msg) set({ notice: null })
    }, 3500)
  },
  openPrompt: (p) => set({ prompt: p }),
  closePrompt: () => set({ prompt: null }),
  exportPdf: async () => {
    const { mainFile } = get()
    if (!mainFile) return
    get().notify((await window.api.exportPdf(mainFile)).message)
  },
  exportZip: async () => {
    const { projectRoot } = get()
    if (!projectRoot) return
    get().notify((await window.api.exportZip(projectRoot)).message)
  },
  exportDoc: async (format) => {
    const { mainFile } = get()
    if (!mainFile) return
    get().notify('正在导出…')
    get().notify((await window.api.exportPandoc(mainFile, format)).message)
  },

  setTheme: (t) => {
    localStorage.setItem('mylatex.theme', t)
    set({ theme: t })
  },
  setAutoCompile: (v) => {
    localStorage.setItem('mylatex.autoCompile', String(v))
    set({ autoCompile: v })
  },
  setEngine: (e) => {
    localStorage.setItem('mylatex.engine', e)
    set({ engine: e })
    void get().compile()
  },
  newFile: async (path, content) => {
    await window.api.writeFile(path, content)
    await get().refreshTree()
    await get().openFile(path)
  },

  renameItem: async (oldPath, newName) => {
    const i = Math.max(oldPath.lastIndexOf('\\'), oldPath.lastIndexOf('/'))
    const newPath = `${oldPath.slice(0, i)}\\${newName}`
    await window.api.rename(oldPath, newPath)
    // 修正 activeFile / mainFile 对该路径（或其子路径）的引用
    const fix = (p: string | null): string | null =>
      !p
        ? p
        : p === oldPath
          ? newPath
          : p.startsWith(`${oldPath}\\`)
            ? newPath + p.slice(oldPath.length)
            : p
    set({ activeFile: fix(get().activeFile), mainFile: fix(get().mainFile) })
    await get().refreshTree()
  },

  deleteItem: async (path) => {
    await window.api.trash(path)
    const under = (p: string | null): boolean => !!p && (p === path || p.startsWith(`${path}\\`))
    if (under(get().activeFile)) set({ activeFile: null, source: '', dirty: false })
    if (under(get().mainFile)) set({ mainFile: null })
    await get().refreshTree()
  },

  createFolder: async (dir, name) => {
    await window.api.mkdir(`${dir}\\${name}`)
    await get().refreshTree()
  },

  // 扫主文件并按 \input 顺序展开，提取章节标题（带防环）
  loadOutline: async () => {
    const main = get().mainFile
    if (!main) return
    const LEVELS = ['part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph']
    const items: { file: string; line: number; level: number; title: string }[] = []
    const labels = new Set<string>()
    const seen = new Set<string>()
    const dirOf = (p: string): string => p.slice(0, Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')))
    const scan = async (file: string): Promise<void> => {
      if (seen.has(file)) return
      seen.add(file)
      const lines = (await window.api.readFile(file).catch(() => '')).split(/\r?\n/)
      const dir = dirOf(file)
      for (let i = 0; i < lines.length; i++) {
        const lab = lines[i].match(/\\label\{([^}]+)\}/)
        if (lab) labels.add(lab[1])
        const sm = lines[i].match(/\\(part|chapter|section|subsection|subsubsection|paragraph)\*?\{([^}]*)\}/)
        if (sm) {
          items.push({ file, line: i + 1, level: LEVELS.indexOf(sm[1]), title: sm[2] })
          continue
        }
        const im = lines[i].match(/\\(?:input|include)\{([^}]+)\}/)
        if (im) {
          let p = im[1]
          if (!/\.tex$/i.test(p)) p += '.tex'
          const abs = /^[a-zA-Z]:/.test(p) ? p : `${dir}\\${p}`
          await scan(abs.replace(/\//g, '\\'))
        }
      }
    }
    await scan(main)
    set({ outline: items, labels: [...labels] })
  },

  requestGoto: async (file, line) => {
    if (file && file !== get().activeFile) await get().openFile(file).catch(() => {})
    if (line) set({ gotoLine: line })
  },

  // 源码 → PDF：用当前文件 + 光标行
  syncForward: async () => {
    const { activeFile, mainFile, cursorLine, selectedTexBin } = get()
    if (!activeFile || !mainFile) return
    const pdf = mainFile.replace(/\.tex$/i, '.pdf')
    const r = await window.api.syncView(pdf, activeFile, cursorLine, selectedTexBin ?? undefined)
    if (r) set({ pdfTarget: r })
  },

  // PDF → 源码：双击 PDF 传入页码与 PDF 点坐标
  syncInverse: async (page, x, y) => {
    const { mainFile, selectedTexBin } = get()
    if (!mainFile) return
    const pdf = mainFile.replace(/\.tex$/i, '.pdf')
    const r = await window.api.syncEdit(pdf, page, x, y, selectedTexBin ?? undefined)
    if (r) await get().requestGoto(r.file, r.line)
  },

  loadDistros: async () => {
    const distros = await window.api.getDistros()
    set({ distros })
    // 若未选或当前选择不可用，默认选第一个可用发行版
    const cur = get().selectedTexBin
    const ok = cur && distros.some((d) => d.binDir === cur && d.available)
    if (!ok) {
      const first = distros.find((d) => d.available)
      if (first) {
        set({ selectedTexBin: first.binDir })
        localStorage.setItem('mylatex.texBin', first.binDir)
      }
    }
  },

  setTexBin: (bin) => {
    set({ selectedTexBin: bin })
    localStorage.setItem('mylatex.texBin', bin)
    void get().compile()
  },

  openProject: async () => {
    const res = await window.api.openProject()
    if (res) await get().loadProject(res)
  },

  openPath: async (path) => {
    const res = await window.api.openPath(path)
    if (res) await get().loadProject(res)
  },

  loadProject: async (res) => {
    set({
      projectRoot: res.root,
      tree: res.tree,
      mainFile: res.mainFile,
      activeFile: null,
      source: '',
      dirty: false,
      status: 'idle',
      pdfData: null
    })
    // 扫描工程内 .bib，收集 \cite 的 key（供自动补全）
    const bibs: string[] = []
    const walk = (ns: FileNode[]): void => {
      for (const n of ns) {
        if (n.type === 'dir') walk(n.children ?? [])
        else if (n.name.toLowerCase().endsWith('.bib')) bibs.push(n.path)
      }
    }
    walk(res.tree)
    const keys = new Set<string>()
    for (const b of bibs) {
      const txt = await window.api.readFile(b).catch(() => '')
      for (const m of txt.matchAll(/@\w+\s*\{\s*([^,\s}]+)/g)) keys.add(m[1])
    }
    set({ bibKeys: [...keys] })

    // 自动打开主文件并编译一次
    if (res.mainFile) {
      await get().openFile(res.mainFile)
      await get().compile()
    }
  },

  refreshTree: async () => {
    const root = get().projectRoot
    if (!root) return
    set({ tree: await window.api.readTree(root) })
  },

  openFile: async (path) => {
    const content = await window.api.readFile(path)
    set({ activeFile: path, source: content, dirty: false })
  },

  setSource: (s) => set({ source: s, dirty: true }),

  saveActive: async () => {
    const { activeFile, source, dirty } = get()
    if (!activeFile || !dirty) return
    await window.api.writeFile(activeFile, source)
    set({ dirty: false })
  },

  setMainFile: (path) => set({ mainFile: path }),

  compile: async () => {
    const { mainFile } = get()
    await get().saveActive() // 编译前先把当前文件存盘
    if (!mainFile) {
      set({ status: 'error', log: '未找到主文件（含 \\documentclass 的 .tex）。请在文件树右键设为主文件。' })
      return
    }
    set({ status: 'compiling' })
    const res = await window.api.compile(mainFile, get().selectedTexBin ?? undefined, get().engine)
    set({
      status: res.success ? 'success' : 'error',
      log: res.log,
      durationMs: res.durationMs,
      pdfData: res.success && res.pdf ? res.pdf : get().pdfData
    })
    if (res.success) void get().loadOutline()
  }
}))
