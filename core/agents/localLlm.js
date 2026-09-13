// 본체 AI — 로컬 실행 모델 (node-llama-cpp + Qwen2.5-3B-Instruct GGUF, Apache-2.0).
//
// 왜 로컬인가: Gemini API/Groq API 모두 이용약관에 "만 18세 이상만 사용 가능"이 명시돼 있어
// 미성년 개발자가 본인 명의로 키를 발급받을 수 없다 (성인이 대신 만들어줘야 함). 이 프로젝트는
// 그 의존을 없애기 위해 클라우드 키가 전혀 없어도 동작하는 로컬 모델을 기본 경로로 삼는다.
// node-llama-cpp는 MIT 라이선스 오픈소스 라이브러리(계정/약관 동의 불필요)이고, 모델 가중치도
// npm install/모델 다운로드 모두 로그인 없는 익명 다운로드로 받는다(scripts/download-model.js).
// 부가 이점: 완전 오프라인 동작 — T-8(랜선 뽑고 데모) 요구사항과도 정확히 맞아떨어진다.
const path = require("path");
const fs = require("fs");

const MODEL_PATH = path.join(__dirname, "..", "..", "models", "qwen2.5-1.5b-instruct-q8_0.gguf");

let sessionPromise = null;

async function getSession() {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    if (!fs.existsSync(MODEL_PATH)) {
      throw new Error(
        `로컬 모델 파일이 없음: ${MODEL_PATH}\n` + `먼저 "npm run download-model" 을 실행하세요 (계정/로그인 불필요, 약 2GB).`
      );
    }
    const { getLlama } = await import("node-llama-cpp");
    // gpu: false로 강제 — 일부 내장 그래픽(예: Intel UHD 6xx)은 Vulkan 16비트 스토리지를
    // 지원하지 않아 GPU 가속 시도 시 모델 로드가 실패한다. 데모 안정성이 속도보다 우선이라
    // CPU 전용으로 고정(대부분의 노트북에서 항상 동작하는 경로).
    const llama = await getLlama({ gpu: false });
    const model = await llama.loadModel({ modelPath: MODEL_PATH });
    const context = await model.createContext();
    return { llama, model, context };
  })();
  return sessionPromise;
}

/** Gemini/Groq와 동일한 인터페이스: JSON 스키마를 강제해 1회 생성. */
async function callLocalLlmJson({ prompt, responseSchema }) {
  const { llama, context } = await getSession();
  const { LlamaChatSession, LlamaJsonSchemaGrammar } = await import("node-llama-cpp");

  const session = new LlamaChatSession({ contextSequence: context.getSequence() });
  const grammar = responseSchema ? new LlamaJsonSchemaGrammar(llama, responseSchema) : undefined;

  const responseText = await session.prompt(prompt, {
    grammar,
    maxTokens: 1024,
    temperature: 0.2,
  });

  const json = grammar ? grammar.parse(responseText) : JSON.parse(responseText);
  return { json, modelUsed: "local:qwen2.5-1.5b-instruct-q8_0" };
}

module.exports = { callLocalLlmJson, MODEL_PATH };
