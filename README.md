# 뉴스 진위·편향 판별 AI 에이전트

`fake-news-agent-plan.md`의 실행 계획(T-0~T-10)을 그대로 구현한 저장소. 전체 설계/위험/한계는 그 문서를 참고.

## 구성

| 경로 | 역할 |
| --- | --- |
| `core/` | 판정 파이프라인, 서브 에이전트(네이버/팩트체크/원문fetch/댓글/편향), 캐시, 프롬프트 |
| `extension/` | 크롬 MV3 확장 — Readability 본문 추출, 댓글 DOM 파싱, 사전 스크리닝 배지 |
| `native-host/` | 크롬 네이티브 메시징 호스트 (확장 ↔ Electron 브릿지) |
| `app/` | Electron 데스크톱 캐릭터 + 결과 리포트 UI + 설정 화면 |
| `installer/` | 네이티브 호스트 레지스트리 등록 + 바탕화면 바로가기 생성 스크립트 |
| `web/` | 소개/다운로드 랜딩 페이지 + Vercel 서버리스 분석 API + 모바일용 URL 분석 페이지(`/analyze`) (Next.js) |
| `data/` | 매체 성향 테이블, 사전 스크리닝 규칙, 댓글 셀렉터 |
| `spike/` | T-0 API 실호출 스파이크 스크립트 |
| `eval/` | T-9 정확도 검증 세트 |
| `docs/` | 편향 방법론, 정확도 평가, 모바일 설계, 배포 계획 |
| `supabase/` | Supabase 스키마 |

## 처음 시작하기 (순서대로)

### 1. 의존성 설치

```bash
npm install
```

### 2. 본체 AI 준비 — 품질 우선순위: Mistral(추천) > 로컬 모델(기본값)

**Gemini API와 Groq API는 둘 다 이용약관상 만 18세 이상만 사용 가능**해서 ([Gemini API 약관](https://ai.google.dev/gemini-api/terms), [Groq Services Agreement](https://console.groq.com/docs/legal/services-agreement)), 미성년 개발자는 본인 명의로 키를 발급받을 수 없다.

**그 대신 추천: [Mistral AI](https://console.mistral.ai/)** — 이용약관상 만 13세 이상이고, 미성년자는 보호자 동의만 있으면 본인 명의로 직접 가입 가능하다(카드 불필요, SMS 인증만). 무료 "Experiment" 티어가 Mistral Large(로컬 1.5B 모델보다 품질이 훨씬 좋음)를 월 10억 토큰까지 무료로 열어준다. 가입 후 API 키를 `.env`의 `MISTRAL_API_KEY`에 넣으면 자동으로 이게 최우선으로 쓰인다.

```bash
npm run spike:mistral
```

키를 아예 안 넣어도(또는 Mistral 없이 데모하고 싶어도) **로컬 실행 모델**(Qwen2.5-1.5B-Instruct, Apache-2.0 라이선스 — 나이 제한 없음)이 기본값으로 동작한다. 계정 생성도, 로그인도, 이용약관 동의도 필요 없다.

```bash
npm run download-model
```

약 2GB, 익명 다운로드(로그인 불필요, HF가 느리면 ModelScope로 자동 전환). 완료 후 확인:

```bash
npm run spike:local-llm
```

첫 실행은 모델 로딩 때문에 느릴 수 있다. CPU만으로 동작(일부 내장 그래픽은 GPU 가속과 호환 안 돼 `core/agents/localLlm.js`가 `gpu: false`로 고정해둠). 노트북 성능에 따라 20초 목표 예산 안에 들어오는지 이 스파이크로 직접 재볼 것 — 느리면 `scripts/download-model.js`의 모델을 더 작은 것(예: Qwen2.5-1.5B)으로 바꿀 수 있다.

**성인(부모님/선생님 등)이 대신 만들어준 Gemini/Groq 키가 있다면** `.env`에 채워 넣으면 `core/agents/llm.js`가 로컬 모델 대신 더 빠른 그쪽을 우선 사용한다 — 선택 사항이지 필수 아님.

### 2-1. 서브 에이전트 키 (네이버는 직접 가능, 팩트체크는 선택)

`.env.example`을 `.env`로 복사하고:
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` — [네이버 개발자센터](https://developers.naver.com/) (연령 제한 문구 없음, 직접 가입 가능)
- `GOOGLE_FACTCHECK_API_KEY` — **선택 사항.** 비워두면 `core/agents/factCheck.js`가 네이버 뉴스 보조 쿼리로 자동 폴백한다. Google Cloud Console 프로젝트 생성이 번거로우면 그냥 생략.

```bash
npm run spike:naver
npm run spike:factcheck   # GOOGLE_FACTCHECK_API_KEY 없으면 자동으로 스킵됨
```

`spike/out/`에 저장된 결과를 확인.

### 3. 파이프라인 단독 테스트 (T-1)

```bash
node cli.js --url "https://example.com/article" --text ./본문.txt --title "기사 제목"
```

20초 미만, evidence 3건 이상이 나오는지 확인.

### 4. 크롬 확장 설치 + 네이티브 호스트 등록 (T-3)

1. `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램을 로드" → `extension/` 폴더 선택 → 표시된 확장 ID 복사.
2. ```powershell
   powershell -ExecutionPolicy Bypass -File installer/register-host.ps1 -ExtensionId <복사한 ID>
   ```
3. `native-host/manifest.json`의 `allowed_origins`도 실제 확장 ID로 맞춰준다 (설치 스크립트가 생성하는 `manifest.generated.json`이 이미 처리함).

### 5. Electron 앱 실행 (T-4/T-5)

```bash
npm start
```

우측 하단에 캐릭터가 뜨면, 크롬에서 뉴스 기사를 연 상태로 캐릭터를 클릭 → "분석할까요?" → 수락 → 결과 창 확인.

앱은 **시스템 트레이에 상주**합니다. 캐릭터 창이나 결과 창을 닫아도(X) 프로세스는 계속 살아있고, 트레이 아이콘을 클릭하면 캐릭터가 다시 뜹니다. 완전히 종료하려면 트레이 아이콘 우클릭 → "종료".

### 6. 바탕화면 바로가기 (완료 기준: 바로가기 클릭으로 실행)

```powershell
powershell -ExecutionPolicy Bypass -File installer/create-shortcut.ps1 -AutoStart
```

### 7. 데모 안전장치 (T-8)

```bash
npm run preload:demo
```

`scripts/demo-articles.json`의 placeholder 5건을 **실제 기사**로 먼저 교체한 뒤 실행할 것. 이후 랜선을 뽑고 같은 5건을 다시 열어도 캐시에서 즉시 렌더링된다.

### 8. 정확도 검증 (T-9)

`eval/dataset.json`의 30건을 실제 기사로 채운 뒤:

```bash
npm run eval
```

`docs/evaluation.md`가 자동 갱신된다.

### 9. 랜딩 페이지 / 클라우드 API 로컬 확인

```bash
cd web
npm install
npm run dev
```

`http://localhost:3000` 접속. `/analyze`는 크롬 확장·Electron 앱 없이 휴대폰 브라우저에서 기사 URL만 붙여넣어 분석하는 페이지 — 단, `.env`에 `MISTRAL_API_KEY`(또는 `GEMINI_API_KEY`/`GROQ_API_KEY`) 중 하나가 있어야 실제 판정까지 나온다(없으면 로컬 모델로 폴백을 시도하는데, Vercel 배포본에서는 이 폴백 자체가 막혀 있음). 배포는 `docs/deployment-vercel-supabase.md` 참고 (Vercel + Supabase).

## 문제 해결

**`npm start` 실행 시 `ipcMain`/`app` 관련 TypeError가 나거나, `Cannot find module 'electron'` 오류가 뜨는 경우**: 셸 환경변수 `ELECTRON_RUN_AS_NODE`가 `1`로 설정돼 있으면 Electron 바이너리가 GUI 앱이 아니라 일반 Node.js처럼 동작해 `require("electron")`이 정상 API 대신 깨진 값을 반환합니다. 확인/해제:

```powershell
echo $env:ELECTRON_RUN_AS_NODE   # 1이 출력되면 원인
Remove-Item Env:\ELECTRON_RUN_AS_NODE   # 현재 세션에서만 해제
```

이 변수는 보통 다른 Electron 기반 도구(예: 일부 개발 도구)가 자식 프로세스용으로 설정해두는 경우가 많습니다. 새 터미널 창을 열어 실행하거나, 위 명령으로 해제 후 `npm start`를 실행하세요.

## 완료 기준 재확인

노트북 부팅 → 바로가기 클릭 → 캐릭터 등장 → 뉴스 기사 열고 클릭 → 수락 → 20초 이내 판정등급+근거3줄, 근거기사3건, 편향+반대기사2건, 댓글요약 표시. 서로 다른 기사 5건 연속 재현. 이 저장소의 코드는 이 흐름을 그대로 구현하지만, **실제 API 키 발급/네이버 앱 등록/확장 ID 등록은 사용자가 직접 수행해야 하는 단계**다 (자동화 불가능한 외부 계정 절차).
