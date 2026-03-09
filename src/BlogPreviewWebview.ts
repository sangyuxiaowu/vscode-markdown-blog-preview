import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { createHash, randomBytes } from "crypto";
import * as YAML from "yaml";
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
const yamlLanguage = require("highlight.js/lib/languages/yaml");

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

interface ImageHostInfo {
    id: string;
    name: string;
    enabled: boolean;
}

interface UploadedImageInfo {
    imageUrl: string;
}

interface ParsedFrontMatter {
    frontMatter: Record<string, unknown>;
    body: string;
}

interface ImageHostApiErrorPayload {
    code?: number;
    msg?: string;
    data?: unknown;
}

const DEFAULT_THEME_RELATIVE_PATH = "themes/default.json";
const SELECTED_THEME_STORAGE_KEY = "mdbp.selectedThemeId";
const SELECTED_CODE_THEME_STORAGE_KEY = "mdbp.selectedCodeThemeId";
const SELECTED_IMAGE_HOST_STORAGE_KEY = "mdbp.selectedImageHostId";

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
hljs.registerLanguage("yaml", yamlLanguage);
hljs.registerLanguage("yml", yamlLanguage);

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
    selectedImageHostId: string = "";
    availableImageHosts: ImageHostInfo[] = [];

    configureWebviewScripts(webviewScripts: string[]) {
        webviewScripts.push("webview-main.js");
        return webviewScripts;
    }

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.selectedThemeId = context.workspaceState.get<string>(SELECTED_THEME_STORAGE_KEY, "default");
        this.selectedCodeThemeId = context.workspaceState.get<string>(SELECTED_CODE_THEME_STORAGE_KEY, "default");
        this.selectedImageHostId = context.workspaceState.get<string>(SELECTED_IMAGE_HOST_STORAGE_KEY, "");

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
        void this.refreshImageHosts();
    }
    initializeWebviewHtml() {
        let loadingScriptHtml: string[] = [];
        this.configureWebviewScripts([]).forEach(path => {
            const jsUri = this.view.webview.asWebviewUri(vscode.Uri.file(this.getHtmlAssetPath(path)));
            loadingScriptHtml.push(
                `<script defer src="${jsUri}"></script>`);
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

                if (event.affectsConfiguration("mdbp.imageHost.apiUrl") || event.affectsConfiguration("mdbp.imageHost.token")) {
                    void this.refreshImageHosts();
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

    updatePreview() {
        const previewDocument = this.getPreviewDocument();
        if (previewDocument === undefined) {
            console.log("活动编辑器无效");
            return;
        }

        this.pushThemeConfigs();

        // 更新当前编辑的文件
        this.currentEditingFilePath = previewDocument.fileName;

        const parsedContent = this.parseMarkdownWithFrontMatter(previewDocument.getText());
        const imageHostData = this.getImageHostData(parsedContent.frontMatter, this.selectedImageHostId);

        let data = parsedContent.body;

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

                    const normalizedSrc = this.normalizeLocalKey(srcValue);
                    const hostedInfo = imageHostData.images[normalizedSrc];

                    if (hostedInfo?.imageUrl) {
                        const replacedHostedTag = imgArr[i].replace(src[1], hostedInfo.imageUrl);
                        data = data.replace(imgArr[i], replacedHostedTag);
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

        this.pushImageHostState();

        this.view.webview.postMessage({
            command: "renderMarkdown", data: data
        });
    }

    getImageHostSettings() {
        const config = vscode.workspace.getConfiguration("mdbp");
        const apiUrl = (config.get<string>("imageHost.apiUrl", "") || "").trim().replace(/\/$/, "");
        const token = (config.get<string>("imageHost.token", "") || "").trim();
        return {
            apiUrl,
            token,
            enabled: Boolean(apiUrl && token)
        };
    }

    pushImageHostState() {
        const settings = this.getImageHostSettings();
        const activeHostId = this.availableImageHosts.some((host) => host.id === this.selectedImageHostId)
            ? this.selectedImageHostId
            : (this.availableImageHosts[0]?.id || "");

        if (activeHostId !== this.selectedImageHostId) {
            this.persistSelectedImageHost(activeHostId);
        }

        this.view.webview.postMessage({
            command: "updateImageHosts",
            data: {
                enabled: settings.enabled,
                hosts: this.availableImageHosts,
                selectedHostId: activeHostId
            }
        });
    }

    async refreshImageHosts() {
        const settings = this.getImageHostSettings();
        if (!settings.enabled) {
            this.availableImageHosts = [];
            this.pushImageHostState();
            this.updatePreview();
            return;
        }

        try {
            const signedListUrl = this.buildSignedUrl(settings.apiUrl, "/api/imagehost/list", settings.token);
            const response = await fetch(signedListUrl, { method: "GET" });
            const payload = await this.parseJsonResponse<ImageHostApiErrorPayload & { data?: { hosts?: Array<Record<string, unknown>> } }>(response);

            if (!response.ok || payload.code !== 0) {
                throw new Error(this.buildImageHostApiError("获取图床列表", response, payload));
            }

            const nextHosts = Array.isArray(payload.data?.hosts)
                ? payload.data!.hosts!.map((host) => {
                    const id = typeof host.id === "string" ? host.id : "";
                    const name = typeof host.name === "string" ? host.name : id;
                    const enabled = host.enabled !== false;
                    return { id, name, enabled } as ImageHostInfo;
                }).filter((host) => Boolean(host.id))
                : [];

            this.availableImageHosts = nextHosts.filter((host) => host.enabled);
        } catch (error) {
            this.availableImageHosts = [];
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            vscode.window.showWarningMessage(`图床服务不可用：${errorMessage}`);
        }

        this.pushImageHostState();
        this.updatePreview();
    }

    buildSignedUrl(apiUrl: string, endpoint: string, token: string): string {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = randomBytes(20).toString("hex").slice(0, 30);
        const signature = this.generateSignature(token, timestamp, nonce);
        const url = new URL(`${apiUrl}${endpoint}`);
        url.searchParams.set("timestamp", timestamp);
        url.searchParams.set("nonce", nonce);
        url.searchParams.set("signature", signature);
        return url.toString();
    }

    generateSignature(token: string, timestamp: string, nonce: string): string {
        const raw = [token, timestamp, nonce].sort().join("");
        return createHash("sha1").update(raw, "utf8").digest("hex");
    }

    parseMarkdownWithFrontMatter(content: string): ParsedFrontMatter {
        const normalizedContent = content.startsWith("\uFEFF") ? content.slice(1) : content;
        const match = normalizedContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
        if (!match) {
            return {
                frontMatter: {},
                body: normalizedContent
            };
        }

        const yamlText = match[1] || "";
        const body = normalizedContent.slice(match[0].length);

        try {
            const parsed = YAML.parse(yamlText);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return {
                    frontMatter: parsed as Record<string, unknown>,
                    body
                };
            }
        } catch {
            return {
                frontMatter: {},
                body: normalizedContent
            };
        }

        return {
            frontMatter: {},
            body
        };
    }

    buildMarkdownWithFrontMatter(frontMatter: Record<string, unknown>, body: string): string {
        const yamlBody = YAML.stringify(frontMatter).trim();
        if (!yamlBody) {
            return body;
        }
        return `---\n${yamlBody}\n---\n\n${body}`;
    }

    getImageHostData(frontMatter: Record<string, unknown>, hostId: string): {
        images: Record<string, UploadedImageInfo>;
        coverRef?: string;
    } {
        if (!hostId) {
            return { images: {} };
        }

        const mdbp = this.toRecord(frontMatter.mdbp);
        const imageHosts = this.toRecord(mdbp.imageHosts);
        const hostData = this.toRecord(imageHosts[hostId]);

        const imagesRaw = this.toRecord(hostData.images);
        const images: Record<string, UploadedImageInfo> = {};
        Object.entries(imagesRaw).forEach(([localPath, value]) => {
            const normalized = this.normalizeLocalKey(localPath);
            const imageUrl = typeof value === "string" ? value : "";
            if (!imageUrl) {
                return;
            }

            images[normalized] = {
                imageUrl
            };
        });

        const coverRef = typeof hostData.coverRef === "string" ? this.normalizeLocalKey(hostData.coverRef) : undefined;

        return { images, coverRef };
    }

    normalizeLocalKey(value: string): string {
        return value.trim().replace(/\\/g, "/");
    }

    toRecord(value: unknown): Record<string, unknown> {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {};
        }
        return value as Record<string, unknown>;
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
            case "selectImageHost":
                if (typeof message.data === "string") {
                    this.persistSelectedImageHost(message.data.trim());
                    this.updatePreview();
                }
                break;
            case "uploadImages":
                void this.uploadImagesToImageHost(typeof message.data === "string" ? message.data : "");
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

    persistSelectedImageHost(hostId: string) {
        this.selectedImageHostId = hostId;
        void this.context.workspaceState.update(SELECTED_IMAGE_HOST_STORAGE_KEY, hostId);
        this.pushImageHostState();
    }

    async uploadImagesToImageHost(hostId: string) {
        const activeHostId = hostId || this.selectedImageHostId;
        const settings = this.getImageHostSettings();

        if (!settings.enabled) {
            this.showMessage("请先配置 mdbp.imageHost.apiUrl 和 mdbp.imageHost.token", "warning");
            return;
        }
        if (!activeHostId) {
            this.showMessage("请先选择图床", "warning");
            return;
        }

        const previewDocument = this.getPreviewDocument();
        if (!previewDocument) {
            this.showMessage("未找到可上传的 Markdown 文件", "warning");
            return;
        }

        this.view.webview.postMessage({ command: "uploading", data: true });

        try {
            const parsed = this.parseMarkdownWithFrontMatter(previewDocument.getText());
            const imageHostData = this.getImageHostData(parsed.frontMatter, activeHostId);
            const localImageKeys = this.extractLocalImageKeysFromMarkdown(parsed.body);
            const coverPath = this.extractCoverLocalPath(parsed.frontMatter);
            if (coverPath) {
                localImageKeys.add(this.normalizeLocalKey(coverPath));
            }

            if (localImageKeys.size === 0) {
                this.showMessage("未找到可上传的本地图片", "warning");
                return;
            }

            const uploadedNow: Array<{ localPath: string; imageUrl: string }> = [];
            const skipped: string[] = [];
            const failed: string[] = [];
            for (const localPath of localImageKeys) {
                const alreadyUploaded = imageHostData.images[localPath]?.imageUrl;
                if (alreadyUploaded) {
                    skipped.push(localPath);
                    continue;
                }

                const imageUri = this.resolveLocalImagePath(localPath, previewDocument.fileName);
                if (!imageUri || !fs.existsSync(imageUri.fsPath)) {
                    failed.push(`${localPath}(文件不存在)`);
                    continue;
                }

                let uploadResult: { imageUrl: string; imageId?: string };
                try {
                    uploadResult = await this.uploadSingleImage(settings.apiUrl, settings.token, activeHostId, imageUri.fsPath);
                } catch (uploadError) {
                    const uploadErrorMessage = uploadError instanceof Error ? uploadError.message : "未知错误";
                    failed.push(`${localPath}(${uploadErrorMessage})`);
                    continue;
                }

                uploadedNow.push({
                    localPath,
                    imageUrl: uploadResult.imageUrl
                });
            }

            if (uploadedNow.length === 0 && failed.length === 0) {
                this.showMessage("图片已全部上传，无需重复上传", "success");
                return;
            }

            const nextFrontMatter = this.applyUploadedMappingsToFrontMatter(
                parsed.frontMatter,
                activeHostId,
                uploadedNow,
                coverPath ? this.normalizeLocalKey(coverPath) : ""
            );
            const nextContent = this.buildMarkdownWithFrontMatter(nextFrontMatter, parsed.body);

            await this.replaceDocumentContent(previewDocument, nextContent);
            this.persistSelectedImageHost(activeHostId);
            this.updatePreview();

            const summary = `上传完成：成功 ${uploadedNow.length}，跳过 ${skipped.length}，失败 ${failed.length}`;
            const failedDetail = failed.length > 0 ? `\n失败详情：${failed.join("; ")}` : "";
            this.showMessage(failed.length > 0 ? `${summary}${failedDetail}` : summary, failed.length > 0 ? "warning" : "success");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            this.showMessage(`上传失败：${errorMessage}`, "error");
        } finally {
            this.view.webview.postMessage({ command: "uploading", data: false });
        }
    }

    async uploadSingleImage(apiUrl: string, token: string, hostId: string, absoluteFilePath: string): Promise<{ imageUrl: string; imageId?: string }> {
        const signedUploadUrl = this.buildSignedUrl(apiUrl, "/api/imagehost/upload", token);
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(absoluteFilePath);
        const fileBlob = new Blob([fileBuffer]);
        formData.append("hostId", hostId);
        formData.append("file", fileBlob, path.basename(absoluteFilePath));

        const response = await fetch(signedUploadUrl, {
            method: "POST",
            body: formData
        });
        const payload = await this.parseJsonResponse<ImageHostApiErrorPayload & {
            data?: {
                success?: boolean;
                imageUrl?: string;
                imageId?: string;
            };
        }>(response);

        const imageUrl = payload?.data?.imageUrl;
        if (!response.ok || payload.code !== 0 || !payload?.data?.success || !imageUrl) {
            throw new Error(this.buildImageHostApiError("上传图片", response, payload));
        }

        return {
            imageUrl,
            imageId: payload.data.imageId
        };
    }

    async parseJsonResponse<T>(response: Response): Promise<T> {
        const rawText = await response.text();
        if (!rawText) {
            return {} as T;
        }

        try {
            return JSON.parse(rawText) as T;
        } catch {
            return ({ msg: rawText } as unknown) as T;
        }
    }

    buildImageHostApiError(action: string, response: Response, payload?: ImageHostApiErrorPayload): string {
        const code = typeof payload?.code === "number" ? payload.code : undefined;
        const msg = typeof payload?.msg === "string" && payload.msg.trim() ? payload.msg.trim() : "无错误消息";
        const codeText = code !== undefined ? ` code=${code}` : "";
        return `${action}失败(status=${response.status}${codeText}): ${msg}`;
    }

    extractLocalImageKeysFromMarkdown(markdownBody: string): Set<string> {
        const localPaths = new Set<string>();
        const markdownImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
        const htmlImgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;

        let markdownMatch: RegExpExecArray | null;
        while ((markdownMatch = markdownImageRegex.exec(markdownBody)) !== null) {
            const rawTarget = markdownMatch[1].trim();
            const cleanedTarget = rawTarget
                .replace(/^<|>$/g, "")
                .split(/\s+/)[0]
                .trim();
            if (this.isLocalImagePath(cleanedTarget)) {
                localPaths.add(this.normalizeLocalKey(cleanedTarget));
            }
        }

        let htmlMatch: RegExpExecArray | null;
        while ((htmlMatch = htmlImgRegex.exec(markdownBody)) !== null) {
            const rawSrc = htmlMatch[1].trim();
            if (this.isLocalImagePath(rawSrc)) {
                localPaths.add(this.normalizeLocalKey(rawSrc));
            }
        }

        return localPaths;
    }

    isLocalImagePath(imagePath: string): boolean {
        if (!imagePath) {
            return false;
        }
        return !/^(https?|ftp|data|vscode-resource|vscode-webview-resource):/i.test(imagePath);
    }

    extractCoverLocalPath(frontMatter: Record<string, unknown>): string | undefined {
        const cover = frontMatter.cover;
        if (typeof cover !== "string") {
            return undefined;
        }

        const normalized = cover.trim();
        if (!normalized || !this.isLocalImagePath(normalized)) {
            return undefined;
        }
        return normalized;
    }

    applyUploadedMappingsToFrontMatter(
        frontMatter: Record<string, unknown>,
        hostId: string,
        uploadedMappings: Array<{ localPath: string; imageUrl: string }>,
        coverLocalPath: string
    ): Record<string, unknown> {
        const nextFrontMatter: Record<string, unknown> = { ...frontMatter };
        const mdbp = this.toRecord(nextFrontMatter.mdbp);
        const imageHosts = this.toRecord(mdbp.imageHosts);
        const hostData = this.toRecord(imageHosts[hostId]);
        const images = this.toRecord(hostData.images);

        const now = new Date().toISOString();

        uploadedMappings.forEach((item) => {
            const normalizedLocal = this.normalizeLocalKey(item.localPath);
            images[normalizedLocal] = item.imageUrl;
        });

        if (coverLocalPath) {
            hostData.coverRef = coverLocalPath;
        }
        hostData.updatedAt = now;

        hostData.images = images;
        imageHosts[hostId] = hostData;
        nextFrontMatter.mdbp = {
            ...mdbp,
            imageHosts
        };

        return nextFrontMatter;
    }

    async replaceDocumentContent(document: vscode.TextDocument, content: string) {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullRange, content);
        await vscode.workspace.applyEdit(edit);
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
                vscode.window.showWarningMessage(message);
                break;
            default:
                vscode.window.showInformationMessage(message);
        }
    }
}
export { BlogView };