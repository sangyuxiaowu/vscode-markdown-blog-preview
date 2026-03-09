(function () {
    const app = window.mdbpApp;
    if (!app || !app.render) {
        return;
    }

    const refs = app.refs;
    const state = app.state;

    // ===== UI 事件 =====
    refs.fontSizeSelect.addEventListener("change", () => {
        app.render.applyFontSize(refs.fontSizeSelect.value);
    });

    refs.fontFamilySelect.addEventListener("change", () => {
        app.render.renderMarkdownToPreview(state.latestMarkdownHtml);
    });

    refs.themeSelect.addEventListener("change", () => {
        app.render.applyTheme(refs.themeSelect.value);
        app.syncLinkReferenceCheckbox(refs.themeSelect.value);
        app.syncWechatAdaptationCheckbox(refs.themeSelect.value);
        app.render.renderMarkdownToPreview(state.latestMarkdownHtml);
        app.vscode.postMessage({
            command: "selectTheme",
            data: refs.themeSelect.value
        });
    });

    refs.codeThemeSelect.addEventListener("change", () => {
        state.selectedCodeThemeId = refs.codeThemeSelect.value;
        app.render.renderMarkdownToPreview(state.latestMarkdownHtml);
        app.vscode.postMessage({
            command: "selectCodeTheme",
            data: state.selectedCodeThemeId
        });
    });

    refs.linkReferenceCheckbox.addEventListener("change", () => {
        state.linkReferenceOverrides[state.selectedThemeId] = refs.linkReferenceCheckbox.checked;
        app.updateWebviewState();
        app.render.renderMarkdownToPreview(state.latestMarkdownHtml);
    });

    refs.imageHostSelect.addEventListener("change", () => {
        state.selectedImageHostId = refs.imageHostSelect.value;
        app.updateWebviewState();
        app.vscode.postMessage({
            command: "selectImageHost",
            data: state.selectedImageHostId
        });
    });

    refs.uploadImagesButton.addEventListener("click", () => {
        if (!state.isImageHostEnabled || !state.selectedImageHostId || refs.uploadImagesButton.hasAttribute("disabled")) {
            return;
        }

        app.vscode.postMessage({
            command: "uploadImages",
            data: state.selectedImageHostId
        });
    });

    refs.wechatAdaptationCheckbox.addEventListener("change", () => {
        state.wechatAdaptationOverrides[state.selectedThemeId] = refs.wechatAdaptationCheckbox.checked;
        app.updateWebviewState();
        app.render.renderMarkdownToPreview(state.latestMarkdownHtml);
    });

    refs.copyButton.addEventListener("click", async () => {
        const copied = await app.render.copyPreviewContent();
        app.vscode.postMessage({
            command: "msg",
            data: {
                type: copied ? "success" : "warning",
                message: copied ? "复制成功" : "复制失败"
            }
        });
    });

    refs.previewWrapper.addEventListener("scroll", () => {
        if (state.syncingFromExtension) {
            return;
        }
        const scrollTop = refs.previewWrapper.scrollTop;
        const scrollHeight = refs.previewWrapper.scrollHeight;
        const clientHeight = refs.previewWrapper.clientHeight;
        const denominator = scrollHeight - clientHeight;
        if (denominator <= 0) {
            return;
        }
        const scrollPercent = scrollTop / denominator;
        app.vscode.postMessage({
            command: "scroll",
            data: scrollPercent
        });
    });

    // ===== 扩展消息 =====
    window.addEventListener("message", (event) => {
        const message = event.data;
        switch (message.command) {
            case "scroll": {
                state.syncingFromExtension = true;
                refs.previewWrapper.scrollTo(0, refs.previewInfo.clientHeight * message.data);
                requestAnimationFrame(() => {
                    state.syncingFromExtension = false;
                });
                break;
            }
            case "renderMarkdown": {
                state.latestMarkdownHtml = message.data || "";
                app.render.renderMarkdownToPreview(state.latestMarkdownHtml);
                break;
            }
            case "updateThemes": {
                const payload = message.data;
                if (Array.isArray(payload)) {
                    app.render.setThemeOptions(payload);
                    break;
                }

                app.render.setThemeOptions(
                    Array.isArray(payload?.themes) ? payload.themes : [],
                    typeof payload?.selectedThemeId === "string" ? payload.selectedThemeId : undefined
                );
                app.render.setCodeThemeOptions(
                    Array.isArray(payload?.codeThemes) ? payload.codeThemes : [],
                    typeof payload?.selectedCodeThemeId === "string" ? payload.selectedCodeThemeId : undefined
                );
                break;
            }
            case "updateImageHosts": {
                const payload = message.data || {};
                app.render.setImageHostOptions(
                    Boolean(payload.enabled),
                    Array.isArray(payload.hosts) ? payload.hosts : [],
                    typeof payload.selectedHostId === "string" ? payload.selectedHostId : ""
                );
                break;
            }
            case "uploading": {
                const uploading = Boolean(message.data);
                if (uploading) {
                    refs.uploadImagesButton.setAttribute("disabled", "disabled");
                    refs.uploadImagesButton.setAttribute("aria-disabled", "true");
                } else if (state.isImageHostEnabled && state.selectedImageHostId) {
                    refs.uploadImagesButton.removeAttribute("disabled");
                    refs.uploadImagesButton.removeAttribute("aria-disabled");
                }
                break;
            }
        }
    });

    // ===== 初始化 =====
    app.render.applyTheme("default");
    app.render.applyFontSize(refs.fontSizeSelect.value);
    app.syncSettingsHeight();
})();
