<p align="center">
  <img src="https://raw.githubusercontent.com/eachann1024/pi-jev-reply/main/assets/hero.png" alt="直白改写的前后对比示意" width="100%" />
</p>

*仅为示意：用直白措辞替换行话。编辑失败或未通过校验时，保留原始回复。*

# Pi Jev Reply

**少一点行话，多一点清晰。** 为 Pi 终端回复做最后一道润色。

它会把回复改写得更直白，也可以添加一张小型图表，并使用你选择的模型。编辑失败时，原始回复保持不变。

[English](https://github.com/eachann1024/pi-jev-reply/blob/main/README.md)

## 演示视频

<video src="https://github.com/user-attachments/assets/78a21dfa-8221-49ff-9c81-cfe0682ce04b" controls muted playsinline width="100%"></video>

▶ 63 秒演示视频： [点击观看](https://github.com/eachann1024/pi-jev-reply/blob/main/docs/media/pi-jev-reply-best-zh.mp4)

## 一分钟开始

```bash
pi install npm:@each1024/pi-jev-reply
```

在 Pi 中执行 `/reload`。**首次进入交互会话**时会自动打开英文欢迎页。点击 **Open settings**，调整偏好并保存，更改立即生效。

- **默认英文。** 可在设置中切换到中文；已有的语言偏好不会被覆盖。
- **默认使用当前模型。** 没有 Jev 密钥时，扩展会直接使用当前 Pi 模型润色。
- **设置后保持安静。** 引导只自动打开一次，之后可用 `/pi-jev-reply-setting welcome` 重新查看。

需要 Pi ≥ 0.85.1 和 Node ≥ 22.18.0。只有交互式 TUI 会打开浏览器，RPC 和打印模式不会。

## 从草稿到清晰回复

| 检查 | 润色 | 返回 |
| --- | --- | --- |
| 配置密钥后，由 Jev 判断编辑是否有帮助。 | 当前或所选模型理清措辞，并可能添加小表格、流程图或文字图表。 | 修改后的回复替换草稿。编辑失败或未通过校验时，保留原文。 |

没有 Jev 密钥时，已启用的改写会直接交给所选模型，不再进行第二轮检查。结构检查会拒绝丢失命令、路径或改动数字的编辑，但不保证事实准确。

## 按你的习惯设置

<p align="center">
  <img src="https://raw.githubusercontent.com/eachann1024/pi-jev-reply/main/assets/settings.png" alt="模型、改写和图表偏好的功能示意" width="720" />
</p>

*功能示意，不是界面截图。可使用当前 Pi 模型或另选模型，再调整改写、图表和自定义指令。*

```text
/pi-jev-reply-setting             打开设置
/pi-jev-reply-setting welcome     重新打开欢迎引导
/pi-jev-reply-setting on | off    启用或停用
/pi-jev-reply-setting status      查看模型和 Jev 密钥状态
```

可以选择模型、控制改写和图表，并自定义指令。本地设置服务只在首次引导或主动打开时启动，默认闲置五分钟后关闭。旧命令 `/clear-reply` 仍可使用。

设置保存在 Pi agent 目录的 `clear-reply.json` 中，并遵循 `PI_CODING_AGENT_DIR`。升级不会重置现有设置。切换语言也会更换内置润色指令，因此保存前请检查自定义指令。

## 隐私与费用

- **Jev 可选。** 设置 `TYPESAFE_API_KEY`，或将密钥写入 `~/.config/typesafe/api_key`，建议权限为 `600`。不要把密钥放入对话或代码仓库。
- **离开本机的内容：** 检查时发送草稿、当前请求的前 2,000 个字符和自定义指令，不发送完整对话或模型思考过程。编辑时向所选模型发送草稿和请求。
- **调用次数：** 配置密钥后进行一次 Jev 检查；需要编辑时再调用一次模型。没有 Jev 时，已启用的改写调用一次模型。
- **本地保护：** 仅监听本机地址，每次启动使用独立令牌，并校验请求来源、防止旧页面覆盖较新设置。敏感信息检测只是尽力识别，不是完整扫描。

隐藏草稿依赖 Pi 原生渲染器；自定义渲染器仍可能显示流式草稿。图表是静态 Markdown、Mermaid 或文字，不会生成交互式页面。

## 开发

```bash
npm install
npm run check
npm test
```

MIT © eachann1024
