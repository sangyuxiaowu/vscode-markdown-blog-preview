import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { deflate } from "zlib";

class BlogView{
    context: vscode.ExtensionContext;
    view: vscode.WebviewPanel;
    isDisposed: boolean = false;
    // 当前工作目录
    currentWorkspacePath: string = "";
    // 当前编辑的文件
    currentEditingFilePath: string = "";

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
    }
    initializeWebviewHtml() {
        let loadingScriptHtml: string[] = [];
        this.configureWebviewScripts([]).forEach(path => {
            var jsUri = vscode.Uri.file(this.getHtmlAssetPath(path)).with({
                scheme: "vscode-resource"
            });
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

        // 更新当前编辑的文件
        this.currentEditingFilePath = editingEditor.document.fileName;


        let data = editingEditor.document.getText();

        // 转换 md 为 html
        const showdown = require("showdown");
        const converter = new showdown.Converter();
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
                let src = imgArr[i].match(srcReg);
                if (src && src[1]) {
                    // 判断图片文件是否非网络图
                    const networkImagePathPattern = /^(https?|ftp):\/\//; // 匹配以 http://、https://、ftp:// 开头的路径
                    if (networkImagePathPattern.test(src[1])) {
                        continue;
                    }

                    // 按照相对路径文件处理，转换为 vscode-resource URI
                    const imgUri = vscode.Uri.file(
                        path.join(path.dirname(editingEditor.document.fileName), src[1])
                    );
                    const vsImgUri = this.view.webview.asWebviewUri(imgUri);
                    data = data.replace(src[1], vsImgUri.toString());

                }
            }
        }

        this.view.webview.postMessage({
            command: "renderMarkdown", data: data
        });
    }
    scrollPreview(percentage :number) {
        this.view.webview.postMessage({
            command: "scroll", data: percentage
        });
    }
    scrollEdit(percentage :number) {
        // TODO: 效果存在异常，需要优化

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
        const scrollLine = Math.round(totalLine * percentage);
        // 计算出当前编辑器滚动条滚动的位置
        const scrollPosition = editingEditor.document.lineAt(scrollLine).range.start;
        // 滚动到指定位置
        editingEditor.revealRange(new vscode.Range(scrollPosition, scrollPosition));
    }
    // 定义接收 vebview 传来的消息的处理函数
    onDidReceiveMessage(message: any) {
        switch (message.command) {
            case "scroll":
                this.scrollEdit(message.data);
                break;
            case "msg":
                this.showMessage(message.data.message, message.data.type);
                break;
        }
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