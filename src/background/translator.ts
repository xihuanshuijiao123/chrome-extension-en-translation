/**
 * AI 翻译模块：以 OpenAI 兼容协议流式调用（默认 Qwen / DashScope）。
 * 使用 fetch + SSE 手写解析实现流式输出，支持中断（AbortSignal）与空闲超时，
 * 错误统一映射为结构化错误码（错误码 + 可读信息）。
 */
import {
  TRANSLATE_ERROR_CODE,
  TRANSLATE_ERROR_MESSAGE,
  type TranslateErrorCode,
} from "../shared/messages";
import type { AppConfig, TranslatePayload } from "../shared/types";

/** 空闲超时：连续 N 毫秒无增量输出视为超时 */
const IDLE_TIMEOUT_MS = 60_000;

/** 翻译错误（带错误码与可读信息） */
export class TranslateError extends Error {
  code: TranslateErrorCode;
  detail?: string;

  constructor(code: TranslateErrorCode, detail?: string) {
    super(TRANSLATE_ERROR_MESSAGE[code]);
    this.name = "TranslateError";
    this.code = code;
    this.detail = detail;
  }
}

/** 系统提示词：翻译要求与输出格式（需求文档 §3.5） */
const SYSTEM_PROMPT = `你是一个专业的英语→中文翻译引擎，将用户提供的英文 Markdown 文章翻译为中文。

要求：
1. 完整保留 Markdown 结构（标题层级、列表、引用块、代码块、图片、链接等语法）。
2. 输出严格遵循以下格式：
# [翻译后的文章标题]

>**作者**:[作者名]
>**原文链接**:[原文链接]

[翻译后的正文]

3. 若未提供作者，则不输出作者行；若未提供原文链接，则不输出原文链接行。
4. 只输出翻译结果本身，不要任何解释、前言或额外说明。`;

/** 组装用户消息：标题 + 作者/原文链接引用块 + 正文 Markdown */
function buildUserContent(payload: TranslatePayload): string {
  const lines: string[] = [];
  if (payload.title) {
    lines.push(`# ${payload.title}`);
  }
  const meta: string[] = [];
  if (payload.author) {
    meta.push(`>**作者**:${payload.author}`);
  }
  if (payload.url) {
    meta.push(`>**原文链接**:${payload.url}`);
  }
  if (meta.length > 0) {
    lines.push(meta.join("\n"));
  }
  if (payload.sourceMarkdown) {
    lines.push(payload.sourceMarkdown);
  }
  return lines.join("\n\n");
}

export interface StreamTranslateOptions {
  /** 已保存的模型服务配置 */
  config: AppConfig;
  /** 待翻译文章（标题 / 作者 / 链接 / 原文 Markdown） */
  payload: TranslatePayload;
  /** 中断信号（用户点击停止时触发） */
  signal: AbortSignal;
  /** 增量回调：每收到一段译文即触发 */
  onChunk: (chunk: string) => void;
}

export interface StreamTranslateResult {
  /** 累积的完整译文 */
  fullText: string;
  /** 是否因用户停止而提前结束（保留已输出部分） */
  aborted: boolean;
}

/**
 * 流式翻译入口：组装消息 → 请求 OpenAI 兼容接口 → SSE 解析 → 逐段回调。
 * @returns 完整译文与中断标记；超时抛出 TranslateError(TIMEOUT)
 */
export async function streamTranslate(
  options: StreamTranslateOptions,
): Promise<StreamTranslateResult> {
  const { config, payload, signal, onChunk } = options;
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;

  // 内部控制器：空闲超时触发 abort；外部停止信号也转发到内部
  const controller = new AbortController();
  let timedOut = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const onExternalAbort = () => controller.abort();
  signal.addEventListener("abort", onExternalAbort);

  const resetIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, IDLE_TIMEOUT_MS);
  };
  resetIdle();

  let fullText = "";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserContent(payload) },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await buildHttpError(response);
    }
    if (!response.body) {
      throw new TranslateError(TRANSLATE_ERROR_CODE.NETWORK_ERROR);
    }

    // SSE 流式解析：逐行读取 data: 负载，累积完整译文并回调增量
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          return { fullText, aborted: false };
        }
        const delta = extractDelta(data);
        if (delta) {
          fullText += delta;
          onChunk(delta);
        }
      }
      resetIdle();
    }

    if (timedOut) {
      throw new TranslateError(TRANSLATE_ERROR_CODE.TIMEOUT);
    }
    return { fullText, aborted: signal.aborted };
  } catch (error) {
    if (timedOut) {
      throw new TranslateError(TRANSLATE_ERROR_CODE.TIMEOUT);
    }
    if (signal.aborted) {
      // 用户停止：保留已输出部分，不视为错误
      return { fullText, aborted: true };
    }
    if (error instanceof TranslateError) {
      throw error;
    }
    throw new TranslateError(TRANSLATE_ERROR_CODE.NETWORK_ERROR);
  } finally {
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    signal.removeEventListener("abort", onExternalAbort);
  }
}

/** 从 SSE data 行解析增量文本（忽略无法解析的行） */
function extractDelta(data: string): string {
  try {
    const json = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    return json.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}

/** 根据 HTTP 状态码构造结构化翻译错误 */
async function buildHttpError(response: Response): Promise<TranslateError> {
  const detail = await extractErrorDetail(response);
  switch (response.status) {
    case 400:
      return new TranslateError(TRANSLATE_ERROR_CODE.BAD_REQUEST, detail);
    case 401:
    case 403:
      return new TranslateError(TRANSLATE_ERROR_CODE.AUTH_ERROR, detail);
    case 429:
      return new TranslateError(TRANSLATE_ERROR_CODE.RATE_LIMIT, detail);
    default:
      if (response.status >= 500) {
        return new TranslateError(TRANSLATE_ERROR_CODE.SERVER_ERROR, detail);
      }
      return new TranslateError(TRANSLATE_ERROR_CODE.NETWORK_ERROR, detail);
  }
}

/** 尝试从错误响应体中提取服务端 error.message */
async function extractErrorDetail(
  response: Response,
): Promise<string | undefined> {
  try {
    const text = await response.text();
    const json = JSON.parse(text) as { error?: { message?: string } };
    return json.error?.message ?? undefined;
  } catch {
    return undefined;
  }
}
