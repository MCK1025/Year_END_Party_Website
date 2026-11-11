# 로컬 검증 기록 · 2026-11-11

## 범위와 한계

Windows의 로컬 Docker Supabase와 실제 Auth, Postgres, RLS, Edge Functions, Realtime, private Storage를 사용했다. 가상 직원은 5명이며 실제 직원 개인정보는 사용하지 않았다. Vite production build를 Chromium에서 실행했다.

아래 표는 최초 로컬 검증의 기록이다. 이후 운영 Supabase 연결, 실제 Auth/Edge/RLS/CORS/Realtime 기본 점검을 완료했고, 결과는 [운영 배포 기록](DEPLOYMENT.md)과 `artifacts/production-smoke.json`에 분리했다. 행사장 Wi-Fi·실제 iOS/Android, 운영 직원 데이터로 로그인 이후 전체 흐름·50명 부하·관리자 MFA 강제 설정은 **미검증**이다. GitHub Pages의 최신 배포 결과는 저장소 Actions 탭에서 확인한다.

## 실행 결과

| 확인 | 결과 | 근거 |
|---|---|---|
| Biome / TypeScript / production build | 통과 | 저장소 명령 `lint`, `typecheck`, `build` |
| 단위 테스트 | 12개 통과 | CSV 날짜·중복·수식 방어, 500자 집계 계약, 오래된 공개 상태 병합 방지 |
| 실제 Supabase 통합 테스트 | 24개 통과 | 서비스 9·보안 7·공개 철회 4·가입 정책 4 |
| 모바일 브라우저 E2E | 2개 통과 | 직원 로그인→설문→추천→전 단계 진행/재접속, 동시 관리자 변경 후 오래된 확인 거절 |
| 동시 연결 | 50/50 수신 | `artifacts/load-test.json` |
| 운영 기능 실험 | 10개 통과 | `artifacts/operations-test.json` |
| 반응형 화면 | 27상태 × 4너비 = 108장 | `artifacts/visual-qa.json`, 가로 넘침·페이지 오류 0 |
| Lighthouse | 모바일 3회·데스크톱 3회 모두 성능/접근성/권장사항 100 | 로그인 경로만 측정. 전체 앱 점수가 아님 |
| 운영 의존성 취약점 검사 | 알려진 취약점 0 | `pnpm audit --prod`, 검사 시점 기준 |
| Deno 함수 타입 검사 | 3개 함수 통과 | verify-employee / portal / upload-media |
| 새 DB 초기화 | 8개 마이그레이션·시드 적용 통과 | 로컬 `supabase db reset` 후 관리자 재생성·통합/E2E 실행 |

### 동시 연결 해석

50개의 독립 익명 Auth 사용자와 50개의 Postgres Changes WebSocket을 사용했다. 5명 명단을 유지하기 위해 같은 합성 직원 자격으로 바인딩했으므로 50명의 서로 다른 직원 데이터에 대한 시험은 아니다. 최신 실행(10:21 KST)의 힌트 1개 전송 지연은 p50 102ms, p95 102ms, 최대 102ms였으며, 50개 동시 snapshot 요청 묶음은 144ms였다. 재접속 후 공개 힌트 1개가 복구됐고 미래 힌트는 전송되지 않았다. 로컬 수치는 인터넷·모바일망의 성능을 보장하지 않는다.

### 보안 및 운영 경계

통합 테스트는 타인 설문·전체 원본·private RPC 접근 차단, 자기 추천 거절, 한 명당 한 표, 서버 기준 18시 경계, 비공개 힌트 차단, 리허설 격리, 오래된 revision 거절, 설문 마감, 동의 철회와 공개 승인 철회를 확인한다. 취향·추천 이유는 공개한 현재 단계뿐 아니라 다음 단계로 넘어간 뒤 철회해도 이전 감사 기록의 되돌리기로 복원되지 않는지 검사한다. 새 직원 세션의 bootstrap과 직접 public state 조회에도 철회 내용이 없는지 확인한다.

별도 운영 시험은 CSV 등록 후 무작위 코드 발급, 코드 재발급 시 기존 세션/코드 무효화, 위장 SVG 업로드 거절, 대기 중 사진 접근 차단과 RECAP 공개 후 다운로드, 개인정보 파기를 실제로 실행했다. 파기 직후 직원·설문·추천·바인딩·익명 Auth 사용자·Storage 파일은 모두 0이었고 관리자 접근은 유지됐다. 그 후 로컬 가상 직원 5명을 복구했다.

실제 관리자 화면에서 내려받은 XLSX의 ZIP 시그니처를 확인했다. CSV/XLSX 생성 경로의 수식 방어는 단위 테스트로 확인했다. Microsoft Excel에서 여는 수동 검증은 수행하지 않았다.

### 화면과 성능

320·375·768·1280px에서 로그인, 설문, 추천, 대기, 회고, 게임 준비/힌트 1~3/일시정지/정답, 취향 질문/결과, 시상, 엔딩, 마감 설문, 관리자 로그인·9개 메뉴·내보내기 확인을 촬영했다. 전부 합성 데이터이다. 화면 캡처는 용량과 개인정보 노출 위험을 줄이기 위해 Git에서 제외했다.

최신 캡처 전체에 대해 독립적인 디자인 시스템/기능 검수와 시각/한글 정밀 검수가 모두 PASS했다. 최종 보고서는 `artifacts/visual-integrity-gate.md`, `artifacts/visual-cjk-gate.md`이며 이전 REVISE 보고서의 줄바꿈·대비·대화상자·캡처 누락 문제를 새 이미지에서 확인했다. 검수 이력과 소스 해시는 `artifacts/REVIEW-LEDGER.md`에 있다.

로그인 Lighthouse SEO 점수는 63이다. 비공개 행사 사이트의 `noindex`와 `robots.txt` 차단은 의도한 설정이다. 대형 공통 JS의 소스맵·미사용 JS 등 진단 항목은 남아 있다. React Doctor의 초기 진단은 61/100으로, 모든 진단이 해소됐다는 주장은 하지 않는다.

검수에서 발견한 실제 오류는 수정했다: 500자 설문과 집계 스키마 길이 불일치, 늦은 bootstrap의 이전 상태 복원, 확인 창의 revision 변경, 공개 취향·추천 이유 승인 철회 반영 누락, HashRouter와 충돌하는 건너뛰기 링크, 어두운 패널 보조문구 대비, 대화상자 위치 및 좁은 관리자 미리보기 줄바꿈. 관련 회귀 테스트와 새 화면 캡처로 확인했다.

## 재실행

README의 로컬 설정 후 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:load`, `pnpm build`를 실행한다. 상태를 변경하는 통합/E2E/부하/운영/화면 캡처 스크립트는 순차 실행한다. `scripts/operations-test.mjs`는 로컬 가상 데이터 전체를 파기하는 시험이므로 운영에서 실행할 수 없도록 localhost를 검사한다.

운영 기본 연결 점검 후에도 관리자 설명서의 당일 점검표를 실제 휴대폰 2대 이상으로 수행하고, 전용 리허설 환경에서 50개 연결 시험·재접속·서명 사진 접근·권한 검증을 다시 기록해야 한다. 현재 행사 운영 데이터에 로컬 파기 시험이나 합성 시드를 실행하면 안 된다.
