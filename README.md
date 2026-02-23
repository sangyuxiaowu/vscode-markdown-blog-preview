# markdown 文章发布预览工具

## 开发环境要求

- VS Code: `>= 1.109`
- Node.js: `>= 18`（由新版测试依赖链要求）
- 包管理器：建议使用 `cnpm`

## 常用命令

- `cnpm install`
- `cnpm test`
- `cnpm run watch`

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