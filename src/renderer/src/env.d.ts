/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

interface CompileResult {
  success: boolean
  pdf?: Uint8Array
  log: string
  durationMs: number
  passes: number
}

interface OpenProjectResult {
  root: string
  tree: FileNode[]
  mainFile: string | null
}

interface TexDistro {
  id: string
  name: string
  binDir: string
  available: boolean
}

interface Window {
  api: {
    openProject: () => Promise<OpenProjectResult | null>
    openPath: (root: string) => Promise<OpenProjectResult | null>
    startupDir: () => Promise<string | null>
    readTree: (root: string) => Promise<FileNode[]>
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<void>
    rename: (oldPath: string, newPath: string) => Promise<void>
    mkdir: (path: string) => Promise<void>
    trash: (path: string) => Promise<void>
    reveal: (path: string) => Promise<void>
    writeClipboard: (text: string) => Promise<void>
    getDistros: () => Promise<TexDistro[]>
    pickTexBin: () => Promise<string | null>
    onProjectChanged: (cb: () => void) => void
    compile: (mainFile: string, texBin?: string, engine?: string) => Promise<CompileResult>
    syncView: (
      pdf: string,
      file: string,
      line: number,
      texBin?: string
    ) => Promise<{ page: number; x: number; y: number; w: number; h: number } | null>
    syncEdit: (
      pdf: string,
      page: number,
      x: number,
      y: number,
      texBin?: string
    ) => Promise<{ file: string; line: number } | null>
    checkEnv: () => Promise<{ hasTeX: boolean; hasPandoc: boolean; hasWinget: boolean }>
    installEnv: (target: 'miktex' | 'pandoc') => Promise<{ ok: boolean; message: string }>
    openEnvDownload: (target: 'miktex' | 'pandoc') => Promise<void>
    hasPandoc: () => Promise<boolean>
    exportPdf: (mainFile: string) => Promise<{ ok: boolean; message: string }>
    exportZip: (root: string) => Promise<{ ok: boolean; message: string }>
    exportPandoc: (
      mainFile: string,
      format: 'docx' | 'md' | 'html'
    ) => Promise<{ ok: boolean; message: string }>
  }
}
