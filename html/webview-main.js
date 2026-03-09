(function () {
    const vscode = acquireVsCodeApi();

    const refs = {
        previewWrapper: document.getElementsByClassName("preview-wrapper")[0],
        previewInfo: document.getElementsByClassName("preview")[0],
        fontSizeSelect: document.getElementById("font-size"),
        fontFamilySelect: document.getElementById("font-family"),
        themeSelect: document.getElementById("theme"),
        codeThemeSelect: document.getElementById("code-theme"),
        imageHostRow: document.getElementById("image-host-row"),
        imageHostSelect: document.getElementById("image-host"),
        uploadImagesButton: document.getElementById("upload-images"),
        linkReferenceCheckbox: document.getElementById("convert-links-to-references"),
        wechatAdaptationCheckbox: document.getElementById("wechat-adaptation"),
        viewHost: document.getElementById("view-host"),
        copyButton: document.getElementById("copy")
    };

    const initialState = vscode.getState() || {};

    const state = {
        syncingFromExtension: false,
        latestMarkdownHtml: "",
        latestRenderedInlineHtml: "",
        currentThemes: [],
        currentCodeThemes: [],
        selectedThemeId: "default",
        selectedCodeThemeId: "default",
        selectedImageHostId: initialState.selectedImageHostId || "",
        isImageHostEnabled: false,
        linkReferenceOverrides: initialState.linkReferenceOverrides && typeof initialState.linkReferenceOverrides === "object"
            ? initialState.linkReferenceOverrides
            : {},
        wechatAdaptationOverrides: initialState.wechatAdaptationOverrides && typeof initialState.wechatAdaptationOverrides === "object"
            ? initialState.wechatAdaptationOverrides
            : {}
    };

    const constants = {
        CONTENT_FONT_SANS: "-apple-system-font,BlinkMacSystemFont, Helvetica Neue, PingFang SC, Hiragino Sans GB , Microsoft YaHei UI , Microsoft YaHei ,Arial,sans-serif",
        CONTENT_FONT_SERIF: "Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, 'PingFang SC', Cambria, Cochin, Georgia, Times, 'Times New Roman', serif",
        FIXED_CODE_FONT: "Consolas, \"Liberation Mono\", Menlo, Courier, monospace",
        defaultPreviewStyle: {
            width: "375px",
            background: "#fff",
            padding: "20px",
            boxShadow: "0 0 60px rgb(0 0 0 / 10%)"
        },
        defaultInlineCodeStyle: {
            padding: "2px 6px",
            margin: "0 2px",
            color: "#c7254e",
            background: "#f9f2f4",
            borderRadius: "4px",
            fontSize: "0.92em"
        }
    };

    const shadowRoot = refs.viewHost.attachShadow({ mode: "open" });
    const shadowStyle = document.createElement("style");
    shadowStyle.textContent = "\n        :host { display: block; }\n        #view { display: block; }\n    ";
    const shadowView = document.createElement("div");
    shadowView.id = "view";
    shadowRoot.append(shadowStyle, shadowView);

    function findThemeById(themeId) {
        return state.currentThemes.find((theme) => theme.id === themeId);
    }

    function findCodeThemeById(codeThemeId) {
        return state.currentCodeThemes.find((theme) => theme.id === codeThemeId);
    }

    function updateWebviewState() {
        vscode.setState({
            selectedImageHostId: state.selectedImageHostId,
            linkReferenceOverrides: state.linkReferenceOverrides,
            wechatAdaptationOverrides: state.wechatAdaptationOverrides
        });
    }

    function syncSettingsHeight() {
        document.documentElement.style.setProperty("--settings-height", refs.imageHostRow.style.display === "flex" ? "128px" : "92px");
    }

    function shouldAutoEnableLinkReferences(themeId) {
        const theme = findThemeById(themeId);
        const themeName = typeof theme?.name === "string" ? theme.name : "";
        return themeName.includes("微信");
    }

    function getLinkReferenceEnabled(themeId) {
        if (Object.prototype.hasOwnProperty.call(state.linkReferenceOverrides, themeId)) {
            return Boolean(state.linkReferenceOverrides[themeId]);
        }

        return shouldAutoEnableLinkReferences(themeId);
    }

    function syncLinkReferenceCheckbox(themeId) {
        refs.linkReferenceCheckbox.checked = getLinkReferenceEnabled(themeId);
    }

    function shouldAutoEnableWechatAdaptation(themeId) {
        const theme = findThemeById(themeId);
        const themeName = typeof theme?.name === "string" ? theme.name : "";
        return themeName.includes("微信");
    }

    function getWechatAdaptationEnabled(themeId) {
        if (Object.prototype.hasOwnProperty.call(state.wechatAdaptationOverrides, themeId)) {
            return Boolean(state.wechatAdaptationOverrides[themeId]);
        }

        return shouldAutoEnableWechatAdaptation(themeId);
    }

    function syncWechatAdaptationCheckbox(themeId) {
        refs.wechatAdaptationCheckbox.checked = getWechatAdaptationEnabled(themeId);
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
        const cssText = styleObjectToCss(style);
        appendInlineStyle(target, cssText);
    }

    function getSelectedFontFamily() {
        return refs.fontFamilySelect.value === "serif" ? constants.CONTENT_FONT_SERIF : constants.CONTENT_FONT_SANS;
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

    window.mdbpApp = {
        vscode,
        refs,
        state,
        constants,
        view: {
            shadowRoot,
            shadowView
        },
        findThemeById,
        findCodeThemeById,
        updateWebviewState,
        syncSettingsHeight,
        shouldAutoEnableLinkReferences,
        getLinkReferenceEnabled,
        syncLinkReferenceCheckbox,
        shouldAutoEnableWechatAdaptation,
        getWechatAdaptationEnabled,
        syncWechatAdaptationCheckbox,
        normalizeStyleObject,
        styleObjectToCss,
        appendInlineStyle,
        applyStyleMap,
        getSelectedFontFamily,
        isExternalHttpLink,
        shouldConvertLink,
        normalizeLineIndent
    };
})();
