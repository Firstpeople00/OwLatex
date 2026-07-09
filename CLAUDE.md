# CLAUDE.md

本文件指导 Claude Code 在本仓库中工作。**完整开发路线图见 [`PLAN.md`](PLAN.md)（权威来源，推进时同步更新）。**

## 项目概述
MyLatex 是一个自研的 **LaTeX IDE 桌面应用**（Electron）。左栏写 LaTeX 代码、右栏实时渲染 PDF，目标是完整 IDE：多文件工程、文献管理、错误解析、SyncTeX 双向跳转。

**当前阶段**：Phase 1（MVP 闭环）尚未开始——仓库目前只有计划文档，代码骨架待生成。

## 技术栈
- **Electron** + electron-vite（应用壳 / 构建）
- **React + TypeScript**（renderer）
- **Zustand**（状态管理）
- **CodeMirror 6**（编辑器，命令式库）
- **PDF.js**（PDF 预览，命令式库）
- **pdflatex**（经 `child_process` 直接调用本地 MiKTeX，原生二进制）。**不用 latexmk**——它是 Perl 脚本，而 MiKTeX 不自带 Perl；多遍/交叉引用重跑由 main 里的 latexmk-lite 逻辑处理
- **electron-store**（设置持久化）

## 关键环境事实（务必遵守）
- **两个 TeX 发行版都装了，编辑器支持切换**（工具栏下拉，localStorage 持久化，默认第一个可用）：
  - **MiKTeX**：bin `D:\Environments\Tex\MikTeX\miktex\bin\x64`
  - **TeX Live 2026**：bin `C:\texlive\2026\bin\windows`（完整版，自带 Perl + 全部宏包，不会有按需安装问题）
  - 已知发行版列表写在 `src/main/index.ts` 的 `DISTROS`（Phase 3 设置面板会改为可自定义路径）。
- ⚠️ **两个发行版都不在系统 PATH**。代码**禁止假设** `pdflatex` 全局可用；按绝对路径调用并注入 PATH，bin 目录来自 `compileMainFile(mainFile, texBin)` 的入参。
- 基准编译命令：`pdflatex -synctex=1 -interaction=nonstopmode -halt-on-error -file-line-error main.tex`，**始终带 `-synctex=1`**。
- ⚠️ **MiKTeX 按需装包会崩（已修，勿回退）**：缺失宏包时 MiKTeX 想弹 Qt 安装对话框，但 pdflatex 是 Electron 子进程、无 GUI 会话 → `GUI framework cannot be initialized` FATAL 崩溃。**已通过 `initexmf --set-config-value [MPM]AutoInstall=1` 开启静默自动安装修复**（一次性，已应用）。TeX Live 完整版无此问题。
- ⚠️ **不要用 latexmk**：它是 Perl 脚本，MiKTeX 不带 Perl（TeX Live 带）。统一用直接 pdflatex + main 里自实现的多遍循环（读 `.log` 检测 "Rerun"，最多 3 遍），两个发行版通用。
- 已知限制：尚未跑 bibtex/biber，`\cite` 工程依赖已存在的 `.bbl`。
- Node v24.14、Python 3.11 可用（主链不依赖 Python）。

## 架构约定
三进程严格分层：
- `src/main/` —— 文件读写、Compiler 服务（spawn pdflatex，多遍）、日志解析、设置持久化。**所有子进程与文件系统操作集中在此**。
- `src/preload/` —— 通过 `contextBridge` 暴露**白名单** IPC API，是 renderer 访问能力的**唯一入口**。
- `src/renderer/` —— React UI，**无 Node 能力**；组件见 `components/`（`Editor.tsx`、`PdfPreview.tsx` 等），状态在 `store/`。

不可妥协的规则：
1. **Electron 安全**：`contextIsolation: true`、`nodeIntegration: false`、开启 `sandbox`。renderer 不得直接拼接或执行 shell 命令。
2. **「实时渲染」= 防抖自动编译**（停止输入约 1.5s 触发），不是逐字符编译。
3. **命令式库封装**：CodeMirror 6 / PDF.js 在各自封装组件内集中处理挂载/卸载/依赖，对外暴露简洁 props，避免 `useEffect` 副作用坑。
4. **受管编译工作目录**：编译在独立工作目录进行，集中存放 `.aux/.log/.synctex.gz` 等中间产物，不污染源目录。
5. **中文/空格路径兜底**：源目录与工作目录可能含中文或空格，调用 TeX 时参数必须严格转义，必要时用英文临时工作目录兜底。

## 命令
> 脚手架尚未生成；Phase 1 完成后在此补充 `npm run dev` / `npm run build` / lint 等命令。

手动验证编译链（PowerShell，路径含空格用调用运算符 `&`）：
```powershell
& "D:\Environments\Tex\MikTeX\miktex\bin\x64\pdflatex.exe" -synctex=1 -interaction=nonstopmode -file-line-error test.tex
```

运行应用（必须用分离方式，否则后台 Bash 任务结束会回收 Electron 子进程）：
```powershell
Start-Process npm.cmd -ArgumentList "run","dev" -WorkingDirectory "D:\Project\MyLatex"
```

## 协作约定
- **用中文回复**（用户偏好）。
- 大改动或不可逆操作前先确认。
- 每完成一个阶段，同步更新 `PLAN.md` 的「进度跟踪」表与对应阶段勾选项。
