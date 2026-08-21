/**
 * Sidebar 主界面（T6：一键翻译全链路）
 * 点击「一键翻译」→ 请求 Content Script 提取文章 → 建立 translate 长连接
 * 发起 Background 流式翻译 → 增量经打字机渲染；支持停止 / 下载译文。
 */
import { useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "md-wx";
import { MSG, PORT_NAME, TRANSLATE_ERROR_CODE } from "../shared/messages";
import { STORAGE_KEYS } from "../shared/constants";
import type {
  ArticleResult,
  ExtractResponse,
  TranslateErrorCode,
  TranslatePortMessage,
  TranslationResult,
} from "../shared/types";
import { useTypewriter } from "./hooks/use-typewriter";
import ArticleInfo from "./components/ArticleInfo";
import StatusBar, { type PopupStatus } from "./components/StatusBar";
import ActionBar from "./components/ActionBar";

/** 清洗文件名中的非法字符 */
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned || "译文";
}

export default function App() {
  const [article, setArticle] = useState<ArticleResult | null>(null);
  const [fullText, setFullText] = useState("");
  const [status, setStatus] = useState<PopupStatus>("ready");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorCode, setErrorCode] = useState<TranslateErrorCode | null>(null);

  const portRef = useRef<browser.runtime.Port | null>(null);

  const typewriter = useTypewriter({
    onDone: () => setStatus("done"),
  });
  const translating = typewriter.state === "typing";

  /** 清理翻译长连接 */
  const cleanupPort = () => {
    if (portRef.current) {
      portRef.current.disconnect();
      portRef.current = null;
    }
  };

  // 组件卸载时断开连接（后台同时中止进行中的翻译）
  useEffect(() => cleanupPort, []);

  // 打开侧边栏时恢复最近一次翻译结果（单槽覆盖，无历史）
  useEffect(() => {
    let cancelled = false;
    void browser.storage.local
      .get(STORAGE_KEYS.LAST_RESULT)
      .then((stored) => {
        if (cancelled) {
          return;
        }
        const last = stored[STORAGE_KEYS.LAST_RESULT] as
          | TranslationResult
          | undefined;
        if (!last?.translatedMarkdown) {
          return;
        }
        setArticle({
          title: last.title,
          author: last.author,
          url: last.url,
          markdown: last.sourceMarkdown,
        });
        setFullText(last.translatedMarkdown);
        typewriter.finish(last.translatedMarkdown);
        setStatus("done");
      })
      .catch(() => {
        // 读取失败静默处理，保持就绪态
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 统一失败处理：记录错误并切换状态 */
  const fail = (message: string, code?: TranslateErrorCode) => {
    setErrorMsg(message);
    setErrorCode(code ?? null);
    setStatus("error");
  };

  /** 处理 Background 推送的流式消息 */
  const handlePortMessage = (message: unknown) => {
    const msg = message as TranslatePortMessage;
    switch (msg.type) {
      case MSG.TRANSLATE_CHUNK:
        typewriter.push(msg.chunk);
        break;
      case MSG.TRANSLATE_DONE: {
        setFullText(msg.fullText);
        typewriter.finish(msg.fullText);
        setStatus("done");
        // 中断时附加提示，保留已翻译部分
        setErrorMsg(msg.aborted ? "已中断，展示已翻译部分" : "");
        cleanupPort();
        break;
      }
      case MSG.TRANSLATE_ERROR: {
        setErrorMsg(msg.message);
        setErrorCode(msg.code);
        setStatus("error");
        cleanupPort();
        break;
      }
    }
  };

  /** 一键翻译：提取 → 流式翻译 → 打字机展示 */
  const handleTranslate = async () => {
    // 重置本次会话
    typewriter.reset();
    setFullText("");
    setErrorMsg("");
    setErrorCode(null);
    setArticle(null);
    setStatus("translating");

    // 1) 提取当前页文章（Content Script）
    const tab = (
      await browser.tabs.query({ active: true, currentWindow: true })
    )[0];
    if (!tab?.id) {
      fail("无法获取当前标签页");
      return;
    }
    let extract: ExtractResponse;
    try {
      extract = (await browser.tabs.sendMessage(tab.id, {
        type: MSG.EXTRACT_ARTICLE,
      })) as ExtractResponse;
    } catch {
      fail("无法访问当前页面，请刷新页面后重试");
      return;
    }
    if (!extract.ok) {
      fail(extract.message);
      return;
    }
    const result = extract.data;
    setArticle(result);

    // 2) 建立翻译长连接并发起流式翻译
    const port = browser.runtime.connect({ name: PORT_NAME.TRANSLATE });
    portRef.current = port;
    port.onMessage.addListener(handlePortMessage);
    port.postMessage({
      type: MSG.TRANSLATE,
      payload: {
        title: result.title,
        author: result.author,
        url: result.url,
        sourceMarkdown: result.markdown,
      },
    });
  };

  /** 停止翻译：中断流式输出，保留已输出部分 */
  const handleStop = () => {
    portRef.current?.postMessage({ type: MSG.STOP_TRANSLATE });
    typewriter.stop();
  };

  /** 下载译文（完整 Markdown，文件名取自文章标题） */
  const handleDownload = () => {
    if (!fullText) {
      return;
    }
    const fileName = `${sanitizeFileName(article?.title ?? "")}.md`;
    const blob = new Blob([fullText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /** 打开设置页 */
  const handleOpenOptions = () => {
    void browser.runtime.openOptionsPage();
  };

  const showErrorPlaceholder = status === "error" && !typewriter.text;

  return (
    <div className="popup">
      <header className="popup-header">
        <span className="popup-title">📄 文章翻译</span>
        <span className="popup-header-spacer" />
        <button className="popup-settings" onClick={handleOpenOptions}>
          ⚙ 设置
        </button>
      </header>

      <main className="popup-body">
        <button
          className={`translate-btn ${translating ? "translate-btn-stop" : ""}`}
          onClick={translating ? handleStop : handleTranslate}
        >
          {translating ? "⏹ 停止翻译" : "✨ 一键翻译"}
        </button>

        {article && (
          <ArticleInfo
            title={article.title}
            author={article.author}
            url={article.url}
          />
        )}

        <div className="content-area">
          {showErrorPlaceholder ? (
            <div className="content-error">
              <span className="content-error-text">{errorMsg}</span>
              {errorCode === TRANSLATE_ERROR_CODE.NO_API_KEY && (
                <button
                  className="content-error-btn"
                  onClick={handleOpenOptions}
                >
                  打开设置页配置 API Key
                </button>
              )}
            </div>
          ) : typewriter.text ? (
            <MarkdownRenderer
              markdown={typewriter.text}
              theme="minimal"
              showSettings={false}
              defaultViewMode="desktop"
              enableCopy
              enableThemeSwitch={false}
              enableViewModeToggle={false}
            />
          ) : (
            <div className="content-placeholder">
              （翻译结果展示区 · 点击上方按钮开始翻译）
            </div>
          )}
        </div>

        <ActionBar
          translating={translating}
          canDownload={status === "done" && !!fullText}
          onStop={handleStop}
          onDownload={handleDownload}
        />
      </main>

      <StatusBar status={status} message={errorMsg || undefined} />
    </div>
  );
}
