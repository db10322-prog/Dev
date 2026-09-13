# 배포 계획 — Vercel + Supabase

> **선택 사항, 후순위.** Vercel도 만 16세 이상만 가입 가능하고 18세 미만은 "AI Product"(이 프로젝트의 `/api/analyze`가 여기 해당) 사용에 부모/법정대리인 동의가 필요하다. 또 이 클라우드 경로가 쓰는 Gemini/Groq 키도 마찬가지로 18세 이상만 발급 가능하다(`.env.example`, README 참고). 데모 자체(Electron + 로컬 모델)는 이 배포 없이도 완전히 동작하므로, 성인의 도움 없이 진행 중이라면 이 문서는 나중에 필요할 때만 보면 된다.

## 이 프로젝트에서 "배포"가 의미하는 범위

핵심 데모(캐릭터 오버레이 + 크롬 확장 + 20초 판정)는 **로컬 Electron 앱**으로 동작해야 한다. 랜선을 뽑고도 재현돼야 한다는 완료 기준(T-8) 때문에, 판정 파이프라인 자체를 Vercel 서버리스에 상시 의존하게 만들면 안 된다. 따라서 Vercel/Supabase는 다음 두 가지 역할만 맡는다.

1. **소개/다운로드 랜딩 페이지** (`web/`) — Next.js 정적/서버 페이지. 프로젝트 설명, 작동 방식, 투명성 고지, 앱 다운로드 링크.
2. **클라우드 분석 API** (`web/pages/api/analyze.js`) — 미해결 질문 #2("실배포 시 프록시 필요")에 대한 실제 구현체. API 키를 서버(Vercel 환경변수)에만 두고, 브라우저/확장이 직접 Gemini/Naver 키를 들고 있지 않아도 되게 하는 경로. **데모의 기본 경로는 아님** — Electron은 기본적으로 `core/pipeline.js`를 로컬에서 직접 호출한다.

## 아키텍처 요약

```
[web/ (Next.js, Vercel)]
  ├─ pages/index.js        → 소개 + 다운로드 랜딩 (Toss 스타일 디자인)
  └─ pages/api/analyze.js  → core/pipeline.js 재사용, Supabase를 캐시 백엔드로 사용

[core/ (공용 로직, Electron과 Vercel이 함께 import)]
  ├─ pipeline.js, agents/*, cache.js (CACHE_BACKEND로 local/supabase 전환)

[Electron 앱 — 기본 경로]
  └─ core/pipeline.js 직접 호출, CACHE_BACKEND=local (오프라인 데모 요구사항)

[Supabase]
  ├─ analysis_cache  — 클라우드 모드 캐시 (supabase/schema.sql)
  ├─ outlet_bias     — data/outlet-bias.json 동기화용(선택)
  └─ eval_results     — T-9 결과 보관용(선택)
```

## Supabase 설정 절차

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성.
2. SQL Editor에 `supabase/schema.sql` 내용을 그대로 실행.
3. Project Settings → API 에서 다음 값을 확보:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (절대 브라우저/클라이언트에 노출 금지 — Vercel 서버 환경변수에만 등록)
   - `anon` 키 → `SUPABASE_ANON_KEY` (현재 코드에서는 서버만 쓰므로 필수는 아니지만 향후 클라이언트 직접 접근 시 사용)
4. (선택) `data/outlet-bias.json`의 `outlets[]`를 `outlet_bias` 테이블에 upsert하는 1회성 스크립트를 돌리고 싶다면 `@supabase/supabase-js`로 간단히 작성 가능 — 현재 파이프라인은 기본적으로 로컬 JSON 파일을 읽으므로 필수는 아님.

## Vercel 설정 절차

1. GitHub 리포지토리를 Vercel에 연결.
2. **Root Directory**를 `web`으로 지정 (모노레포 — 랜딩 페이지와 API가 `web/`에 있음).
3. `web/next.config.js`의 `outputFileTracingRoot`가 리포 루트를 가리키도록 이미 설정되어 있어, `core/`, `data/` 등 상위 폴더 파일도 서버리스 함수 번들에 포함된다. 별도 조치 불필요.
4. Vercel Project → Settings → Environment Variables에 아래를 등록:
   - `GEMINI_API_KEY`, `GEMINI_MODEL`
   - `GROQ_API_KEY`, `GROQ_MODEL` (폴백)
   - `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
   - `GOOGLE_FACTCHECK_API_KEY`
   - `CACHE_BACKEND=supabase`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy. `web/pages/index.js`가 루트(`/`)에, `web/pages/api/analyze.js`가 `/api/analyze`(POST)에 뜬다.
6. 배포 후 확인:
   ```bash
   curl -X POST https://<프로젝트>.vercel.app/api/analyze \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com/a","title":"테스트","text":"...(200자 이상)..."}'
   ```

## 로컬 Electron 데모와의 관계 — 반드시 지킬 것

- Electron 앱의 `.env`에는 `CACHE_BACKEND`를 설정하지 않거나 `local`로 둔다. Supabase/Vercel 자격증명이 없어도 데모는 완전히 동작해야 한다.
- `CACHE_BACKEND=supabase`는 **오직 Vercel 배포본에서만** 사용한다. 로컬에서 이 값을 켜면 네트워크가 필요해져 T-8(랜선 뽑고 데모)이 깨진다.
- 두 경로가 같은 `core/pipeline.js`를 공유하므로, 파이프라인 로직을 고치면 로컬 데모와 클라우드 배포본에 동시에 반영된다 — 이중 유지보수가 없다.

## 남은 작업 (실제 배포 전 체크리스트)

- [ ] Supabase 프로젝트 생성 + `supabase/schema.sql` 실행
- [ ] Vercel 프로젝트 연결 + Root Directory `web` 설정 + 환경변수 등록
- [ ] `web/pages/index.js`의 다운로드 링크를 실제 GitHub Release/설치 파일 URL로 교체
- [ ] `/api/analyze` 실제 호출 테스트 (위 curl 예시)
- [ ] 프로덕션 Rate limiting/남용 방지가 필요하면 Vercel Edge Config 또는 Supabase에 요청 카운터 테이블 추가 (현재 범위 밖 — 데모 규모에서는 불필요)
