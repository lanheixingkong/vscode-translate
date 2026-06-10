import * as vscode from "vscode";
import { TranslationPreviewProvider } from "./translationProvider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new TranslationPreviewProvider(context.secrets);

  context.subscriptions.push(
    provider,
    vscode.workspace.registerTextDocumentContentProvider(
      TranslationPreviewProvider.scheme,
      provider,
    ),
    vscode.commands.registerCommand(
      "llmLiveTranslate.translateFile",
      async () => {
        const editor = getSourceEditor();
        if (editor) {
          await provider.createPreview(editor.document, "file");
        }
      },
    ),
    vscode.commands.registerCommand(
      "llmLiveTranslate.translateSelection",
      async () => {
        const editor = getSourceEditor();
        if (!editor) {
          return;
        }
        if (editor.selection.isEmpty) {
          void vscode.window.showInformationMessage(
            "Select some content to translate first.",
          );
          return;
        }
        await provider.createPreview(
          editor.document,
          "selection",
          new vscode.Range(editor.selection.start, editor.selection.end),
        );
      },
    ),
    vscode.commands.registerCommand("llmLiveTranslate.refresh", async () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      if (uri?.scheme === TranslationPreviewProvider.scheme) {
        await provider.refreshByUri(uri);
      }
    }),
    vscode.commands.registerCommand(
      "llmLiveTranslate.configureApiKey",
      async () => {
        const apiKey = await vscode.window.showInputBox({
          title: "Configure LLM Translation API Key",
          prompt: "The key is stored securely in VS Code SecretStorage.",
          password: true,
          ignoreFocusOut: true,
        });
        if (apiKey !== undefined) {
          if (apiKey.trim()) {
            await context.secrets.store(
              "llmLiveTranslate.apiKey",
              apiKey.trim(),
            );
          } else {
            await context.secrets.delete("llmLiveTranslate.apiKey");
          }
          void vscode.window.showInformationMessage(
            apiKey.trim()
              ? "LLM translation API key saved."
              : "LLM translation API key removed.",
          );
        }
      },
    ),
  );
}

function getSourceEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showInformationMessage("Open a text file to translate.");
    return undefined;
  }
  if (editor.document.uri.scheme === TranslationPreviewProvider.scheme) {
    void vscode.window.showInformationMessage(
      "Translation previews are read-only. Run the command from a source file.",
    );
    return undefined;
  }
  return editor;
}

export function deactivate(): void {}
