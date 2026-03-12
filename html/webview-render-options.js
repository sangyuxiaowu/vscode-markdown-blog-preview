(function () {
    // 选项与状态同步相关能力：下拉框填充、主题切换、图床状态同步
    const app = window.mdbpApp;
    if (!app) {
        return;
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

    // 校验字号输入，返回合法字号或 null
    function parseFontSize(fontSize) {
        const parsed = Number(fontSize);
        if (Number.isNaN(parsed) || parsed <= 0) {
            return null;
        }
        return parsed;
    }

    // 设置主题下拉框选项并同步当前主题状态
    function setThemeOptions(themes, nextSelectedThemeId, applyTheme) {
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
            app.syncWxDraftButton();
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
        app.syncWxDraftButton();
        app.updateWebviewState();
    }

    function setWatermarkStyleOptions(styles, nextSelectedWatermarkStyleId) {
        app.state.currentWatermarkStyles = Array.isArray(styles) ? styles : [];

        const styleItems = [
            { id: "", name: "无水印" },
            ...app.state.currentWatermarkStyles.map((style) => ({
                id: style.id,
                name: style.name || style.id
            }))
        ];

        populateSelectOptions(app.refs.watermarkStyleSelect, styleItems);

        app.state.selectedWatermarkStyleId = resolveSelectedId(
            styleItems,
            nextSelectedWatermarkStyleId || app.state.selectedWatermarkStyleId,
            ""
        );

        app.refs.watermarkStyleSelect.value = app.state.selectedWatermarkStyleId;
        app.updateWebviewState();
    }

    app.renderOptions = {
        populateSelectOptions,
        resolveSelectedId,
        parseFontSize,
        setThemeOptions,
        setCodeThemeOptions,
        setImageHostOptions,
        setWatermarkStyleOptions
    };
})();