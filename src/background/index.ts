/**
 * Background Script 入口
 * 通过 translate 长连接（Port）接收侧边栏的翻译请求：
 * 读取配置 → 校验 API Key → 流式调用翻译接口 → 逐段推送增量 → 完成/错误。
 * 支持「停止翻译」中断与连接断开自动中止。
 * 另监听工具栏图标点击：打开 / 关闭右侧翻译侧边栏。
 */
import { MSG, PORT_NAME, TRANSLATE_ERROR_CODE } from "../shared/messages";
import { STORAGE_KEYS } from "../shared/constants";
import type {
  AppConfig,
  TranslatePayload,
  TranslationResult,
} from "../shared/types";
import { TranslateError, streamTranslate } from "./translator";

console.log("[翻译插件] background 已启动");

// 点击工具栏图标：打开 / 关闭右侧翻译侧边栏
browser.action.onClicked.addListener(() => {
  void browser.sidebarAction.toggle();
});

browser.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME.TRANSLATE) {
    return;
  }

  const controller = new AbortController();
  let active = false;

  port.onMessage.addListener((message: unknown) => {
    const { type } = (message ?? {}) as { type?: string };

    if (type === MSG.TRANSLATE) {
      if (active) {
        return;
      }
      active = true;
      const payload = (message as { payload?: TranslatePayload }).payload;
      if (!payload) {
        port.postMessage({
          type: MSG.TRANSLATE_ERROR,
          code: TRANSLATE_ERROR_CODE.BAD_REQUEST,
          message: "翻译请求缺少参数",
        });
        return;
      }
      void handleTranslate(port, payload, controller.signal);
    } else if (type === MSG.STOP_TRANSLATE) {
      // 用户停止：中断流式输出，已输出部分由 handleTranslate 保留
      controller.abort();
    }
  });

  // 连接断开（如侧边栏关闭）时中止进行中的翻译
  port.onDisconnect.addListener(() => {
    controller.abort();
  });
});

/** 执行一次完整翻译流程并推送结果到侧边栏 */
async function handleTranslate(
  port: browser.runtime.Port,
  payload: TranslatePayload,
  signal: AbortSignal,
): Promise<void> {
  // 读取配置；API Key 仅在此层使用，不注入页面上下文
  const stored = (await browser.storage.local.get(STORAGE_KEYS.CONFIG))[
    STORAGE_KEYS.CONFIG
  ] as AppConfig | undefined;

  if (!stored?.apiKey) {
    port.postMessage({
      type: MSG.TRANSLATE_ERROR,
      code: TRANSLATE_ERROR_CODE.NO_API_KEY,
      message: "尚未配置 API Key，请先打开设置页配置",
    });
    return;
  }

  try {
    const { fullText, aborted } = await streamTranslate({
      config: stored,
      payload,
      signal,
      onChunk: (chunk) => {
        try {
          port.postMessage({ type: MSG.TRANSLATE_CHUNK, chunk });
        } catch {
          // 连接已断开，忽略后续推送
        }
      },
    });
    // 输出格式兜底（需求 §3.5），保证标题行与引用块完整
    const normalized = normalizeTranslatedText(payload, fullText);
    // 翻译完成（含中断）即持久化最近一次结果，单槽覆盖
    await saveLastResult(payload, normalized);
    try {
      port.postMessage({
        type: MSG.TRANSLATE_DONE,
        fullText: normalized,
        aborted,
      });
    } catch {
      // 连接已断开
    }
  } catch (error) {
    const { code, message, detail } =
      error instanceof TranslateError
        ? {
            code: error.code,
            message: error.message,
            detail: error.detail,
          }
        : {
            code: TRANSLATE_ERROR_CODE.NETWORK_ERROR,
            message: "翻译失败",
            detail: undefined,
          };
    try {
      port.postMessage({ type: MSG.TRANSLATE_ERROR, code, message, detail });
    } catch {
      // 连接已断开
    }
  }
}

/** 将最近一次翻译结果写入本地存储（整体覆盖，不保留历史） */
async function saveLastResult(
  payload: TranslatePayload,
  translatedMarkdown: string,
): Promise<void> {
  const result: TranslationResult = {
    title: payload.title,
    author: payload.author,
    url: payload.url,
    sourceMarkdown: payload.sourceMarkdown,
    translatedMarkdown,
    timestamp: Date.now(),
  };
  await browser.storage.local.set({ [STORAGE_KEYS.LAST_RESULT]: result });
}

/**
 * 译文输出格式兜底（需求文档 §3.5）：
 * 模型输出若缺少一级标题或作者/原文链接引用块，在此补齐，保证最终格式规范。
 */
function normalizeTranslatedText(
  payload: TranslatePayload,
  fullText: string,
): string {
  const text = fullText.trim();
  if (!text) {
    return text;
  }
  const prefix: string[] = [];
  if (!/^#\s+/.test(text)) {
    prefix.push(`# ${payload.title || "文章翻译"}`);
    prefix.push("");
  }
  const meta: string[] = [];
  if (payload.author && !text.includes(">**作者**:")) {
    meta.push(`>**作者**:${payload.author}`);
  }
  if (payload.url && !text.includes(">**原文链接**:")) {
    meta.push(`>**原文链接**:${payload.url}`);
  }
  if (meta.length > 0) {
    prefix.push(meta.join("\n"));
    prefix.push("");
  }
  if (prefix.length === 0) {
    return text;
  }
  return prefix.join("\n") + text;
}
