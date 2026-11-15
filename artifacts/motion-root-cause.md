# 초대장과 책장 모션 원인 분석

## A. 저장소와 운영에서 확인한 사실

- 조사 시작 시 로컬 main, 원격 main, 최근 성공한 Pages 배포의 커밋은 모두 `5675063706ae11ee75d54b7a0cc7d85adf606e36`였다. 당시 운영 HTML의 진입 파일은 `index-V49DNCnh.js`였다. 개별 휴대폰이 같은 자산을 받았는지는 미확인이다. [GitHub Pages 배포 기록](https://github.com/MCK1025/Year_END_Party_Website/actions/runs/43605250712)
- 그 커밋의 `src/lib/invitation.ts:16`–17에 설정된 준비 제한은 3000ms, 출발 제한은 2500ms다. 소스에 운영용 forceMotion 우회 분기는 없었다. 이전의 제한값을 적어 놓은 그래픽 서비스 설명을 현행 코드에 맞췄다.
- 같은 커밋에서 `src/components/invitation/InvitationScene.tsx:49` 이후 ready를 기다렸다가 준비 타이머를 해제했다. 이후 실제 표시 가능한 프레임의 반환을 확인하는 감시는 없었다. `src/graphics/service.ts:34`의 초당 진행 시간은 프레임 한 번당 최대 0.05초였다.
- `src/components/book/BookLayout.tsx:88`은 모든 resize를 종료 함수에 연결했다. 91행부터 같은 함수를 React effect의 정리 함수로도 사용해 revision만 달라져도 진행 중인 애니메이션이 취소될 수 있었다.

## B. 재현한 현상

| 조건 | 수정 전 관측 또는 근거 | 수정 후 검증 |
|---|---|---|
| 보이는 초대장에서 프레임 스케줄러가 콜백을 전달하지 않음 | 브라우저 시험에서 7.5초 후에도 preparing. [수정 전 기록](local-motion-before.log) | FIRST_FRAME_TIMEOUT 후 CSS 봉투와 읽기 화면. 바로 입장 가능 |
| 책장을 넘기는 중 똑같은 크기로 resize 알림 발생 | 실행 중이던 덮개가 즉시 사라짐. [수정 전 기록](local-motion-resize-before.log) | 높이만 줄어든 뒤에도 실행 유지. 큰 폭 변화는 목적지에서 안전하게 종료 |
| 초당 5프레임 | 기존 수식으로 1초 동안 연출은 0.25초만 진행. 예전 코드에서의 수치 재현이며 두 폰의 실측 프레임률은 모름 | 봉투가 활성 시간으로 읽기에 도착하고 출발 제한 전에 로그인. 눈과 트리는 기존 간격 상한 유지 |
| 셰이더 예외, 엔진 파일 요청 실패, 컨텍스트 생성 실패·손실, 책장 API 누락·시작 예외 또는 CSS 숨김 | 브라우저에서 강제로 만든 조건 | 각 원인 코드와 표시 방식 구분. 편지 읽기와 책장 목적지 접근 가능 |
| 일반 데이터 revision 갱신, 행사 일시 정지, 회전 | 이전 코드의 effect 수명과 의존성에서 확인 | 일반 갱신은 유지. 실제 일시 정지와 회전은 별도 사유로 종료 |

## C. 실제 휴대폰 증상과의 연결

사용자 관측으로 확인된 것은 같은 네트워크에서 A에서는 두 효과가 보이고 B에서는 둘 다 보이지 않았다는 점이다. 실기기의 설정값, 자산 버전, 실행 기록, 화면을 확보하지 못했다. 코드에서 재현한 결함이 B에서 발생했는지, 편지와 책장의 원인이 같은지는 미확인이다. 특정 원인을 유력하다고 좁힐 기기 증거도 아직 없다.

## D. 수정과 적용 범위

- `src/lib/motion.ts`, `motionDebug.ts`, `components/MotionDiagnostics.tsx`, `components/book/preferences.tsx`에서 OS와 페이지 효과 설정을 구분하고, 설정 패널에서 진단 기록을 복사하거나 비울 수 있게 했다. 실제 진입 파일 해시, 브라우저, 설정, 시도 번호, 상대 시각, 정해진 원인 코드와 표시 상태를 담는다. 기록은 최근 150건을 메모리에만 보관한다. 클립보드를 사용할 수 없는 휴대폰은 텍스트를 직접 선택할 수 있다.
- `components/invitation/InvitationEntry.tsx`, `InvitationScene.tsx`, `pages/Invitation.tsx`, `lib/invitation.ts`, `graphics/invitation.ts`, `graphics/service.ts`, `styles/invitation.css`에서 방문 생략, import, 생성, compile, 첫 렌더, 일시 정지와 실패를 분리했다. 기존 준비 제한과 출발 제한을 유지하고 셰이더 준비 후 화면에 그릴 수 있는 상태에서 첫 프레임을 별도로 감시한다. 읽기 중 실패하면 편지를 펼친 채 유지한다. 입장을 요청한 뒤 화면을 숨기면 한 번만 로그인으로 연결한다.
- `components/book/BookLayout.tsx`, `bookTurn.ts`, `pages/Participant.tsx`, `styles/book.css`에서 사용자 이동·행사 내용 및 권한 변화·폭 변화에 따라 책장 수명을 관리한다. OS 저감과 사이트의 책장 효과 끄기, 뒤로가기, 단계 변경에 따른 즉시 이동을 존중한다. 렌더러 실패가 확인되고 모션이 허용될 때만 경량 CSS 연출을 사용한다.
- 초대장의 건너뛰기, 지연 완료 무시, 타이머 및 세션 정리, 실제 HTML 편지와 기존 입력 폼을 유지했다. 초안이나 응답 본문을 진단에 전달하지 않는다.

## E. 검증

Node 24.18.0, Vite 7.3.8, Vitest 4.1.12, Playwright 1.65.0, Chromium 158.0.8127.18. 로컬 데이터베이스와 Edge Functions 및 가상 계정으로 실행했다.

| 명령 또는 시나리오 | 결과 |
|---|---|
| `tsc --noEmit`, `biome check src tests scripts supabase/functions vite.config.ts` | 타입 및 린트 검사 통과 |
| `vitest run tests/unit` | 10개 파일, 40개 테스트 통과. 지연된 셰이더 완료, 중복 정리, 초기화 중 예외에서 앞서 만든 효과 정리 포함 |
| `vite build`, Pages 하위 경로 빌드 | 두 빌드 생성. 메인 번들 크기 및 의존성 주석에 대한 빌드 경고가 있음 |
| `playwright test --reporter=line` | 전체 E2E 43개 통과(2.5분). 모션, 초안, 6자리 로그인, 행사 진행, 권한, 마음 트리, 관리자 시나리오 포함. [최종 실행 기록](local-motion-verified.log) |
| 개발 서버 StrictMode 및 화면 밖 대기 | 이전 시도의 지연 import 무시, 첫 프레임 한 번, 로그인 확인. 캔버스를 화면 밖에 3.6초 둔 후 되돌리면 시간 초과 없이 WebGL 읽기에 도착 |
| Chromium 390×844에서 Pages 하위 경로 수동 확인용 시나리오 | 초대장 WebGL 읽기, 실제 클립보드 복사, 로그인과 새로고침, 진단 없는 URL 확인. [진단 화면](screens/motion-diagnosis/panel-390.png) |

수정 전후 재현은 `tests/e2e/motion-repro.spec.ts`, 기기 설정과 실패 주입 시나리오는 `tests/e2e/motion-debug.spec.ts`, 진입·출발·정리는 `invitation*.spec.ts`, 공책의 저장 실패·입력 유지와 접근성은 `notebook.spec.ts`에서 확인한다. 표시 샘플은 계산된 CSS와 크기를 기록하므로 첫 렌더 함수가 반환됐다는 사실만으로 휴대폰에 픽셀이 표시됐다고 판정할 수 없다.

## F. 남은 확인

두 실제 휴대폰의 OS·브라우저 설정, GPU/절전 동작, 인앱 브라우저, iOS Safari 및 Android 기기별 합성 결과는 검사하지 못했다. 개발 모드의 React StrictMode를 실기기에서 반복 마운트한 시험도 수행하지 않았다. 푸시·병합·배포 및 운영 데이터 변경 없이 로컬 빌드에서 검사했다. 같은 테스트 빌드에서 두 휴대폰의 기록을 비교하는 절차와 빈 비교표는 [휴대폰 모션 진단](../docs/MOTION-TROUBLESHOOTING.md)에 있다.
