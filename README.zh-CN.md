<p align="center">
  <img src="https://unpkg.com/@each1024/pi-jev-reply@0.1.4/assets/hero.png" alt="回复经过清晰度检查" width="100%" />
</p>

<h1 align="center">Pi Jev Reply</h1>

<p align="center">
  <strong>让 Pi 的最终回复更清楚——只在真的含糊时润色。</strong><br />
  Jev 先判断；确有必要时再由你选定的模型改写。改完即用，不再复查。
</p>

<p align="center">
  <a href="#安装">安装</a> · <a href="#工作流">工作流</a> · <a href="#设置">设置</a> · <a href="#隐私与成本">隐私</a> · <a href="README.md">English</a>
</p>

> **它是什么：** 一个 Pi TUI 扩展。每次助手回复结束后，它会检查黑话、未解释的缩写和含糊表述；必要时还会补一个小型静态图表。

## 安装

```bash
npm_config_registry=https://registry.npmjs.org pi install npm:@each1024/pi-jev-reply
```

在 Pi 执行 `/reload`。首次会话会打开设置页完成初始化。之后用 `/pi-jev-reply` 打开同一页面（`/clear-reply` 仍可用）。需要 Pi `>= 0.85.1`、Node `>= 22.18.0` 和 Jev API key。

首次安装会按系统语言环境自动写入 `clear-reply.json` 的设置界面语言（`zh*` → `zh-CN`，否则 `en`），并打开一次设置页。已有配置文件不会被改写语言。

## 工作流

<p align="center">
  <img src="https://unpkg.com/@each1024/pi-jev-reply@0.1.4/assets/workflow.svg" alt="两阶段回复清晰度工作流" width="760" />
</p>

| 阶段 | 负责者 | 结果 |
| --- | --- | --- |
| **审查** | Jev | 判断是否需要澄清表述或补视觉内容。 |
| **编辑** | 默认当前主模型 | 改写回复，和／或加入紧凑的静态视觉内容，然后直接展示。 |

任一步失败、超时或输出不合规时，插件都会保留原始回复；不会陷入自动重试循环。结构检查仍会拒绝改掉数字、丢路径／命令的结果。

用户明确要求流程图／表格／图表，或明确不要图时，会覆盖 Jev 的不确定结果，避免同请求忽有忽无。

## 它会做什么，不会做什么

| 可以改善 | 明确不会做 |
| --- | --- |
| 黑话、缩写缺少解释、上下文缺失、结论含糊 | 编造事实，把检查说成安全保障，或在失败时静默替换原稿 |
| 有帮助时增加 Markdown 表格、Mermaid `flowchart TD` 或文本数据图 | 生成 Canvas、HTML、SVG、JavaScript、外部嵌入或交互图表 |
| 使用当前 Pi 主模型，或设置中指定 `provider/model` | 硬编码 provider，或强制使用名为 `loop` 的模型 |

## 命令

```text
/pi-jev-reply                 打开本地设置页
/pi-jev-reply on | off        开关处理并立即保存
/pi-jev-reply status          查看开关、Jev key 和当前模型
```

设置保存后立即生效，无需重启或再次 `/reload`。

## 按需启动的设置页

<p align="center">
  <img src="https://unpkg.com/@each1024/pi-jev-reply@0.1.4/assets/settings.png" alt="按需启动的本地设置服务" width="720" />
</p>

双语（`en` / `zh-CN`）HTML 设置页只在需要时运行：

- 仅绑定 `127.0.0.1`，每次启动随机 token，并有 Host/Origin 校验、CSP 和请求体限制；
- 只有执行设置命令才启动；闲置时没有监听、轮询或心跳；
- 默认五分钟无有效请求自动关闭，下次打开重新启动；
- ETag/`If-Match` 防止旧页面覆盖新设置，写入采用原子替换。

界面语言只影响设置页面，不会改变回复本身的语言。

## 配置与密钥

配置保存到 Pi agent 目录的 `clear-reply.json`（遵守 `PI_CODING_AGENT_DIR`）。开关、改写模型、改写／视觉选项、阈值、Jev 模型、超时、隐藏草稿、闲置时长和审查说明都可调整。

Jev key 按以下顺序读取：

1. `TYPESAFE_API_KEY`
2. `~/.config/typesafe/api_key`（建议权限 `600`）

不要把真实 token 放进提示词、示例、Issue 或源码。

## 隐私与成本

每个符合条件的回复，Jev 只收到：草稿、当前用户请求的前 2,000 个字符和自定义说明；不会发送完整对话或模型思考。明显的凭据会被跳过，但这不是完整的密钥扫描器。

**典型成本：**一次 Jev 审查；需要编辑时，再加一次所选模型调用。超长草稿会直接跳过，不截断发送。

## 边界

- 仅支持 Pi **TUI**；JSON、RPC、print 模式不会被改写。
- 隐藏流式草稿依赖 Pi 原生 Markdown transformer。mini-mode 等自定义 transcript renderer 仍可能显示之前的草稿。
- 它是清晰度辅助，不是事实、安全或风险保证。

## 开发

```bash
npm install
npm run check
npm test
```

MIT © eachann1024
