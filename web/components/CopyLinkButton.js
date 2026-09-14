import { useState } from "react";

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(typeof window !== "undefined" ? window.location.href : "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 권한이 막힌 환경 — 조용히 무시(치명적이지 않음)
    }
  }

  return (
    <button type="button" className="copy-link-btn" onClick={handleCopy}>
      {copied ? "복사됨 ✓" : "링크 복사해서 PC로 보내기 →"}
    </button>
  );
}
