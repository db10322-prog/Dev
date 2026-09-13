// T-3 — background service worker: 네이티브 메시징 브릿지.
// 확장 시작 시 native host(native-host/host.js, Electron이 등록)와 지속 연결을 맺고,
// Electron → host.js → (native messaging) → 여기 → 현재 탭 content script 순으로 요청을 중계한다.
const NATIVE_HOST_NAME = "com.fakenewsagent.host";
let nativePort = null;

function connectNative() {
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    nativePort.onMessage.addListener(handleHostMessage);
    nativePort.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError;
      console.warn("[background] native host 연결 끊김:", err?.message);
      nativePort = null;
      // 재연결은 다음 사용자 액션(캐릭터 클릭) 시 background가 다시 깨어나며 재시도됨.
    });
    console.log("[background] native host 연결 성공:", NATIVE_HOST_NAME);
  } catch (e) {
    console.error("[background] connectNative 실패:", e);
  }
}

async function handleHostMessage(msg) {
  if (msg.type !== "REQUEST_ARTICLE") return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("활성 탭 없음");
    const articleData = await chrome.tabs.sendMessage(tab.id, { type: "COLLECT_ARTICLE" });
    nativePort.postMessage({ type: "ARTICLE_DATA", requestId: msg.requestId, data: articleData });
  } catch (e) {
    nativePort.postMessage({ type: "ARTICLE_ERROR", requestId: msg.requestId, error: String(e.message || e) });
  }
}

chrome.runtime.onStartup.addListener(connectNative);
chrome.runtime.onInstalled.addListener(connectNative);
// 서비스워커가 idle 후 재시작될 때도 즉시 재연결 시도.
connectNative();
