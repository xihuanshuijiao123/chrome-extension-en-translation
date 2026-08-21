/**
 * 跨模块共享的数据结构定义
 */
import type {
  ExtractErrorCode,
  TranslateErrorCode,
} from "./messages";
import { MSG } from "./messages";

// 统一从 types.ts 再导出错误码类型，作为跨模块类型中心
export type { ExtractErrorCode, TranslateErrorCode };

/** 文章提取结果：Content Script 提取并转换后返回的数据 */
export interface ArticleResult {
  /** 文章标题（可能为空） */
  title: string;
  /** 作者名称（可能为空） */
  author: string;
  /** 原始文章 URL */
  url: string;
  /** 转换后的 Markdown 原文 */
  markdown: string;
}

/** 文章提取响应：Popup / Content Script 间传递 */
export type ExtractResponse =
  | { ok: true; data: ArticleResult }
  | { ok: false; error: ExtractErrorCode; message: string };

/** AI 模型服务配置 */
export interface AppConfig {
  /** API Key（敏感信息，仅 Background 层读取） */
  apiKey: string;
  /** 服务端点（OpenAI 兼容） */
  baseUrl: string;
  /** 模型名称 */
  model: string;
}

/** 最近一次翻译结果（本地持久化，单槽覆盖） */
export interface TranslationResult {
  /** 文章标题 */
  title: string;
  /** 作者名称 */
  author: string;
  /** 原文链接 */
  url: string;
  /** 原文 Markdown */
  sourceMarkdown: string;
  /** 翻译后的 Markdown 正文 */
  translatedMarkdown: string;
  /** 完成时间戳 */
  timestamp: number;
}

/** 翻译请求 payload：Popup → Background（经 translate 长连接） */
export interface TranslatePayload {
  /** 文章标题 */
  title: string;
  /** 作者名称（可能为空） */
  author: string;
  /** 原文链接 */
  url: string;
  /** 提取到的 Markdown 原文 */
  sourceMarkdown: string;
}

/** 翻译流式消息：Background → Popup（经 translate 长连接） */
export type TranslatePortMessage =
  | { type: typeof MSG.TRANSLATE_CHUNK; chunk: string }
  | { type: typeof MSG.TRANSLATE_DONE; fullText: string; aborted: boolean }
  | {
      type: typeof MSG.TRANSLATE_ERROR;
      code: TranslateErrorCode;
      /** 服务端返回的原始错误描述（可能为空） */
      detail?: string;
      message: string;
    };
