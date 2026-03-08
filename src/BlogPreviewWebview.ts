import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
const hljs = require("highlight.js/lib/core");
const bash = require("highlight.js/lib/languages/bash");
const c = require("highlight.js/lib/languages/c");
const cpp = require("highlight.js/lib/languages/cpp");
const csharp = require("highlight.js/lib/languages/csharp");
const css = require("highlight.js/lib/languages/css");
const go = require("highlight.js/lib/languages/go");
const java = require("highlight.js/lib/languages/java");
const javascript = require("highlight.js/lib/languages/javascript");
const json = require("highlight.js/lib/languages/json");
const markdown = require("highlight.js/lib/languages/markdown");
const python = require("highlight.js/lib/languages/python");
const rust = require("highlight.js/lib/languages/rust");
const sql = require("highlight.js/lib/languages/sql");
const typescript = require("highlight.js/lib/languages/typescript");
const xml = require("highlight.js/lib/languages/xml");
const yaml = require("highlight.js/lib/languages/yaml");

interface ThemeConfigItem {
    id: string;
    name: string;
    previewStyle?: Record<string, string>;
    contentStyle?: Record<string, string>;
    elementStyles?: Record<string, Record<string, string>>;
    inlineCodeStyle?: Record<string, string>;
    contentCss?: string;
}

interface CodeThemeConfigItem {
    id: string;
    name: string;
    blockStyle?: Record<string, string>;
    codeStyle?: Record<string, string>;
    tokenStyles?: Record<string, Record<string, string>>;
}

const DEFAULT_THEME_RELATIVE_PATH = "themes/default.json";
const SELECTED_THEME_STORAGE_KEY = "mdbp.selectedThemeId";
const SELECTED_CODE_THEME_STORAGE_KEY = "mdbp.selectedCodeThemeId";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("h", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("cc", cpp);
hljs.registerLanguage("cxx", cpp);
hljs.registerLanguage("hpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cs", csharp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("go", go);
hljs.registerLanguage("golang", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("svg", xml);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);

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
    selectedThemeId: string = "default";
    selectedCodeThemeId: string = "default";

    configureWebviewScripts(webviewScripts: string[]) {
        //webviewScripts.push("libs/d3.js");
        return webviewScripts;
    }

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.selectedThemeId = context.workspaceState.get<string>(SELECTED_THEME_STORAGE_KEY, "default");
        this.selectedCodeThemeId = context.workspaceState.get<string>(SELECTED_CODE_THEME_STORAGE_KEY, "default");

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
                if (event.affectsConfiguration("mdbp.themeConfigFiles") || event.affectsConfiguration("mdbp.codeThemeConfigFiles")) {
                    this.pushThemeConfigs();
                    this.updatePreview();
                }
            },
            null,
            this.context.subscriptions
        );
    }
    getHtmlAssetPath(filename: string) {
        return path.join(this.context.extensionPath, "html", filename);
    }

    getPreviewDocument(): vscode.TextDocument | undefined {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor?.document.languageId === "markdown") {
            return activeEditor.document;
        }

        if (this.currentEditingFilePath) {
            const existingDocument = vscode.workspace.textDocuments.find((document) => {
                return document.fileName === this.currentEditingFilePath && document.languageId === "markdown";
            });
            if (existingDocument) {
                return existingDocument;
            }
        }

        return vscode.workspace.textDocuments.find((document) => document.languageId === "markdown");
    }

    stripLeadingFrontMatter(markdownContent: string): string {
        const leadingFrontMatterPattern = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n)*/;
        return markdownContent.replace(leadingFrontMatterPattern, "");
    }

    updatePreview() {
        const previewDocument = this.getPreviewDocument();
        if (previewDocument === undefined) {
            console.log("活动编辑器无效");
            return;
        }

        this.pushThemeConfigs();

        // 更新当前编辑的文件
        this.currentEditingFilePath = previewDocument.fileName;


        let data = previewDocument.getText();
        data = this.stripLeadingFrontMatter(data);

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

                    const imgUri = this.resolveLocalImagePath(srcValue, previewDocument.fileName);
                    if (!imgUri) {
                        continue;
                    }

                    const vsImgUri = this.view.webview.asWebviewUri(imgUri);
                    const replacedTag = imgArr[i].replace(src[1], vsImgUri.toString());
                    data = data.replace(imgArr[i], replacedTag);
                }
            }
        }

        if (this.selectedCodeThemeId !== "default") {
            data = this.highlightCodeBlocksInHtml(data);
        }

        this.view.webview.postMessage({
            command: "renderMarkdown", data: data
        });
    }

    pushThemeConfigs() {
        const themes = this.loadThemeConfigs();
        const codeThemes = this.loadCodeThemeConfigs();
        const activeThemeId = themes.some(theme => theme.id === this.selectedThemeId)
            ? this.selectedThemeId
            : (themes[0]?.id ?? "default");
        const activeCodeThemeId = codeThemes.some(theme => theme.id === this.selectedCodeThemeId)
            ? this.selectedCodeThemeId
            : "default";

        if (activeThemeId !== this.selectedThemeId) {
            this.persistSelectedTheme(activeThemeId);
        }
        if (activeCodeThemeId !== this.selectedCodeThemeId) {
            this.persistSelectedCodeTheme(activeCodeThemeId);
        }

        this.view.webview.postMessage({
            command: "updateThemes",
            data: {
                themes,
                selectedThemeId: activeThemeId,
                codeThemes,
                selectedCodeThemeId: activeCodeThemeId
            }
        });
    }

    loadCodeThemeConfigs(): CodeThemeConfigItem[] {
        const configuration = vscode.workspace.getConfiguration("mdbp");
        const configuredFiles = configuration.get<string[]>("codeThemeConfigFiles", []);
        if (!configuredFiles || configuredFiles.length === 0) {
            return [];
        }

        const themes: CodeThemeConfigItem[] = [];
        configuredFiles.forEach((itemPath, index) => {
            if (!itemPath || !itemPath.trim()) {
                return;
            }

            const absolutePath = this.resolveThemeConfigPath(itemPath.trim());
            if (!absolutePath || !fs.existsSync(absolutePath)) {
                return;
            }

            try {
                const raw = fs.readFileSync(absolutePath, "utf-8");
                const parsed = JSON.parse(raw) as Record<string, unknown>;
                const theme = this.normalizeCodeThemeConfig(parsed, index, path.resolve(absolutePath));
                if (theme) {
                    themes.push(theme);
                }
            } catch {
                return;
            }
        });

        return themes;
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
                const theme = this.normalizeThemeConfig(parsed, index, path.resolve(absolutePath));
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

    normalizeThemeConfig(config: Record<string, unknown>, index: number, themeId?: string): ThemeConfigItem | undefined {
        const name = typeof config.name === "string" && config.name.trim()
            ? config.name.trim()
            : `主题 ${index + 1}`;

        const previewStyle = this.normalizeStyleMap(config.previewStyle);
        const contentStyle = this.normalizeStyleMap(config.contentStyle);
        const elementStyles = this.normalizeNestedStyleMap(config.elementStyles);
        const inlineCodeStyle = this.normalizeStyleMap(config.inlineCodeStyle);
        const contentCss = typeof config.contentCss === "string" ? config.contentCss : undefined;

        return {
            id: themeId || `user-theme-${index + 1}`,
            name,
            previewStyle,
            contentStyle,
            elementStyles,
            inlineCodeStyle,
            contentCss
        };
    }

    normalizeCodeThemeConfig(config: Record<string, unknown>, index: number, themeId?: string): CodeThemeConfigItem | undefined {
        const name = typeof config.name === "string" && config.name.trim()
            ? config.name.trim()
            : `代码主题 ${index + 1}`;

        const blockStyle = this.normalizeStyleMap(config.blockStyle);
        const codeStyle = this.normalizeStyleMap(config.codeStyle);
        const tokenStyles = this.normalizeNestedStyleMap(config.tokenStyles);

        return {
            id: themeId || `code-theme-${index + 1}`,
            name,
            blockStyle,
            codeStyle,
            tokenStyles
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
            case "selectTheme":
                if (typeof message.data === "string" && message.data.trim()) {
                    this.persistSelectedTheme(message.data.trim());
                }
                break;
            case "selectCodeTheme":
                if (typeof message.data === "string" && message.data.trim()) {
                    this.persistSelectedCodeTheme(message.data.trim());
                    this.pushThemeConfigs();
                    this.updatePreview();
                }
                break;
            case "msg":
                this.showMessage(message.data.message, message.data.type);
                break;
        }
    }

    persistSelectedTheme(themeId: string) {
        this.selectedThemeId = themeId;
        void this.context.workspaceState.update(SELECTED_THEME_STORAGE_KEY, themeId);
    }

    persistSelectedCodeTheme(themeId: string) {
        this.selectedCodeThemeId = themeId;
        void this.context.workspaceState.update(SELECTED_CODE_THEME_STORAGE_KEY, themeId);
    }

    highlightCodeBlocksInHtml(html: string): string {
        return html.replace(/<pre><code(?: class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g, (_match, classNames = "", encodedCode = "") => {
            const originalClassNames = typeof classNames === "string" ? classNames.trim() : "";
            const language = this.extractCodeLanguage(originalClassNames);
            const code = this.decodeHtmlEntities(encodedCode);

            try {
                const highlighted = language && hljs.getLanguage(language)
                    ? hljs.highlight(code, { language, ignoreIllegals: true }).value
                    : hljs.highlightAuto(code).value;
                const mergedClassNames = ["hljs", originalClassNames].filter(Boolean).join(" ");
                return `<pre data-mdbp-code-block=""><code class="${mergedClassNames}" data-mdbp-code-content="">${highlighted}</code></pre>`;
            } catch {
                return `<pre data-mdbp-code-block=""><code class="${originalClassNames}" data-mdbp-code-content="">${encodedCode}</code></pre>`;
            }
        });
    }

    extractCodeLanguage(classNames: string): string | undefined {
        if (!classNames) {
            return undefined;
        }

        const names = classNames.split(/\s+/).filter(Boolean);
        for (const className of names) {
            const matched = className.match(/^(?:language|lang)-(.+)$/i);
            if (matched && matched[1]) {
                return matched[1].toLowerCase();
            }
        }

        return undefined;
    }

    decodeHtmlEntities(value: string): string {
        return value
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, "&");
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