# Markdown Blog Preview

Markdown 文章排版发布插件，面向公众号、博客、知乎、Bilibili 等文章发布场景，提供实时预览、主题配置、代码高亮主题和内联样式复制能力。

## 功能亮点

- Markdown 实时预览，编辑与预览联动
- 复制为富文本 HTML，适配常见发布场景
- 正文主题 JSON 配置，可扩展、可复用
- 代码主题下拉，支持“默认”模式与内置代码高亮主题
- 外链转引用，可生成正文引用与文末 References
- 微信公众号适配，可修正列表与代码缩进等常见粘贴问题
- 行内代码样式可配置（`inlineCodeStyle`）
- 主题与代码主题选择自动记忆
- 正文支持无衬线/衬线切换
- 图床上传：支持按图床 ID 记录上传映射并自动替换预览图片 URL

## 使用方式

1. 打开 Markdown 文件。
2. 点击编辑器标题栏命令：`预览文章`。
3. 在预览页调整字号、字体、主题、代码主题。
4. 如需适配微信公众号等平台，可按需勾选 `外链转引用` 和 `微信公众号适配`。
5. 点击 `复制`，粘贴到目标发布平台。

如需图床上传：

1. 在设置中配置 `mdbp.imageHost.apiUrl` 与 `mdbp.imageHost.token`。
2. 在预览页选择图床，点击 `上传图片`。
3. 插件会把上传结果写入当前 Markdown 文件的 YAML front matter（按图床 ID 分组）。

说明：

- 当代码主题选择为 `默认` 时，插件不会额外改写代码高亮结构，适合目标平台本身会自动识别代码块的场景。
- 当代码主题选择为具体主题时，插件会将代码高亮以内联样式输出，适合微信等不依赖外部样式的场景。
- 当正文主题名称包含“微信”时，`外链转引用` 会默认启用，但可以手动关闭。
- 当正文主题名称包含“微信”时，`微信公众号适配` 也会默认启用，但可以手动关闭。

## 主题配置文件（JSON）

可以在 VS Code 设置里配置 `mdbp.themeConfigFiles`，填入一个或多个主题 JSON 文件路径。

- 支持工作区相对路径，如 `themes/wechat.json`
- 支持绝对路径，如 `E:/themes/wechat.json`

示例配置：

```json
"mdbp.themeConfigFiles": [
	"themes/wechat.json",
	"themes/minimal.json"
]
```

示例主题文件：

```json
{
	"name": "公众号简洁风",
	"contentFontSans": "-apple-system-font,BlinkMacSystemFont, Helvetica Neue, PingFang SC, Hiragino Sans GB, Microsoft YaHei UI, Microsoft YaHei, Arial, sans-serif",
	"contentFontSerif": "Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, 'PingFang SC', Cambria, Cochin, Georgia, Times, 'Times New Roman', serif",
	"fixedCodeFont": "Consolas, 'Liberation Mono', Menlo, Courier, monospace",
	"previewStyle": {
		"background": "#ffffff",
		"padding": "24px",
		"width": "375px",
		"boxShadow": "0 0 40px rgb(0 0 0 / 10%)"
	},
	"contentStyle": {
		"line-height": "1.9",
		"color": "#2f2f2f"
	},
	"elementStyles": {
		"h1": {
			"font-size": "26px"
		},
		"p": {
			"margin": "0.9em 0"
		}
	},
	"inlineCodeStyle": {
		"color": "#0f172a",
		"background": "#e2e8f0",
		"borderRadius": "4px",
		"padding": "2px 6px"
	}
}
```

说明：

- `themes/default.json` 是内置默认主题，未配置 `mdbp.themeConfigFiles` 时也会自动加载。
- `contentFontSans` 和 `contentFontSerif` 控制预览中的正文字体切换。
- `fixedCodeFont` 控制行内代码和代码块的字体族。
- `inlineCodeStyle` 控制行内代码的盒子样式。

主题会显示在预览页的“主题”下拉中，切换后立即生效。

内置正文主题：

- `themes/default.json`
- `themes/wechat.json`

## 代码主题配置文件（JSON）

可以在 VS Code 设置里配置 `mdbp.codeThemeConfigFiles`，填入一个或多个代码主题 JSON 文件路径。

- 支持工作区相对路径，如 `themes/code-themes/github-light.json`
- 支持绝对路径

示例配置：

```json
"mdbp.codeThemeConfigFiles": [
	"themes/code-themes/github-light.json",
	"themes/code-themes/monokai.json"
]
```

示例代码主题文件：

```json
{
	"name": "GitHub Light",
	"blockStyle": {
		"background": "#f6f8fa",
		"border": "1px solid #eaeef2",
		"border-radius": "6px"
	},
	"codeStyle": {
		"color": "#24292f",
		"font-size": "13px",
		"line-height": "1.7"
	},
	"tokenStyles": {
		".hljs-keyword": {
			"color": "#d73a49",
			"font-weight": "600"
		},
		".hljs-string": {
			"color": "#032f62"
		},
		".hljs-comment": {
			"color": "#6a737d",
			"font-style": "italic"
		}
	}
}
```

内置代码主题：

- `themes/code-themes/github-light.json`
- `themes/code-themes/monokai.json`
- `themes/code-themes/vscode-dark.json`

## 图床配置与 YAML 结构

新增配置项：

```json
"mdbp.imageHost.apiUrl": "http://localhost:5269",
"mdbp.imageHost.token": "your-token"
```

说明：

- 当上述两项都已配置时，预览页面会显示图床下拉和上传按钮。
- 上传时会扫描正文中的本地图片（Markdown 图片与 HTML `img`）以及 front matter 的 `cover` 字段。
- 已上传映射会写入 `mdbp.imageHosts.<hostId>`，渲染时若选择对应图床会自动替换为远程 URL。

示例 front matter：

```yaml
---
title: 示例文章
cover: ./images/cover.png
mdbp:
	imageHosts:
		wechat:
			images:
				./images/a.png:
					imageUrl: https://example.com/a.png
					imageId: MEDIA_ID_A
					uploadedAt: 2026-03-08T10:00:00.000Z
			cover:
				localPath: ./images/cover.png
				imageUrl: https://example.com/cover.png
				imageId: MEDIA_ID_COVER
				uploadedAt: 2026-03-08T10:00:00.000Z
---
```

## 外链转引用

勾选 `外链转引用` 后：

- 除 `mp.weixin.qq.com` 外的普通外链会转换为正文中的引用编号
- 链接文本本身等于 URL 的链接不会转换
- 文末会自动追加 `References` 区块
- 正文引用文本仍会继承当前主题中的链接样式

## 微信公众号适配

勾选 `微信公众号适配` 后：

- 会修正列表项中的块级内容结构，减少粘贴到公众号编辑器后的错位
- 会把代码行首缩进转换为不间断空格，避免公众号吞掉缩进
- 当正文主题名称包含“微信”时，该选项默认启用，但仍可手动关闭