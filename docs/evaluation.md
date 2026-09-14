# 정확도 검증 결과 (T-9)

이 문서는 `node eval/run.js` (또는 `npm run eval`) 실행 시 자동 생성/갱신됩니다.

**아직 실행되지 않음.** `eval/dataset.json`의 30건은 이미 실제 기사/팩트체크 자료로 채워져 있으므로, 바로

```bash
npm run eval
```

를 실행하면 이 파일이 혼동행렬·정확도·오답 원인 분석으로 자동 교체됩니다. 단, `.env`에 `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET` 등 본체 AI·서브 에이전트 키가 설정돼 있거나(또는 `npm run download-model`로 로컬 모델이 받아져 있어야) 실행됩니다 — README의 "처음 시작하기" 2~2-1단계를 먼저 마쳐야 함.

## 준비 절차 (완료됨 — 참고용으로 남김)

1. ~~팩트체크 기관이 이미 허위로 판정한 기사 10건, 검증된 정상 보도 10건, 성향이 뚜렷한 매체의 기사 10건을 수집합니다.~~
2. ~~각 기사를 크롬 확장으로 열어 본문을 1회 수집하거나 직접 복사해 `eval/dataset.json`의 `text` 필드를 채웁니다.~~
3. ~~`groundTruthVerdict`(허위/정상 그룹) 또는 `groundTruthDirection`(성향뚜렷 그룹)을 직접 라벨링합니다.~~
4. `npm run eval` 실행 후, 오답 3건 이상을 직접 열어 원인을 이 파일에 기록합니다(발표 Q&A 방어용) — 이 단계만 남음.
