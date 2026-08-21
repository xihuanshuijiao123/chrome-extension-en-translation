/**
 * HTML → Markdown 转换模块：基于 Turndown
 * 保证图片（![alt](src)）、链接、代码块、列表等语法不被破坏。
 */
import TurndownService from 'turndown'

let turndown: TurndownService | null = null

/**
 * 惰性创建 Turndown 实例并注册自定义图片规则：
 * - 保留 alt 替代文本（清洗换行 / 制表符）
 * - src 优先取 src，懒加载站点兜底 data-src / data-original
 * - 相对地址统一转为绝对地址，保证图片可正常访问
 */
function getTurndown(): TurndownService {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
    })

    turndown.addRule('image', {
      filter: 'img',
      replacement: (_content, node) => {
        const img = node as HTMLImageElement
        const alt = (img.getAttribute('alt') ?? '').replace(/[\r\n\t]+/g, ' ').trim()
        const src =
          img.getAttribute('src') ??
          img.getAttribute('data-src') ??
          img.getAttribute('data-original') ??
          ''
        if (!src) {
          return ''
        }
        const absSrc = new URL(src, document.baseURI).href
        return `![${alt}](${absSrc})`
      },
    })
  }
  return turndown
}

/**
 * 将正文 HTML 转换为 Markdown 文本。
 * @param html 提取到的正文 HTML
 * @returns 转换后的 Markdown（已去除首尾空白；空输入返回空串）
 */
export function htmlToMarkdown(html: string): string {
  if (!html.trim()) {
    return ''
  }
  return getTurndown().turndown(html).trim()
}
