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

    function setUploadButtonEnabled(enabled) {
        if (enabled) {
            refs.uploadImagesButton.removeAttribute("disabled");
            refs.uploadImagesButton.removeAttribute("aria-disabled");
            return;
        }

        refs.uploadImagesButton.setAttribute("disabled", "disabled");
        refs.uploadImagesButton.setAttribute("aria-disabled", "true");
    }

    function syncSettingsHeight() {
        document.documentElement.style.setProperty("--settings-height", refs.imageHostRow.style.display === "flex" ? "128px" : "92px");
    }

    function isWechatTheme(themeId) {
        const theme = findThemeById(themeId);
        const themeName = typeof theme?.name === "string" ? theme.name : "";
        return themeName.includes("微信");
    }

    function getThemeOverrideValue(overrides, themeId) {
        if (Object.prototype.hasOwnProperty.call(overrides, themeId)) {
            return Boolean(overrides[themeId]);
        }

        return isWechatTheme(themeId);
    }

    function getLinkReferenceEnabled(themeId) {
        return getThemeOverrideValue(state.linkReferenceOverrides, themeId);
    }

    function syncLinkReferenceCheckbox(themeId) {
        refs.linkReferenceCheckbox.checked = getLinkReferenceEnabled(themeId);
    }

    function getWechatAdaptationEnabled(themeId) {
        return getThemeOverrideValue(state.wechatAdaptationOverrides, themeId);
    }

    function syncWechatAdaptationCheckbox(themeId) {
        refs.wechatAdaptationCheckbox.checked = getWechatAdaptationEnabled(themeId);
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
        view: {
            shadowRoot,
            shadowView
        },
        findThemeById,
        findCodeThemeById,
        updateWebviewState,
        setUploadButtonEnabled,
        syncSettingsHeight,
        getLinkReferenceEnabled,
        syncLinkReferenceCheckbox,
        getWechatAdaptationEnabled,
        syncWechatAdaptationCheckbox,
        normalizeLineIndent
    };
})();
