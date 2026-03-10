(function () {
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
    function getSelectedFontFamily() {
        const theme = getResolvedTheme();
        return app.refs.fontFamilySelect.value === "serif"
            ? (theme?.contentFontSerif || "")
            : (theme?.contentFontSans || "");
    }

    // 解析并校验 http/https 链接，非法或非网页链接返回 null
    function parseHttpUrl(href) {
        try {
            const parsedUrl = new URL(href);
            if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
                return parsedUrl;
            }
            return null;
        } catch {
            return null;
        }
    }

    // 判断链接是否需要转换为参考文献脚注
    function shouldConvertLink(anchor) {
        const href = (anchor.getAttribute("href") || "").trim();
        if (!href) {
            return false;
        }

        const parsedUrl = parseHttpUrl(href);
        if (!parsedUrl) {
            return false;
        }

        if (parsedUrl.hostname.toLowerCase() === "mp.weixin.qq.com") {
            return false;
        }

        const linkText = (anchor.textContent || "").replace(/\s+/g, " ").trim();
        return Boolean(linkText) && linkText !== href;
    }

    // 用给定数据重新填充下拉框选项
    function populateSelectOptions(select, items) {
        select.innerHTML = "";
        items.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.name;
            select.appendChild(option);
        });
    }

    // 在可选项中解析最终选中的 id，不合法时退回默认值
    function resolveSelectedId(items, preferredId, fallbackId) {
        if (typeof preferredId === "string" && preferredId && items.some((item) => item.id === preferredId)) {
            return preferredId;
        }

        return fallbackId;
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
    function applyCodeFontFamily(root) {
        const theme = getResolvedTheme();
        if (!theme?.fixedCodeFont) {
            return;
        }

        applyFontFamily(root, "pre > code", theme.fixedCodeFont);
        applyFontFamily(root, "code:not(pre > code)", theme.fixedCodeFont);
    }

    // 切换主题并刷新预览区域的字号与样式
    function applyTheme(themeId) {
        app.state.selectedThemeId = themeId;
        const theme = getResolvedTheme(themeId);

        const previewStyle = normalizeStyleObject(theme?.previewStyle);
        Object.assign(app.refs.previewInfo.style, previewStyle);

        applyFontSize(app.refs.fontSizeSelect.value);
    }

    // 设置主题下拉框选项并同步当前主题状态
    function setThemeOptions(themes, nextSelectedThemeId) {
        app.state.currentThemes = Array.isArray(themes) ? themes : [];

        if (app.state.currentThemes.length === 0) {
            app.state.currentThemes = [{ id: "default", name: "默认" }];
        }

        populateSelectOptions(app.refs.themeSelect, app.state.currentThemes);

        app.state.selectedThemeId = resolveSelectedId(
            app.state.currentThemes,
            nextSelectedThemeId || app.state.selectedThemeId,
            app.state.currentThemes[0].id
        );

        app.refs.themeSelect.value = app.state.selectedThemeId;
        applyTheme(app.state.selectedThemeId);
        app.syncLinkReferenceCheckbox(app.state.selectedThemeId);
        app.syncWechatAdaptationCheckbox(app.state.selectedThemeId);
    }

    // 设置代码主题下拉框选项并同步当前代码主题状态
    function setCodeThemeOptions(codeThemes, nextSelectedCodeThemeId) {
        app.state.currentCodeThemes = Array.isArray(codeThemes) ? codeThemes : [];
        const allOptions = [{ id: "default", name: "默认" }, ...app.state.currentCodeThemes];

        populateSelectOptions(app.refs.codeThemeSelect, allOptions);

        app.state.selectedCodeThemeId = resolveSelectedId(
            allOptions,
            nextSelectedCodeThemeId || app.state.selectedCodeThemeId,
            "default"
        );

        app.refs.codeThemeSelect.value = app.state.selectedCodeThemeId;
    }

    // 校验字号输入，合法时重新渲染预览
    function applyFontSize(fontSize) {
        const parsed = Number(fontSize);
        if (Number.isNaN(parsed) || parsed <= 0) {
            return;
        }
        if (app.state.latestMarkdownHtml) {
            renderMarkdownToPreview(app.state.latestMarkdownHtml);
        }
    }

    // 设置图床相关控件状态，并同步当前选中的图床配置
    function setImageHostOptions(enabled, hosts, nextSelectedHostId) {
        app.state.isImageHostEnabled = Boolean(enabled);
        app.refs.imageHostRow.style.display = app.state.isImageHostEnabled ? "flex" : "none";
        app.syncSettingsHeight();

        const hostItems = Array.isArray(hosts) ? hosts : [];
        populateSelectOptions(app.refs.imageHostSelect, hostItems.map((host) => ({
            id: host.id,
            name: host.name || host.id
        })));

        if (!app.state.isImageHostEnabled || hostItems.length === 0) {
            app.state.selectedImageHostId = "";
            app.setUploadButtonEnabled(false);
            app.updateWebviewState();
            return;
        }

        app.state.selectedImageHostId = resolveSelectedId(
            hostItems,
            nextSelectedHostId || app.state.selectedImageHostId,
            hostItems[0].id
        );

        app.refs.imageHostSelect.value = app.state.selectedImageHostId;
        app.setUploadButtonEnabled(true);
        app.updateWebviewState();
    }

    // 为常见基础元素补齐兜底内联样式，避免在目标平台丢失表现
    function applyBaseInlineStyles(root) {
        root.querySelectorAll("*").forEach((node) => {
            if (node.closest("[data-mdbp-code-block]")) {
                return;
            }
            appendInlineStyle(node, "word-break: break-word;");
        });

        root.querySelectorAll("img").forEach((img) => {
            appendInlineStyle(img, "max-width: 100%; height: auto;");
        });
        root.querySelectorAll("table").forEach((table) => {
            appendInlineStyle(table, "width: 100%; border-collapse: collapse; margin: 1em 0;");
        });
        root.querySelectorAll("th, td").forEach((cell) => {
            appendInlineStyle(cell, "border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left;");
        });
        root.querySelectorAll("blockquote").forEach((blockquote) => {
            appendInlineStyle(blockquote, "margin: 0.9em 0; padding: 0.25em 0 0.25em 0.9em; border-left: 4px solid #d0d7de; color: #57606a; background: #f6f8fa;");
        });
        root.querySelectorAll("pre").forEach((pre) => {
            appendInlineStyle(pre, "ooverflow-x: scroll;");
        });
    }

    // 根据当前代码主题，为代码块和高亮 token 应用样式
    function applyCodeThemeStyles(root) {
        const codeTheme = app.findCodeThemeById(app.state.selectedCodeThemeId);
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
    function applyInlineThemeAndTypography(container) {
        const theme = getResolvedTheme();
        const rootFontFamily = getSelectedFontFamily();
        const fontSize = app.refs.fontSizeSelect.value;

        const root = document.createElement("div");
        root.innerHTML = container.innerHTML;

        root.querySelectorAll("style, script").forEach((node) => {
            node.remove();
        });

        appendInlineStyle(root, `font-family: ${rootFontFamily};`);
        appendInlineStyle(root, `font-size: ${fontSize}px;`);
        appendInlineStyle(root, "line-height: 1.8;");
        appendInlineStyle(root, "color: #2f2f2f;");
        appendInlineStyle(root, "word-break: break-word;");
        applyStyleMap(root, theme?.contentStyle);

        applyBaseInlineStyles(root);

        applyFontFamily(root, "p, li, blockquote, td, th", rootFontFamily);
        applyFontSizeStyle(root, "p, li, blockquote, td, th", fontSize);
        applyFontFamily(root, "h1, h2, h3, h4, h5, h6, a, strong, em", rootFontFamily);
        applyThemeElementStyles(root, theme?.elementStyles);
        applyCodeFontFamily(root);

        applyCodeThemeStyles(root);

        return root;
    }

    // 将单条参考链接追加到参考文献段落中
    function appendReferenceItem(paragraph, reference, isLast) {
        const code = document.createElement("em");
        code.textContent = `[${reference.index}]`;
        code.setAttribute("data-mdbp-references-index", "");

        const url = document.createElement("i");
        url.textContent = reference.href;
        url.setAttribute("data-mdbp-references-url", "");

        paragraph.appendChild(code);
        paragraph.appendChild(document.createTextNode(` ${reference.text}: `));
        paragraph.appendChild(url);

        if (!isLast) {
            paragraph.appendChild(document.createElement("br"));
        }
    }

    // 构建链接参考列表的 DOM 结构
    function buildReferencesSection(references) {
        const section = document.createElement("section");
        section.setAttribute("data-mdbp-references", "");

        const title = document.createElement("h3");
        title.textContent = "References";
        title.setAttribute("data-mdbp-references-title", "");
        section.appendChild(title);

        const paragraph = document.createElement("p");
        paragraph.setAttribute("data-mdbp-references-list", "");
        references.forEach((reference, index) => {
            appendReferenceItem(paragraph, reference, index === references.length - 1);
        });

        section.appendChild(paragraph);
        return section;
    }

    // 处理外部链接转换为脚注形式，避免微信对外链的特殊处理
    function convertExternalLinksToReferences(container) {
        const references = [];
        const referenceIndexByHref = new Map();
        const anchors = Array.from(container.querySelectorAll("a[href]"));
        anchors.forEach((anchor) => {
            if (!shouldConvertLink(anchor)) {
                return;
            }

            const href = (anchor.getAttribute("href") || "").trim();
            const linkText = (anchor.textContent || "").replace(/\s+/g, " ").trim();
            let referenceIndex = referenceIndexByHref.get(href);
            if (!referenceIndex) {
                referenceIndex = references.length + 1;
                referenceIndexByHref.set(href, referenceIndex);
                references.push({ index: referenceIndex, text: linkText, href });
            }

            const fragment = document.createDocumentFragment();
            const linkTextWrapper = document.createElement("span");
            linkTextWrapper.setAttribute("data-mdbp-link-text", "");
            while (anchor.firstChild) {
                linkTextWrapper.appendChild(anchor.firstChild);
            }
            fragment.appendChild(linkTextWrapper);

            const sup = document.createElement("sup");
            sup.textContent = `[${referenceIndex}]`;
            sup.setAttribute("data-mdbp-ref-sup", "");
            linkTextWrapper.appendChild(sup);
            anchor.replaceWith(fragment);
        });

        if (references.length === 0) {
            return;
        }

        container.appendChild(buildReferencesSection(references));
    }

    // 图片添加题注
    function wrapImageWithCaption(img) {
        if (img.closest("figure")) {
            return;
        }

        const altText = (img.getAttribute("alt") || "").trim();
        const titleText = (img.getAttribute("title") || "").trim();
        const captionText = altText || titleText;
        if (!captionText) {
            return;
        }

        const figure = document.createElement("figure");
        const figcaption = document.createElement("figcaption");
        figcaption.textContent = captionText;
        const parent = img.parentElement;

        if (parent && parent.tagName.toLowerCase() === "p") {
            const onlyImageInParagraph = Array.from(parent.childNodes).every((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    return node === img;
                }
                if (node.nodeType === Node.TEXT_NODE) {
                    return !(node.textContent || "").trim();
                }
                return true;
            });

            if (onlyImageInParagraph && parent.parentNode) {
                parent.parentNode.replaceChild(figure, parent);
            } else {
                parent.insertBefore(figure, img);
                parent.removeChild(img);
            }
        } else if (parent) {
            parent.insertBefore(figure, img);
            parent.removeChild(img);
        }

        figure.appendChild(img);
        figure.appendChild(figcaption);
    }


    // 区分块级代码和内联代码并分别应用格式
    function applyCodeBlockFormat(container) {
        const theme = getResolvedTheme();
        
        // 标记块级代码
        container.querySelectorAll("pre > code").forEach((code) => {
            code.parentElement.setAttribute("data-mdbp-code-block", "");
            code.setAttribute("data-mdbp-code-content", "");
        });

        // 内联代码应用主题配置的样式
        const inlineCodeStyle = normalizeStyleObject(theme?.inlineCodeStyle);
        const inlineCodeStyleText = styleObjectToCss(inlineCodeStyle);

        container.querySelectorAll("code:not(pre > code)").forEach((code) => {
            code.setAttribute("style", "");
            appendInlineStyle(code, inlineCodeStyleText);
        });

        return container;
    }

    // 修正微信环境下列表结构和代码缩进，减少排版异常
    function applyFinalWechatStructure(root) {
        const blockTags = new Set(["P", "UL", "OL", "PRE", "SECTION", "TABLE", "BLOCKQUOTE", "DIV", "FIGURE", "H1", "H2", "H3", "H4", "H5", "H6"]);

        root.querySelectorAll("li").forEach((li) => {
            const childNodes = Array.from(li.childNodes);
            const fragment = document.createDocumentFragment();
            let inlineBuffer = [];

            const flushInlineBuffer = () => {
                if (inlineBuffer.length === 0) {
                    return;
                }

                const paragraph = document.createElement("p");
                inlineBuffer.forEach((node) => {
                    paragraph.appendChild(node);
                });
                fragment.appendChild(paragraph);
                inlineBuffer = [];
            };

            childNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName.toUpperCase();
                    if (blockTags.has(tagName)) {
                        flushInlineBuffer();
                        fragment.appendChild(node);
                        return;
                    }
                }
                inlineBuffer.push(node);
            });

            flushInlineBuffer();

            if (fragment.childNodes.length > 0) {
                li.replaceChildren(fragment);
            }
        });

        root.querySelectorAll("pre > code").forEach((code) => {
            const textNodes = [];
            const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
            let currentNode = walker.nextNode();
            while (currentNode) {
                textNodes.push(currentNode);
                currentNode = walker.nextNode();
            }

            textNodes.forEach((textNode) => {
                const original = textNode.nodeValue || "";
                const normalized = normalizeLineIndent(original);
                if (normalized !== original) {
                    textNode.nodeValue = normalized;
                }
            });
        });
    }

    // 将行首缩进替换为不间断空格，避免微信吞掉代码缩进
    function normalizeLineIndent(text) {
        const NBSP = "\u00A0";
        const tabAsSpaces = `${NBSP}${NBSP}${NBSP}${NBSP}`;

        const segments = text.split(/(\n)/);
        let atLineStart = true;

        return segments.map((segment) => {
            if (segment === "\n") {
                atLineStart = true;
                return segment;
            }

            if (!atLineStart || !segment) {
                if (segment.length > 0) {
                    atLineStart = false;
                }
                return segment;
            }

            const indentMatch = segment.match(/^[ \t]+/);
            if (!indentMatch) {
                atLineStart = false;
                return segment;
            }

            const indent = indentMatch[0]
                .replace(/\t/g, tabAsSpaces)
                .replace(/ /g, NBSP);
            atLineStart = false;
            return `${indent}${segment.slice(indentMatch[0].length)}`;
        }).join("");
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

        // 代码预处理
        applyCodeBlockFormat(container);

        // 外链转引用，可选项。提前标记 data-mdbp-link-text，供后续样式使用
        if (app.refs.linkReferenceCheckbox.checked) {
            convertExternalLinksToReferences(container);
        }

        // 图片添加题注
        container.querySelectorAll("img").forEach((img) => {
            wrapImageWithCaption(img);
        });


        const resultRoot = applyInlineThemeAndTypography(container);

        // 微信公众号适配
        if (app.refs.wechatAdaptationCheckbox.checked) {
            applyFinalWechatStructure(resultRoot);
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
        setThemeOptions,
        setCodeThemeOptions,
        applyFontSize,
        setImageHostOptions,
        renderMarkdownToPreview,
        copyPreviewContent
    };
})();
