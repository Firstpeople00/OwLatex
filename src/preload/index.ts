import { contextBridge, ipcRenderer } from 'electron'

/**
 * renderer 访问主进程能力的唯一入口（白名单）。
 * 只暴露明确需要的方法，绝不暴露 ipcRenderer 本体或 Node 能力。
 */
const api = {
  openProject: () => ipcRenderer.invoke('project:open'),
  openPath: (root: string) => ipcRenderer.invoke('project:openPath', root),
  startupDir: () => ipcRenderer.invoke('app:startupDir'),
  readTree: (root: string) => ipcRenderer.invoke('fs:readTree', root),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('fs:writeFile', path, content),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
  trash: (path: string) => ipcRenderer.invoke('fs:trash', path),
  reveal: (path: string) => ipcRenderer.invoke('fs:reveal', path),
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  getDistros: () => ipcRenderer.invoke('tex:distros'),
  pickTexBin: () => ipcRenderer.invoke('tex:pickBin'),
  onProjectChanged: (cb: () => void) => ipcRenderer.on('project:changed', cb),
  compile: (mainFile: string, texBin?: string, engine?: string) =>
    ipcRenderer.invoke('latex:compile', mainFile, texBin, engine),
  syncView: (pdf: string, file: string, line: number, texBin?: string) =>
    ipcRenderer.invoke('synctex:view', pdf, file, line, texBin),
  syncEdit: (pdf: string, page: number, x: number, y: number, texBin?: string) =>
    ipcRenderer.invoke('synctex:edit', pdf, page, x, y, texBin),
  checkEnv: () => ipcRenderer.invoke('env:check'),
  installEnv: (target: 'miktex' | 'pandoc') => ipcRenderer.invoke('env:install', target),
  openEnvDownload: (target: 'miktex' | 'pandoc') =>
    ipcRenderer.invoke('env:openDownload', target),
  hasPandoc: () => ipcRenderer.invoke('export:hasPandoc'),
  exportPdf: (mainFile: string) => ipcRenderer.invoke('export:pdf', mainFile),
  exportZip: (root: string) => ipcRenderer.invoke('export:zip', root),
  exportPandoc: (mainFile: string, format: 'docx' | 'md' | 'html') =>
    ipcRenderer.invoke('export:pandoc', mainFile, format)
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-ignore - 始终开启 contextIsolation，此分支仅保底
  window.api = api
}
