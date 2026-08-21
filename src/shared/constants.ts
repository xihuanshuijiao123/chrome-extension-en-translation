/**
 * 跨模块共享常量（骨架）
 * 后续任务（T3/T6）将在此基础上补充完整配置项。
 */

/** 本地存储键 */
export const STORAGE_KEYS = {
  /** AI 模型服务配置 */
  CONFIG: 'config',
  /** 最近一次翻译结果（单槽覆盖，不保留历史） */
  LAST_RESULT: 'lastResult',
} as const

/** 默认配置：Qwen（DashScope）OpenAI 兼容端点 */
export const DEFAULT_CONFIG = {
  BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  MODEL: 'qwen-plus',
} as const

/** 内置可选模型 */
export const MODEL_OPTIONS = ['qwen-plus', 'qwen-turbo', 'qwen-max'] as const
