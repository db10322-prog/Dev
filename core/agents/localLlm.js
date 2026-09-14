// 본체 AI — 로컬 실행 모델 (node-llama-cpp + Qwen2.5-3B-Instruct GGUF, Apache-2.0).
//
// 왜 로컬인가: Gemini API/Groq API 모두 이용약관에 "만 18세 이상만 사용 가능"이 명시돼 있어
// 미성년 개발자가 본인 명의로 키를 발급받을 수 없다 (성인이 대신 만들어줘야 함). 이 프로젝트는
// 그 의존을 없애기 위해 클라우드 키가 전혀 없어도 동작하는 로컬 모델을 기본 경로로 삼는다.
// node-llama-cpp는 MIT 라이선스 오픈소스 라이브러리(계정/약관 동의 불필요)이고, 모델 가중치도
// npm install/모델 다운로드 모두 로그인 없는 익명 다운로드로 받는다(scripts/download-model.js).
// 부가 이점: 완전 오프라인 동작 — T-8(랜선 뽑고 데모) 요구사항과도 정확히 맞아떨어진다.
const fs = require("fs");
const { MODEL_PATH } = require("../modelDownloader");

let sessionPromise = null;

// core/pipeline.js는 속도를 위해 여러 서브 에이전트(textBias, opinion 등)를 Promise.all로
// 동시에 실행하는데, 로컬 모델은 CPU 하나로 실제 병렬 추론이 안 되고 컨텍스트의 시퀀스도
// 한정돼 있어(기본 1개) 동시에 두 요청이 들어오면 "No sequences left"로 서로를 깨뜨린다
// (실제로 재현됨). 그래서 로컬 모델 호출만 큐로 직렬화한다 — 클라우드 API(Mistral/Gemini/
// Groq)는 이 큐를 안 타므로 병렬 이점을 그대로 유지한다.
let queue = Promise.resolve();
function enqueue(task) {
  const result = queue.then(task, task);
  queue = result.catch(() => {});
  return result;
}

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
function callLocalLlmJson({ prompt, responseSchema }) {
  return enqueue(() => runLocalLlmJson({ prompt, responseSchema }));
}

async function runLocalLlmJson({ prompt, responseSchema }) {
  const { llama, context } = await getSession();
  const { LlamaChatSession, LlamaJsonSchemaGrammar } = await import("node-llama-cpp");

  // context는 시퀀스를 한정된 개수만 갖고 있고(기본 1개), getSequence()로 받은 시퀀스를
  // 세션과 함께 dispose() 해주지 않으면 다음 호출에서 "No sequences left" 오류가 난다 —
  // 실제로 두 번째 호출에서 이 버그로 죽는 걸 확인함. 매 호출마다 반드시 해제해야 함.
  const sequence = context.getSequence();
  const session = new LlamaChatSession({ contextSequence: sequence });
  try {
    const grammar = responseSchema ? new LlamaJsonSchemaGrammar(llama, responseSchema) : undefined;

    const responseText = await session.prompt(prompt, {
      grammar,
      maxTokens: 1024,
      // temperature가 너무 낮으면(0.2) 이 작은 모델은 반복적으로 같은 패턴(예: 존재하지도
      // 않는 "url: https://..." 문자열)을 그대로 복제해 찍어내는 퇴화 현상이 실제로 관찰됨.
      // repeatPenalty를 걸고 temperature를 조금 올려 반복 패턴을 억제.
      temperature: 0.5,
      repeatPenalty: { penalty: 1.15 },
    });

    const json = grammar ? grammar.parse(responseText) : JSON.parse(responseText);
    return { json, modelUsed: "local:qwen2.5-1.5b-instruct-q8_0" };
  } finally {
    // session.dispose() 기본값은 disposeSequence:false — contextSequence를 우리가 직접
    // 넘겼기 때문에 세션이 "남의 시퀀스"로 간주해 안 풀어준다. 명시적으로 true를 줘야
    // 실제로 시퀀스가 풀려서 다음 호출이 "No sequences left"로 죽지 않는다(실제로 겪은 버그).
    session.dispose({ disposeSequence: true });
  }
}

module.exports = { callLocalLlmJson, MODEL_PATH };
