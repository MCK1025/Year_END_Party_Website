# 스프링 줄공책 검증 기록 · 2026-11-15

검증 기준은 로컬 main의 시작 커밋 `5dd9e61`과 그 위에 적용한 미커밋 변경이다. 시작 시 같은 커밋의 GitHub Pages 배포 성공을 읽기 전용으로 확인했다. 이 검증 단계에서는 로컬 빌드와 가상 데이터만 사용했다. 기능별 변경 파일과 실기기 확인 절차는 [구현 문서](../docs/SPIRAL-NOTEBOOK.md)에 있다.

## 시각 증거

| 내용 | 실제 산출물 |
|---|---|
| 다음·이전 장 0/25/50/75/100% | [WebGL 열 프레임](screens/spiral-notebook/webgl-frames.png) · [DOM 대체 열 프레임](screens/spiral-notebook/dom-frames.png) |
| 같은 화면의 원본과 중간 프레임 | [원본](screens/spiral-notebook/original-story.png) · [앞으로 50%](screens/spiral-notebook/webgl-forward-50.png) · [뒤로 50%](screens/spiral-notebook/webgl-backward-50.png) |
| 재생 위치를 고정하지 않은 녹화 | [Chromium 정상 경로](screens/spiral-notebook/chromium-normal.webm) · [Chromium DOM](screens/spiral-notebook/chromium-dom.webm) · [WebKit 정상 경로](screens/spiral-notebook/webkit-normal.webm) · [WebKit DOM](screens/spiral-notebook/webkit-dom.webm) |
| 화면 폭 | [320px](screens/spiral-notebook/survey-320.png) · [390px](screens/spiral-notebook/survey-390.png) · [1280px](screens/spiral-notebook/survey-1280.png) |

가상 답변 “올해는 동료들과 한 걸음 더 가까워졌어요.”, 선택값 “점심시간”, 켜진 동의를 넣었다. 목적지는 서비스의 기존 동료 추천 제목을 사용했다. 처음과 끝의 실제 DOM, 반쯤 열린 영역, 동의 체크 및 화살표 픽셀을 비교했다. 두 경로 모두 스프링은 고정됐고 원본 위치에 같은 답변이 남지 않았다.

## 자동 검증

- 타입 검사, Biome, 단위 테스트 41개와 Vite 빌드 통과. Vite는 진입 번들 크기와 의존성의 주석 처리에 대해 경고했다.
- 로컬 Supabase 통합 테스트 8개 파일, 36개 테스트 통과. [통합 테스트 기록](local-curl-integration.log)
- GitHub Pages와 같은 하위 경로에서 두 지연 로드 파일의 HTTP 200과 목적지 입력 가능 상태를 확인했다.
- Chromium E2E 54개 시나리오. 마지막 전체 실행은 53개 통과, 1개 실패였다. 로그인 연결 장애를 주입하는 시나리오에서 주입 **전** 첫 참가자 화면에 연결 오류가 표시됐다. 같은 코드로 로그인 세션 묶음 4개를 재실행해 모두 통과했다. 이 간헐적 연결 실패의 원인은 확인되지 않았다. [전체 기록](local-curl-verified.log) · [로그인 재실행](local-curl-auth-confirm.log)
- 반복 실행 중 기존 행사 테스트가 순서가 보장되지 않는 문항 배열의 마지막 항목을 선택해 미승인 문항을 요청할 수 있음을 확인했다. 새로 만든 승인 문항 ID를 선택하고 공개 명령의 성공을 검사하도록 테스트를 수정했다. 수정 후 실제 힌트·취향 공개부터 엔딩까지 통과했다. [행사 단독 재검증](local-curl-selected-question.log)
- Windows Playwright WebKit에서 공책 관련 11개 통과. 양방향 픽셀 검증, IME 합성 이벤트와 긴 초안, 사진, 실패 주입, 컨텍스트 손실, 모션 생략, 크기·글자 확대를 포함한다. [WebKit 실행](local-curl-release-webkit.log)
- 캡처가 미완료인 동안 로그아웃한 별도 시나리오에서 비밀번호 화면으로 이동했고, 지연 요청이 풀린 후 남은 본문 복제본은 0개였다. 로그인·관리자·트리의 권한 또는 인증 코드는 변경하지 않았다.

## 측정과 한계

390×844 뷰포트에서 테스트용 영상 녹화를 켜고 측정했다. 준비 시간은 이동 요청부터 브라우저가 재생 시작을 관측한 때까지다.

| 항목 | Chromium | WebKit |
|---|---:|---:|
| 정상 설정 이동 / 실제 WebGL 이동 횟수 | 20 / 20 | 2 / 2 |
| 첫 이동 준비 | 335ms | 553ms |
| 이후 WebGL 준비 중앙값 | 199ms | 196ms (추가 1회) |
| 이후 브라우저 프레임 콜백 빈도 | 약 60회/초 | 약 42회/초 |
| 정착 후 남은 전환 표면 최대 수 | 0 | 0 |

Chromium의 강제 GC 후 DOM 리스너는 195→189, 노드는 276→289, JS 힙은 3.96→6.91MiB였다. 첫 측정에는 지연 로드 모듈과 공개 글꼴 캐시가 아직 없다. WebGL 텍스처 생성 호출 100회와 명시적 삭제 20회를 관측했다. 렌더러 내부 텍스처도 생성 수에 포함되며 각 일회용 컨텍스트는 종료 시 반환한다. 이 수치는 드라이버의 GPU 메모리 회수량을 측정한 결과가 아니다. [Chromium 원자료](screens/spiral-notebook/chromium-normal.json) · [WebKit 원자료](screens/spiral-notebook/webkit-normal.json)

실제 iPhone·Android, 카카오톡 인앱 브라우저, 한국어 시스템 키보드, 물리 GPU 프레임률과 메모리는 미검증이다. 이 측정은 배포 전 로컬 빌드에서 수행했다.
