# MyLatex —— 自研 LaTeX IDE 开发计划

> 一个基于 Electron 的桌面级 LaTeX 集成开发环境。左栏写代码、右栏实时渲染 PDF，目标是做成支持多文件工程、文献管理、错误解析、SyncTeX 双向跳转的**完整 IDE**。

- **项目目录**：`D:\Project\MyLatex`
- **文档版本**：v1.0
- **创建日期**：2026-06-26
- **当前阶段**：Phase 0 已完成，准备进入 Phase 1

---

## 1. 项目定位与目标

| 项 | 内容 |
|---|---|
| 形态 | Electron 桌面应用（跨平台，优先 Windows） |
| 定位 | **完整 IDE**（非简单 .tex 文本编辑器） |
| 核心交互 | 双栏对照：左栏代码 / 右栏实时渲染 PDF |
| 渲染策略 | **防抖自动编译**（停止输入约 1.5s 触发），非逐字符渲染 |
| 编译方式 | 调用**本地 MiKTeX 发行版** |

### 目标功能（最终形态）
- 语法高亮、括号匹配、命令/环境/`\ref`/`\cite` 智能补全
- 编译错误/警告解析，定位到行号，编辑器内标红 + 问题面板
- SyncTeX 源码 ↔ PDF 双向跳转
- 多文件工程：文件树、主文件设置、`\input/\include` 解析、文件监听
- BibTeX 文献管理
- 文档大纲/章节导航、模板系统
- 可切换编译引擎（pdflatex / xelatex / lualatex）与参数
- 主题、配置持久化、会话恢复

---

## 2. 技术栈

| 角色 | 选型 | 理由 |
|---|---|---|
| 应用壳 | **Electron** + electron-vite | 脚手架省心、热更新快、可直接调本地 TeX |
| UI 框架 | **React + TypeScript** | 生态最大、IDE 类组件现成、资料/AI 辅助最多 |
| 状态管理 | **Zustand** | 轻量、样板少，适合多标签/面板联动 |
| 编辑器 | **CodeMirror 6** | Overleaf 同款，LaTeX 高亮/补全生态成熟 |
| PDF 预览 | **PDF.js** | 渲染编译产物，支持滚动定位 |
| 分栏布局 | **react-resizable-panels** | 可拖拽双栏 |
| 文件树 | **react-arborist**（Phase 3） | 现成的工程文件树组件 |
| 编译 | `child_process` spawn **pdflatex** | 原生二进制不依赖 Perl；多遍/交叉引用重跑由 main 自实现（latexmk 因 MiKTeX 不带 Perl 弃用） |
| 文件监听 | **chokidar**（Phase 3） | 多文件 `\input/\include` 改动监听 |
| 配置持久化 | **electron-store** | TeX 路径、引擎、主题等设置 |

---

## 3. 总体架构

### 3.1 Electron 进程模型

```
┌─────────────────────────────────────────────────────────┐
│  Renderer 进程 (React UI)                                 │
│   ┌──────────────┐        ┌──────────────────┐           │
│   │ CodeMirror 6 │  双栏  │ PDF.js Preview   │           │
│   │  (左栏代码)  │ <----> │  (右栏渲染)      │           │
│   └──────────────┘        └──────────────────┘           │
│        状态层 Zustand（打开文件 / 编译状态 / 错误 / 设置）  │
└───────────────▲───────────────────────────────────────────┘
                │  contextBridge 暴露的安全 IPC（白名单）
        ┌───────┴────────┐  preload/index.ts
                │
┌───────────────▼───────────────────────────────────────────┐
│  Main 进程 (Node)                                          │
│   • 文件读写 / 工程管理                                     │
│   • Compiler 服务：spawn pdflatex（可配置 TeX bin 路径）    │
│   • 日志解析（错误/警告 → 行号）                            │
│   • chokidar 文件监听（Phase 3）                            │
│   • electron-store 设置持久化                              │
└────────────────────────────────────────────────────────────┘
                │
                ▼  调用本地发行版
        D:\Environments\Tex\MikTeX\miktex\bin\x64\pdflatex.exe
```

### 3.2 核心编译流程（Phase 1 闭环）

1. 用户在 CodeMirror 输入 → `onChange` 触发**防抖**（~1.5s）
2. Renderer 经 IPC 把内容交给 Main → Main 写入**受管编译工作目录**
3. Main `spawn` pdflatex：`pdflatex -synctex=1 -interaction=nonstopmode -halt-on-error -file-line-error main.tex`（最多 3 遍，读 `.log` 检测 "Rerun" 决定是否重跑）
4. 编译结束 → Main 解析 `.log` → 回传 `{ success, pdfPath, problems[] }`
5. Renderer：PDF.js **重载 PDF**（保持滚动位置）、问题面板刷新、编辑器行号槽标错

### 3.3 安全约定（Electron 必守）
- `contextIsolation: true`、`nodeIntegration: false`、`sandbox` 开启
- 渲染层**只能**通过 preload 的 `contextBridge` 白名单 API 访问能力
- 不在 Renderer 直接拼接/执行 shell；所有子进程调用集中在 Main，参数严格转义

---

## 4. 目录结构（规划）

```
MyLatex/
├─ PLAN.md                     # 本文档
├─ package.json
├─ electron.vite.config.ts
├─ tsconfig.json
├─ .gitignore
└─ src/
   ├─ main/                    # 主进程
   │  ├─ index.ts             # 窗口创建、IPC 注册
   │  ├─ compiler.ts          # 封装 pdflatex 多遍调用 + 可配置 TeX bin 路径
   │  ├─ logParser.ts         # .log → 错误/警告/行号
   │  ├─ fileService.ts       # 读写 / 工程管理
   │  └─ settings.ts          # electron-store 封装
   ├─ preload/
   │  └─ index.ts             # contextBridge 安全 API 白名单
   └─ renderer/
      ├─ main.tsx
      ├─ App.tsx              # 双栏布局 + 工具栏 + 状态栏
      ├─ store/               # Zustand 状态
      ├─ components/
      │  ├─ Editor.tsx        # CodeMirror 6 封装
      │  ├─ PdfPreview.tsx    # PDF.js 封装
      │  ├─ Toolbar.tsx
      │  └─ ProblemsPanel.tsx
      └─ hooks/               # useDebouncedCompile 等
```

---

## 5. 环境与前置条件（Phase 0 ✅ 已验证）

| 检查项 | 状态 |
|---|---|
| MiKTeX | ✅ 25.12，安装于 `D:\Environments\Tex\MikTeX` |
| TeX bin 目录 | `D:\Environments\Tex\MikTeX\miktex\bin\x64`（pdflatex/xelatex/lualatex/latexmk/synctex 齐全） |
| 编译链 `latexmk → PDF` | ✅ exit=0，PDF + `.synctex.gz` 正常产出 |
| Node | ✅ v24.14 |
| Python | ✅ 3.11（备用，主链不依赖） |

> ⚠️ **关键约束**：MiKTeX **不在系统 PATH**。因此编辑器**不得**假设 `latexmk` 全局可用，必须把 **"TeX bin 路径"做成可配置项**，默认值填上面探测到的路径。

---

## 6. 关键设计决策

1. **"实时"= 防抖自动编译**：LaTeX 编译是秒级的，业界（含 Overleaf）均为防抖触发，而非逐字符渲染。心理预期与架构必须对齐。后续可加增量编译/缓存优化。
2. **TeX bin 路径可配置**：默认 `D:\Environments\Tex\MikTeX\miktex\bin\x64`，设置面板可改。换机器/换发行版只改配置。
3. **受管编译工作目录**：编译在独立工作目录进行，集中管理中间产物（`.aux/.log/.synctex.gz` 等），避免污染源目录。
4. **SyncTeX 全程保留**：编译始终带 `-synctex=1`，为 Phase 2 的双向跳转打底。
5. **中文/空格路径兜底**：源目录、工作目录可能含中文/空格 → 路径严格转义、必要时用短路径或临时英文工作目录兜底。
6. **Electron 安全优先**：见 §3.3。
7. **编译引擎用 pdflatex 而非 latexmk**：latexmk 是 Perl 脚本，**MiKTeX 不自带 Perl**（Phase 1 实测踩坑：`could not find the script engine 'perl'`）。改为直接 spawn 原生的 `pdflatex.exe`，零额外安装；多遍编译/交叉引用重跑由 main 里的 latexmk-lite 循环自实现（读 `.log` 检测 "Rerun"，最多 3 遍）。bibtex/biber 编排留待 Phase 3 文献功能。
8. **支持 MiKTeX / TeX Live 双发行版切换 + MiKTeX 静默装包**（Phase 2 实测踩坑）：MiKTeX 缺包时弹 Qt 安装窗，但 Electron 子进程无 GUI 会话 → `GUI framework cannot be initialized` 崩溃。修复：`initexmf --set-config-value [MPM]AutoInstall=1` 开启静默自动安装。用户同时装了 TeX Live 2026（完整版，自带 Perl + 全宏包），编辑器工具栏下拉可在两者间切换，`compileMainFile(mainFile, texBin)` 按选择注入 bin 路径。

---

## 7. 分阶段路线图

### Phase 0 · 环境准备 ✅ 已完成
- [x] 安装并验证 MiKTeX
- [x] 跑通 `latexmk → PDF + synctex` 编译链
- [x] 确认 Node 工具链
- [x] 确定技术栈（React）

### Phase 1 · MVP 最小闭环 ✅ 已完成（2026-06-26）
**目标**：改代码 → 防抖编译 → 右栏 PDF 自动刷新（单文件）
- [x] electron-vite + React + TS 脚手架
- [x] Electron 安全骨架（contextIsolation / nodeIntegration:false / sandbox / preload 白名单 IPC）
- [x] 双栏布局（react-resizable-panels）+ 工具栏 + 状态栏
- [x] 左栏 CodeMirror 6 基础编辑器（stex 语法高亮）
- [x] 右栏 PDF.js 查看器（重渲染保持滚动位置）
- [x] Main 端 `compiler.ts`：可配置路径 spawn pdflatex（多遍），临时英文工作目录兜底中文路径
- [x] 防抖自动编译 hook（~1.5s）+ 首屏即编译
- [x] 编译状态/基础错误输出展示（状态栏，错误可悬停看日志）

**验收标准**：输入一段 LaTeX，1.5s 后右栏自动出现/刷新 PDF；编译失败时状态栏给出提示。

**验证结果**：`electron-vite build` ✅、`tsc` 类型检查 ✅、编译链 headless 实测产出 92KB PDF + synctex（1.5s）✅、运行态确认 renderer→IPC→main 闭环执行（`main.tex` 被应用实时写入）✅。

### Phase 2 · 编辑体验（进行中，按用户优先级先做了文件树）
**已提前完成（原属 Phase 3，用户优先要文件栏）：**
- [x] **多文件工程模型**：打开本地文件夹 → 递归文件树（自研轻量组件，非 react-arborist）→ 自动探测主文件（含 `\documentclass`，优先 `main.tex`）
- [x] 文件树点击打开 / 编辑保存 / ★主文件标记 / 右键设为主文件
- [x] 三栏布局（树 \| 编辑器 \| PDF）
- [x] **多文件就地编译**：cwd = 主文件目录，`\input`/图片/`.bbl` 相对路径解析正常（实测用户真实工程 9 页 PDF ✅）
- [x] **编译引擎可切换**：工具栏下拉在 **MiKTeX / TeX Live 2026** 间切换（localStorage 持久化）
- [x] 修复 MiKTeX 按需装包崩溃：开启 `[MPM]AutoInstall=1` 静默自动安装（详见 §6.8）
- [x] 开发用启动自动打开（`MYLATEX_OPEN_DIR`）

**待完成（原 Phase 2 编辑体验）：**
- [x] LaTeX 语法高亮、括号匹配（stex 高亮 + basicSetup 自带括号匹配/高亮）
- [x] 命令/环境/`\ref`(跨文件 `\label`)/`\cite`(工程 .bib key) 自动补全（`latex-complete.ts`，标签随大纲扫描收集）
- [x] `.log` 错误/警告解析 → 问题面板 + 点击跳转到出错行（`parse-log.ts`）+ **编辑器红波浪线**（`@codemirror/lint`，编译后 forceLinting 刷新）
- [x] SyncTeX 正向（源码→PDF，工具栏 →PDF 按钮）/ 反向（PDF 双击→源码）跳转（`synctex.ts`，整行精度）

**已知限制**：当前 latexmk-lite 只做 pdflatex 多遍（检测 "Rerun"），**不运行 bibtex/biber**——含 `\cite` 的工程依赖已存在的 `.bbl`；改动文献后需 Phase 3 加 bibtex 编排才会更新。

**验收标准**：编译报错能精确跳到行；双击源码定位 PDF 位置，反之亦然。

### Phase 3 · IDE 化
- [x] ~~多文件工程：文件树、主文件设置、`\input/\include` 解析~~（已在 Phase 2 提前完成）
- [x] 文件监听：**stdlib `fs.watch`**（递归，忽略编译产物，防抖 300ms）→ IPC 通知 renderer 刷新树（未引 chokidar）
- [x] BibTeX 文献：编译链首遍后若 `.aux` 含 `\bibdata` 则跑 bibtex 再续编（`compiler.ts`）；`\cite` 补全读工程 .bib 的 key（实测 E 盘工程 70 条、0 undefined）
- [x] 文档大纲/章节导航（`OutlinePanel.tsx`；store 扫主文件按 `\input` 顺序展开提取章节，点击跨文件跳转；编译成功后刷新）
- [x] 模板系统：文件树 ✚ 从内置模板（article / 中文 ctex / beamer）新建（重名自动加序号）
- [x] 设置面板（⚙ 弹层）：主题 浅/深、自动编译开关（Ctrl+S 手动编译）、**引擎 pdflatex/xelatex/lualatex 切换**（实测 xelatex 编中文 ctex ✅）；发行版切换在工具栏。编译参数自定义待补
- [x] 配置持久化：用 **localStorage**（texBin/theme/autoCompile），未引入 electron-store（ponytail：无新依赖）

**验收标准**：能打开/管理一个多文件工程，切引擎，配置持久保存。

### Phase 4 · 打磨与分发
- [ ] 增量编译缓存、自动保存、会话恢复、滚动位置保持
- [ ] 性能优化（大文档）
- [ ] electron-builder 打包成 Windows 安装包
- [ ] 应用图标、关于页、更新检查

**验收标准**：产出可安装的 `.exe`，冷启动到首次编译流畅。

---

## 8. Phase 1 任务拆解（即将执行）

| # | 任务 | 产出文件 |
|---|---|---|
| 1 | 初始化 electron-vite + React + TS 工程 | `package.json` / `electron.vite.config.ts` / `tsconfig.json` |
| 2 | Main 进程窗口 + 安全配置 | `src/main/index.ts` |
| 3 | preload 白名单 API | `src/preload/index.ts` |
| 4 | Compiler 服务（可配置路径 spawn pdflatex，多遍） | `src/main/compiler.ts` |
| 5 | 双栏布局外壳 | `src/renderer/App.tsx` |
| 6 | CodeMirror 编辑器封装 | `src/renderer/components/Editor.tsx` |
| 7 | PDF.js 预览封装 | `src/renderer/components/PdfPreview.tsx` |
| 8 | 防抖编译 hook + Zustand 状态 | `src/renderer/hooks/` `src/renderer/store/` |
| 9 | 端到端联调跑通闭环 | — |

---

## 9. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 编译耗时拖慢"实时"体验 | 中 | 防抖 + 后续增量编译/缓存；编译期间不阻塞 UI |
| CM6/PDF.js（命令式）接入 React 副作用坑 | 中 | 在封装组件里集中处理挂载/卸载/依赖，对外暴露简洁接口 |
| 中文/空格路径导致编译失败 | 中 | 路径转义 + 受管工作目录兜底 |
| MiKTeX 首次用某宏包按需下载卡顿 | 低 | 首次编译给出"正在获取宏包"提示；可预装常用包 |
| Electron 安全配置疏漏 | 中 | 严守 §3.3；渲染层无 Node 能力 |

---

## 10. 进度跟踪

| 阶段 | 状态 | 备注 |
|---|---|---|
| Phase 0 环境准备 | ✅ 完成 | 2026-06-26 |
| Phase 1 MVP 闭环 | ✅ 完成 | 2026-06-26，构建/类型检查/编译链/IPC 闭环均已验证 |
| Phase 2 编辑体验 | ✅ 完成 | 文件树/多文件工程、双发行版切换、错误面板+跳转、自动补全、SyncTeX 双向均完成 |
| Phase 3 IDE 化 | ⬜ | |
| Phase 4 打磨分发 | ⬜ | |

---

*本计划随开发推进持续更新。*
