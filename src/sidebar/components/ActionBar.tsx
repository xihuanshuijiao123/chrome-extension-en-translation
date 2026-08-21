/**
 * 底部操作栏（⑤）：翻译中显示「停止」，完成后显示「下载译文」。
 */
export interface ActionBarProps {
  /** 翻译是否进行中 */
  translating: boolean;
  /** 翻译是否已完成（有完整译文可下载） */
  canDownload: boolean;
  /** 点击停止 */
  onStop: () => void;
  /** 点击下载译文 */
  onDownload: () => void;
}

export default function ActionBar({
  translating,
  canDownload,
  onStop,
  onDownload,
}: ActionBarProps) {
  return (
    <div className="action-bar">
      {translating && (
        <button className="action-btn action-btn-stop" onClick={onStop}>
          ⏹ 停止
        </button>
      )}
      {canDownload && (
        <button className="action-btn action-btn-download" onClick={onDownload}>
          ⬇ 下载译文
        </button>
      )}
    </div>
  );
}
