# 운영 연결 기록 · 2026-11-11

## Supabase

- 프로젝트: `dzjfjspudnttqnbctljn` / `year-end-party`, Tokyo.
- URL: `https://dzjfjspudnttqnbctljn.supabase.co`.
- 마이그레이션 001~010 적용. 가상 직원 시드는 운영에 적용하지 않았다.
- `portal`, `verify-employee`, `upload-media` 배포. 각 함수는 공유 import map과 JWT 검증을 사용한다.
- 서버 `LOGIN_HASH_SECRET`, `ALLOWED_ORIGINS` 등록. 실제 비밀값은 문서·Git에 기록하지 않는다.
- Pages의 실제 Origin은 `https://mck1025.github.io`이다. 호스트 대소문자를 정규화한 Origin으로 CORS를 점검하며, 허용값에도 이 소문자 주소를 사용한다.
- 운영자 이메일 계정과 `private.admins` 권한 생성. 임시 비밀번호는 Git에서 제외된 `.env.admin.production.local`에만 저장했다. 이 파일을 업로드·공유하지 않는다.
- 직원 익명 Auth 허용. 일반 이메일 회원가입과 `user_metadata`로 위장한 관리자 가입은 before-user-created 훅이 거절한다. 전역 signup을 끄면 직원 익명 로그인도 막히므로 끄지 않는다.
- 서버에서 생성한 추가 운영자도 Auth admin API의 `app_metadata.party_admin_provisioning=true`가 필요하다. `user_metadata`는 허용 조건이 아니다. 계정을 만든 후 `private.admins`에 UUID를 따로 등록한다.
- 기존 `public.game_state`의 행은 보존했다. 이 프로토타입 테이블의 익명/직원 SELECT와 Realtime publication만 제거했다. 새 서비스는 `event_public_state`를 사용한다.

## 로컬 비공개 설정

`.env.local`과 `.env.test.local`은 로컬 합성 데이터용이다. `.env.hosted.local`은 운영 URL/공개 키, `.env.admin.production.local`은 운영 관리자 인증정보, `supabase/functions/.env.production`은 서버 비밀값이다. 모두 Git에서 제외한다.

초기 연결 도구 `scripts/production-setup.mjs <관리자이메일> <프로젝트ID>`는 `artifacts/local-production-keys.json`에 별도로 보관한 CLI 키 응답을 읽는다. 기존 계정의 비밀번호는 변경하지 않는다. 새 계정 생성용 Auth admin 키와 관리자 grant SQL은 초기 작업 후 로컬 임시 파일에서 제거한다. 운영용 키는 소스나 `VITE_` 환경변수에 넣지 않는다.

## GitHub Pages

대상은 `MCK1025/Year_END_Party_Website` 하나이다. 사용자가 이 저장소의 공개 전환을 승인했다. 다른 저장소의 가시성은 변경하지 않는다.

Actions 공개 변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 등록했다. 비공개 저장소 상태에서 Pages API가 계정 요금제 제한(422)을 반환했으며, 승인받은 이 저장소만 공개로 전환하고 Pages를 GitHub Actions 빌드 방식으로 설정했다. 이후 `main` push가 검증·배포를 실행한다. 실제 배포 결과는 저장소 Actions 탭에서 확인한다.

접속 주소: `https://mck1025.github.io/Year_END_Party_Website/#/login`, 운영자 `/#/admin`. 첫 소스 커밋 `4c4bac098d12f6146fff499e7a3d5aeee39f054a`의 [GitHub Actions 실행](https://github.com/MCK1025/Year_END_Party_Website/actions/runs/43015381110)은 성공했다.

공개 URL의 HTTP 200, 실제 운영 관리자 로그인과 9개 운영 메뉴를 Chromium에서 확인했다. 375/1280px의 로그인·운영 메뉴 20개 캡처에서 가로 넘침과 실행 오류는 없었다(`artifacts/hosted-browser.json`). 이는 실제 휴대폰을 사용한 검증은 아니다. 캡처에는 로그인 비밀번호를 포함하지 않았으며 이미지 파일은 Git에서 제외했다.

## 검증 범위

실제 운영 Auth/Edge/RLS/CORS와 Realtime을 `scripts/production-smoke.mjs <프로젝트ID>`로 점검했다. 17개 확인 항목이 통과했으며, 단순 채널 연결뿐 아니라 관리자의 대기 상태 갱신이 Postgres Changes로 도착하는 것도 확인했다. 이 스크립트는 직원 0명·대기 상태인 초기 환경 전용이며, 실제 행사 데이터가 들어간 뒤 실행하지 않는다. 임시 익명 점검 계정은 종료 시 삭제한다. 결과는 `artifacts/production-smoke.json`에 기록한다.

직원 인증 성공 이후의 설문·추천·게임 전체 흐름과 50개 동시 연결은 로컬 Supabase에서 검증했다. 운영에는 시험용 직원 데이터를 넣지 않았으므로 운영 직원 흐름·50명 부하·실제 iOS/Android·행사장 네트워크 확인은 아직 남아 있다. 행사일·명단·로고·사진은 운영자가 관리자 화면에서 설정해야 한다.
