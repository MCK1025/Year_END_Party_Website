# 2026 · 한 걸음 더 가까이

직원 30~50명의 휴대폰에서 사용하는 연말 행사 서비스입니다. React/TypeScript/Vite, Tailwind CSS, HashRouter, GitHub Pages와 Supabase만 사용합니다. 상시 운영 앱 서버는 없습니다.

현재 저장소는 실제 Postgres 저장·Auth·RLS·Edge Functions·Realtime을 사용하는 구현입니다. 운영 Supabase 연결과 기본 권한 점검을 완료했습니다. 브라우저 메모리나 localStorage에 행사 데이터를 대신 저장하는 데모 모드는 없습니다. 연결·배포 기록은 [운영 배포 기록](docs/DEPLOYMENT.md)을 참고하세요.

## 로컬 실행

Node.js 24, pnpm 10.32.1, 실행 중인 Docker가 필요합니다. 아래 명령은 저장소 루트에서 실행합니다.

```powershell
pnpm install --frozen-lockfile
pnpm exec supabase start
pnpm exec supabase status -o env > .env.supabase.local
pnpm local:setup
pnpm exec supabase functions serve --env-file supabase/functions/.env.local
```

다른 터미널에서 `pnpm dev`를 실행하고 [로컬 로그인](http://localhost:5173/#/login)을 엽니다. 가상 직원 5명은 `supabase/seed.sql`에 있습니다. 예: 이름 `가상직원 하나`, 생년월일 `1990-01-01`, 코드 `TEST2026-A1`. 모두 개발용 합성 정보입니다.

로컬 관리자 이메일과 무작위 비밀번호는 무시되는 `.env.test.local`에 생성됩니다. 터미널이나 GitHub에 출력하지 않습니다. `pnpm local:setup`을 다시 실행하면 로컬 관리자 비밀번호가 바뀝니다.

`supabase db reset`은 로컬 DB를 초기화하고 가상 직원을 다시 넣습니다. 이때 관리자도 사라지므로 `pnpm local:setup`을 다시 실행합니다. **운영 프로젝트에서 시드·테스트·부하 테스트를 실행하지 마세요.**

## 운영 Supabase 연결

1. 이 행사 전용 Supabase 프로젝트를 생성합니다. 다른 서비스의 Auth·Storage와 공유하지 않습니다.
2. `pnpm exec supabase login`, `pnpm exec supabase link --project-ref <프로젝트ID>`, `pnpm exec supabase db push --remote=<프로젝트ID> --dry-run`으로 대상을 확인하고 `--dry-run` 대신 `--yes`로 적용합니다. CLI 3에서는 DB 명령의 기본 대상이 로컬이므로 운영에는 **항상 `--remote`를 명시**합니다. `--include-seed`는 사용하지 않습니다.
3. `pnpm exec supabase config diff --workdir deploy --remote=<프로젝트ID>`로 운영용 부분 설정을 확인하고 `config push`에 같은 인자와 `--yes`를 주어 적용합니다. 익명 로그인과 시간당 IP 제한 100회, 서버 가입 훅을 설정합니다. 전역 signup을 끄면 익명 로그인도 막히므로 이를 켜고 `private.before_user_created`에서 일반 이메일 가입을 거절합니다. 훅은 anonymous 또는 서비스 전용 Auth admin API가 `app_metadata.party_admin_provisioning=true`로 생성한 계정만 허용합니다. 이 표식은 관리자 권한을 부여하지 않으며, 별도로 `private.admins` 등록이 필요합니다. 현재 로그인에는 CAPTCHA 위젯이 없으므로 Auth CAPTCHA는 끈 상태로 사용합니다.
4. SQL Editor에서 생성한 관리자에게 권한을 부여합니다.

```sql
insert into private.admins(user_id)
select id from auth.users where email = '실제 관리자 이메일';
```

5. 로컬 비공개 파일 `supabase/functions/.env.production`에 `LOGIN_HASH_SECRET=<암호학적 난수 32바이트 이상>`와 `ALLOWED_ORIGINS=https://mck1025.github.io`를 설정합니다. Origin은 브라우저가 보내는 소문자 호스트로 쓰고 저장소 경로를 넣지 않습니다. 파일을 커밋하지 않습니다.
6. `pnpm exec supabase secrets set --remote=<프로젝트ID> --env-file supabase/functions/.env.production --yes` 후 `pnpm exec supabase functions deploy --remote=<프로젝트ID> --use-api --yes`를 실행합니다. 세 함수의 공유 import map은 `config.toml`에 명시되어 있습니다. 플랫폼 JWT 검증과 함수 내부 `getUser/getClaims` 검증을 함께 사용합니다.
7. 운영 미리보기에는 `.env.hosted.local`에 프로젝트 URL과 **공개 가능 키**를 설정하고 Vite `--mode hosted`를 사용합니다. 기본 `.env.local`은 로컬 테스트용으로 유지합니다. `VITE_`에는 서비스 역할 키·Secret key·DB 비밀번호를 넣지 않습니다.
8. Realtime publication에 `event_public_state`만 들어가는지 확인합니다. 마이그레이션이 이 테이블을 등록합니다. `private` 스키마는 Data API에 노출하지 않습니다.
9. 운영 관리자 로그인 후 행사일, 삭제 예정일, 로고, 명단, 공개 콘텐츠를 설정합니다.

관리자 MFA를 사용할 경우 Supabase Auth의 TOTP를 활성화하고 관리자 계정에 인증 앱을 등록합니다. 로그인 화면은 등록된 TOTP를 확인합니다. 등록 후 SQL에서 `update private.settings set require_admin_mfa=true where id;`로 **서버와 직접 RLS 조회 모두에** aal2를 강제할 수 있습니다. 등록하지 않고 강제하면 관리자가 잠기므로 SQL Editor에서 해제해야 합니다.

## GitHub Pages

저장소 [MCK1025/Year_END_Party_Website](https://github.com/MCK1025/Year_END_Party_Website)의 Settings → Pages → Source를 **GitHub Actions**로 설정합니다. Settings → Secrets and variables → Actions → **Variables**에 다음 두 공개 변수를 등록합니다.

| 변수 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | 운영 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key 또는 legacy anon key |

`main` push 시 검증·빌드 후 Pages에 배포합니다. 예상 URL은 `https://MCK1025.github.io/Year_END_Party_Website/#/login`이며, 실제 배포 성공과 모바일 실기기 점검 전에는 운영 배포 완료로 간주하지 않습니다. 키가 미설정이면 화면에 연결 설정 안내가 표시됩니다.

Supabase CLI 로그인·DB 비밀번호·서비스 역할 키는 Pages 빌드에 필요하지 않습니다. 운영 DB 배포는 위 CLI 절차로 분리합니다. URL 경로를 바꾸거나 저장소 이름을 바꾸면 Pages workflow의 `VITE_BASE_PATH`도 수정합니다.

## 검증 명령

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:load
pnpm doctor
pnpm build
```

통합·E2E·부하 테스트는 `.env.test.local`의 **로컬 주소만 허용**하며 합성 데이터의 상태를 바꿉니다. 테스트를 병렬로 실행하지 않습니다. 부하 테스트는 50개의 독립 익명 인증 사용자와 50개의 WebSocket을 사용합니다. 같은 합성 직원의 자격으로 바인딩하므로 직원 수는 5명으로 유지됩니다.

테스트를 많이 반복해서 Auth의 로컬 시간당 제한에 걸리면 제한이 풀릴 때까지 기다리거나 **이 프로젝트의 로컬 Auth 컨테이너만** 재시작합니다. 운영의 보안 제한을 테스트 목적으로 해제하지 않습니다.

결과와 운영 절차는 [docs/TEST-RESULTS.md](docs/TEST-RESULTS.md), [관리자 설명서](docs/ADMIN-MANUAL.md), [개인정보 파기 안내](docs/PRIVACY-DELETION.md)를 참고하세요.

## 구조와 보안 경계

- `src/pages/`: 직원 로그인·설문·추천·행사 화면.
- `src/admin/`: 별도 인증된 운영 화면. Edge에서 관리자 자격을 다시 확인합니다.
- `supabase/migrations/`: 스키마·권한·원자적 진행·집계·감사 기록.
- `supabase/functions/`: 직원 확인, 업무 API, 실제 파일 서명 검증 업로드.
- `public/templates/employees.csv`: 헤더만 담은 업로드 템플릿.
- `private.employees`: 생년월일, bcrypt 개인코드 해시. 브라우저 조회 불가.
- 직원별 본문은 검증된 본인만 읽으며 쓰기는 Edge → 서비스 전용 RPC를 거칩니다. 관리자 역할은 요청 본문이나 사용자 metadata에서 받지 않습니다.
- 진행 RPC가 설정과 상태를 잠그고 revision을 비교한 뒤 공개 부분만 저장합니다. 다음 힌트·정답·추천 원본은 공개 상태에 미리 넣지 않습니다.
- 동의 철회·답변 변경·문항 변경 시 관련 검수가 해제됩니다. 현재 공개 내용이 영향을 받으면 상태도 비웁니다.
- 사진은 비공개 Storage에서 단계·직원 권한 확인 후 60초 서명 URL로 제공합니다. 이미 내려받은 콘텐츠를 회수할 수는 없습니다.
- 리허설은 `private.rehearsals`를 사용하며 공식 상태와 집계를 수정하지 않습니다.

## 참고 문서

- [GitHub Pages Actions 배포](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Supabase Anonymous Auth](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Edge Functions 인증](https://supabase.com/docs/guides/functions/auth)
