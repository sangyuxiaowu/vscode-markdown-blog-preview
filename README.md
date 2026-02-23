# Markdown Blog Preview

Markdown 文章排版发布插件，面向 公众号/博客/知乎/Bilibili 文章排版场景，提供「实时预览 + 主题配置 + 内联样式复制」能力。

## 功能亮点

- Markdown 实时预览（编辑与预览联动）
- 复制为富文本 HTML（适配发布场景）
- 主题 JSON 配置（可扩展、可复用）
- 行内代码样式可配置（`inlineCodeStyle`）
- 代码字体固定，正文支持无衬线/衬线切换

## 使用方式

1. 打开 Markdown 文件。
2. 点击编辑器标题栏命令：`预览文章`。
3. 在预览页调整字号、字体、主题。
4. 点击 `复制`，粘贴到目标发布平台。

## 主题配置文件（JSON）

可以在 VS Code 设置里配置 `mdbp.themeConfigFiles`，填入一个或多个主题 JSON 文件路径。

- 支持工作区相对路径（如 `themes/wechat.json`）
- 支持绝对路径（Windows 如 `E:/themes/wechat.json`）

示例配置（设置项）：

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

仓库内已提供默认主题文件：`themes/default.json`，可直接添加到 `mdbp.themeConfigFiles` 使用。