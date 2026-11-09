# 本地第三方技能许可审查

审查日期：2026-11-09。范围仅为本仓库已跟踪的 `.agents/skills/`；未连接上游网站，也未下载或补写上游许可证。

以下内容是开发辅助材料，不是 Todo 运行、测试或打包所需源码。项目根目录的 MIT LICENSE 不替代第三方许可证，也不把第三方技能声明为本项目原创。

## 本地证据与快照决定

| 目录 | 来源和版权证据 | 许可证证据与缺口 | 公开快照 |
| --- | --- | --- | --- |
| `banner-design` | SKILL.md 的 metadata.author 为 `claudekit`；未找到精确上游仓库/版本或版权声明 | 标注 `license: MIT`，但未附完整许可文本和版权通知，尚不能核实完整再分发条件 | 排除，暂停处理 |
| `brand` | metadata.author 为 `claudekit`；未找到精确上游仓库/版本或版权声明 | 未找到目录适用的许可声明或许可文件 | 排除，需核实授权 |
| `design` | metadata.author 为 `claudekit`；未找到精确上游仓库/版本或版权声明 | 标注 `license: MIT`，但未附完整许可文本和版权通知 | 排除，暂停处理 |
| `design-system` | metadata.author 为 `claudekit`；未找到精确上游仓库/版本或版权声明 | 标注 `license: MIT`，但未附完整许可文本和版权通知；Pexels 相关代码注释也不证明整个目录的授权 | 排除，暂停处理 |
| `slides` | metadata.author 为 `claudekit`；未找到精确上游仓库/版本或版权声明 | 未找到目录适用的许可声明或许可文件 | 排除，需核实授权 |
| `ui-styling` | metadata.author 为 `claudekit`；未找到精确上游仓库/版本及有效版权通知 | SKILL.md 标注 MIT，而 LICENSE.txt 是 Apache License 2.0 通用文本，附录保留版权占位符；无法确定各文件适用的许可 | 排除，需澄清许可范围 |
| `ui-ux-pro-max` | 用户提供的来源链接为 [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)；本地未核实对应上游版本和版权通知 | 未找到整个技能的 LICENSE 或明确许可声明；字体、图标目录的来源/许可元数据不能代替整个技能的许可 | 排除，需补足上游证据 |

本次没有任何技能目录满足完整纳入条件，因此公开快照不含 `.agents/`。这不等于断言上游禁止再分发；结论仅为现有本地证据不足，不能猜测授权、添加虚构版权声明或用项目 MIT 替代。

如果后续希望纳入某个技能，需要先核实精确来源/版本、完整许可文本、版权通知及适用的再分发条件；有冲突或缺失时先向权利人确认。本轮不进行这些联网或授权操作。

## 本地清理范围

只移除三个已跟踪的 Python 编译缓存文件：

- `.agents/skills/ui-ux-pro-max/scripts/__pycache__/core.cpython-314.pyc`
- `.agents/skills/ui-ux-pro-max/scripts/__pycache__/design_system.cpython-314.pyc`
- `.agents/skills/ui-ux-pro-max/scripts/__pycache__/reasoning_contract.cpython-314.pyc`

其他技能文件保持原样，原仓库历史保持不变。公开快照使用明确的项目文件清单复制，不从原仓库复制 Git 历史。
