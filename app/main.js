// T-4 — Electron 메인 프로세스: 캐릭터 오버레이 + 네이티브 호스트 브릿지(WS 서버) + 오케스트레이터 겸함.
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require("electron");
const WebSocket = require("ws");
const { analyzeArticle } = require("../core/pipeline");

const WS_PORT = process.env.NATIVE_HOST_HTTP_PORT || 5757;
const ENV_PATH = path.join(__dirname, "..", ".env");
const SETTINGS_KEYS = ["MISTRAL_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET", "GOOGLE_FACTCHECK_API_KEY"];

let characterWindow = null;
let reportWindow = null;
let settingsWindow = null;
let tray = null;
let isQuitting = false;
let wss = null;
let hostSocket = null; // native-host/host.js 가 붙는 연결
const pendingRequests = new Map(); // requestId -> {resolve, reject}

function createCharacterWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  // index.html의 #stage(240x340)와 반드시 맞춰야 함 — Electron은 창 크기 밖으로 나온
  // 내용을 그냥 잘라버리므로(웹페이지처럼 스크롤이 생기지 않음), 말풍선이 위로 자라날
  // 공간을 충분히 확보해야 말풍선이 잘리지 않는다.
  const winWidth = 240;
  const winHeight = 340;

  characterWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: width - winWidth - 24,
    y: height - winHeight - 24,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "character", "preload.js"),
      contextIsolation: true,
    },
  });
  characterWindow.setAlwaysOnTop(true, "screen-saver");
  characterWindow.loadFile(path.join(__dirname, "character", "index.html"));

  // 캐릭터 영역 밖 클릭은 데스크톱으로 통과시킴 (렌더러가 마우스 위치를 보고 토글 요청).
  characterWindow.setIgnoreMouseEvents(false);

  // 창의 X(닫기)는 트레이로 숨기기만 함 — 프로세스는 트레이 아이콘 클릭으로 계속 켜져 있어야 함.
  // 진짜 종료는 트레이 메뉴의 "종료"(isQuitting=true 후 app.quit())로만 가능.
  characterWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      characterWindow.hide();
    }
  });
}

function showCharacterWindow() {
  if (!characterWindow || characterWindow.isDestroyed()) {
    createCharacterWindow();
  } else {
    characterWindow.show();
    characterWindow.focus();
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "character", "tray-icon.png"));
  tray = new Tray(icon);
  tray.setToolTip("뉴스 진위·편향 판별 에이전트");

  const contextMenu = Menu.buildFromTemplate([
    { label: "캐릭터 열기", click: () => showCharacterWindow() },
    { label: "API 키 설정", click: () => createSettingsWindow() },
    { type: "separator" },
    {
      label: "종료",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => showCharacterWindow());
}

function createReportWindow() {
  reportWindow = new BrowserWindow({
    width: 720,
    height: 820,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "character", "preload.js"),
      contextIsolation: true,
    },
  });
  reportWindow.loadFile(path.join(__dirname, "renderer", "report.html"));

  // 결과 창도 닫기(X)는 숨기기만 — 다음 분석 때 재사용(웹뷰 재생성 비용 회피).
  reportWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      reportWindow.hide();
    }
  });
}

function startNativeBridgeServer() {
  wss = new WebSocket.Server({ port: WS_PORT, path: "/native-bridge" });
  wss.on("connection", (socket) => {
    console.log("[main] native-host 연결됨");
    hostSocket = socket;
    socket.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      handleExtensionMessage(msg);
    });
    socket.on("close", () => {
      console.log("[main] native-host 연결 끊김");
      hostSocket = null;
    });
  });
  console.log(`[main] native bridge WS 서버 시작: ws://127.0.0.1:${WS_PORT}/native-bridge`);
}

function handleExtensionMessage(msg) {
  const pending = pendingRequests.get(msg.requestId);
  if (!pending) return;
  pendingRequests.delete(msg.requestId);
  if (msg.type === "ARTICLE_DATA") pending.resolve(msg.data);
  else if (msg.type === "ARTICLE_ERROR") pending.reject(new Error(msg.error));
}

/** 확장에 "현재 탭 기사 수집" 요청을 보내고 응답을 기다림 (타임아웃 10초) */
function requestCurrentTabArticle() {
  return new Promise((resolve, reject) => {
    if (!hostSocket) {
      reject(new Error("크롬 확장이 연결되어 있지 않음. chrome://extensions 에서 확장이 로드/실행 중인지 확인하세요."));
      return;
    }
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("확장 응답 타임아웃(10초)"));
    }, 10000);

    pendingRequests.set(requestId, {
      resolve: (data) => {
        clearTimeout(timer);
        resolve(data);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });
    hostSocket.send(JSON.stringify({ type: "REQUEST_ARTICLE", requestId }));
  });
}

// 캐릭터 클릭 → 렌더러가 IPC로 분석 요청 → 여기서 확장에 수집 요청 → 파이프라인 실행 → 결과 창 표시.
ipcMain.handle("analyze-current-tab", async () => {
  const articleData = await requestCurrentTabArticle();
  if (!articleData?.text || articleData.text.length < 200) {
    throw new Error("본문을 충분히 추출하지 못했습니다(200자 미만). 뉴스 기사 페이지인지 확인하세요.");
  }
  const report = await analyzeArticle({
    url: articleData.url,
    title: articleData.title,
    text: articleData.text,
    comments: articleData.comments || [],
  });
  reportWindow.webContents.send("report-ready", report);
  reportWindow.show();
  return report;
});

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 560,
    webPreferences: {
      preload: path.join(__dirname, "character", "preload.js"),
      contextIsolation: true,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, "renderer", "settings.html"));
  settingsWindow.on("closed", () => (settingsWindow = null));
}

/** .env 파일을 key=value 라인 단위로 파싱 (dotenv 형식, 따옴표 없는 단순 값 가정) */
function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const lines = fs.readFileSync(ENV_PATH, "utf-8").split("\n");
  const result = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) result[m[1]] = m[2];
  }
  return result;
}

function writeEnvFile(values) {
  const current = readEnvFile();
  const merged = { ...current, ...values };
  const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n", "utf-8");
}

ipcMain.handle("open-settings", () => createSettingsWindow());
ipcMain.handle("get-settings", () => {
  const env = readEnvFile();
  const result = {};
  SETTINGS_KEYS.forEach((k) => (result[k] = env[k] || ""));
  return result;
});
ipcMain.handle("save-settings", (_event, values) => {
  writeEnvFile(values);
  return { ok: true };
});

app.whenReady().then(() => {
  startNativeBridgeServer();
  createCharacterWindow();
  createReportWindow();
  createTray();
});

// 트레이 상주 앱이므로 모든 창이 닫혀도 프로세스는 유지 — 종료는 트레이 메뉴에서만.
app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("before-quit", () => {
  isQuitting = true;
});
