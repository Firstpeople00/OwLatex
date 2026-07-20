import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron'
import { basename, dirname, join } from 'path'
import { existsSync, watch, type FSWatcher } from 'fs'
import { spawn } from 'child_process'
import { copyFile } from 'fs/promises'
import { compileMainFile } from './compiler'
import { synctexView, synctexEdit } from './synctex'
import { findPandoc, runPandoc, runZip } from './exporter'
import { detectDistros, clearDistroCache } from './tex-detect'
import {
  snapshot,
  listVersions,
  diff as versionDiff,
  restore,
  repoInfo,
  clearAll
} from './versionService'
import {
  readTree,
  detectMainFile,
  readFileText,
  writeFileText,
  renamePath,
  makeDir
} from './fileService'

function createWindow(): void {
  const iconPath = join(__dirname, '../../build/icon.png')
  const mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    show: false,
    autoHideMenuBar: true,
    frame: false, // 去掉 Windows 原生标题栏，改用自研菜单栏 + 自绘窗口控件
    backgroundColor: '#1e1e1e',
    title: 'OwLatex',
    icon: existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // 安全三件套（见 CLAUDE.md §架构约定）
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // 无边框窗口：把最大化状态推给 renderer，用于切换 最大化/还原 图标
  const sendMax = (): void =>
    mainWindow.webContents.send('win:maximized', mainWindow.isMaximized())
  mainWindow.on('maximize', sendMax)
  mainWindow.on('unmaximize', sendMax)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // 移除默认应用菜单（我们有自研菜单栏）——顺带释放 Ctrl+=/- 等默认缩放快捷键
  Menu.setApplicationMenu(null)

  // 无边框窗口控制：由菜单栏里的自绘按钮触发
  ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('win:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (w?.isMaximized()) w.unmaximize()
    else w?.maximize()
  })
  ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())

  // 文件监听：用 stdlib fs.watch（递归），改动时通知 renderer 刷新树（忽略编译产物，防抖）
  let watcher: FSWatcher | null = null
  const ARTIFACT = /\.(aux|log|pdf|synctex\.gz|bbl|blg|out|toc|fls|fdb_latexmk)$/i
  function watchProject(root: string): void {
    watcher?.close()
    let t: NodeJS.Timeout | undefined
    try {
      watcher = watch(root, { recursive: true }, (_e, file) => {
        if (file && ARTIFACT.test(file.toString())) return
        clearTimeout(t)
        t = setTimeout(() => {
          BrowserWindow.getAllWindows()[0]?.webContents.send('project:changed')
        }, 300)
      })
    } catch {
      watcher = null
    }
  }

  async function buildProject(
    root: string
  ): Promise<{ root: string; tree: Awaited<ReturnType<typeof readTree>>; mainFile: string | null }> {
    const tree = await readTree(root)
    const mainFile = await detectMainFile(tree)
    watchProject(root)
    return { root, tree, mainFile }
  }

  // 打开工程文件夹：弹目录选择 → 读树 → 探测主文件
  ipcMain.handle('project:open', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    if (r.canceled || !r.filePaths[0]) return null
    return buildProject(r.filePaths[0])
  })

  // 直接按路径打开（无对话框）——供启动自动打开 / 测试使用
  ipcMain.handle('project:openPath', async (_e, root: string) => {
    try {
      return await buildProject(root)
    } catch {
      return null
    }
  })

  // 启动时自动打开的目录（开发/测试用，来自环境变量）
  ipcMain.handle('app:startupDir', () => process.env.MYLATEX_OPEN_DIR ?? null)

  // 刷新目录树
  ipcMain.handle('fs:readTree', async (_e, root: string) => readTree(root))

  ipcMain.handle('fs:readFile', async (_e, path: string) => readFileText(path))

  ipcMain.handle('fs:writeFile', async (_e, path: string, content: string) =>
    writeFileText(path, content)
  )
  ipcMain.handle('fs:rename', (_e, oldPath: string, newPath: string) =>
    renamePath(oldPath, newPath)
  )
  ipcMain.handle('fs:mkdir', (_e, path: string) => makeDir(path))
  // 删除走系统回收站（可恢复，不做永久删除）
  ipcMain.handle('fs:trash', (_e, path: string) => shell.trashItem(path))
  ipcMain.handle('fs:reveal', (_e, path: string) => {
    shell.showItemInFolder(path)
  })
  ipcMain.handle('clipboard:write', (_e, text: string) => {
    clipboard.writeText(text)
  })

  // 探测可用的 TeX 发行版（PATH + 注册表 + 常见路径，跨机器稳健）
  ipcMain.handle('tex:distros', () => detectDistros())

  // 手动指定 TeX bin 目录（检测失败时兜底）：返回校验过含 pdflatex.exe 的目录
  ipcMain.handle('tex:pickBin', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const r = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: '选择 TeX 的 bin 目录（含 pdflatex.exe）'
    })
    if (r.canceled || !r.filePaths[0]) return null
    const picked = r.filePaths[0]
    // 直接是 bin 目录，或用户选了 MiKTeX/TeX Live 根目录
    for (const cand of [picked, join(picked, 'miktex', 'bin', 'x64'), join(picked, 'bin', 'windows')]) {
      if (existsSync(join(cand, 'pdflatex.exe'))) return cand
    }
    return null
  })

  // 编译指定主文件（就地编译），texBin 选发行版，engine 选 pdflatex/xelatex/lualatex
  ipcMain.handle('latex:compile', async (_e, mainFile: string, texBin?: string, engine?: string) =>
    compileMainFile(mainFile, texBin, engine)
  )

  // 运行环境检测：LaTeX / Pandoc / winget
  function hasWinget(): Promise<boolean> {
    return new Promise((res) => {
      const c = spawn('powershell', ['-NoProfile', '-Command', 'winget --version'], {
        windowsHide: true
      })
      c.on('error', () => res(false))
      c.on('close', (code) => res(code === 0))
    })
  }
  ipcMain.handle('env:check', async () => ({
    hasTeX: (await detectDistros()).some((d) => d.available),
    hasPandoc: (await findPandoc()) !== null,
    hasWinget: await hasWinget()
  }))
  // 用 winget 联网安装（可能弹 UAC）
  ipcMain.handle('env:install', (_e, target: 'miktex' | 'pandoc') => {
    const id = target === 'miktex' ? 'MiKTeX.MiKTeX' : 'JohnMacFarlane.Pandoc'
    return new Promise<{ ok: boolean; message: string }>((res) => {
      const c = spawn(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `winget install --id ${id} -e --accept-package-agreements --accept-source-agreements`
        ],
        { windowsHide: true }
      )
      c.on('error', (err) => res({ ok: false, message: err.message }))
      c.on('close', (code) => {
        clearDistroCache() // 装完后清缓存，下次检测能发现新装的
        res({ ok: code === 0, message: code === 0 ? '安装完成' : '安装失败或被取消' })
      })
    })
  })
  ipcMain.handle('env:openDownload', (_e, target: 'miktex' | 'pandoc') => {
    shell.openExternal(
      target === 'miktex' ? 'https://miktex.org/download' : 'https://pandoc.org/installing.html'
    )
  })

  // 导出
  ipcMain.handle('export:hasPandoc', async () => (await findPandoc()) !== null)

  ipcMain.handle('export:pdf', async (_e, mainFile: string) => {
    const pdf = mainFile.replace(/\.tex$/i, '.pdf')
    if (!existsSync(pdf)) return { ok: false, message: '请先编译生成 PDF' }
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const r = await dialog.showSaveDialog(win!, {
      defaultPath: basename(pdf),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (r.canceled || !r.filePath) return { ok: false, message: '已取消' }
    await copyFile(pdf, r.filePath)
    return { ok: true, message: `已导出 ${r.filePath}` }
  })

  ipcMain.handle('export:zip', async (_e, root: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const r = await dialog.showSaveDialog(win!, {
      defaultPath: `${basename(root)}.zip`,
      filters: [{ name: 'Zip', extensions: ['zip'] }]
    })
    if (r.canceled || !r.filePath) return { ok: false, message: '已取消' }
    return runZip(root, r.filePath)
  })

  ipcMain.handle('export:pandoc', async (_e, mainFile: string, format: 'docx' | 'md' | 'html') => {
    const pandoc = await findPandoc()
    if (!pandoc) return { ok: false, message: '未检测到 Pandoc，请先安装' }
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const base = basename(mainFile).replace(/\.tex$/i, '')
    const r = await dialog.showSaveDialog(win!, {
      defaultPath: `${base}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }]
    })
    if (r.canceled || !r.filePath) return { ok: false, message: '已取消' }
    const dir = dirname(mainFile)
    return runPandoc(pandoc, mainFile, r.filePath, dir, existsSync(join(dir, 'refs.bib')))
  })

  // 论文版本管理（内置 isomorphic-git，版本库在 .mylatex/versions）
  ipcMain.handle('version:snapshot', (_e, root: string, name: string, kind: 'auto' | 'manual') =>
    snapshot(root, name, kind)
  )
  ipcMain.handle('version:list', (_e, root: string) => listVersions(root))
  ipcMain.handle('version:diff', (_e, root: string, a: string, b: string) =>
    versionDiff(root, a, b)
  )
  ipcMain.handle('version:restore', (_e, root: string, oid: string) => restore(root, oid))
  ipcMain.handle('version:info', (_e, root: string) => repoInfo(root))
  ipcMain.handle('version:clear', (_e, root: string) => clearAll(root))

  // SyncTeX 双向定位
  ipcMain.handle('synctex:view', (_e, pdf: string, file: string, line: number, texBin?: string) =>
    synctexView(pdf, file, line, texBin)
  )
  ipcMain.handle('synctex:edit', (_e, pdf: string, page: number, x: number, y: number, texBin?: string) =>
    synctexEdit(pdf, page, x, y, texBin)
  )

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
