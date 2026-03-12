(function () {
    // 内容变换相关能力：外链转引用、图片题注、代码块处理、微信结构适配
    const app = window.mdbpApp;
    if (!app || !app.renderStyle) {
        return;
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

    function getLinkTransformInfo(anchor) {
        const href = (anchor.getAttribute("href") || "").trim();
        if (!href) {
            return null;
        }

        const parsedUrl = parseHttpUrl(href);
        if (!parsedUrl) {
            return null;
        }

        if (parsedUrl.hostname.toLowerCase() === "mp.weixin.qq.com") {
            return null;
        }

        const linkText = (anchor.textContent || "").replace(/\s+/g, " ").trim();
        return {
            href,
            linkText,
            needsReference: Boolean(linkText) && linkText !== href
        };
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
            const linkInfo = getLinkTransformInfo(anchor);
            if (!linkInfo) {
                return;
            }

            const { href, linkText, needsReference } = linkInfo;

            const fragment = document.createDocumentFragment();
            const linkTextWrapper = document.createElement("span");
            linkTextWrapper.setAttribute("data-mdbp-link-text", "");
            while (anchor.firstChild) {
                linkTextWrapper.appendChild(anchor.firstChild);
            }
            fragment.appendChild(linkTextWrapper);

            if (!needsReference) {
                anchor.replaceWith(fragment);
                return;
            }

            let referenceIndex = referenceIndexByHref.get(href);
            if (!referenceIndex) {
                referenceIndex = references.length + 1;
                referenceIndexByHref.set(href, referenceIndex);
                references.push({ index: referenceIndex, text: linkText, href });
            }

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
    function applyCodeBlockFormat(container, theme) {
        container.querySelectorAll("pre > code").forEach((code) => {
            code.parentElement.setAttribute("data-mdbp-code-block", "");
            code.setAttribute("data-mdbp-code-content", "");
        });

        const inlineCodeStyle = app.renderStyle.normalizeStyleObject(theme?.inlineCodeStyle);
        const inlineCodeStyleText = app.renderStyle.styleObjectToCss(inlineCodeStyle);

        container.querySelectorAll("code:not(pre > code)").forEach((code) => {
            code.setAttribute("style", "");
            app.renderStyle.appendInlineStyle(code, inlineCodeStyleText);
        });

        return container;
    }

    // 修正微信环境下列表结构和代码缩进，减少排版异常
    function applyFinalWechatStructure(root) {
        const blockTags = new Set(["P", "UL", "OL", "PRE", "SECTION", "TABLE", "BLOCKQUOTE", "DIV", "FIGURE", "H1", "H2", "H3", "H4", "H5", "H6"]);

        root.querySelectorAll("ol, ul").forEach((list) => {
            Array.from(list.childNodes).forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE && !(node.textContent || "").trim()) {
                    list.removeChild(node);
                }
            });
        });

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
                if (!normalized.includes("\n")) {
                    if (normalized !== original) {
                        textNode.nodeValue = normalized;
                    }
                    return;
                }

                const fragment = document.createDocumentFragment();
                normalized.split("\n").forEach((segment, index, segments) => {
                    if (segment) {
                        fragment.appendChild(document.createTextNode(segment));
                    }
                    if (index < segments.length - 1) {
                        fragment.appendChild(document.createElement("br"));
                    }
                });
                textNode.replaceWith(fragment);
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

    app.renderTransform = {
        parseHttpUrl,
        getLinkTransformInfo,
        appendReferenceItem,
        buildReferencesSection,
        convertExternalLinksToReferences,
        wrapImageWithCaption,
        applyCodeBlockFormat,
        applyFinalWechatStructure,
        normalizeLineIndent
    };
})();