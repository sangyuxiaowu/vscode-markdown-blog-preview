(function () {
    // 样式与主题相关能力：主题解析、样式对象处理、内联样式应用
    const app = window.mdbpApp;
    if (!app) {
        return;
    }

    // 规范化样式对象，确保所有属性值都是字符串
    function normalizeStyleObject(style) {
        if (!style || typeof style !== "object") {
            return {};
        }

        const result = {};
        Object.entries(style).forEach(([key, value]) => {
            if (typeof value === "string") {
                result[key] = value;
            }
        });
        return result;
    }

    // 合并两个样式对象，后者覆盖前者
    function mergeStyleObject(baseStyle, overrideStyle) {
        return {
            ...normalizeStyleObject(baseStyle),
            ...normalizeStyleObject(overrideStyle)
        };
    }

    // 合并嵌套的样式对象，如 elementStyles.a、elementStyles.blockquote 等，后者覆盖前者
    function mergeNestedStyleObject(baseStyle, overrideStyle) {
        const base = baseStyle && typeof baseStyle === "object" ? baseStyle : {};
        const override = overrideStyle && typeof overrideStyle === "object" ? overrideStyle : {};
        const selectors = new Set([...Object.keys(base), ...Object.keys(override)]);
        const result = {};

        selectors.forEach((selector) => {
            const merged = mergeStyleObject(base[selector], override[selector]);
            if (Object.keys(merged).length > 0) {
                result[selector] = merged;
            }
        });

        return result;
    }

    // 将样式对象转换为 CSS 文本
    function styleObjectToCss(style) {
        const entries = Object.entries(normalizeStyleObject(style));
        if (entries.length === 0) {
            return "";
        }
        return entries.map(([key, value]) => `${key}: ${value};`).join(" ");
    }

    // 追加内联样式到元素
    function appendInlineStyle(target, styleText) {
        if (!styleText) {
            return;
        }
        target.style.cssText = `${target.style.cssText}; ${styleText}`;
    }

    // 直接应用样式对象到元素
    function applyStyleMap(target, style) {
        appendInlineStyle(target, styleObjectToCss(style));
    }

    // 获取解析后的主题，合并默认主题和选定主题的样式
    function getResolvedTheme(themeId = app.state.selectedThemeId) {
        const defaultTheme = app.findThemeById("default") || app.state.currentThemes[0];
        const selectedTheme = app.findThemeById(themeId) || defaultTheme;
        if (!defaultTheme && !selectedTheme) {
            return undefined;
        }

        return {
            ...defaultTheme,
            ...selectedTheme,
            previewStyle: mergeStyleObject(defaultTheme?.previewStyle, selectedTheme?.previewStyle),
            contentStyle: mergeStyleObject(defaultTheme?.contentStyle, selectedTheme?.contentStyle),
            elementStyles: mergeNestedStyleObject(defaultTheme?.elementStyles, selectedTheme?.elementStyles),
            inlineCodeStyle: mergeStyleObject(defaultTheme?.inlineCodeStyle, selectedTheme?.inlineCodeStyle),
            contentFontSans: selectedTheme?.contentFontSans || defaultTheme?.contentFontSans,
            contentFontSerif: selectedTheme?.contentFontSerif || defaultTheme?.contentFontSerif,
            fixedCodeFont: selectedTheme?.fixedCodeFont || defaultTheme?.fixedCodeFont
        };
    }

    // 根据当前字体选项返回正文使用的字体族
    function getSelectedFontFamily(theme = getResolvedTheme()) {
        return app.refs.fontFamilySelect.value === "serif"
            ? (theme?.contentFontSerif || "")
            : (theme?.contentFontSans || "");
    }

    // 为指定选择器匹配到的节点统一追加字体族样式
    function applyFontFamily(root, selector, fontFamily) {
        root.querySelectorAll(selector).forEach((node) => {
            appendInlineStyle(node, `font-family: ${fontFamily};`);
        });
    }

    // 为指定选择器匹配到的节点统一追加字号样式
    function applyFontSizeStyle(root, selector, fontSize) {
        root.querySelectorAll(selector).forEach((node) => {
            appendInlineStyle(node, `font-size: ${fontSize}px;`);
        });
    }

    // 按主题配置对各类元素选择器应用样式
    function applyThemeElementStyles(root, elementStyles) {
        if (!elementStyles || typeof elementStyles !== "object") {
            return;
        }

        Object.entries(elementStyles).forEach(([selector, styleMap]) => {
            if (!selector) {
                return;
            }
            root.querySelectorAll(selector).forEach((node) => {
                applyStyleMap(node, styleMap);
            });
        });

        if (elementStyles.a) {
            root.querySelectorAll("[data-mdbp-link-text]").forEach((node) => {
                applyStyleMap(node, elementStyles.a);
            });
        }
    }

    // 为块级代码和内联代码统一应用等宽字体
    function applyCodeFontFamily(root, theme = getResolvedTheme()) {
        if (!theme?.fixedCodeFont) {
            return;
        }

        applyFontFamily(root, "pre > code", theme.fixedCodeFont);
        applyFontFamily(root, "code:not(pre > code)", theme.fixedCodeFont);
    }

    // 根据当前代码主题，为代码块和高亮 token 应用样式
    function applyCodeThemeStyles(root, codeThemeId = app.state.selectedCodeThemeId) {
        const codeTheme = app.findCodeThemeById(codeThemeId);
        if (!codeTheme) {
            return;
        }

        root.querySelectorAll("[data-mdbp-code-block]").forEach((node) => {
            applyStyleMap(node, codeTheme.blockStyle);
        });
        root.querySelectorAll("[data-mdbp-code-content]").forEach((node) => {
            applyStyleMap(node, codeTheme.codeStyle);
        });

        const tokenStyles = codeTheme.tokenStyles;
        if (!tokenStyles || typeof tokenStyles !== "object") {
            return;
        }

        Object.entries(tokenStyles).forEach(([selector, styleMap]) => {
            if (!selector) {
                return;
            }
            root.querySelectorAll(selector).forEach((node) => {
                applyStyleMap(node, styleMap);
            });
        });
    }

    // 将主题、字号、字体等样式全部转换为内联样式，生成最终可复制 DOM
    function applyInlineThemeAndTypography(container, options = {}) {
        const theme = getResolvedTheme(options.themeId);
        const rootFontFamily = options.fontFamily || getSelectedFontFamily(theme);
        const fontSize = options.fontSize || app.refs.fontSizeSelect.value;

        const root = document.createElement("div");
        root.innerHTML = container.innerHTML;

        // 去除所有 style 和 script 标签
        root.querySelectorAll("style, script").forEach((node) => {
            node.remove();
        });

        // 根节点追加基础样式，不会复制
        appendInlineStyle(root, `font-family: ${rootFontFamily};`);
        appendInlineStyle(root, `font-size: ${fontSize}px;`);
        appendInlineStyle(root, "line-height: 1.8;");
        appendInlineStyle(root, "color: #2f2f2f;");
        appendInlineStyle(root, "word-break: break-word;");
        applyStyleMap(root, theme?.contentStyle);

        // 各类元素追加主题样式、字体和字号，生成最终内容
        applyFontFamily(root, "p, li, blockquote, td, th", rootFontFamily);
        applyFontSizeStyle(root, "p, li, blockquote, td, th", fontSize);
        applyFontFamily(root, "h1, h2, h3, h4, h5, h6, a, strong, em", rootFontFamily);
        applyThemeElementStyles(root, theme?.elementStyles);
        applyCodeFontFamily(root, theme);
        applyCodeThemeStyles(root, options.codeThemeId);

        return root;
    }

    app.renderStyle = {
        normalizeStyleObject,
        mergeStyleObject,
        mergeNestedStyleObject,
        styleObjectToCss,
        appendInlineStyle,
        applyStyleMap,
        getResolvedTheme,
        getSelectedFontFamily,
        applyFontFamily,
        applyFontSizeStyle,
        applyThemeElementStyles,
        applyCodeFontFamily,
        applyCodeThemeStyles,
        applyInlineThemeAndTypography
    };
})();