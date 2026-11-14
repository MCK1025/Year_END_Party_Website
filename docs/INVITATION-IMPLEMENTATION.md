# 2026-11-14 초대장 스플래시 구현 기록

운영 배포·push·merge·운영 데이터 변경 없이 로컬 작업으로 구현했다. 기존 행사 주제, 6자리 비밀번호 로그인, verify/bootstrap 목적지 분기, 관리자 링크와 모든 행사 기능을 유지한다. DB·Auth·RLS·Edge Functions·Realtime·배포 설정·패키지 의존성은 변경하지 않았다.

## 변경 범위

| 파일 | 책임 |
|---|---|
| `src/pages/Invitation.tsx` | HTML 초대장, 저감/정적 모드, 출발·단일 이동·안전 타이머 |
| `src/components/invitation/InvitationScene.tsx` | 동적 import, ready, 준비 제한, 취소·세션 해제 |
| `src/components/invitation/InvitationFallback.tsx` | 정적 종이 봉투 장식 |
| `src/components/invitation/InvitationEntry.tsx` | 루트/로그인 첫 방문 판단, 사용자 입장 후 본문 초점 |
| `src/lib/invitation.ts` | 문구, 모션 상수, 단계 계산, UI 기록과 메모리 fallback |
| `src/graphics/invitation.ts`, `effects/envelope.ts` | 공용 서비스 소비자와 접힌 선을 축으로 여닫는 봉투 효과 |
| `src/graphics/invitation-layout.ts` | DOM 편지 bounds와 직교 카메라의 공통 앵커 |
| `src/graphics/service.ts` | 리사이즈 시 현재 시각으로 효과 1회 갱신. 기존 공개 API 유지 |
| `src/styles/invitation.css`, `DESIGN.md` | 기존 종이·네이비 토큰과 명조/고딕을 사용하는 반응형 디자인 |
| `src/App.tsx`, `Login.tsx`, `Participant.tsx` | 초대장 경로·전용 shell·다시 보기·앱 내부 로그인 복귀 상태 |

도착 1.2초 → 안착 1.5초 → 덮개 열림 2.2초 → 편지 읽기 3초를 활성 그래픽 시계로 진행한다. 출발은 1초이며 1.5초 안전 타이머가 이동을 보장한다. 읽기에서는 실제 렌더 루프가 멈춘다. 페이지가 숨겨지면 서비스가 시계를 멈추므로 DOM 단계와 봉투가 따로 진행되지 않는다. 문구·입장 버튼은 WebGL 텍스처가 아닌 HTML이다.

## 진입 정책

- 첫 루트/`/#/login`: `/#/invite`로 replace.
- 입장/건너뛰기: UI 전용 sessionStorage 기록과 메모리 상태를 설정한 뒤 로그인으로 replace. 저장소 접근 예외에도 루프 없이 진행한다.
- 같은 탭에서 통과 후 루트/로그인: 로그인 바로 표시. `/invite` 직접 접속과 다시 보기는 재생한다.
- 관리자·보호 경로는 초대장 판단 대상이 아니다. 기존 앱 안의 본인 확인/로그아웃 복귀도 초대장을 반복하지 않는다.
- 저감 설정은 엔진 import 전에 정적 읽기를 선택한다. 준비 실패·2초 제한·컨텍스트 손실도 정적 읽기로 전환하고, 출발 중 실패는 즉시 입장한다.

## 검증

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` 통과. 단위 테스트 35개.
- 로컬 Supabase 가상 직원 기반 전체 Playwright 23개 통과: 기존 로그인 계정 전환·잘못된 비밀번호·다른 탭 정리, 설문→추천→실시간 행사 종료, 익명 글 관리, 관리자 확인창, CSV, 마음 트리/눈/쪽지까지 포함.
- 최종 바람 곡선·로그인 등장 효과를 반영한 뒤 초대장 전용 12개 재실행 통과. 생성/셰이더 실패, 준비 지연 후 늦은 완료, context loss, 저감 설정 변경, 중간 건너뛰기, 중복 클릭과 숨긴 탭 출발 제한을 검사했다.
- 읽기 250ms 동안 실제 WebGL drawElements 호출 수가 늘지 않음. 리사이즈 후 CTA 접근, 입장 후 canvas 제거와 본문 초점 확인.
- 첫 초대장 네트워크에 Auth/Functions/REST 요청 없음. 정적 저감 모드와 재방문 로그인·직접 관리자는 초대장 그래픽 chunk를 요청하지 않음.
- 별도 로컬 빌드의 `/Year_END_Party_Website/` 하위 경로에서 직접 진입·동적 chunk·입장·새로고침·보호 경로·관리자 확인 완료. Vite base/workflow 원본은 그대로다.
- 320/375/390/430/768/1280px의 도착/열림/읽기/출발/로그인/정적 상태 36장, 200% 확대·큰 텍스트 2장. `artifacts/screens/invitation/`, 목록 `artifacts/local-invitation-captures.json` (개인정보 없는 로컬 파일, Git 제외).
- 초기 회귀 실행은 로컬 Edge를 환경변수 파일 없이 시작해 직원 검증이 실패했다. README의 `.env.local` 실행 방식으로 다시 시작한 뒤 전체 23개가 통과했다. 운영 설정은 사용하지 않았다.

## 번들과 측정 한계

기본 경로 production build, gzip 추정 기준: 초대장 효과 전용 chunk 1.29kB, 재사용 Three.js/서비스 chunk 141.25kB. 기존 초기 JS는 182.23kB에서 183.71kB로 약 1.48kB, CSS는 5.63kB에서 약 6.13kB로 증가했다. 전용 효과까지 합한 기능 증가량은 약 3.27kB이며 기존 Three.js 전체를 신규 증가량으로 계산하지 않는다. 새 모델·텍스처·폰트 다운로드는 없다.

Pages 하위 경로의 첫 일반 초대장 로딩에서 Resource Timing으로 측정한 JS/CSS encoded body 합은 332,402바이트였다. HTML 및 응답 헤더를 포함한 브라우저 최초 전송량은 334,599바이트였다. 저감/재방문은 공용 엔진과 효과를 받지 않는다. 원본 측정은 `artifacts/local-invitation-baseline.json`, `local-invitation-pages.json`에 있다.

최종 바람 곡선·로그인 등장 효과 추가 전, Playwright로 실행한 Chrome stable/CDP Lighthouse 1회씩: 모바일 성능 99, 데스크톱 100, 접근성 100, 권장사항 96, SEO 63. 권장사항 감점은 기존 `/favicon.ico` 404, SEO는 기존 noindex 정책이다. 반복 측정 중앙값·실제 휴대폰 FPS/배터리·행사장 네트워크는 미검증이다. 브라우저 에뮬레이션을 실기기 검증으로 간주하지 않는다. 기존 공통 JS 600kB 초과 빌드 경고는 남아 있다.

최종 38개 캡처의 해시와 한글 줄바꿈·접근성·디자인·동작 검토가 통과했다. `artifacts/screens/invitation/sequence-390.webm`, `sequence-1280.webm`에서 실제 Chromium 도착→읽기→출발→로그인 흐름을 볼 수 있다. 드리운 바람 곡선은 도착 구간에만 보이고 로그인 등장 180ms는 동작 줄이기에서 생략한다.

운영 배포는 수행하지 않았다. 확인하려면 로컬 `pnpm dev` 후 `/#/invite`로 접속한다.
