import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { deflate } from "zlib";

class BlogView{
    context: vscode.ExtensionContext;
    view: vscode.WebviewPanel;
    isDisposed: boolean = false;

    configureWebviewScripts(webviewScripts: string[]) {
        //webviewScripts.push("libs/d3.js");
        return webviewScripts;
    }

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        this.view = vscode.window.createWebviewPanel(
            "blogPreview",
            "Markdown Blog Preview",
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, "html")),
                    vscode.Uri.file(vscode.env.appRoot)
                ]
            }
        );
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
            vscode.window.showWarningMessage("活动编辑器无效");
            return;
        }
        let data = editingEditor.document.getText();
        this.view.webview.postMessage({
            command: "renderMarkdown", data: data
        });
    }
    scrollPreview(percentage :number) {
        this.view.webview.postMessage({
            command: "scroll", data: percentage
        });
    }
}
export { BlogView };