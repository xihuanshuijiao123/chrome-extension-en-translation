/**
 * 状态提示区：就绪 / 翻译中 / 已完成 / 错误 四态展示。
 */
export type PopupStatus = "ready" | "translating" | "done" | "error";

const STATUS_TEXT: Record<PopupStatus, string> = {
  ready: "就绪",
  translating: "翻译中",
  done: "已完成",
  error: "错误",
};

export interface StatusBarProps {
  /** 当前状态 */
  status: PopupStatus;
  /** 附加提示信息（如错误原因） */
  message?: string;
}

export default function StatusBar({ status, message }: StatusBarProps) {
  return (
    <footer className="popup-footer">
      <span className={`status-dot status-${status}`} />
      <span>状态：{STATUS_TEXT[status]}</span>
      {message && <span className="status-message"> · {message}</span>}
    </footer>
  );
}
