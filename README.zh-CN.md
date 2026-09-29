<p align="center">
  <img src="https://unpkg.com/@each1024/pi-jev-reply@0.9.2/assets/hero.png" alt="回复穿过清晰之门" width="100%" />
</p>

# Pi Jev Reply

**少一点黑话，多一点清晰。** 为 Pi 终端回复做最后一道润色。

直白改写、可选的小型图表、自由选择模型。编辑失败时保留原文。

[English](https://github.com/eachann1024/pi-jev-reply/blob/main/README.md)

## 一分钟开始

```bash
pi install npm:@each1024/pi-jev-reply
```

在 Pi 中执行 `/reload`。**首次进入交互会话**会自动打开英文欢迎页，点击 **Open settings** 调整并保存，即刻生效。

- **默认英文：** 设置中可切换中文；已有语言偏好不会被覆盖。
- **默认使用主模型：** 不配置 Jev 密钥也能直接使用当前 Pi 模型润色。
- **只自动打开一次：** 此后保持安静，可用 `/pi-jev-reply welcome` 重看引导。

需要 Pi ≥ 0.85.1、Node ≥ 22.18.0。仅支持交互式 TUI；RPC 和打印模式不会打开浏览器。

## 从草稿到清晰回复

<p align="center">
  <img src="https://unpkg.com/@each1024/pi-jev-reply@0.9.2/assets/workflow.svg" alt="Jev 检查，所选模型编辑" width="760" />
</p>

| 检查 | 润色 | 展示 |
| --- | --- | --- |
| 有密钥时，由 Jev 判断是否需要编辑。 | 当前或指定模型改写措辞，可添加小表格、流程图或文字图表。 | 展示新回复；失败或无效编辑保留原文。 |

无 Jev 密钥时，启用的改写直接交给所选模型。不进行第二轮复检。结构检查会拒绝丢失命令、路径或改变数字的编辑，但不保证事实正确。

## 按你的习惯设置

<p align="center">
  <img src="https://unpkg.com/@each1024/pi-jev-reply@0.9.2/assets/settings.png" alt="按需开启的本地设置" width="720" />
</p>

```text
/pi-jev-reply             打开设置
/pi-jev-reply welcome     重看新手引导
/pi-jev-reply on | off    开启或关闭
/pi-jev-reply status      查看模型和密钥状态
```

选择模型、开关改写和图表、自定义指令。本地服务仅在首次引导或主动打开时启动，默认闲置五分钟关闭。旧命令 `/clear-reply` 仍可使用。

配置保存在 Pi agent 目录的 `clear-reply.json`，支持 `PI_CODING_AGENT_DIR`。升级不重置现有配置。切换语言也会调整内置润色指令，保存前请检查自定义内容。

## 隐私与费用

- **Jev 可选：** 设置 `TYPESAFE_API_KEY`，或将密钥写入 `~/.config/typesafe/api_key`（建议权限 `600`）。不要把密钥放进对话或代码仓库。
- **发送内容：** Jev 接收草稿、当前请求最多 2,000 字符和自定义指令，不接收完整对话或思考过程；编辑模型接收草稿和请求。
- **调用次数：** 有密钥时一次 Jev 检查，需要编辑时再调用一次模型；无密钥时启用的改写调用一次模型。
- **本地保护：** 仅监听本机地址，使用临时令牌、来源校验和旧版本保存保护。敏感信息检测不等同于完整扫描。

隐藏草稿依赖 Pi 原生渲染器，自定义渲染器仍可能显示流式草稿。图表为静态 Markdown、Mermaid 或文字，不生成交互网页。

## 开发

```bash
npm install
npm run check
npm test
```

MIT © eachann1024
