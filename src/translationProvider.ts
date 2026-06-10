import * as vscode from "vscode";
import {
  readTranslationConfig,
  translateText,
} from "./translationClient";
import { segmentText, TextSegment } from "./segmenter";

type PreviewKind = "file" | "selection";

interface Preview {
  id: string;
  uri: vscode.Uri;
  sourceUri: vscode.Uri;
  sourceLanguageId: string;
  kind: PreviewKind;
  selection?: vscode.Range;
  content: string;
  requestVersion: number;
  controller?: AbortController;
  timer?: NodeJS.Timeout;
  results: SegmentResult[];
}

interface SegmentResult extends TextSegment {
  translation?: string;
  error?: string;
}

export class TranslationPreviewProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  static readonly scheme = "llm-translate";

  private readonly previews = new Map<string, Preview>();
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly disposables: vscode.Disposable[] = [];

  readonly onDidChange = this.emitter.event;

  constructor(private readonly secrets: vscode.SecretStorage) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (
          event.document.uri.scheme === TranslationPreviewProvider.scheme ||
          !vscode.workspace
            .getConfiguration("llmLiveTranslate")
            .get<boolean>("liveUpdate", true)
        ) {
          return;
        }

        for (const preview of this.previews.values()) {
          if (
            preview.kind === "file" &&
            preview.sourceUri.toString() === event.document.uri.toString()
          ) {
            this.scheduleRefresh(preview);
          }
        }
      }),
    );
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.previews.get(uri.path)?.content ?? "Translation preview expired.";
  }

  async createPreview(
    document: vscode.TextDocument,
    kind: PreviewKind,
    selection?: vscode.Range,
  ): Promise<vscode.Uri> {
    const id = `/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const sourceName = document.uri.path.split("/").pop() || "Untitled";
    const uri = vscode.Uri.from({
      scheme: TranslationPreviewProvider.scheme,
      path: id,
      query: `source=${encodeURIComponent(document.uri.toString())}`,
      fragment: `${sourceName} (${kind === "file" ? "Translated" : "Selection Translation"})`,
    });

    const preview: Preview = {
      id,
      uri,
      sourceUri: document.uri,
      sourceLanguageId: document.languageId,
      kind,
      selection,
      content: "Translating…",
      requestVersion: 0,
      results: [],
    };
    this.previews.set(id, preview);

    const translatedDocument = await vscode.workspace.openTextDocument(uri);
    await vscode.languages.setTextDocumentLanguage(translatedDocument, "markdown");
    await vscode.window.showTextDocument(translatedDocument, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
      preserveFocus: false,
    });
    void this.refresh(preview);
    return uri;
  }

  async refreshByUri(uri: vscode.Uri): Promise<void> {
    const preview = this.previews.get(uri.path);
    if (preview) {
      await this.refresh(preview);
    }
  }

  private scheduleRefresh(preview: Preview): void {
    if (preview.timer) {
      clearTimeout(preview.timer);
    }
    const delay = vscode.workspace
      .getConfiguration("llmLiveTranslate")
      .get<number>("debounceMs", 1200);
    preview.timer = setTimeout(() => void this.refresh(preview), delay);
  }

  private async refresh(preview: Preview): Promise<void> {
    const version = ++preview.requestVersion;
    preview.controller?.abort();
    preview.controller = new AbortController();

    try {
      const document = await vscode.workspace.openTextDocument(preview.sourceUri);
      const text =
        preview.kind === "selection" && preview.selection
          ? document.getText(preview.selection)
          : document.getText();
      const config = await readTranslationConfig(this.secrets);
      const segmentLimit = Math.min(
        config.segmentMaxCharacters,
        config.maxCharacters,
      );
      preview.results = segmentText(text, segmentLimit);
      preview.content = this.render(preview);
      this.fire(preview);

      await runConcurrent(
        preview.results,
        config.maxConcurrentRequests,
        async (segment) => {
          try {
            segment.translation = await translateText(
              segment.source,
              config,
              preview.controller?.signal,
            );
          } catch (error) {
            if (isAbortError(error)) {
              throw error;
            }
            segment.error = error instanceof Error ? error.message : String(error);
          }
          if (preview.requestVersion === version) {
            preview.content = this.render(preview);
            this.fire(preview);
          }
        },
      );
    } catch (error) {
      if (preview.requestVersion !== version || isAbortError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      preview.content = `Translation failed:\n\n${message}`;
      this.fire(preview);
      void vscode.window.showErrorMessage(`LLM translation failed: ${message}`);
    }
  }

  private fire(preview: Preview): void {
    this.emitter.fire(preview.uri);
  }

  private render(preview: Preview): string {
    return preview.results
      .map((segment) => {
        const translation = segment.translation ?? "";
        return translation
          ? `${segment.source}\n\n${translation}`
          : segment.source;
      })
      .join("\n\n");
  }

  dispose(): void {
    for (const preview of this.previews.values()) {
      preview.controller?.abort();
      if (preview.timer) {
        clearTimeout(preview.timer);
      }
    }
    this.emitter.dispose();
    this.disposables.forEach((item) => item.dispose());
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await worker(item);
      }
    }),
  );
}
