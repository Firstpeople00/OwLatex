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
  openFiles: string[] // 已打开的标签（顺序）
  buffers: Record<string, { text: string; dirty: boolean }> // 非活动标签的缓冲区

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
  autoSnapshot: boolean
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
  pickTexBin: () => Promise<void>
  openProject: () => Promise<void>
  openPath: (path: string) => Promise<void>
  loadProject: (res: OpenProjectResult) => Promise<void>
  refreshTree: () => Promise<void>
  openFile: (path: string) => Promise<void>
  closeFile: (path: string) => Promise<void>
  setSource: (s: string) => void
  saveActive: () => Promise<void>
  saveAll: () => Promise<void>
  setMainFile: (path: string) => void
  compile: () => Promise<void>

  versions: VersionEntry[]
  diffView: { aName: string; bName: string; files: DiffFile[] } | null
  vcOpen: boolean
  loadVersions: () => Promise<void>
  saveVersion: () => void
  restoreVersion: (oid: string, name: string) => Promise<void>
  compareVersion: (aOid: string, bOid: string, aName: string, bName: string) => Promise<void>
  closeDiff: () => void
  openVC: () => void
  closeVC: () => void
  setAutoSnapshot: (v: boolean) => void
  clearVersions: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  projectRoot: null,
  tree: [],
  mainFile: null,
  activeFile: null,
  source: '',
  dirty: false,
  openFiles: [],
  buffers: {},
  versions: [],
  diffView: null,
  vcOpen: false,

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
  autoSnapshot: localStorage.getItem('mylatex.autoSnapshot') !== 'false',
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
    // 修正 activeFile / mainFile / 标签 / 缓冲区 对该路径（或其子路径）的引用
    const fix = (p: string | null): string | null =>
      !p
        ? p
        : p === oldPath
          ? newPath
          : p.startsWith(`${oldPath}\\`)
            ? newPath + p.slice(oldPath.length)
            : p
    const { openFiles, buffers } = get()
    const nextBuffers: typeof buffers = {}
    for (const [p, b] of Object.entries(buffers)) nextBuffers[fix(p) as string] = b
    set({
      activeFile: fix(get().activeFile),
      mainFile: fix(get().mainFile),
      openFiles: openFiles.map((p) => fix(p) as string),
      buffers: nextBuffers
    })
    await get().refreshTree()
  },

  deleteItem: async (path) => {
    await window.api.trash(path)
    const under = (p: string): boolean => p === path || p.startsWith(`${path}\\`)
    const { activeFile, mainFile, openFiles, buffers } = get()
    const activeGone = !!activeFile && under(activeFile)
    const nextBuffers = { ...buffers }
    for (const p of Object.keys(buffers)) if (under(p)) delete nextBuffers[p]
    const nextOpen = openFiles.filter((p) => !under(p))
    set({
      openFiles: nextOpen,
      buffers: nextBuffers,
      mainFile: mainFile && under(mainFile) ? null : mainFile,
      ...(activeGone ? { activeFile: null, source: '', dirty: false } : {})
    })
    // 活动文件被删：切到剩余标签（activeFile 已置空，openFile 不会回写缓冲）
    if (activeGone && nextOpen[0]) await get().openFile(nextOpen[0])
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
    // 合并用户手动指定的路径（检测不到但用户设过）
    const custom = localStorage.getItem('mylatex.customTexBin')
    if (custom && !distros.some((d) => d.binDir === custom)) {
      distros.push({ id: 'custom', name: '自定义', binDir: custom, available: true })
    }
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

  pickTexBin: async () => {
    const dir = await window.api.pickTexBin()
    if (!dir) {
      get().notify('该目录下没找到 pdflatex.exe')
      return
    }
    localStorage.setItem('mylatex.customTexBin', dir)
    if (!get().distros.some((d) => d.binDir === dir)) {
      set({ distros: [...get().distros, { id: 'custom', name: '自定义', binDir: dir, available: true }] })
    }
    const env = get().envStatus
    if (env) set({ envStatus: { ...env, hasTeX: true } })
    get().setTexBin(dir) // 选中 + 持久化 + 重编译
    get().notify(`已指定 TeX 路径：${dir}`)
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
      openFiles: [],
      buffers: {},
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
    void get().loadVersions() // 加载版本历史

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
    const { activeFile, source, dirty, openFiles, buffers } = get()
    if (path === activeFile) return
    // 暂存当前活动文件的编辑到缓冲区（避免切换标签丢未保存内容）
    const nextBuffers = { ...buffers }
    if (activeFile) nextBuffers[activeFile] = { text: source, dirty }
    // 目标文件：优先取缓冲区（含未保存编辑），否则读盘
    let text: string
    let d: boolean
    if (nextBuffers[path]) {
      text = nextBuffers[path].text
      d = nextBuffers[path].dirty
      delete nextBuffers[path]
    } else {
      text = await window.api.readFile(path)
      d = false
    }
    set({
      activeFile: path,
      source: text,
      dirty: d,
      openFiles: openFiles.includes(path) ? openFiles : [...openFiles, path],
      buffers: nextBuffers
    })
  },

  closeFile: async (path) => {
    const { activeFile, openFiles, buffers, source, dirty } = get()
    const isDirty = path === activeFile ? dirty : buffers[path]?.dirty
    if (isDirty) {
      const name = path.replace(/\\/g, '/').split('/').pop()
      if (!window.confirm(`${name} 有未保存的修改，仍要关闭并丢弃？`)) return
    }
    const idx = openFiles.indexOf(path)
    const nextOpen = openFiles.filter((p) => p !== path)
    const nextBuffers = { ...buffers }
    delete nextBuffers[path]
    if (path !== activeFile) {
      set({ openFiles: nextOpen, buffers: nextBuffers })
      return
    }
    // 关闭的是活动标签：激活右邻，否则左邻，否则清空
    const neighbor = nextOpen[idx] ?? nextOpen[idx - 1] ?? null
    if (!neighbor) {
      set({ openFiles: nextOpen, buffers: nextBuffers, activeFile: null, source: '', dirty: false })
      return
    }
    let text: string
    let d: boolean
    if (nextBuffers[neighbor]) {
      text = nextBuffers[neighbor].text
      d = nextBuffers[neighbor].dirty
      delete nextBuffers[neighbor]
    } else {
      text = await window.api.readFile(neighbor)
      d = false
    }
    set({ openFiles: nextOpen, buffers: nextBuffers, activeFile: neighbor, source: text, dirty: d })
  },

  setSource: (s) => set({ source: s, dirty: true }),

  saveActive: async () => {
    const { activeFile, source, dirty } = get()
    if (!activeFile || !dirty) return
    await window.api.writeFile(activeFile, source)
    set({ dirty: false })
  },

  // 保存活动文件 + 所有有未保存编辑的标签（编译前调用，避免其它标签的改动没落盘）
  saveAll: async () => {
    const { activeFile, source, dirty, buffers } = get()
    if (activeFile && dirty) await window.api.writeFile(activeFile, source)
    const nextBuffers = { ...buffers }
    for (const [p, b] of Object.entries(buffers)) {
      if (b.dirty) {
        await window.api.writeFile(p, b.text)
        nextBuffers[p] = { text: b.text, dirty: false }
      }
    }
    set({ dirty: activeFile ? false : dirty, buffers: nextBuffers })
  },

  setMainFile: (path) => set({ mainFile: path }),

  compile: async () => {
    const { mainFile } = get()
    await get().saveAll() // 编译前把所有标签的改动落盘
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
    if (res.success) {
      void get().loadOutline()
      // 编译成功后自动快照（可在版本控制设置里关闭；内容无改动时主进程会跳过）
      const root = get().projectRoot
      if (root && get().autoSnapshot)
        void window.api
          .versionSnapshot(root, '自动快照', 'auto')
          .then((oid) => {
            if (oid) void get().loadVersions()
          })
          .catch(() => {})
    }
  },

  loadVersions: async () => {
    const root = get().projectRoot
    if (!root) return set({ versions: [] })
    set({ versions: await window.api.versionList(root).catch(() => []) })
  },

  saveVersion: () => {
    const root = get().projectRoot
    if (!root) return
    // 默认版本名：干净的时间戳，预填进输入框（选中态，回车即用、想改直接覆盖）
    const n = new Date()
    const p = (x: number): string => String(x).padStart(2, '0')
    const defaultName = `版本 ${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}`
    get().openPrompt({
      title: '保存版本（留空则用默认名）',
      value: defaultName,
      onOk: async (name) => {
        const label = name.trim() || defaultName
        await get().saveAll()
        const oid = await window.api.versionSnapshot(root, label, 'manual')
        await get().loadVersions()
        get().notify(oid ? `已保存版本「${label}」` : '当前无改动，未新建版本')
      }
    })
  },

  restoreVersion: async (oid, name) => {
    const root = get().projectRoot
    if (!root) return
    if (!window.confirm(`恢复到「${name}」？\n当前状态会先自动备份，可再回退。`)) return
    await window.api.versionRestore(root, oid)
    await get().openPath(root) // 重载工程（清缓冲、刷树、重编译）
    await get().loadVersions()
    get().notify(`已恢复到「${name}」`)
  },

  // a/b 为版本 oid，b 可为 'WORKDIR'；diff 展示 a → b 的增删
  compareVersion: async (aOid, bOid, aName, bName) => {
    const root = get().projectRoot
    if (!root) return
    if (bOid === 'WORKDIR') await get().saveAll()
    const files = await window.api.versionDiff(root, aOid, bOid).catch(() => [])
    set({ diffView: { aName, bName, files } })
  },

  closeDiff: () => set({ diffView: null }),

  openVC: () => {
    set({ vcOpen: true })
    void get().loadVersions()
  },
  closeVC: () => set({ vcOpen: false, diffView: null }),

  setAutoSnapshot: (v) => {
    localStorage.setItem('mylatex.autoSnapshot', String(v))
    set({ autoSnapshot: v })
  },

  clearVersions: async () => {
    const root = get().projectRoot
    if (!root) return
    await window.api.versionClear(root)
    await get().loadVersions()
    get().notify('已清空全部版本历史')
  }
}))
