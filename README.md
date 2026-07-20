# OwLatex

> **当前版本 v0.3.0** · Windows x64

一个自研的 **LaTeX 桌面 IDE**（Electron + React）。左栏文件树/大纲、中栏源码编辑、右栏 PDF 实时预览，面向多文件论文写作。

> 编译调用本机的 TeX 发行版（MiKTeX / TeX Live），首次启动可引导一键安装。

---

## ✨ 功能

- **多文件工程**：打开文件夹作为工程，支持 `\input`/`\include`，就地编译（cwd = 主文件目录），自动探测主文件。
- **实时预览**：停止输入后防抖自动编译（可关），或手动编译；PDF 自适应宽度 + 手动缩放。
- **编译引擎可切换**：`pdflatex` / `xelatex`（中文）/ `lualatex`；发行版 **MiKTeX / TeX Live** 一键切换。
- **文献**：含 `\bibliography` 时自动跑 BibTeX。
- **多标签编辑**：文件以标签页打开，切换保留未保存缓冲；溢出时滚轮横向滚动、自动滚入视野。
- **格式化工具栏**：撤销/重做、标题、粗斜体、行内公式、符号面板、链接/图片/表格/列表、引用/交叉引用、查找。
- **智能编辑**：LaTeX 语法高亮、括号匹配；命令/环境、跨文件 `\ref`、工程 `\cite`（读 .bib）自动补全。
- **错误定位**：解析编译日志 → 问题面板 + 点击跳到出错行 + 编辑器红波浪线。
- **SyncTeX 双向跳转**：源码光标 → PDF 定位；PDF 双击 → 跳回源码。
- **大纲导航**：按 `\input` 顺序提取章节，点击跨文件跳转。
- **文件树右键菜单**（VS Code 风）：新建文件/文件夹、重命名、删除到回收站、复制路径、在资源管理器中显示；空白处/文件/文件夹三套菜单。
- **模板**：article / 中文（ctex）/ beamer。
- **导出**：PDF、源码 `.zip`、**Word (.docx) / Markdown / HTML**（后三者经 Pandoc）。
- **顶栏菜单**：文件 / 编辑 / 插入 / 格式 / 视图 / 帮助。
- **主题**：浅色 / 深色；Obsidian 风圆角分区 UI，内联 SVG 图标；自绘无边框标题栏（窗口控制并入菜单栏）。
- **运行环境检测**：跨机器自动检测 LaTeX（PATH / 注册表 / 常见安装位置）与 Pandoc；缺失可一键 `winget` 联网安装，识别不到还能手动指定 TeX 路径。

---

## 📦 安装（普通用户）

1. 下载并运行 `OwLatex-Setup-0.3.0.exe`（可选安装目录、创建桌面快捷方式）。
2. 首次启动若未检测到 LaTeX，会弹出引导，点「安装 MiKTeX」即可（或到 **帮助 → 检查运行环境** 手动触发）。
3. 已装 LaTeX 却没识别到？在该弹窗点「**手动指定 TeX 路径…**」选到含 `pdflatex.exe` 的 bin 目录即可。

**前置依赖**（安装包不打包，调用本机）：

| 组件 | 用途 | 获取 |
|---|---|---|
| MiKTeX 或 TeX Live | 编译（必需） | 应用内一键装 / [miktex.org](https://miktex.org/download) |
| Pandoc | Word/MD/HTML 导出（可选） | 应用内一键装 / `winget install JohnMacFarlane.Pandoc` |

> 未做代码签名：首次运行 Windows SmartScreen 可能提示「已保护你的电脑」→ 更多信息 → 仍要运行。

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl+S` | 保存当前文件 |
| `Ctrl+B` / `Ctrl+I` | 加粗 / 斜体（包裹选区） |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| `Ctrl+F` / `Ctrl+A` | 查找 / 全选 |
| `Ctrl` `+`/`=` `−` `0` | PDF 放大 / 缩小 / 适应宽度 |

---

## 🛠 从源码构建（开发者）

需要 Node 18+ 和本机 TeX 发行版。

```bash
npm install          # 安装依赖
npm run dev          # 开发模式（热更新）
npm run build        # 构建到 out/
npm run typecheck    # 类型检查
npm run icon         # 从 src/images/logo-1.svg 生成 build/icon.ico
npm run pack         # 出免安装解包版（dist/win-unpacked）
npm run dist         # 出 NSIS 安装包（dist/OwLatex-Setup-*.exe）
```

开发时可用环境变量 `MYLATEX_OPEN_DIR=<工程目录>` 让应用启动自动打开某工程。

---

## 🧱 技术栈 / 架构

- **Electron + electron-vite**（三进程：main / preload / renderer）
- **React + TypeScript**、**Zustand**（状态）、**react-resizable-panels**（分栏）
- **CodeMirror 6**（编辑器）、**PDF.js**（预览）
- **无 UI 框架**：手写 CSS 设计 tokens（浅/深主题）
- 编译：主进程 `child_process` 调本机 `pdflatex/xelatex/lualatex`，自实现多遍循环（检测 "Rerun"）+ 按需 BibTeX
- 导出：PDF 复制、`Compress-Archive` 打包、Pandoc 转换

安全：`contextIsolation` + `sandbox`，preload 白名单 IPC，无 `nodeIntegration`。

```
src/
├─ main/        # 窗口、编译(compiler)、SyncTeX、TeX 检测(tex-detect)、文件服务、导出(exporter)、IPC
├─ preload/     # contextBridge 白名单 API
└─ renderer/    # React UI（components / store / editor-view / templates）
```

---

## 📝 已知限制

- 仅 Windows x64；未代码签名。
- TeX / Pandoc 需本机安装（不随包分发）。
- 中文文档需在「视图 → 引擎」切换到 **xelatex**（配 ctex）。
- 文献仅 BibTeX（暂不支持 biber/biblatex）。

---

## 📄 License

MIT
