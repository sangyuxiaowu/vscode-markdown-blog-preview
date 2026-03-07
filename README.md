# Markdown Blog Preview

Markdown 文章排版发布插件，面向公众号、博客、知乎、Bilibili 等文章发布场景，提供实时预览、主题配置、代码高亮主题和内联样式复制能力。

## 功能亮点

- Markdown 实时预览，编辑与预览联动
- 复制为富文本 HTML，适配常见发布场景
- 正文主题 JSON 配置，可扩展、可复用
- 代码主题下拉，支持“默认”模式与内置代码高亮主题
- 外链转引用，可生成正文引用与文末 References
- 行内代码样式可配置（`inlineCodeStyle`）
- 主题与代码主题选择自动记忆
- 正文支持无衬线/衬线切换

## 使用方式

1. 打开 Markdown 文件。
2. 点击编辑器标题栏命令：`预览文章`。
3. 在预览页调整字号、字体、主题、代码主题。
4. 如需适配微信公众号等平台，可勾选 `外链转引用`。
5. 点击 `复制`，粘贴到目标发布平台。

说明：

- 当代码主题选择为 `默认` 时，插件不会额外改写代码高亮结构，适合目标平台本身会自动识别代码块的场景。
- 当代码主题选择为具体主题时，插件会将代码高亮以内联样式输出，适合微信等不依赖外部样式的场景。
- 当正文主题名称包含“微信”时，`外链转引用` 会默认启用，但可以手动关闭。

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

## 外链转引用

勾选 `外链转引用` 后：

- 除 `mp.weixin.qq.com` 外的普通外链会转换为正文中的引用编号
- 链接文本本身等于 URL 的链接不会转换
- 文末会自动追加 `References` 区块
- 正文引用文本仍会继承当前主题中的链接样式