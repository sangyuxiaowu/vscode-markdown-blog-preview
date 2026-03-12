(function () {
    const app = window.mdbpApp;
    if (!app || !app.render) {
        return;
    }

    const refs = app.refs;
    const state = app.state;

    function rerenderLatestMarkdown() {
        app.render.renderMarkdownToPreview(state.latestMarkdownHtml);
    }

    function postCommand(command, data) {
        app.vscode.postMessage({ command, data });
    }

    // ===== UI 事件 =====
    refs.fontSizeSelect.addEventListener("change", () => {
        app.render.applyFontSize(refs.fontSizeSelect.value);
    });

    refs.fontFamilySelect.addEventListener("change", () => {
        rerenderLatestMarkdown();
    });

    refs.themeSelect.addEventListener("change", () => {
        app.render.applyTheme(refs.themeSelect.value);
        app.syncLinkReferenceCheckbox(refs.themeSelect.value);
        app.syncWechatAdaptationCheckbox(refs.themeSelect.value);
        postCommand("selectTheme", refs.themeSelect.value);
    });

    refs.codeThemeSelect.addEventListener("change", () => {
        state.selectedCodeThemeId = refs.codeThemeSelect.value;
        rerenderLatestMarkdown();
        postCommand("selectCodeTheme", state.selectedCodeThemeId);
    });

    refs.linkReferenceCheckbox.addEventListener("change", () => {
        state.linkReferenceOverrides[state.selectedThemeId] = refs.linkReferenceCheckbox.checked;
        app.updateWebviewState();
        rerenderLatestMarkdown();
    });

    refs.imageHostSelect.addEventListener("change", () => {
        state.selectedImageHostId = refs.imageHostSelect.value;
        app.updateWebviewState();
        postCommand("selectImageHost", state.selectedImageHostId);
    });

    refs.watermarkStyleSelect.addEventListener("change", () => {
        state.selectedWatermarkStyleId = refs.watermarkStyleSelect.value;
        app.updateWebviewState();
        postCommand("selectWatermarkStyle", state.selectedWatermarkStyleId);
    });

    refs.uploadImagesButton.addEventListener("click", () => {
        if (!state.isImageHostEnabled || !state.selectedImageHostId || refs.uploadImagesButton.hasAttribute("disabled")) {
            return;
        }

        postCommand("uploadImages", {
            hostId: state.selectedImageHostId,
            watermarkStyleId: state.selectedWatermarkStyleId
        });
    });

    refs.uploadWxDraftButton.addEventListener("click", () => {
        if (refs.uploadWxDraftButton.hasAttribute("disabled")) {
            return;
        }

        state.pendingWxDraftPublish = true;
        postCommand("uploadImages", {
            hostId: state.selectedImageHostId,
            watermarkStyleId: state.selectedWatermarkStyleId
        });
    });

    refs.wechatAdaptationCheckbox.addEventListener("change", () => {
        state.wechatAdaptationOverrides[state.selectedThemeId] = refs.wechatAdaptationCheckbox.checked;
        app.updateWebviewState();
        rerenderLatestMarkdown();
    });

    refs.copyButton.addEventListener("click", async () => {
        const copied = await app.render.copyPreviewContent();
        postCommand("msg", {
            type: copied ? "success" : "warning",
            message: copied ? "复制成功" : "复制失败"
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
        postCommand("scroll", scrollPercent);
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
                rerenderLatestMarkdown();
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
                app.render.setWatermarkStyleOptions(
                    Array.isArray(payload.watermarkStyles) ? payload.watermarkStyles : [],
                    typeof payload.selectedWatermarkStyleId === "string" ? payload.selectedWatermarkStyleId : ""
                );
                break;
            }
            case "uploading": {
                const uploading = Boolean(message.data);
                if (uploading) {
                    app.setUploadButtonEnabled(false);
                } else if (state.isImageHostEnabled && state.selectedImageHostId) {
                    app.setUploadButtonEnabled(true);
                }

                if (!uploading && state.pendingWxDraftPublish) {
                    state.pendingWxDraftPublish = false;
                    postCommand("publishWxDraft", {
                        renderedHtml: state.latestRenderedInlineHtml || app.view.shadowView.innerHTML || ""
                    });
                }
                break;
            }
            case "wxDraftUploading": {
                app.setWxDraftUploading(Boolean(message.data));
                break;
            }
        }
    });

    // ===== 初始化 =====
    app.render.applyTheme("default");
    app.syncSettingsHeight();
})();
