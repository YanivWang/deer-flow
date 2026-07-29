---
name: video-generation
description: 当用户请求生成、创建或构想视频时，使用此 skill。支持结构化提示词和参考图，用于引导生成。
---

# 视频生成 Skill

## 概述

此 skill 使用结构化提示词和 Python 脚本生成高质量视频。工作流包括创建 JSON 格式的提示词，并在可选参考图的辅助下执行视频生成。

## 核心能力

- 为 AIGC 视频生成创建结构化 JSON 提示词
- 支持将参考图作为视频的引导；在 MiniMax 路径中，第一张参考图会作为首帧
- 通过自动化 Python 脚本执行视频生成

## 工作流

### 步骤 1：理解需求

当用户请求生成视频时，识别：

- 主体/内容：视频画面中应该出现什么
- 风格偏好：艺术风格、氛围、色彩搭配
- 技术规格：宽高比、构图、光照
- 参考图：用于引导生成的任何图像
- 不需要检查 `/mnt/user-data` 下的文件夹

### 步骤 2：创建结构化提示词

在 `/mnt/user-data/workspace/` 中生成一个结构化 JSON 文件，命名模式为：`{descriptive-name}.json`

### 步骤 3：创建参考图（当 image-generation skill 可用时为可选）

为视频生成创建参考图。

- 如果只提供了 1 张图像，则将它作为视频的引导帧

### 步骤 4：执行生成

调用 Python 脚本：
```bash
python /mnt/skills/public/video-generation/scripts/generate.py \
  --prompt-file /mnt/user-data/workspace/prompt-file.json \
  --reference-images /path/to/ref1.jpg \
  --output-file /mnt/user-data/outputs/generated-video.mp4 \
  --aspect-ratio 16:9
```

参数：

- `--prompt-file`：JSON 提示词文件的绝对路径（必填）
- `--reference-images`：参考图的绝对路径（可选）
- `--output-file`：输出视频文件的绝对路径（必填）
- `--aspect-ratio`：生成视频的宽高比参数（可选，默认：16:9；MiniMax 路径会忽略该参数）

[!NOTE]
不要读取 Python 文件，而是直接使用参数调用它。

## 视频生成示例

用户请求："Generate a short video clip depicting the opening scene from 'The Chronicles of Narnia: The Lion, the Witch and the Wardrobe'"

步骤 1：在线搜索《纳尼亚传奇：狮子、女巫和魔衣橱》的开场场景

步骤 2：创建包含以下内容的 JSON 提示词文件：

```json
{
  "title": "The Chronicles of Narnia - Train Station Farewell",
  "background": {
    "description": "World War II evacuation scene at a crowded London train station. Steam and smoke fill the air as children are being sent to the countryside to escape the Blitz.",
    "era": "1940s wartime Britain",
    "location": "London railway station platform"
  },
  "characters": ["Mrs. Pevensie", "Lucy Pevensie"],
  "camera": {
    "type": "Close-up two-shot",
    "movement": "Static with subtle handheld movement",
    "angle": "Profile view, intimate framing",
    "focus": "Both faces in focus, background soft bokeh"
  },
  "dialogue": [
    {
      "character": "Mrs. Pevensie",
      "text": "You must be brave for me, darling. I'll come for you... I promise."
    },
    {
      "character": "Lucy Pevensie",
      "text": "I will be, mother. I promise."
    }
  ],
  "audio": [
    {
      "type": "Train whistle blows (signaling departure)",
      "volume": 1
    },
    {
      "type": "Strings swell emotionally, then fade",
      "volume": 0.5
    },
    {
      "type": "Ambient sound of the train station",
      "volume": 0.5
    }
  ]
}
```

步骤 3：使用 image-generation skill 生成参考图

加载 image-generation skill，并根据该 skill 生成一张参考图 `narnia-farewell-scene-01.jpg`。

步骤 4：使用 generate.py 脚本生成视频
```bash
python /mnt/skills/public/video-generation/scripts/generate.py \
  --prompt-file /mnt/user-data/workspace/narnia-farewell-scene.json \
  --reference-images /mnt/user-data/outputs/narnia-farewell-scene-01.jpg \
  --output-file /mnt/user-data/outputs/narnia-farewell-scene-01.mp4 \
  --aspect-ratio 16:9
```
> 不要读取 Python 文件，只需使用参数调用它。

## 输出处理

生成完成后：

- 视频通常保存在 `/mnt/user-data/outputs/`
- 使用 `present_files` 工具将生成的视频（放在首位）分享给用户；如果适用，也分享生成的图像
- 简要描述生成结果
- 如果需要调整，主动提出可以继续迭代

## 注意事项

- 无论用户使用什么语言，都始终使用英文编写提示词
- JSON 格式可确保提示词结构化且可解析
- 参考图能显著提升生成质量
- 为获得最佳结果，迭代优化是正常的

## Provider（Gemini / MiniMax）

根据环境变量自动选择（CLI 保持不变）：

- 设置了 `GEMINI_API_KEY` → Gemini Veo（默认，保持不变）。
- 仅设置了 `MINIMAX_API_KEY` → MiniMax 视频（`/v1/video_generation`，异步三步轮询/下载）。
- 使用 `VIDEO_GENERATION_PROVIDER=gemini|minimax` 强制指定。

MiniMax 覆盖项：`MINIMAX_API_HOST`（默认 `https://api.minimaxi.com`），
`MINIMAX_VIDEO_MODEL`（默认 `MiniMax-Hailuo-2.3`）。第一张参考图会被用作
MiniMax 的 `first_frame_image`。MiniMax 会忽略 `--aspect-ratio`（它使用 resolution/duration）。
