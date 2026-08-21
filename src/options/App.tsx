/**
 * Options 设置页：AI 模型服务配置
 * 表单：API Key / Base URL / 模型名称（下拉 + 可自定义）。
 * 加载时从 storage.local 回填（API Key 不回填明文）；保存写入 config 键并反馈状态。
 */
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_CONFIG,
  MODEL_OPTIONS,
  STORAGE_KEYS,
} from "../shared/constants";
import type { AppConfig } from "../shared/types";

/** 状态反馈类型：未修改 / 已保存 / 保存失败 */
type SaveStatus = "idle" | "saved" | "error";

/** 状态反馈文案 */
const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "未修改",
  saved: "已保存 ✓",
  error: "保存失败 ✗",
};

export default function App() {
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_CONFIG.BASE_URL);
  const [model, setModel] = useState<string>(DEFAULT_CONFIG.MODEL);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const apiKeyRef = useRef<HTMLInputElement>(null);

  // 加载已有配置：Base URL / 模型名回填；API Key 不回填明文
  useEffect(() => {
    let cancelled = false;
    void browser.storage.local
      .get(STORAGE_KEYS.CONFIG)
      .then((result) => {
        if (cancelled) return;
        const config = result[STORAGE_KEYS.CONFIG] as AppConfig | undefined;
        if (config) {
          if (config.baseUrl) setBaseUrl(config.baseUrl);
          if (config.model) setModel(config.model);
          setHasSavedKey(Boolean(config.apiKey));
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 保存配置：API Key 留空表示保留已存值（未配置过则校验拦截） */
  const handleSave = async () => {
    const apiKey = (apiKeyRef.current?.value ?? "").trim();
    const stored = (await browser.storage.local.get(STORAGE_KEYS.CONFIG))[
      STORAGE_KEYS.CONFIG
    ] as AppConfig | undefined;
    const prevKey = stored?.apiKey ?? "";

    if (!apiKey && !prevKey) {
      setStatus("error");
      setErrorMsg("请先填写 API Key");
      return;
    }

    const nextConfig: AppConfig = {
      apiKey: apiKey || prevKey,
      baseUrl: baseUrl.trim() || DEFAULT_CONFIG.BASE_URL,
      model: model.trim() || DEFAULT_CONFIG.MODEL,
    };

    try {
      await browser.storage.local.set({ [STORAGE_KEYS.CONFIG]: nextConfig });
      setHasSavedKey(Boolean(nextConfig.apiKey));
      if (apiKeyRef.current) {
        apiKeyRef.current.value = ""; // 保存成功后清空密码框，避免明文残留
      }
      setStatus("saved");
      setErrorMsg("");
    } catch {
      setStatus("error");
      setErrorMsg("保存失败，请重试");
    }
  };

  return (
    <div className="options">
      <header className="options-header">⚙ 设置 · AI 模型配置</header>

      <main className="options-body">
        <div className="form-field">
          <label htmlFor="api-key">API Key</label>
          <input
            id="api-key"
            ref={apiKeyRef}
            type="password"
            autoComplete="off"
            placeholder={
              hasSavedKey ? "已配置（留空表示不修改）" : "请输入 API Key"
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor="base-url">Base URL</label>
          <input
            id="base-url"
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="model">模型名称</label>
          <input
            id="model"
            type="text"
            list="model-options"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <datalist id="model-options">
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        <div className="tip-box">
          💡 提示：采用 OpenAI 兼容协议，修改 Base URL 与模型名即可切换服务商。
        </div>

        <button className="save-btn" onClick={() => void handleSave()}>
          💾 保存配置
        </button>
      </main>

      <footer className="options-footer">
        <span className={`status-dot status-${status}`} />
        {errorMsg
          ? `状态：${STATUS_TEXT[status]} · ${errorMsg}`
          : `状态：${STATUS_TEXT[status]}`}
      </footer>
    </div>
  );
}
