import * as vscode from "vscode";

export type Provider = "openai" | "anthropic";

export interface TranslationConfig {
  provider: Provider;
  baseUrl: string;
  model: string;
  apiKey: string;
  targetLanguage: string;
  systemPrompt: string;
  maxCharacters: number;
  segmentMaxCharacters: number;
  maxConcurrentRequests: number;
  retryCount: number;
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
}

export async function readTranslationConfig(
  secrets: vscode.SecretStorage,
): Promise<TranslationConfig> {
  const config = vscode.workspace.getConfiguration("llmLiveTranslate");
  const provider = config.get<Provider>("provider", "openai");
  const defaultUrl =
    provider === "anthropic"
      ? "https://api.anthropic.com"
      : "https://api.openai.com/v1";

  return {
    provider,
    baseUrl: config.get<string>("baseUrl")?.trim() || defaultUrl,
    model: config.get<string>("model", "gpt-4o-mini").trim(),
    apiKey:
      (await secrets.get("llmLiveTranslate.apiKey")) ||
      config.get<string>("apiKey", "").trim(),
    targetLanguage: config.get<string>(
      "targetLanguage",
      "Simplified Chinese",
    ),
    systemPrompt: config.get<string>(
      "systemPrompt",
      "You are a professional translation engine. Translate the complete source text into {targetLanguage}. Never summarize, explain, answer, analyze, omit, or add information. Preserve meaning, tone, Markdown, code, placeholders, URLs, and line breaks where practical. Return only the translation, without labels or commentary.",
    ),
    maxCharacters: config.get<number>("maxCharacters", 50000),
    segmentMaxCharacters: config.get<number>("segmentMaxCharacters", 20000),
    maxConcurrentRequests: config.get<number>("maxConcurrentRequests", 5),
    retryCount: config.get<number>("retryCount", 2),
  };
}

export async function translateText(
  text: string,
  config: TranslationConfig,
  signal?: AbortSignal,
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(
      "API key is not configured. Run “LLM Translate: Configure API Key”.",
    );
  }
  if (!config.model) {
    throw new Error("Model is not configured.");
  }
  if (text.length > config.maxCharacters) {
    throw new Error(
      `Content has ${text.length} characters, exceeding the configured limit of ${config.maxCharacters}.`,
    );
  }

  const prompt = config.systemPrompt.replaceAll(
    "{targetLanguage}",
    config.targetLanguage,
  );

  const sourceMessage = [
    "Translate every part of the text between the source_text markers.",
    "Do not translate or output the markers themselves.",
    "Do not summarize, explain, answer, or omit any content.",
    "<source_text>",
    text,
    "</source_text>",
  ].join("\n");

  let lastError: unknown;
  for (let attempt = 0; attempt <= config.retryCount; attempt += 1) {
    try {
      return config.provider === "anthropic"
        ? await translateWithAnthropic(sourceMessage, prompt, config, signal)
        : await translateWithOpenAI(sourceMessage, prompt, config, signal);
    } catch (error) {
      lastError = error;
      if (signal?.aborted || attempt === config.retryCount) {
        throw error;
      }
      await wait(500 * 2 ** attempt, signal);
    }
  }
  throw lastError;
}

async function translateWithOpenAI(
  text: string,
  prompt: string,
  config: TranslationConfig,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(joinUrl(config.baseUrl, "chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: text },
      ],
    }),
    signal,
  });
  const body = (await response.json()) as OpenAIResponse;
  if (!response.ok) {
    throw new Error(body.error?.message || `OpenAI API error ${response.status}`);
  }
  const translated = body.choices?.[0]?.message?.content;
  if (!translated) {
    throw new Error("OpenAI-compatible API returned no translated content.");
  }
  return translated;
}

async function translateWithAnthropic(
  text: string,
  prompt: string,
  config: TranslationConfig,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(joinUrl(config.baseUrl, "v1/messages"), {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      temperature: 0.1,
      system: prompt,
      messages: [{ role: "user", content: text }],
    }),
    signal,
  });
  const body = (await response.json()) as AnthropicResponse;
  if (!response.ok) {
    throw new Error(
      body.error?.message || `Anthropic API error ${response.status}`,
    );
  }
  const translated = body.content
    ?.filter((item) => item.type === "text")
    .map((item) => item.text || "")
    .join("");
  if (!translated) {
    throw new Error("Anthropic-compatible API returned no translated content.");
  }
  return translated;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("The operation was aborted.", "AbortError"));
      },
      { once: true },
    );
  });
}
