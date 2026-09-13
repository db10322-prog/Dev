# 뉴스 진위·편향 판별 AI 에이전트 — 실행 계획

**목표.** 윈도우 바탕화면에 상주하는 AI 캐릭터를 클릭하면, 지금 크롬에서 보고 있는 뉴스 기사를 읽어 진위 신뢰도·편향 방향·반대편 기사·댓글 여론을 근거와 함께 한 화면에 띄워줌.

**완료 기준.** 노트북 부팅 → 바로가기 클릭 → 우측 하단 캐릭터 등장 → 크롬에서 네이버 뉴스 기사 1건 연 상태로 캐릭터 클릭 → "현재 페이지 기사를 분석할까요?" → 수락 → **20초 이내**에 ① 진위 판정 등급 \+ 판단 근거 3줄 이상 ② 근거로 쓴 타 언론사 기사 3건 이상(제목·매체·링크) ③ 편향 방향 \+ 반대 성향 기사 2건 ④ 댓글 여론 요약. 이 흐름이 **서로 다른 기사 5건에 대해 연속으로 끊김 없이** 재현됨.

**범위 밖.** iOS/안드로이드 앱 구현(문서로만 설계), 웹스토어 정식 심사 통과, 다중 사용자 서버 운영, 유료 API, 회원가입/계정 시스템.

**전제.** 1차 목표는 대회/발표용 데모, 혼자 개발, 시간 빠듯, 윈도우 데스크톱 우선.

---

## 조사해서 확인한 것 (Current state)

### 쓸 수 있는 무료 API — 실제로 확인됨

| 역할 | API | 확인된 조건 |
| :---- | :---- | :---- |
| **본체 AI** (진위·편향 추론) | Google Gemini API 무료 티어 | 공식 가격표상 Gemini 3.x Flash / Flash-Lite 계열이 무료 티어에서 입출력 **무료**. 단 무료 티어 요청은 **구글 제품 개선에 사용될 수 있음**이 명시돼 있음. 모델별 RPM/RPD 정확한 숫자는 공식 문서 표에 없고 AI Studio 대시보드에서 봐야 함 → T-0에서 실측 필요 |
| **본체 AI 폴백** | Groq 무료 티어 | 2026년 기준 대략 30 RPM / 일 1.4만 요청대. 지연시간이 매우 낮아 데모 중 Gemini 쿼터 소진·장애 시 백업으로 적합 |
| **서브 에이전트 A** (한국 뉴스 검색) | 네이버 검색 API `/v1/search/news.json` | **일일 25,000회**, `display` 최대 100, `start` 최대 1000\. 즉 한 쿼리당 최대 1,000건까지 페이징 가능 |
| **서브 에이전트 B** (기존 팩트체크 조회) | Google Fact Check Tools API `claims.search` | API 키만으로 호출. 파라미터 `query`, `languageCode`(BCP-47, `ko`), `reviewPublisherSiteFilter`, `maxAgeDays`, `pageSize`. 응답에 주장문·판정등급·팩트체크 기관·링크가 들어옴 |
| **서브 에이전트 C** (해외 교차검증, 선택) | GDELT DOC 2.0 API | 키 불필요 |

### 설계를 바꿔야 하는 발견 3가지

**1\. "URL을 서버가 직접 읽는다"는 방식은 한국 뉴스에서 자주 실패함.** 네이버 뉴스는 봇 접근 차단·동적 렌더링이 걸려 있어 서버가 URL만 받아 fetch 하면 본문이 안 나오는 경우가 많음. 반면 **사용자 브라우저에는 이미 본문이 렌더링돼 있음**. → 크롬 확장 content script가 현재 탭 DOM에서 본문을 뽑는 구조가 성공률·속도 양쪽에서 압도적으로 유리함. 본문 추출은 Mozilla Readability.js(MIT, 무료)로 해결.

**2\. 네이버 뉴스 댓글은 공식 API가 없음.** 서버에서 긁어오는 방식은 이용약관 위반 소지가 있고 차단도 걸림. 대신 **사용자가 이미 열어 놓은 화면의 댓글 DOM을 확장이 읽는 것**은 "사용자 본인 화면"이라 위험이 훨씬 낮음. 이 경로 외에는 현실적 대안 없음.

**3\. 한국엔 AllSides 같은 표준화된 언론사 편향 등급 데이터가 없음.** KCI 학술논문(신문 보도의 이념적 다양성 분석 등)과 비공식 정리글만 존재. → 매체 성향 매핑 테이블을 **직접 만들고, 출처와 한계를 UI에 그대로 노출**해야 함. 이걸 숨기면 발표에서 제일 먼저 찔리는 지점이고, 드러내면 오히려 가점 요인임.

### 원 구상과 충돌하는 지점 (짚고 넘어가야 함)

> "모든 뉴스 기사 내용 바로 아래에 가짜 뉴스로 의심된다는 안내문구를 띄워주고"

분석 **전에** 모든 기사에 의심 문구를 붙이면 오탐이 심각하고, 정상 기사에 낙인을 찍는 구조가 됨. 대회 심사에서 바로 지적당하는 부분. → **사전 스크리닝을 저비용 규칙으로 돌려 배지를 3등급으로 나누는 방식**으로 바꾸는 걸 권함 (T-6). 확정 판정은 버튼 누른 뒤에만.

---

## 접근 방식

**클라이언트는 크롬 확장 \+ Electron 두 조각으로 쪼개고, 네이티브 메시징으로 잇는다.**

바탕화면 캐릭터는 브라우저 확장으로 못 만들고, 현재 탭 DOM 접근은 Electron으로 못 함. 둘 다 필요하므로 둘 다 만들되 다리를 놓는 구조가 유일한 답임. 크롬 네이티브 메시징은 확장→네이티브 호스트 **64MiB**, 호스트→확장 **1MB** 제한이 확인됨. 기사 본문+댓글은 확장→호스트 방향이라 여유 충분하고, 결과는 Electron 창이 직접 그리므로 1MB 제약에 안 걸림.

대안으로 검토했다 버린 것: 클립보드 폴링(사용자가 URL을 복사해야 함), 화면 OCR(정확도·속도 둘 다 실패), UI 자동화로 주소창 읽기(크롬 버전마다 깨짐). 데모 안정성이 최우선이라 확장 방식 채택. 단 확장 미설치 상황 대비 **클립보드 URL 폴백**은 남겨둠.

**런타임은 최대한 병렬로.** 체감 속도는 서브 에이전트가 결정함. 본문 확보 직후 ① 네이버 뉴스 검색 ② 팩트체크 조회 ③ 후보 기사 원문 fetch ④ 댓글 파싱을 `Promise.all`로 동시에 던지고, 다 모인 뒤 본체 AI를 **한 번만** 호출함. 순차로 하면 40초 넘고, 병렬이면 15초권에 들어옴.

**판정 어휘는 "가짜/진짜" 이분법 대신 4단계 \+ 근거 필수.** 이건 윤리 문제이자 동시에 발표 차별화 포인트임.

### 전체 구조

\[크롬 확장 MV3\]

  content script — Readability로 본문 추출 \+ 댓글 DOM 파싱 \+ 사전 스크리닝 배지

        │  chrome.runtime.connectNative  (확장→호스트 최대 64MiB)

        ▼

\[Electron 앱\]  ← 바로가기 하나로 실행, 캐릭터 \+ 네이티브 호스트 \+ 오케스트레이터 겸함

  ├─ 캐릭터 창 : frameless \+ transparent \+ alwaysOnTop, 우측 하단 고정

  ├─ 결과 창   : 판정 리포트 렌더링

  └─ 오케스트레이터 (main 프로세스)

        ├─\[병렬\]─ 네이버 뉴스 검색 API      (동일 사안 타 매체 기사)

        ├─\[병렬\]─ Google Fact Check API    (languageCode=ko)

        ├─\[병렬\]─ 후보 기사 원문 fetch \+ Readability (originallink 기준)

        └─\[병렬\]─ 매체 성향 매핑 조회

                       ▼

             본체 AI 1회 호출 (Gemini 3.x Flash, 구조화 JSON 강제)

                       │  실패/쿼터초과 시 → Groq 폴백

                       ▼

                  판정 리포트 JSON

---

## Tasks

### T-0 — API 3종 실호출 스파이크

- **Do:** 네이버 개발자센터 앱 등록 후 뉴스 검색 API 호출 / Gemini 무료 키로 한국어 프롬프트에 JSON 스키마 강제 출력 호출 / Fact Check API를 `languageCode=ko`로 호출. 각각 응답 원본을 파일로 저장. Gemini는 실제 RPM·RPD가 어디서 막히는지 연속 호출로 실측.  
- **Touches:** `spike/naver_news.js`, `spike/gemini_json.js`, `spike/factcheck_ko.js`, `.env.example`  
- **Done when:** 세 스크립트 모두 200 응답 \+ 파싱된 JSON이 `spike/out/`에 저장됨. 특히 **팩트체크 ko 검색 결과 건수를 숫자로 기록** (예: "조국" 5건, "백신" 12건). 이 숫자가 0에 가까우면 서브 에이전트 B 설계를 바꿔야 하므로 이 태스크가 최우선.  
- **Depends on:** 없음

### T-1 — 판정 파이프라인 코어 (CLI, UI 없음)

- **Do:** `기사 본문 텍스트 + URL` 입력 → `판정 JSON` 출력하는 Node 모듈. 검색 키워드 추출 → 서브 에이전트 4종 `Promise.all` 병렬 실행 → 본체 AI 1회 호출. 출력 스키마 고정: `{verdict, confidence, reasons[], evidence[{title,outlet,url,stance,supports}], bias:{direction,score,signals[]}, counterArticles[], limitations[]}`. `verdict`는 `검증됨 / 대체로 사실 / 근거 불충분 / 사실과 다름` 4단계. Gemini 실패 시 Groq 폴백 경로 포함.  
- **Touches:** `core/pipeline.js`, `core/agents/*.js`, `core/prompts/verdict.md`, `core/schema.json`  
- **Done when:** `node cli.js --url <기사URL> --text <본문파일>` 한 줄로 스키마에 맞는 JSON이 나오고, **서로 다른 기사 5건에서 스키마 검증 통과 \+ evidence 3건 이상**. 전체 소요 콘솔 출력이 **20초 미만**. Gemini 키를 일부러 무효화해도 Groq로 넘어가 결과가 나옴.  
- **Depends on:** T-0

### T-2 — 매체 성향 매핑 \+ 편향 2요소 판정

- **Do:** 국내 주요 언론사 40\~60곳의 도메인 → 성향 라벨(진보/중도진보/중도/중도보수/보수/미분류) 테이블 작성. 각 항목에 **근거 출처를 함께 기록**(학술연구·언론재단 자료 등), 근거 없는 곳은 `미분류`로 두고 추정하지 않음. 텍스트 층에서는 LLM이 프레이밍 지표를 구조화 채점: 인용원 편중, 감정어 밀도, 생략된 맥락, 제목–본문 불일치. 최종 편향 점수 \= 매체 레이어 \+ 텍스트 레이어 결합, **두 근거를 UI에 분리 표시**.  
- **Touches:** `data/outlet-bias.json`, `core/prompts/bias.md`, `docs/bias-methodology.md`  
- **Done when:** 테이블의 모든 엔트리에 `source` 필드가 채워져 있음(빈 것 0개). 파이프라인 출력의 `bias.signals[]`에 텍스트 지표가 2개 이상, 반대 성향 기사(`counterArticles`)가 **2건 이상** 실제 반대 라벨 매체에서 나옴. `docs/bias-methodology.md`에 한계 3가지 이상 서술.  
- **Depends on:** T-0 (T-1과 병행 가능 — 데이터 작업이라 코드와 안 겹침)

### T-3 — 크롬 확장 \+ 네이티브 메시징 브릿지

- **Do:** MV3 확장 작성. content script가 Readability로 본문 추출, 네이버/다음 뉴스 댓글 DOM 셀렉터로 댓글 최대 200개 수집, `chrome.runtime.connectNative`로 Electron 네이티브 호스트에 전달. 윈도우 레지스트리(`HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\<host-name>`)에 호스트 매니페스트 등록하는 설치 스크립트 포함. 매니페스트 필드는 `name`/`path`/`type:"stdio"`/`allowed_origins`.  
- **Touches:** `extension/manifest.json`, `extension/content.js`, `extension/background.js`, `native-host/manifest.json`, `installer/register-host.ps1`  
- **Done when:** 크롬에서 네이버 뉴스 기사를 연 상태로, Electron 콘솔에 **본문 1,000자 이상 \+ 댓글 10개 이상**이 찍힘. 언론사 자체 사이트 기사 3곳(예: 연합뉴스·조선·한겨레)에서도 본문 추출 성공.  
- **Depends on:** 없음 (T-1/T-2와 완전 독립 — 시간 쪼개서 번갈아 진행하면 됨)

### T-4 — Electron 캐릭터 오버레이 \+ 대화 흐름

- **Do:** frameless·transparent·alwaysOnTop 창을 우측 하단에 배치, `setIgnoreMouseEvents`로 캐릭터 영역 밖 클릭은 통과시킴. 클릭 → 말풍선 "현재 페이지에 있는 기사 내용을 분석할까요?" → 수락 시 확장에 현재 탭 수집 요청 → 분석 중 캐릭터 애니메이션 → 결과 창 슬라이드업. 윈도우 시작 시 자동 실행 옵션 \+ 바로가기(.lnk) 생성.  
- **Touches:** `app/main.js`, `app/character/`, `app/renderer/bubble.html`, `installer/`  
- **Done when:** 바로가기 더블클릭 → 캐릭터가 다른 앱 위에 뜸 → 클릭 시 말풍선 표시 → 수락 시 T-3 경로로 실제 본문이 넘어옴. 캐릭터 밖 데스크톱 클릭이 정상 동작함(투명 영역 클릭 삼킴 없음).  
- **Depends on:** T-3

### T-5 — 결과 리포트 UI

- **Do:** 판정 JSON을 화면으로. 상단 판정 등급 배지 \+ 신뢰도, 그 아래 **판단 근거 목록(각 근거마다 출처 기사 링크가 붙음)**, 교차 비교한 기사 카드, 편향 스펙트럼 바(좌↔우) \+ 반대 성향 기사 2건 나란히, 댓글 여론 요약. 하단에 고정 문구: 자동 분석 결과이며 최종 판단은 사용자 몫이라는 고지 \+ 한계 표시.  
- **Touches:** `app/renderer/report.html`, `app/renderer/report.css`  
- **Done when:** 기사 3건의 실제 파이프라인 출력이 레이아웃 깨짐 없이 렌더링되고, **모든 근거 항목에서 출처 링크 클릭 시 원문이 열림**. `limitations` 섹션이 항상 보임.  
- **Depends on:** T-1, T-2, T-4

### T-6 — 댓글 여론 분석

- **Do:** 수집된 댓글을 본체 AI에 넘겨 ① 찬반 비율 ② 주요 논점 3\~5개 ③ 기사 논조와 댓글 여론의 일치/괴리 여부를 요약. 댓글 원문은 그대로 노출하지 않고 요약만(명예훼손·개인정보 리스크 회피). 댓글 0개일 때 섹션 자체를 숨기는 처리 포함.  
- **Touches:** `core/agents/comments.js`, `core/prompts/opinion.md`  
- **Done when:** 댓글 50개 이상 달린 기사에서 찬반 비율 \+ 논점 3개가 출력되고, 댓글이 없는 기사에서 에러 없이 섹션이 생략됨.  
- **Depends on:** T-1, T-3

### T-7 — 사전 스크리닝 배지 (원 구상의 "의심 문구" 대체안)

- **Do:** 버튼 누르기 전 단계. content script에서 API 호출 없이 돌아가는 저비용 규칙으로 3등급 배지 부착 — `정보 없음`(기본) / `교차검증 권장`(매체 미분류 \+ 제목 선정성 패턴 \+ 출처 미표기) / `주의`(팩트체크 DB 즉시 히트 시). 문구는 단정형 금지, "이 기사는 교차검증이 필요할 수 있어요" 톤.  
- **Touches:** `extension/screening.js`, `data/screening-rules.json`  
- **Done when:** 기사 10건에 대해 배지가 뜨고, **명백한 정상 기사 5건 중 `주의` 오탐 0건**.  
- **Depends on:** T-3

### T-8 — 데모 안전장치

- **Do:** ① 판정 결과를 URL 키로 로컬 캐시(같은 기사 재분석 시 즉시 응답) ② 데모용 기사 5건을 미리 분석해 캐시에 심어두는 프리로드 스크립트 ③ 네트워크·쿼터 실패 시 캐시된 결과로 폴백하고 화면에 "캐시된 결과" 표시 ④ API 키 입력 화면(키를 코드에 안 박음).  
- **Touches:** `core/cache.js`, `scripts/preload-demo.js`, `app/renderer/settings.html`  
- **Done when:** **랜선을 뽑은 상태에서** 데모 기사 5건이 전부 정상 렌더링됨. 실시간 분석 결과와 캐시 결과가 화면상 구분됨.  
- **Depends on:** T-5

### T-9 — 정확도 검증 세트

- **Do:** 기사 30건 수집(팩트체크 기관이 이미 허위로 판정한 것 10건 \+ 검증된 정상 보도 10건 \+ 성향 뚜렷한 기사 10건)을 직접 라벨링하고 파이프라인을 돌려 혼동행렬 작성. 오답 사례 3건을 뜯어 원인 기록.  
- **Touches:** `eval/dataset.json`, `eval/run.js`, `docs/evaluation.md`  
- **Done when:** 30건 결과표 \+ 혼동행렬 \+ 정확도 수치가 `docs/evaluation.md`에 들어감. **오답 3건 이상에 원인 분석이 붙어 있음**(발표 Q\&A 방어용).  
- **Depends on:** T-1, T-2

### T-10 — 모바일 확장 설계 문서

- **Do:** 구현 없이 설계만. **안드로이드**: `SYSTEM_ALERT_WINDOW` 권한으로 떠있는 버블 구현 가능, 단 다른 앱의 DOM 접근은 불가하므로 공유 시트로 URL을 받아 서버가 본문을 fetch하는 경로 필요(성공률이 데스크톱보다 낮음을 명시). **iOS**: 다른 앱 위 오버레이가 OS 차원에서 금지되므로 바탕화면 캐릭터 UX 재현 불가 → Share Extension \+ 앱 내 결과 화면이 유일한 경로. 플랫폼별 기능 대조표 포함.  
- **Touches:** `docs/mobile-plan.md`  
- **Done when:** 안드로이드/iOS/데스크톱 3열 기능 대조표와 각 제약의 근거가 문서에 들어감. 발표 슬라이드에 그대로 붙일 수 있는 형태.  
- **Depends on:** 없음 (자투리 시간에 진행)

---

## 진행 순서 (혼자 개발 기준 병렬화)

혼자라 진짜 동시 작업은 안 되지만, **서로 안 막는 트랙으로 갈라서 막히면 바로 갈아타는** 구조로 짜둠.

T-0 (반드시 먼저, 전체 설계를 죽일 수 있는 불확실성)

 │

 ├─ 트랙 A (백엔드) : T-1 → T-6 → T-9

 ├─ 트랙 B (데이터) : T-2                    ← 코딩 막힐 때 돌리는 작업

 └─ 트랙 C (클라이언트) : T-3 → T-4 → T-7

                              │

                    T-5 (A \+ C 합류) → T-8

 └─ T-10 : 아무 때나, 이동 중에도 가능

런타임 병렬은 T-1에 이미 반영됨(`Promise.all`). 이게 20초 목표의 전제라 나중에 끼워넣지 말고 처음부터 그렇게 짜야 함.

---

## 위험

| 위험 | 가능성 | 실제 피해 | 지금 할 대응 |
| :---- | :---- | :---- | :---- |
| Fact Check API의 한국어 결과가 거의 없음 | **높음** | 서브 에이전트 B가 무용지물, "근거" 품질이 LLM 추론에만 의존하게 됨 | T-0에서 건수를 먼저 잰다. 부족하면 네이버 뉴스 검색으로 `"팩트체크" OR "사실확인" + 키워드`를 돌리는 보조 쿼리로 대체 |
| 네이버 뉴스 검색 API의 `description`이 짧게 잘려 비교·대조가 불가능 | **높음** | 교차검증이 제목 수준에 머물러 판정 근거가 얄팍해짐 | T-1에서 상위 후보 5건의 `originallink`(언론사 원문)를 병렬 fetch \+ Readability로 본문 확보. 언론사 자체 사이트는 대체로 접근 가능 |
| 데모 현장에서 네트워크 불안정 또는 무료 티어 쿼터 소진 | 중 | 발표 도중 아무것도 안 뜸 — 가장 치명적 | T-8을 선택 사항으로 두지 말 것. 프리로드 캐시 \+ 랜선 뽑고 리허설 |
| 댓글 DOM 셀렉터가 네이버 UI 개편으로 깨짐 | 중 | 여론 섹션만 빈다 | 셀렉터를 `data/selectors.json`으로 외부화, 실패 시 섹션 생략(전체 분석은 계속 진행) |
| 편향 판정이 특정 매체에 불리하게 보여 발표 중 반박당함 | 중 | 신뢰도 타격 | T-2에서 근거 출처를 전부 기록하고 UI에 노출. "매체 성향은 외부 연구 인용, 텍스트 분석은 AI 추정"으로 책임을 분리해 표시 |
| LLM이 근거 없는 판정을 그럴듯하게 말함(환각) | 중 | 오판 \+ 근거 링크가 실제 내용과 불일치 | 프롬프트에서 근거는 **전달받은 기사에서 인용한 문장만** 쓰도록 강제하고, `evidence[].url`이 입력 후보 목록에 없으면 파이프라인이 해당 항목을 버리는 후처리 검증 |
| 크롬 네이티브 메시징 윈도우 등록이 환경마다 꼬임 | 중 | 데모 PC에서 연결 실패 | 설치 스크립트를 만들되 **발표에 쓸 PC에서 직접 한 번 돌려 검증**. 폴백으로 클립보드 URL 경로 유지 |

---

## 미해결 질문

1. **네이버 개발자센터 앱 등록이 지금 바로 되는지** — T-0을 막음. 본인인증/휴대폰 인증 절차가 필요할 수 있음. 막히면 1차 뉴스 검색 소스를 GDELT \+ 구글 팩트체크 조합으로 임시 대체하고 진행해야 하는데, 한국 뉴스 커버리지가 크게 떨어짐.  
     
2. **API 키를 데모에서 어떻게 다룰지** — T-8을 막음. 배포용이면 프록시 서버가 필수지만 데모면 로컬 `.env` \+ 본인 키로 충분함. 기본값으로는 **로컬 `.env` \+ 설정 화면에서 키 입력**을 잡아둠. 발표 자료에 "실배포 시 프록시 필요"를 한 줄 넣으면 방어됨.  
     
3. **댓글 수집 대상 범위** — T-3, T-6에 영향. 네이버 뉴스만 지원할지, 다음/언론사 자체 댓글까지 볼지. 기본값으로는 **네이버 뉴스만** 잡아둠 (셀렉터 유지 비용이 가장 낮고 댓글 양도 제일 많음).  
     
4. **캐릭터 비주얼을 어디서 조달할지** — T-4의 마감 품질을 좌우함. 직접 그릴지, 무료 에셋을 쓸지, 간단한 도형+애니메이션으로 갈지. 시간이 빠듯하면 **SVG 도형 기반 \+ CSS 애니메이션**이 제일 싸고 깔끔함.

---

## 첫 덩어리

**T-0 (API 3종 실호출 스파이크) → T-2 (매체 성향 테이블) 착수.**

T-0을 맨 앞에 두는 이유는 하나임 — 팩트체크 API의 한국어 결과가 비었거나 Gemini 무료 티어가 생각보다 빡빡하면 **T-1의 아키텍처 자체가 달라짐**. 코드를 한 줄이라도 쓰기 전에 이 숫자를 봐야 함. T-2는 API 키 발급을 기다리는 동안 손 놀리지 않고 돌릴 수 있는 데이터 작업이라 같이 묶음.

T-0부터 시작할까?

---

## 참고 자료

Sources:

- [Gemini API pricing — Google AI for Developers](https://ai.google.dev/gemini-api/docs/pricing)  
- [Gemini API rate limits — Google AI for Developers](https://ai.google.dev/gemini-api/docs/rate-limits)  
- [Gemini API Free Tier Limits — TokenMix](https://tokenmix.ai/blog/gemini-api-free-tier-limits)  
- [Groq Free Tier Limits 2026 — TokenMix](https://tokenmix.ai/blog/groq-free-tier-limits-2026)  
- [네이버 검색 API 참조 문서 (일일 25,000회 / display 100 / start 1000\)](https://glama.ai/mcp/servers/@cola314/naver-encyc-mcp/blob/4e3e453d86479ec87802d75051cc7cf136475855/docs/api-reference.md)  
- [Method: claims.search — Fact Check Tools API](https://developers.google.com/fact-check/tools/api/reference/rest/v1alpha1/claims/search)  
- [Fact Check Tools API Terms of Service](https://developers.google.com/fact-check/tools/api/terms)  
- [Native messaging — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)  
- [Using chrome native messaging with electron — electron/electron\#8692](https://github.com/electron/electron/issues/8692)  
- [네이버 뉴스기사 웹 크롤링 안되는 이유](https://brunch.co.kr/@9002b66c31a742f/3)  
- [한국 신문 보도의 이념적 다양성에 대한 고찰 — KCI](https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART001463900)  
- [SNU 팩트체크](https://factcheck.snu.ac.kr/)

