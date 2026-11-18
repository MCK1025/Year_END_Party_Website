# 행사 종료 후 자유 관람 · 2026-11-18

## 화면과 운영

관리자 **실시간 진행**에서 시상식 또는 엔딩을 마친 뒤 **행사 종료 및 자유 관람 시작**을 누른다. 확인 창에서 기존 이야기 트리 전체 글의 검수·공개를 확인해야 확정할 수 있다. 기존 행사 시작 여부·시작 시각·일시 정지·관리자 권한·동시 조작 검증을 서버에서 적용한다.

종료 후 직원 화면은 `/afterparty` 홈, 기존 `/tree`, 새 `/cards`로 구성된다. HashRouter와 기존 공책 레이아웃·감자꽃·보기 설정을 그대로 사용한다. 홈의 두 큰 링크와 각 페이지의 홈 링크로 자유롭게 왕복한다. 초기 접속·재접속은 홈으로 이동한다. 이미 자유 관람 중인 화면에는 관리자 게임 명령이 끼어들지 않는다.

## 기존 트리 재사용

`src/pages/Tree.tsx`에 홈 링크와 공개 상태 안내만 추가했다. `TreeCollection`, 이야기창, 트리 그림·눈·전구·페이지 이동·30개 제한 및 공개 데이터 조회는 기존 구현을 그대로 사용한다. 종료 명령은 기존 트리 공개 방식대로 검수한 전체 글을 공개 사본에 반영한다. 관리자 공개 종료·접속 차단 권한도 유지한다.

## 데이터와 권한

기존 `public.questions`, `public.surveys`, 비공개 직원 명단을 서버에서 연결한다. 별도 질문이나 응답 사본은 만들지 않는다. 직원에게는 카드 ID·이름·소속·승인된 질문과 답변 원문만 보낸다. 줄바꿈과 공백도 보존한다. 이름순 정렬, 이름 검색, 이전/다음 버튼, 가로 스와이프, 현재 순번을 제공한다.

**설문·추천 → 직원별 원본 조회 → 자유 관람 취향 카드**에서 관리자가 공개할 원문 항목을 선택한다. 기존 공개 동의와 별도 관리자 검수를 모두 통과해야 공개된다. 비활성 직원·미작성 설문·비동의·빈 답변·공개 제외·미검수 항목은 제외한다. 답변·동의·질문이 바뀌면 승인을 해제한다. 전체 선택 해제로 공개를 취소할 수 있다.

직원은 원본 설문 전체나 검수 테이블을 직접 조회할 수 없다. 기존 Edge Function의 인증과 서비스 전용 RPC를 재사용한다. 카드 조회는 인증된 활성 직원에게 행사 종료 후에만 허용한다. 생년월일·비밀번호·인증정보·추천 내역은 카드 응답에 포함하지 않는다.

카드 목록은 참가자별 메모리 캐시에 보관한다. 카드 넘김·검색·홈 왕복은 재조회하지 않는다. 기존 Realtime의 상태 revision이 바뀌면 이전 캐시를 숨기고 다시 조회하며, 실패 시 안내와 재시도를 제공한다.

## 상태 및 SQL

`supabase/migrations/202611180001_completed_browsing.sql`:

- 기존 `event_public_state.phase`에 `COMPLETED`를 추가한다. 별도 행사 상태 테이블은 없다.
- `private.card_reviews`에 직원별 공개 승인 질문 ID를 저장한다. 비공개 스키마·RLS·권한 회수 적용.
- 원본 변경 시 승인 취소 트리거와 기존 공개 revision 갱신을 연결한다.
- `complete_event` 명령은 트리 공개·상태 갱신·감사 기록을 한 트랜잭션으로 저장한다.
- `taste_cards`, `review_card`를 기존 서버 게이트웨이에 추가한다. 기존 원본 설문 RLS는 유지한다.
- 완료 후 공식 게임 명령을 거절하고 일정 변경·직원 삭제가 완료 상태를 되돌리지 않도록 한다. 리허설과 개인정보 파기 절차는 별도로 유지한다.

운영 적용 순서는 SQL → `portal` Edge Function → GitHub Pages다. 적용만으로 행사 종료·설문 공개 승인이 실행되지는 않는다. 검수된 카드가 없으면 빈 목록 안내를 표시한다.

## 변경 파일

- 화면: `src/pages/AfterParty.tsx`, `TasteCards.tsx`, `Participant.tsx`, `Tree.tsx`, `Survey.tsx`, `src/App.tsx`
- 공통 화면: `src/components/afterparty/CardData.tsx`, `src/components/book/BookLayout.tsx`, `src/components/EventView.tsx`, `src/components/ui.tsx`, `src/lib/motion.ts`, `src/styles/components.css`
- 관리자: `src/admin/CardReview.tsx`, `DataPanel.tsx`, `ProgressPanel.tsx`, `GameControls.tsx`
- 서버 계약: `supabase/functions/_shared/contracts.ts`, `requests.ts`
- SQL: `supabase/migrations/202611180001_completed_browsing.sql`
- 테스트: `tests/integration/completed-browsing.test.ts`, `tests/e2e/completed-browsing.spec.ts`, `completed-cards.spec.ts`, `notebook-fixture.ts`
- 문서: `DESIGN.md`, `docs/ADMIN-MANUAL.md`, 이 보고서

## 실행한 검증

- `npm run lint`, `npm run typecheck`, 빌드 통과.
- 기존 단위 테스트 43개 통과.
- 전체 로컬 Supabase 통합 테스트 42개 통과. 자유 관람 권한·동시 조작·원문·승인 취소·일정 변경·직원 삭제 회귀 테스트 6개를 포함한다.
- 실제 로컬 Supabase로 가상 직원 5명과 모바일 크기 브라우저 50개를 연결한 E2E 통과. 관리자 확인창 취소/승인, 49개 연결 화면 전환과 1개 재연결, 새로고침, 뒤늦은 로그인, 트리 왕복, 카드 원문·검색·이동·캐시 확인.
- 공개 카드 조회 50개 동시 요청의 성공과 응답 일치 확인.
- 조회 실패·재시도·빈 목록·공개 revision 변경·동작 줄이기 E2E 통과.
- 기존 이야기 트리 회귀 E2E 3개 통과: 개인 글 삭제·추천 조건·검수한 공개 트리·이야기 확대/닫기·이야기 편집 화면 양방향 책장 넘김.
- 320/390/768/1280px 홈·긴 답변 카드와 390px 트리 화면 캡처 검토. 기존 공책 모션이 끝난 실제 HTML 상태로 캡처.
- `/Year_END_Party_Website/` 경로로 별도 빌드 후 홈·카드 이동과 정적 자산 로드 확인.

로컬 캡처는 Git에서 제외된 `artifacts/screens/afterparty/`에 있다. 실제 직원 개인정보 대신 가상 답변만 사용했다.

## 검증 한계

실제 휴대폰과 행사장 네트워크는 확인하지 않았다. 브라우저 50개는 한 컴퓨터의 독립 로그인 컨텍스트이며 가상 직원 5명을 반복 사용한다. 기본 5개 화면은 일반 모션, 추가 45개 화면은 동작 줄이기로 실행했다. 50대 실물 기기의 그래픽 성능을 검증한 것은 아니다. 운영 행사 종료·공개 승인·직원 데이터 변경은 테스트하지 않는다.
