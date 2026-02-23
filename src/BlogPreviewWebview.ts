import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

interface ThemeConfigItem {
    id: string;
    name: string;
    previewStyle?: Record<string, string>;
    contentStyle?: Record<string, string>;
    elementStyles?: Record<string, Record<string, string>>;
    inlineCodeStyle?: Record<string, string>;
    contentCss?: string;
}

const DEFAULT_THEME_RELATIVE_PATH = "themes/default.json";

class BlogView{
    context: vscode.ExtensionContext;
    view: vscode.WebviewPanel;
    isDisposed: boolean = false;
    // 当前工作目录
    currentWorkspacePath: string = "";
    // 当前编辑的文件
    currentEditingFilePath: string = "";
    // 标记是否正在处理来自预览侧的滚动，避免双向同步抖动
    isApplyingWebviewScroll: boolean = false;

    configureWebviewScripts(webviewScripts: string[]) {
        //webviewScripts.push("libs/d3.js");
        return webviewScripts;
    }

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        // 获取当前工作目录或编辑文件的路径
        this.currentWorkspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";
        const editingEditor = vscode.window.activeTextEditor;
        if (editingEditor !== undefined) {
            this.currentEditingFilePath = editingEditor.document.fileName;
        }

        this.view = vscode.window.createWebviewPanel(
            "blogPreview",
            "Markdown Blog Preview",
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, "html")), // 插件的 html 文件夹
                    vscode.Uri.file(vscode.env.appRoot), // vscode 自身的资源
                    vscode.Uri.file(this.currentWorkspacePath) // 当前工作目录
                ]
            }
        );
        this.view.webview.onDidReceiveMessage(this.onDidReceiveMessage, this, this.context.subscriptions);
        this.initialize();
        this.isDisposed = false;
    }

    initialize() {
        this.initializeWebviewHtml();
        this.registerDisposables();
        this.pushThemeConfigs();
    }
    initializeWebviewHtml() {
        let loadingScriptHtml: string[] = [];
        this.configureWebviewScripts([]).forEach(path => {
            const jsUri = this.view.webview.asWebviewUri(vscode.Uri.file(this.getHtmlAssetPath(path)));
            loadingScriptHtml.push(
                `<script src="${jsUri}"></script>`);
        });

        const html: string = fs.readFileSync(path.join(this.getHtmlAssetPath(
            "webview.html"))).toString("utf-8");

        const appRoot = this.view.webview.asWebviewUri(
            vscode.Uri.file(vscode.env.appRoot)
        );
        this.view.webview.html = html
            .replace(/<insert-vscode-resource\/>/g, loadingScriptHtml.join("\r\n"))
            .replace(/\[insert-vscode-approot\]/g,`${appRoot}`);
    }
    registerDisposables() {
        this.view.onDidDispose(
            () => {
                this.isDisposed = true;
            },
            null,
            this.context.subscriptions
        );

        vscode.workspace.onDidChangeConfiguration(
            (event: vscode.ConfigurationChangeEvent) => {
                if (event.affectsConfiguration("mdbp.themeConfigFiles")) {
                    this.pushThemeConfigs();
                }
            },
            null,
            this.context.subscriptions
        );
    }
    getHtmlAssetPath(filename: string) {
        return path.join(this.context.extensionPath, "html", filename);
    }
    updatePreview() {
        const editingEditor = vscode.window.activeTextEditor;
        if (editingEditor === undefined) {
            console.log("活动编辑器无效");
            return;
        }
        if (editingEditor.document.languageId !== "markdown") {
            return;
        }

        this.pushThemeConfigs();

        // 更新当前编辑的文件
        this.currentEditingFilePath = editingEditor.document.fileName;


        let data = editingEditor.document.getText();

        // 转换 md 为 html
        const showdown = require("showdown");
        const converter = new showdown.Converter({
            ghCompatibleHeaderId: true,
            simpleLineBreaks: true,
            strikethrough: true,
            tables: true,
            tasklists: true
        });
        data = converter.makeHtml(data);

        // 这里的  data 是 html, 判断 data 中的 img 是否是本地的图片，
        // 如果是本地的图片，就把使用 `vscode` API 的 `asWebviewUri` 方法将本地文件转换为 `vscode-resource` URI。
        // 1. 先找到所有的 img 标签
        // 2. 判断是否是本地文件
        // 3. 如果是本地文件，就转换为 vscode-resource URI
        // 4. 替换原来的 src

        const imgReg = /<img.*?(?:>|\/>)/gi;
        const srcReg = /src=[\'\"]?([^\'\"]*)[\'\"]?/i;
        const imgArr = data.match(imgReg);
        if (imgArr) {
            for (let i = 0; i < imgArr.length; i++) {
                const src = imgArr[i].match(srcReg);
                if (src && src[1]) {
                    const srcValue = src[1].trim();
                    const skipConvertPathPattern = /^(https?|ftp|data|vscode-resource|vscode-webview-resource):/i;
                    if (skipConvertPathPattern.test(srcValue)) {
                        continue;
                    }

                    const imgUri = this.resolveLocalImagePath(srcValue, editingEditor.document.fileName);
                    if (!imgUri) {
                        continue;
                    }

                    const vsImgUri = this.view.webview.asWebviewUri(imgUri);
                    const replacedTag = imgArr[i].replace(src[1], vsImgUri.toString());
                    data = data.replace(imgArr[i], replacedTag);
                }
            }
        }

        this.view.webview.postMessage({
            command: "renderMarkdown", data: data
        });
    }

    pushThemeConfigs() {
        const themes = this.loadThemeConfigs();
        this.view.webview.postMessage({
            command: "updateThemes",
            data: themes
        });
    }

    loadThemeConfigs(): ThemeConfigItem[] {
        const defaultTheme = this.loadDefaultThemeConfig();

        const configuration = vscode.workspace.getConfiguration("mdbp");
        const configuredFiles = configuration.get<string[]>("themeConfigFiles", []);
        if (!configuredFiles || configuredFiles.length === 0) {
            return defaultTheme ? [defaultTheme] : [];
        }

        const themes: ThemeConfigItem[] = [];
        const defaultThemePath = this.resolveThemeConfigPath(DEFAULT_THEME_RELATIVE_PATH);
        configuredFiles.forEach((itemPath, index) => {
            if (!itemPath || !itemPath.trim()) {
                return;
            }

            const absolutePath = this.resolveThemeConfigPath(itemPath.trim());
            if (!absolutePath || !fs.existsSync(absolutePath)) {
                return;
            }

            if (defaultThemePath && path.resolve(absolutePath) === path.resolve(defaultThemePath)) {
                return;
            }

            try {
                const raw = fs.readFileSync(absolutePath, "utf-8");
                const parsed = JSON.parse(raw) as Record<string, unknown>;
                const theme = this.normalizeThemeConfig(parsed, index);
                if (theme) {
                    themes.push(theme);
                }
            } catch {
                return;
            }
        });

        if (defaultTheme) {
            return [defaultTheme, ...themes];
        }

        return themes;
    }

    loadDefaultThemeConfig(): ThemeConfigItem | undefined {
        const defaultPath = this.resolveThemeConfigPath(DEFAULT_THEME_RELATIVE_PATH);
        if (!defaultPath || !fs.existsSync(defaultPath)) {
            return undefined;
        }

        try {
            const raw = fs.readFileSync(defaultPath, "utf-8");
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const normalized = this.normalizeThemeConfig(parsed, 0);
            if (!normalized) {
                return undefined;
            }

            return {
                ...normalized,
                id: "default",
                name: normalized.name || "默认"
            };
        } catch {
            return undefined;
        }
    }

    resolveThemeConfigPath(inputPath: string): string | undefined {
        if (path.isAbsolute(inputPath)) {
            return inputPath;
        }

        if (this.currentWorkspacePath) {
            const workspaceFile = path.join(this.currentWorkspacePath, inputPath);
            if (fs.existsSync(workspaceFile)) {
                return workspaceFile;
            }
        }

        const extensionFile = path.join(this.context.extensionPath, inputPath);
        if (fs.existsSync(extensionFile)) {
            return extensionFile;
        }

        return undefined;
    }

    normalizeThemeConfig(config: Record<string, unknown>, index: number): ThemeConfigItem | undefined {
        const name = typeof config.name === "string" && config.name.trim()
            ? config.name.trim()
            : `主题 ${index + 1}`;

        const previewStyle = this.normalizeStyleMap(config.previewStyle);
        const contentStyle = this.normalizeStyleMap(config.contentStyle);
        const elementStyles = this.normalizeNestedStyleMap(config.elementStyles);
        const inlineCodeStyle = this.normalizeStyleMap(config.inlineCodeStyle);
        const contentCss = typeof config.contentCss === "string" ? config.contentCss : undefined;

        return {
            id: `user-theme-${index + 1}`,
            name,
            previewStyle,
            contentStyle,
            elementStyles,
            inlineCodeStyle,
            contentCss
        };
    }

    normalizeStyleMap(value: unknown): Record<string, string> | undefined {
        if (!value || typeof value !== "object") {
            return undefined;
        }

        const styleMap: Record<string, string> = {};
        Object.entries(value as Record<string, unknown>).forEach(([key, styleValue]) => {
            if (!key || typeof styleValue !== "string") {
                return;
            }
            styleMap[key] = styleValue;
        });

        return Object.keys(styleMap).length > 0 ? styleMap : undefined;
    }

    normalizeNestedStyleMap(value: unknown): Record<string, Record<string, string>> | undefined {
        if (!value || typeof value !== "object") {
            return undefined;
        }

        const result: Record<string, Record<string, string>> = {};
        Object.entries(value as Record<string, unknown>).forEach(([selector, styleObject]) => {
            if (!selector) {
                return;
            }
            const normalized = this.normalizeStyleMap(styleObject);
            if (normalized) {
                result[selector] = normalized;
            }
        });

        return Object.keys(result).length > 0 ? result : undefined;
    }
    scrollPreview(percentage :number) {
        if (this.isApplyingWebviewScroll) {
            return;
        }
        this.view.webview.postMessage({
            command: "scroll", data: percentage
        });
    }
    scrollEdit(percentage :number) {
        const editingEditor = vscode.window.activeTextEditor;
        if (editingEditor === undefined) {
            
            console.log("活动编辑器无效");
            return;
        }
        // 判断当前激活的编辑器文件是 markdown 文件
        if (editingEditor.document.languageId !== "markdown") {
            return;
        }
        // 获取当前编辑器的总行数
        const totalLine = editingEditor.document.lineCount;
        // 计算出当前编辑器的滚动条滚动的行数
        const scrollLine = Math.min(totalLine - 1, Math.max(0, Math.round(totalLine * percentage)));
        // 计算出当前编辑器滚动条滚动的位置
        const scrollPosition = editingEditor.document.lineAt(scrollLine).range.start;
        // 滚动到指定位置
        this.isApplyingWebviewScroll = true;
        editingEditor.revealRange(new vscode.Range(scrollPosition, scrollPosition));
        setTimeout(() => {
            this.isApplyingWebviewScroll = false;
        }, 120);
    }
    // 定义接收 vebview 传来的消息的处理函数
    onDidReceiveMessage(message: any) {
        if (!message || typeof message.command !== "string") {
            return;
        }
        switch (message.command) {
            case "scroll":
                this.scrollEdit(message.data);
                break;
            case "msg":
                this.showMessage(message.data.message, message.data.type);
                break;
        }
    }

    resolveLocalImagePath(imagePath: string, markdownFilePath: string): vscode.Uri | undefined {
        if (path.isAbsolute(imagePath)) {
            return vscode.Uri.file(imagePath);
        }

        if (imagePath.startsWith("/") && this.currentWorkspacePath) {
            return vscode.Uri.file(path.join(this.currentWorkspacePath, imagePath));
        }

        return vscode.Uri.file(path.join(path.dirname(markdownFilePath), imagePath));
    }
    // 消息提示框
    showMessage(message: string, type: string) {
        switch (type) {
            case "error":
                vscode.window.showErrorMessage(message, { modal: true }, "OK");
                break;
            case "warning":
                vscode.window.showWarningMessage(message, { modal: true }, "OK");
                break;
            default:
                vscode.window.showInformationMessage(message);
        }
    }
}
export { BlogView };