// T-3 — 네이티브 메시징 호스트. Chrome이 이 프로세스를 stdio로 spawn한다.
// 역할: (1) 크롬 네이티브 메시징 프로토콜(4바이트 길이 프리픽스 + JSON)로 확장과 통신
//       (2) 이미 떠 있는 Electron 앱의 로컬 WebSocket 서버(app/main.js)와 연결해 양방향 중계.
// 확장→호스트 방향 최대 64MiB, 호스트→확장 방향 최대 1MB (Chrome 문서 확인됨).
// 기사 본문+댓글은 확장→호스트라 여유 있고, 판정 리포트는 Electron 창이 직접 그려 1MB 제약과 무관.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const WebSocket = require("ws");

const WS_PORT = process.env.NATIVE_HOST_HTTP_PORT || 5757;
const WS_URL = `ws://127.0.0.1:${WS_PORT}/native-bridge`;

let buffer = Buffer.alloc(0);

function readMessages() {
  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    if (buffer.length < 4 + length) return;
    const messageBuf = buffer.subarray(4, 4 + length);
    buffer = buffer.subarray(4 + length);
    try {
      const msg = JSON.parse(messageBuf.toString("utf-8"));
      onExtensionMessage(msg);
    } catch (e) {
      process.stderr.write(`[host] JSON 파싱 실패: ${e.message}\n`);
    }
  }
}

function sendToExtension(obj) {
  const json = Buffer.from(JSON.stringify(obj), "utf-8");
  if (json.length > 1024 * 1024) {
    process.stderr.write("[host] 호스트→확장 메시지가 1MB 초과 — 잘림 위험, 전송 취소\n");
    return;
  }
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(Buffer.concat([header, json]));
}

let ws = null;
function connectElectron() {
  ws = new WebSocket(WS_URL);
  ws.on("open", () => process.stderr.write("[host] Electron 브릿지 연결 성공\n"));
  ws.on("message", (data) => {
    // Electron → 확장 요청 중계 (예: {type:"REQUEST_ARTICLE", requestId})
    try {
      sendToExtension(JSON.parse(data.toString()));
    } catch (e) {
      process.stderr.write(`[host] Electron 메시지 처리 실패: ${e.message}\n`);
    }
  });
  ws.on("close", () => {
    process.stderr.write("[host] Electron 브릿지 연결 끊김, 3초 후 재시도\n");
    setTimeout(connectElectron, 3000);
  });
  ws.on("error", (e) => process.stderr.write(`[host] WS 에러: ${e.message}\n`));
}

function onExtensionMessage(msg) {
  // 확장 → Electron 중계 (예: ARTICLE_DATA / ARTICLE_ERROR)
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    process.stderr.write("[host] Electron 브릿지 미연결 상태에서 메시지 도착 — 드롭\n");
  }
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  readMessages();
});
process.stdin.on("end", () => process.exit(0));

connectElectron();
