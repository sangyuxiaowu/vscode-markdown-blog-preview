import * as vscode from 'vscode';
import { BlogView } from "./BlogPreviewWebview";

export function activate(context: vscode.ExtensionContext) {

	let blogPreview: BlogView;

	context.subscriptions.push(
		vscode.commands.registerCommand('mdbp.showView', () => {
			if ((blogPreview === undefined) || blogPreview.isDisposed) {
				blogPreview = new BlogView(context);
			}
			blogPreview.updatePreview();
		})
	);

	 // 向 vscode 注册当前文件发生变化时的回调函数
	 vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
        if (!!e && !!vscode.window.activeTextEditor && e.document.languageId === "markdown") {
            blogPreview.updatePreview();
        }
    });
	vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
        if (!!e && !!e.textEditor && (e.textEditor === vscode.window.activeTextEditor) && e.textEditor.document.languageId === "markdown") {
            blogPreview.updatePreview();
        }
    });
}

export function deactivate() {}
