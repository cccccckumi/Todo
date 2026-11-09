# AI Todo 桌面版

Windows 桌面待办：悬浮球、悬停预览、系统托盘和可选的豆包通知解析。保留 React + Vite + JavaScript 前端和普通 CSS。首版提供 Windows x64 安装包，本机已验证 Windows 11；macOS 的代码路径已预留，但尚未在 Mac 上构建或验证。

## 为什么用 Electron

| 方案 | 与当前项目的关系 | 悬浮窗实现 | 本次选择 |
| --- | --- | --- | --- |
| Electron | 复用 React 和现有 Node AI 逻辑，只增加主进程与受限 IPC | BrowserWindow、置顶、窗口区域、托盘均有原生 API | 采用；Windows 验证链路完整，代价是包体较大 |
| Tauri 2 | 可复用 React，但需 Rust/MSVC 工具链并迁移 Node 端逻辑或维护 sidecar | 支持窗口/托盘，需要适配系统 WebView 和原生边界 | 适合后续更强调包体大小时评估 |

官方参考：[Electron 窗口 API](https://www.electronjs.org/docs/latest/api/browser-window)、[Electron 托盘](https://www.electronjs.org/docs/latest/api/tray)、[Tauri 工具链](https://v2.tauri.app/start/prerequisites/)、[Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)。

## 开发与运行

使用 Node.js 24 和 npm：

```powershell
cd D:\vibecoding\Todo
npm.cmd ci
npm.cmd run dev
```

一个命令启动 Vite 和真实 Electron 窗口，无需浏览器或单独 API 服务。`npm.cmd run desktop` 会先构建前端，再直接启动桌面应用。首次启动打开主界面，之后启动显示悬浮球。

Windows 主窗口固定为原生浅色标题栏，与应用的白色界面协调。修改桌面主进程代码后，应从托盘“完全退出”旧进程再启动；只关闭主窗口会继续驻留。标题栏实现和验证范围见 [标题栏说明](docs/TITLEBAR.md)。

如果 npm 禁用了依赖安装脚本，Electron 运行时未下载，可执行 `node node_modules/electron/install.js`。若官方下载地址无法连接，可在当前终端临时指定镜像后重试；不要禁用校验：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
node node_modules/electron/install.js
```

## 悬浮球和托盘

- 悬浮球在普通应用窗口上方；悬停展开待办预览，移入面板继续显示，离开球/面板/连接通道约 280 毫秒后收起。
- 点击球或预览底部按钮打开完整清单。预览中可完成任务，与主窗口同步。
- 拖动球调整位置，位置保存在本地；显示器变化时会重新约束到可见工作区。
- 主窗口位于前台时暂时隐藏悬浮区，切到其他软件或关闭主窗口后恢复，避免挡住主界面。
- 关闭主窗口只是隐藏。托盘菜单可打开主界面、显示/隐藏球、重置球的位置、打开数据文件夹或完全退出。
- 完全退出会销毁托盘和全部窗口。操作系统的安全桌面、独占全屏程序不属于可保证覆盖的普通窗口。

Windows 的球与预览是同一个透明窗口，原生 `setShape` 限制点击区域；没有横跨桌面的透明大窗口。macOS 分支采用指针命中后调整鼠标忽略状态，未来仍需在 Mac 上实际验证。

任务完成现在包含轻微按压、短暂的对勾描绘和行退场反馈；现有数量同步变化，不等待动画保存。系统开启“减少动态效果”时直接更新状态。交互范围与实现说明见 [完成反馈](docs/INTERACTIONS.md)。

## 本地保存与旧数据迁移

桌面版主进程统一保存所有任务，两个窗口通过 IPC 读取同一份数据。Windows 默认位置：

```text
%APPDATA%\AI Todo\todo-data.json
%APPDATA%\AI Todo\todo-data.json.bak
```

每次修改先写临时文件，再替换正式文件；上一个版本保留为 `.bak`。读写错误会显示提示，损坏数据不会被静默覆盖为空。托盘里的“打开数据文件夹”可定位实际目录。卸载默认保留用户数据；换电脑请使用导出备份。

Chrome/Edge 的 localStorage 与 Electron 的数据目录相互独立，不能自动读取浏览器里的旧任务。迁移步骤：

1. 运行 `npm.cmd run web:dev`，在**原浏览器中打开原来保存任务的同一地址和端口**，例如 `http://localhost:5173`。`localhost` 与 `127.0.0.1`、局域网 IP 是不同的来源，请使用原地址。
2. 在页面右上角点“导出”。此迁移页面继续使用原来的 `ai-todo.tasks.v1` localStorage 键，不会清除浏览器任务。
3. 打开桌面版，在右上角点“导入”，选择 JSON 文件。已完成、已删除、日期、优先级和自定义分类全部保留。
4. 检查数量后再停用旧版。导入默认合并，相同 ID 保留桌面当前任务，避免重复导入覆盖新改动；通知会显示新增和跳过数量。

如果已经不再运行旧页面，也可在原浏览器原来源的开发者工具控制台执行：

```javascript
const tasks = localStorage.getItem('ai-todo.tasks.v1');
if (!tasks) throw new Error('当前来源没有旧任务，请确认浏览器和地址');
const link = document.createElement('a');
link.href = URL.createObjectURL(new Blob([tasks], { type: 'application/json' }));
link.download = 'AI-Todo-old-tasks.json';
link.click();
```

## 豆包 AI

安装后的应用在“AI 设置”填写使用者自己的 API Key 与模型/接入点 ID。Key 由 Electron safeStorage 使用系统加密能力保存，renderer 只能得到“已配置”状态，不会读回 Key。Windows 使用本机用户的系统加密，因此配置文件不能作为跨电脑共享 Key 的方案。

开发模式可继续读取项目 `.env`，只在主进程读取；安装包不含 `.env` 或开发者凭据。AI 请求直接由主进程发出，不需要监听本地 HTTP 端口。输入通知会发给火山方舟，解析结果需逐条勾选确认后保存。详情见 [AI_SETUP.md](AI_SETUP.md)。

## Windows 安装包

```powershell
npm.cmd test
npm.cmd run test:desktop
npm.cmd run dist:win
npm.cmd run check:package
```

安装包输出：`release/AI-Todo-0.2.0-x64-Setup.exe`。`release/win-unpacked/AI Todo.exe` 可用于免安装检查；分发免安装版需保留整个目录。`npm.cmd run pack:win` 只生成解包目录。

NSIS 安装器按用户安装，不需要系统级管理员安装；支持选择安装目录。构建固定依赖版本并使用 lockfile；没有代码签名证书，因此 Windows 可能显示未知发布者。正式广泛分发时可另外配置代码签名。构建命令始终带 `--publish never`。

工作流 `.github/workflows/windows-build.yml` 可通过 GitHub Actions 的 **Run workflow** 手动触发，或推送 `v*` 标签触发。它只上传 Actions 构建产物（通常需登录下载），不会创建 GitHub Release。维护者检查安装包后，手动创建 Release 并把 `.exe` 作为附件，普通用户即可从 Release 下载。不要上传 `.env`、数据文件或 AI 配置文件。

## 目录

- `src/`：复用的 React 任务界面、新视觉、设置与悬浮预览。
- `electron/main.js` / `preload.cjs`：窗口生命周期、托盘、安全 IPC。
- `electron/store.js`：共享持久化与备份；`geometry.js`：悬浮布局和点击区域。
- `electron/ai-config.js`：本机加密凭据。
- `shared/`：前后端共享的任务校验、导入合并和 AI 解析。
- `server/`：仅为旧浏览器迁移/开发保留的 API；桌面版不启动此服务。
- `build/`：项目原创图标；`scripts/`：开发启动、包检查、图标生成。
- `tests/`：数据与几何单元测试、真实 Electron 窗口生命周期测试。

桌面自动化使用独立测试目录，不访问真实清单或 `.env`；模型请求使用测试响应，不消耗真实 API 额度。自动化验证使用 Chromium 鼠标事件和原生窗口状态，系统指针命中检查使用独立测试坐标；真实物理鼠标、多显示器和 macOS 仍需人工验收。

本机的构建结果、截图、原生命中证据和验证边界见 [验证记录](docs/VERIFICATION.md)。Windows 原生命中测试使用 Python 标准库（构建安装包本身不需要 Python）。

## 许可证

本项目采用 [MIT License](LICENSE)，版权声明为 Copyright (c) 2026 cccccckumi。第三方依赖保留各自的许可证。

本地开发技能不属于本项目原创，也不受本项目 MIT 重新许可。当前公开源码快照排除 `.agents/`，各目录的许可证据和待核实事项见 [第三方技能审查](docs/THIRD_PARTY_SKILLS.md)。

任务数据、备份和 AI 配置应保存在应用数据目录或仓库外。`.gitignore` 保护项目根目录下的标准数据文件及默认导出名称；自定义名称的备份也请保存在仓库外，不要依赖文件名规则识别全部私人文件。
