/**
 * 打字机效果 Hook
 * 维护「待输出队列」，按固定间隔逐段输出累积文本；
 * 支持增量追加（push，供流式翻译使用）与中断（stop，保留已输出部分）。
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** 打字机状态：空闲 / 输出中 / 已完成 */
export type TypewriterState = "idle" | "typing" | "done";

export interface UseTypewriterOptions {
  /** 每个间隔输出的字符数（越大越快），默认 2 */
  charsPerTick?: number;
  /** 输出间隔（毫秒），默认 16 */
  intervalMs?: number;
  /** 全部输出完成后的回调 */
  onDone?: () => void;
}

export function useTypewriter(options: UseTypewriterOptions = {}) {
  const { charsPerTick = 2, intervalMs = 16, onDone } = options;

  const [text, setText] = useState("");
  const [state, setState] = useState<TypewriterState>("idle");

  /** 尚未输出的待输出文本 */
  const pendingRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<TypewriterState>("idle");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const setStateSafe = (next: TypewriterState) => {
    stateRef.current = next;
    setState(next);
  };

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 组件卸载时清理定时器
  useEffect(() => clearTimer, [clearTimer]);

  const startTicking = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      if (!pendingRef.current) {
        clearTimer();
        setStateSafe("done");
        onDoneRef.current?.();
        return;
      }
      const slice = pendingRef.current.slice(0, charsPerTick);
      pendingRef.current = pendingRef.current.slice(charsPerTick);
      setText((prev) => prev + slice);
    }, intervalMs);
  }, [charsPerTick, intervalMs, clearTimer]);

  /** 追加待输出文本；若当前未在播放则开始打字机输出 */
  const push = useCallback(
    (chunk: string) => {
      if (!chunk) {
        return;
      }
      pendingRef.current += chunk;
      if (stateRef.current !== "typing") {
        setStateSafe("typing");
        startTicking();
      }
    },
    [startTicking],
  );

  /** 停止播放：丢弃未输出内容，保留已输出部分 */
  const stop = useCallback(() => {
    clearTimer();
    pendingRef.current = "";
    setStateSafe("idle");
  }, [clearTimer]);

  /** 重置：清空已输出与待输出内容，回到初始状态 */
  const reset = useCallback(() => {
    clearTimer();
    pendingRef.current = "";
    setText("");
    setStateSafe("idle");
  }, [clearTimer]);

  /** 直接呈现完整文本（跳过排队播放），用于流式结束 / 中断完成时 */
  const finish = useCallback(
    (finalText: string) => {
      clearTimer();
      pendingRef.current = "";
      setText(finalText);
      setStateSafe("done");
    },
    [clearTimer],
  );

  return { text, state, push, stop, reset, finish };
}
