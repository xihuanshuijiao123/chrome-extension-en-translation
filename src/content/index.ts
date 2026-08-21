/**
 * Content Script 入口
 * 注入页面后监听「提取请求」：Readability 提取文章 → Turndown 转换 Markdown，
 * 返回结构化结果或明确错误码（供 Popup / UI 层提示）。
 */
import { MSG, EXTRACT_ERROR, EXTRACT_ERROR_MESSAGE } from '../shared/messages'
import type { ExtractResponse } from '../shared/types'
import { extractArticle } from './extractor'
import { htmlToMarkdown } from './converter'

console.log('[翻译插件] content script 已注入当前页面')

browser.runtime.onMessage.addListener((message: unknown) => {
  const { type } = (message ?? {}) as { type?: string }
  if (type === MSG.EXTRACT_ARTICLE) {
    return Promise.resolve(handleExtract())
  }
  return undefined
})

/** 执行「提取 → 转换」链路并组装响应 */
function handleExtract(): ExtractResponse {
  const article = extractArticle()
  if (!article) {
    return fail(EXTRACT_ERROR.NO_ARTICLE)
  }

  const markdown = htmlToMarkdown(article.contentHtml)
  if (!markdown) {
    return fail(EXTRACT_ERROR.NO_CONTENT)
  }

  return {
    ok: true,
    data: {
      title: article.title,
      author: article.author,
      url: article.url,
      markdown,
    },
  }
}

/** 构造提取失败响应（错误码 + 用户可读信息） */
function fail(error: (typeof EXTRACT_ERROR)[keyof typeof EXTRACT_ERROR]): ExtractResponse {
  return {
    ok: false,
    error,
    message: EXTRACT_ERROR_MESSAGE[error],
  }
}
