import * as vscode from 'vscode';
import { BlogView } from "./BlogPreviewWebview";

export function activate(context: vscode.ExtensionContext) {
	let blogPreview: BlogView | undefined;

	context.subscriptions.push(
		vscode.commands.registerCommand('mdbp.showView', () => {
			if (!blogPreview || blogPreview.isDisposed) {
				blogPreview = new BlogView(context);
			}
			blogPreview.updatePreview();
		})
	);

	// 向 vscode 注册当前文件发生变化时的回调函数
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
			if (!blogPreview || blogPreview.isDisposed || !vscode.window.activeTextEditor) {
				return;
			}
			if (e.document.languageId === "markdown") {
				blogPreview.updatePreview();
			}
		})
	);
	// 切换窗口了，如果是 md 的就更新一下
	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
			if (!blogPreview || blogPreview.isDisposed || !e.textEditor) {
				return;
			}
			if ((e.textEditor === vscode.window.activeTextEditor) && e.textEditor.document.languageId === "markdown") {
				blogPreview.updatePreview();
			}
		})
	);
	// 滚动了visibleRanges[0][0].line
	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorVisibleRanges((e: vscode.TextEditorVisibleRangesChangeEvent) => {
			if (!blogPreview || blogPreview.isDisposed || !e.textEditor || e.visibleRanges.length === 0) {
				return;
			}
			if (e.textEditor.document.languageId === "markdown") {
				const ratio = e.visibleRanges[0].start.line / Math.max(1, e.textEditor.document.lineCount);
				blogPreview.scrollPreview(ratio);
			}
		})
	);
}

export function deactivate() {}
