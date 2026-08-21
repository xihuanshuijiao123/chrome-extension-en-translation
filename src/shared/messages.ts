/**
 * 跨模块消息协议定义
 * 涵盖 Content Script / Background / Popup 之间的消息事件与错误码。
 */

/** 消息事件名 */
export const MSG = {
  /** Popup → Content Script：提取文章 */
  EXTRACT_ARTICLE: "EXTRACT_ARTICLE",
  /** Popup → Background：发起翻译 */
  TRANSLATE: "TRANSLATE",
  /** Background → Popup：翻译增量推送 */
  TRANSLATE_CHUNK: "TRANSLATE_CHUNK",
  /** Background → Popup：翻译完成（含完整译文，可标记中断） */
  TRANSLATE_DONE: "TRANSLATE_DONE",
  /** Background → Popup：翻译失败（结构化错误） */
  TRANSLATE_ERROR: "TRANSLATE_ERROR",
  /** Popup → Background：中断翻译 */
  STOP_TRANSLATE: "STOP_TRANSLATE",
} as const;

/** 消息类型 */
export type MessageType = (typeof MSG)[keyof typeof MSG];

/** 翻译长连接名称（Popup ↔ Background 流式通道） */
export const PORT_NAME = {
  TRANSLATE: "translate",
} as const;

/** 文章提取错误码（Content Script 返回） */
export const EXTRACT_ERROR = {
  /** 未能识别文章内容（非文章页或 Readability 解析失败） */
  NO_ARTICLE: "NO_ARTICLE",
  /** 识别到文章但正文为空 / 转换后 Markdown 为空 */
  NO_CONTENT: "NO_CONTENT",
} as const;

/** 提取错误码类型 */
export type ExtractErrorCode =
  (typeof EXTRACT_ERROR)[keyof typeof EXTRACT_ERROR];

/** 提取错误码对应的用户可读文案（供 UI 层直接展示） */
export const EXTRACT_ERROR_MESSAGE: Record<ExtractErrorCode, string> = {
  [EXTRACT_ERROR.NO_ARTICLE]: "未能识别文章内容",
  [EXTRACT_ERROR.NO_CONTENT]: "未提取到有效正文",
};

/** 翻译错误码（Background 流式翻译返回） */
export const TRANSLATE_ERROR_CODE = {
  /** 未配置 API Key */
  NO_API_KEY: "NO_API_KEY",
  /** 网络异常（无法连接服务） */
  NETWORK_ERROR: "NETWORK_ERROR",
  /** 鉴权失败（API Key 无效 / 无权限） */
  AUTH_ERROR: "AUTH_ERROR",
  /** 模型限流 / 配额不足 */
  RATE_LIMIT: "RATE_LIMIT",
  /** 请求超时（长时间无增量输出） */
  TIMEOUT: "TIMEOUT",
  /** 请求参数错误（如模型名不存在） */
  BAD_REQUEST: "BAD_REQUEST",
  /** 服务端错误 */
  SERVER_ERROR: "SERVER_ERROR",
  /** 翻译中断（用户停止） */
  ABORTED: "ABORTED",
} as const;

/** 翻译错误码类型 */
export type TranslateErrorCode =
  (typeof TRANSLATE_ERROR_CODE)[keyof typeof TRANSLATE_ERROR_CODE];

/** 翻译错误码对应的用户可读文案（供 UI 层直接展示） */
export const TRANSLATE_ERROR_MESSAGE: Record<TranslateErrorCode, string> = {
  [TRANSLATE_ERROR_CODE.NO_API_KEY]: "尚未配置 API Key，请先打开设置页配置",
  [TRANSLATE_ERROR_CODE.NETWORK_ERROR]: "网络异常，无法连接翻译服务",
  [TRANSLATE_ERROR_CODE.AUTH_ERROR]: "API Key 无效或未授权，请检查配置",
  [TRANSLATE_ERROR_CODE.RATE_LIMIT]: "请求过于频繁或配额不足，请稍后重试",
  [TRANSLATE_ERROR_CODE.TIMEOUT]: "翻译超时，请重试",
  [TRANSLATE_ERROR_CODE.BAD_REQUEST]: "请求参数错误，请检查模型配置",
  [TRANSLATE_ERROR_CODE.SERVER_ERROR]: "翻译服务出错，请稍后重试",
  [TRANSLATE_ERROR_CODE.ABORTED]: "翻译已停止",
};
