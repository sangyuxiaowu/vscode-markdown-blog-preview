(function () {
    // 渲染入口：串联内容变换、主题排版和剪贴板复制能力
    const app = window.mdbpApp;
    if (!app || !app.renderStyle || !app.renderTransform || !app.renderOptions) {
        return;
    }

    // 切换主题并刷新预览区域的字号与样式
    function applyTheme(themeId) {
        app.state.selectedThemeId = themeId;
        const theme = app.renderStyle.getResolvedTheme(themeId);

        const previewStyle = app.renderStyle.normalizeStyleObject(theme?.previewStyle);
        Object.assign(app.refs.previewInfo.style, previewStyle);

        applyFontSize(app.refs.fontSizeSelect.value);
    }

    // 校验字号输入，合法时重新渲染预览
    function applyFontSize(fontSize) {
        if (app.renderOptions.parseFontSize(fontSize) === null) {
            return;
        }
        if (app.state.latestMarkdownHtml) {
            renderMarkdownToPreview(app.state.latestMarkdownHtml);
        }
    }

    // 将 Markdown 转换后的 HTML 渲染到预览区域，并生成可复制的最终内容
    function renderMarkdownToPreview(rawHtml) {
        if (!rawHtml) {
            app.view.shadowView.innerHTML = "";
            app.state.latestRenderedInlineHtml = "";
            return;
        }

        const container = document.createElement("div");
        container.innerHTML = rawHtml;
        const theme = app.renderStyle.getResolvedTheme();

        // 代码预处理
        app.renderTransform.applyCodeBlockFormat(container, theme);

        // 外链转引用，可选项。提前标记 data-mdbp-link-text，供后续样式使用
        if (app.refs.linkReferenceCheckbox.checked) {
            app.renderTransform.convertExternalLinksToReferences(container);
        }

        // 图片添加题注
        container.querySelectorAll("img").forEach((img) => {
            app.renderTransform.wrapImageWithCaption(img);
        });

        const resultRoot = app.renderStyle.applyInlineThemeAndTypography(container);

        // 微信公众号适配
        if (app.refs.wechatAdaptationCheckbox.checked) {
            app.renderTransform.applyFinalWechatStructure(resultRoot);
        }
        app.state.latestRenderedInlineHtml = resultRoot.innerHTML;
        app.view.shadowView.innerHTML = "";
        app.view.shadowView.appendChild(resultRoot);
    }

    // 将当前预览内容同时以 HTML 和纯文本写入剪贴板
    async function copyPreviewContent() {
        const html = app.state.latestRenderedInlineHtml || app.view.shadowView.innerHTML;
        const plainText = app.view.shadowView.textContent || "";

        if (!html || !html.trim()) {
            return false;
        }

        if (!navigator.clipboard || !window.ClipboardItem) {
            return false;
        }

        try {
            const item = new ClipboardItem({
                "text/html": new Blob([html], { type: "text/html" }),
                "text/plain": new Blob([plainText], { type: "text/plain" })
            });
            await navigator.clipboard.write([item]);
            return true;
        } catch {
            return false;
        }
    }

    app.render = {
        applyTheme,
        // 设置主题下拉框选项并同步当前主题状态
        setThemeOptions(themes, nextSelectedThemeId) {
            app.renderOptions.setThemeOptions(themes, nextSelectedThemeId, applyTheme);
        },
        setCodeThemeOptions,
        applyFontSize,
        setImageHostOptions,
        renderMarkdownToPreview,
        copyPreviewContent
    };

    function setCodeThemeOptions(codeThemes, nextSelectedCodeThemeId) {
        app.renderOptions.setCodeThemeOptions(codeThemes, nextSelectedCodeThemeId);
    }

    function setImageHostOptions(enabled, hosts, nextSelectedHostId) {
        app.renderOptions.setImageHostOptions(enabled, hosts, nextSelectedHostId);
    }
})();
