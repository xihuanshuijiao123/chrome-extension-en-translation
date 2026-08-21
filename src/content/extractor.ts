/**
 * 文章提取模块：基于 @mozilla/readability（Firefox 阅读模式同源引擎）
 * 在 DOM 克隆上执行解析，不污染原页面，返回标题 / 作者 / 正文 HTML。
 */
import { Readability } from '@mozilla/readability'

/** 提取到的原始文章数据（正文为 HTML，待转换为 Markdown） */
export interface ExtractedArticle {
  /** 文章标题（可能为空） */
  title: string
  /** 作者名称（可能为空） */
  author: string
  /** 原始文章 URL */
  url: string
  /** 提取出的正文 HTML */
  contentHtml: string
}

/**
 * 从当前页面提取文章。
 * 克隆 DOM 后交给 Readability 解析，避免影响原页面。
 * @returns 提取结果；非文章页或解析失败返回 null
 */
export function extractArticle(): ExtractedArticle | null {
  const documentClone = document.cloneNode(true) as Document
  const reader = new Readability(documentClone)
  const parsed = reader.parse()

  // 解析失败或未产出正文，视为非文章页
  if (!parsed || !parsed.content) {
    return null
  }

  return {
    title: parsed.title ?? '',
    author: parsed.byline ?? '',
    url: window.location.href,
    contentHtml: parsed.content,
  }
}
