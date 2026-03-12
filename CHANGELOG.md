# Change Log

All notable changes to the "markdown-blog-preview" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.3.1] - 2026-03-12

- 新增微信公众号草稿上传能力，支持在微信主题下直接新增或更新草稿
- 新增 `mdbp.wxDraftMediaId` 持久化，后续上传自动走草稿更新接口
- 新增封面图 `coverMediaId` 记录，用于微信公众号草稿封面素材 ID
- 优化图床上传流程，上传草稿前会按当前选中的图床和水印自动补传图片
- 优化微信公众号适配，修复列表和代码块在微信后台中的兼容问题

## [1.2.0] - 2026-03-11

- 新增图床配置与上传流程，支持按图床 ID 持久化图片映射并在预览中自动替换图片 URL
- 新增 `mdbp.imageHost.apiUrl` 与 `mdbp.imageHost.token` 配置项
- 新增微信公众号适配选项，修正列表结构与代码缩进等常见粘贴问题
- 新增行内代码样式配置 `inlineCodeStyle`
- 优化主题行为，微信主题默认启用“外链转引用”和“微信公众号适配”，且支持手动覆盖
- 优化预览侧前端代码结构，拆分渲染、样式、内容变换与选项同步逻辑，降低维护成本

## [1.1.0] - 2026-03-07

- 新增代码主题下拉，支持默认模式与内置代码高亮主题
- 新增 `mdbp.codeThemeConfigFiles` 配置项，支持代码主题 JSON 扩展
- 新增外链转引用能力，可生成正文引用与文末 References
- 新增主题与代码主题选择记忆，重新打开预览后自动恢复
- 优化预览页设置区布局，调整为双排显示

## [0.0.1] - 2026-02-23

- 首版发布
- 支持 Markdown 实时预览
- 支持富文本复制
- 支持主题 JSON 配置（含默认主题）