/**
 * 文章信息区：展示提取到的标题 / 作者 / 原文链接，缺失行自动隐藏。
 */
export interface ArticleInfoProps {
  /** 文章标题 */
  title: string;
  /** 作者名称（可能为空） */
  author: string;
  /** 原文链接 */
  url: string;
}

export default function ArticleInfo({ title, author, url }: ArticleInfoProps) {
  return (
    <div className="article-info">
      {title && (
        <div className="article-info-row">
          <span className="article-info-label">标题</span>
          <span className="article-info-value article-info-title">{title}</span>
        </div>
      )}
      {author && (
        <div className="article-info-row">
          <span className="article-info-label">作者</span>
          <span className="article-info-value">{author}</span>
        </div>
      )}
      {url && (
        <div className="article-info-row">
          <span className="article-info-label">原文</span>
          <a
            className="article-info-value article-info-link"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            {url}
          </a>
        </div>
      )}
    </div>
  );
}
