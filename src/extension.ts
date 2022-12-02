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
	// 切换窗口了，如果是 md 的就更新一下
	vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
        if (!!e && !!e.textEditor && (e.textEditor === vscode.window.activeTextEditor) && e.textEditor.document.languageId === "markdown") {
            blogPreview.updatePreview();
        }
    });
	// 滚动了visibleRanges[0][0].line
	vscode.window.onDidChangeTextEditorVisibleRanges((e:vscode.TextEditorVisibleRangesChangeEvent)=>{
		if (!!e && !!e.textEditor && (e.textEditor === vscode.window.activeTextEditor) && e.textEditor.document.languageId === "markdown") {
            blogPreview.scrollPreview(e.visibleRanges[0].start.line / e.textEditor.document.lineCount);
        }
	});
}

export function deactivate() {}
