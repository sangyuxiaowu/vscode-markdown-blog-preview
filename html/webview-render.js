(function () {
    const app = window.mdbpApp;
    if (!app) {
        return;
    }

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

    function styleObjectToCss(style) {
        const entries = Object.entries(normalizeStyleObject(style));
        if (entries.length === 0) {
            return "";
        }
        return entries.map(([key, value]) => `${key}: ${value};`).join(" ");
    }

    function appendInlineStyle(target, styleText) {
        if (!styleText) {
            return;
        }
        target.style.cssText = `${target.style.cssText}; ${styleText}`;
    }

    function applyStyleMap(target, style) {
        appendInlineStyle(target, styleObjectToCss(style));
    }

    function getSelectedFontFamily() {
        return app.refs.fontFamilySelect.value === "serif"
            ? app.constants.CONTENT_FONT_SERIF
            : app.constants.CONTENT_FONT_SANS;
    }

    function isExternalHttpLink(href) {
        try {
            const parsedUrl = new URL(href);
            return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
        } catch {
            return false;
        }
    }

    function shouldConvertLink(anchor) {
        const href = (anchor.getAttribute("href") || "").trim();
        if (!href || !isExternalHttpLink(href)) {
            return false;
        }

        try {
            const parsedUrl = new URL(href);
            if (parsedUrl.hostname.toLowerCase() === "mp.weixin.qq.com") {
                return false;
            }
        } catch {
            return false;
        }

        const linkText = (anchor.textContent || "").replace(/\s+/g, " ").trim();
        return Boolean(linkText) && linkText !== href;
    }

    function applyTheme(themeId) {
        app.state.selectedThemeId = themeId;
        const theme = app.findThemeById(themeId);

        const previewStyle = Object.assign({}, app.constants.defaultPreviewStyle, normalizeStyleObject(theme?.previewStyle));
        Object.assign(app.refs.previewInfo.style, previewStyle);

        applyFontSize(app.refs.fontSizeSelect.value);
    }

    function setThemeOptions(themes, nextSelectedThemeId) {
        app.state.currentThemes = Array.isArray(themes) ? themes : [];

        if (app.state.currentThemes.length === 0) {
            app.state.currentThemes = [{ id: "default", name: "默认" }];
        }

        app.refs.themeSelect.innerHTML = "";
        app.state.currentThemes.forEach((theme) => {
            const option = document.createElement("option");
            option.value = theme.id;
            option.textContent = theme.name;
            app.refs.themeSelect.appendChild(option);
        });

        if (typeof nextSelectedThemeId === "string" && nextSelectedThemeId) {
            app.state.selectedThemeId = nextSelectedThemeId;
        }

        const available = app.state.currentThemes.some((theme) => theme.id === app.state.selectedThemeId);
        if (!available) {
            app.state.selectedThemeId = app.state.currentThemes[0].id;
        }

        app.refs.themeSelect.value = app.state.selectedThemeId;
        applyTheme(app.state.selectedThemeId);
        app.syncLinkReferenceCheckbox(app.state.selectedThemeId);
        app.syncWechatAdaptationCheckbox(app.state.selectedThemeId);
        if (app.state.latestMarkdownHtml) {
            renderMarkdownToPreview(app.state.latestMarkdownHtml);
        }
    }

    function setCodeThemeOptions(codeThemes, nextSelectedCodeThemeId) {
        app.state.currentCodeThemes = Array.isArray(codeThemes) ? codeThemes : [];
        const allOptions = [{ id: "default", name: "默认" }, ...app.state.currentCodeThemes];

        app.refs.codeThemeSelect.innerHTML = "";
        allOptions.forEach((theme) => {
            const option = document.createElement("option");
            option.value = theme.id;
            option.textContent = theme.name;
            app.refs.codeThemeSelect.appendChild(option);
        });

        if (typeof nextSelectedCodeThemeId === "string" && nextSelectedCodeThemeId) {
            app.state.selectedCodeThemeId = nextSelectedCodeThemeId;
        }

        const available = allOptions.some((theme) => theme.id === app.state.selectedCodeThemeId);
        if (!available) {
            app.state.selectedCodeThemeId = "default";
        }

        app.refs.codeThemeSelect.value = app.state.selectedCodeThemeId;
    }

    function applyFontSize(fontSize) {
        const parsed = Number(fontSize);
        if (Number.isNaN(parsed) || parsed <= 0) {
            return;
        }
        if (app.state.latestMarkdownHtml) {
            renderMarkdownToPreview(app.state.latestMarkdownHtml);
        }
    }

    function setImageHostOptions(enabled, hosts, nextSelectedHostId) {
        app.state.isImageHostEnabled = Boolean(enabled);
        app.refs.imageHostRow.style.display = app.state.isImageHostEnabled ? "flex" : "none";
        app.syncSettingsHeight();

        const hostItems = Array.isArray(hosts) ? hosts : [];
        app.refs.imageHostSelect.innerHTML = "";

        hostItems.forEach((host) => {
            const option = document.createElement("option");
            option.value = host.id;
            option.textContent = host.name || host.id;
            app.refs.imageHostSelect.appendChild(option);
        });

        if (!app.state.isImageHostEnabled || hostItems.length === 0) {
            app.state.selectedImageHostId = "";
            app.refs.uploadImagesButton.setAttribute("disabled", "disabled");
            app.refs.uploadImagesButton.setAttribute("aria-disabled", "true");
            app.updateWebviewState();
            return;
        }

        if (typeof nextSelectedHostId === "string" && nextSelectedHostId) {
            app.state.selectedImageHostId = nextSelectedHostId;
        }

        const hostExists = hostItems.some((host) => host.id === app.state.selectedImageHostId);
        if (!hostExists) {
            app.state.selectedImageHostId = hostItems[0].id;
        }

        app.refs.imageHostSelect.value = app.state.selectedImageHostId;
        app.refs.uploadImagesButton.removeAttribute("disabled");
        app.refs.uploadImagesButton.removeAttribute("aria-disabled");
        app.updateWebviewState();
    }

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

    function applyInlineThemeAndTypography(container) {
        const theme = app.findThemeById(app.state.selectedThemeId);
        const rootFontFamily = getSelectedFontFamily();

        const root = document.createElement("div");
        root.innerHTML = container.innerHTML;

        root.querySelectorAll("style, script").forEach((node) => {
            node.remove();
        });

        appendInlineStyle(root, `font-family: ${rootFontFamily};`);
        appendInlineStyle(root, `font-size: ${app.refs.fontSizeSelect.value}px;`);
        appendInlineStyle(root, "line-height: 1.8;");
        appendInlineStyle(root, "color: #2f2f2f;");
        appendInlineStyle(root, "word-break: break-word;");
        applyStyleMap(root, theme?.contentStyle);

        applyBaseInlineStyles(root);

        root.querySelectorAll("p, li, blockquote, td, th").forEach((node) => {
            appendInlineStyle(node, `font-family: ${rootFontFamily};`);
            appendInlineStyle(node, `font-size: ${app.refs.fontSizeSelect.value}px;`);
        });

        root.querySelectorAll("h1, h2, h3, h4, h5, h6, a, strong, em").forEach((node) => {
            appendInlineStyle(node, `font-family: ${rootFontFamily};`);
        });

        const elementStyles = theme?.elementStyles;
        if (elementStyles && typeof elementStyles === "object") {
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

        root.querySelectorAll("pre > code").forEach((code) => {
            appendInlineStyle(code, `font-family: ${app.constants.FIXED_CODE_FONT};`);
        });
        root.querySelectorAll("code:not(pre > code)").forEach((code) => {
            appendInlineStyle(code, `font-family: ${app.constants.FIXED_CODE_FONT};`);
        });

        applyCodeThemeStyles(root);

        return root;
    }

    function convertExternalLinksToReferences(container) {
        if (!app.refs.linkReferenceCheckbox.checked) {
            return;
        }

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

        const section = document.createElement("section");
        section.setAttribute("data-mdbp-references", "");
        const title = document.createElement("h3");
        title.textContent = "References";
        title.setAttribute("data-mdbp-references-title", "");
        section.appendChild(title);

        const paragraph = document.createElement("p");
        paragraph.setAttribute("data-mdbp-references-list", "");
        references.forEach((reference, index) => {
            const code = document.createElement("em");
            code.textContent = `[${reference.index}]`;
            code.setAttribute("data-mdbp-references-index", "");

            const url = document.createElement("i");
            url.textContent = reference.href;
            url.setAttribute("data-mdbp-references-url", "");

            paragraph.appendChild(code);
            paragraph.appendChild(document.createTextNode(` ${reference.text}: `));
            paragraph.appendChild(url);

            if (index < references.length - 1) {
                paragraph.appendChild(document.createElement("br"));
            }
        });
        section.appendChild(paragraph);
        container.appendChild(section);
    }

    function applyWechatCodeBlockFormat(rawHtml) {
        const container = document.createElement("div");
        container.innerHTML = rawHtml;
        const theme = app.findThemeById(app.state.selectedThemeId);

        convertExternalLinksToReferences(container);

        const images = container.querySelectorAll("img");
        images.forEach((img) => {
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
        });

        const blockCodes = container.querySelectorAll("pre > code");
        blockCodes.forEach((code) => {
            const pre = code.parentElement;
            if (!pre) {
                return;
            }

            pre.setAttribute("data-mdbp-code-block", "");
            code.setAttribute("data-mdbp-code-content", "");

            pre.setAttribute("style", "");
            appendInlineStyle(pre, "margin: 1em 0; padding: 12px 14px; background: #f6f8fa; border: 1px solid #eaecef; border-radius: 6px; overflow-x: auto;");

            code.setAttribute("style", "");
            appendInlineStyle(code, `display: block; color: #24292e; background: transparent; font-size: 13px; line-height: 1.7; font-family: ${app.constants.FIXED_CODE_FONT};`);
        });

        const inlineCodes = container.querySelectorAll("code:not(pre > code)");
        const inlineCodeStyle = Object.assign({}, app.constants.defaultInlineCodeStyle, normalizeStyleObject(theme?.inlineCodeStyle));
        const inlineCodeStyleText = styleObjectToCss(inlineCodeStyle);
        inlineCodes.forEach((code) => {
            code.setAttribute("style", "");
            appendInlineStyle(code, `${inlineCodeStyleText} font-family: ${app.constants.FIXED_CODE_FONT};`);
        });

        return container;
    }

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
                const normalized = app.normalizeLineIndent(original);
                if (normalized !== original) {
                    textNode.nodeValue = normalized;
                }
            });
        });
    }

    function renderMarkdownToPreview(rawHtml) {
        if (!rawHtml) {
            app.view.shadowView.innerHTML = "";
            app.state.latestRenderedInlineHtml = "";
            return;
        }

        const container = applyWechatCodeBlockFormat(rawHtml);
        const resultRoot = applyInlineThemeAndTypography(container);
        if (app.refs.wechatAdaptationCheckbox.checked) {
            applyFinalWechatStructure(resultRoot);
        }
        app.state.latestRenderedInlineHtml = resultRoot.innerHTML;
        app.view.shadowView.innerHTML = "";
        app.view.shadowView.appendChild(resultRoot);
    }

    async function copyPreviewContent() {
        const html = app.state.latestRenderedInlineHtml || app.view.shadowView.innerHTML;
        const plainText = app.view.shadowView.textContent || "";

        if (!html || !html.trim()) {
            return false;
        }

        if (navigator.clipboard && window.ClipboardItem) {
            try {
                const item = new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([plainText], { type: "text/plain" })
                });
                await navigator.clipboard.write([item]);
                return true;
            } catch {
            }
        }

        const temp = document.createElement("div");
        temp.setAttribute("contenteditable", "true");
        temp.style.position = "fixed";
        temp.style.left = "-99999px";
        temp.style.top = "0";
        temp.innerHTML = html;
        document.body.appendChild(temp);

        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(temp);

        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }

        const copied = document.execCommand("copy");

        if (selection) {
            selection.removeAllRanges();
        }
        document.body.removeChild(temp);
        return copied;
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
