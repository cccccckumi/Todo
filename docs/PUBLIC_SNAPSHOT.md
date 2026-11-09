# 公开源码快照范围

本轮只准备独立的本地源码快照，不连接 GitHub，不推送或发布。原仓库的 Git 历史不进入快照。

## 纳入的项目文件

- `src/`、`electron/`、`shared/`：任务界面、桌面窗口、数据和 AI 调用源码。
- `server/`：保留旧浏览器迁移/开发模式需要的本地 API 源码，不含配置。
- `scripts/`、`tests/unit/`、`tests/desktop/`：构建与检查脚本、使用合成输入的测试源码，不含测试运行生成的数据。
- `build/icon.png`、`build/icon.ico`：由项目图标生成脚本绘制的图标。
- README、MIT LICENSE、AI_SETUP、构建配置、lockfile、GitHub Actions 工作流和必要文档。
- `docs/screenshots/`：原有文档插图，仅含测试源码中可核实的合成任务，作为文档素材保留；临时截图和测试报告不纳入。

快照根目录的 `PUBLIC_FILES.txt` 是这次复制的明确文件清单。复制前检查每个文件，复制后独立检查快照；不递归复制整个工作目录。

## 排除的内容

- 原 `.git`、任何旧提交或原仓库配置。
- `.env` 和变体；仅保留空值模板 `.env.example`。
- 用户任务、任务备份、导出文件、加密 AI 配置和配置临时文件。
- `node_modules`、`dist`、`release`、Python 缓存、临时文件、测试 profile、测试报告、日志及其他本机生成内容。
- 全部 `.agents/skills/`：本地许可证据尚不完整或相互冲突，详见 [许可审查](THIRD_PARTY_SKILLS.md)。保留原目录不代表已经获准公开。

快照初始化为一个没有 remote 的全新本地 Git 仓库，使用公开网名和 GitHub noreply 邮箱。本轮不 stage、不创建提交，文件保留为未跟踪状态，便于继续审阅。发布前再核实新 GitHub 仓库的名称和归属；本轮不创建它。

Windows 安装包另行保留在本地 `release/`，不放入源码快照。未配置代码签名，安装时 Windows SmartScreen 可能提示未知发布者；不能把测试通过解释为已经签名或获得系统信誉。
