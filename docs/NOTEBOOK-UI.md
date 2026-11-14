# 직원용 공책 UI 구현·검증 기록

2026-11-14 로컬 작업. 기준 버전 `401b6ca`. 원격 push·merge, 운영 배포 및 운영 데이터 변경은 수행하지 않았다.

| 변경 파일 | 역할 |
|---|---|
| `src/components/book/BookLayout.tsx`, `src/pages/Participant.tsx` | 직원 목차, 단일 활성 장, 이전/다음 링크, 초점·히스토리, 양방향 페이지 효과. 트리는 공개 상태에 따라 목차에 추가된다. |
| `src/components/book/preferences.tsx`, `src/App.tsx`, `src/pages/Invitation.tsx` | 손글씨·기본 글씨·효과 끄기. 같은 직원/초대장 화면에 설정을 공유한다. 저장소가 차단되면 현재 탭의 메모리 선택을 사용한다. |
| `src/styles/book.css`, `src/main.tsx` | 공책 표지와 본문, 책등, 입력 영역의 줄, 로그인 첫 장, 반응형 목차, 의미별 서체. 850px부터 왼쪽 목차와 오른쪽 본문을 배치한다. |
| `src/components/book/drafts.tsx`, `Survey.tsx`, `Nominate.tsx`, `Forest.tsx`, `ForestForm.tsx` | 직원 ID 범위의 메모리에 답변·동의·추천 이유·익명 새 글/편집 초안을 보관한다. 장을 이동해도 유지되고 참가자 영역 종료 또는 계정 변경 때 해제된다. |
| `src/components/book/useSavedNavigation.ts`, `src/lib/useParticipant.ts`, `src/lib/useTask.ts` | 저장과 후속 재조회가 성공해야 이동한다. 이탈한 화면의 늦은 완료가 사용자를 다시 이동시키지 않도록 하고 동기 중복 제출을 방지한다. |
| `src/pages/Event.tsx`, `src/components/RecapCards.tsx` | 행사에서 열린 트리로 가는 사용자 이동과 회고 문구의 글씨를 연결한다. |
| `public/fonts/nanum-pen/`, `THIRD_PARTY_NOTICES.md` | 공식 WOFF2 93개, 라이선스 전문, 메타데이터, 원본 URL·개별 SHA-256·용량 기록. |
| `tests/e2e/notebook.spec.ts`, `tests/e2e/submission-edit.spec.ts` | 초안 왕복, 접근성 이름, 페이지 효과, 폰트 로딩/실패, 저장 후 재조회 오류, 반응형 검증. 기존 편집 검증의 탐색 범위를 실제 수정 폼으로 지정했다. |

## 페이지 전환

활성 URL과 HTML 폼은 하나다. 허용된 링크를 누르면 라우터가 한 번 이동하고 비상호작용 종이 한 장이 왼쪽 책등을 축으로 480ms 동안 회전한다. 순방향과 역방향의 키프레임이 다르다. 보이는 표면 높이를 제한하고 폼이나 개인 내용을 복제하지 않는다. 일반 페이지의 모션에는 Web Animations API와 CSS 3D만 사용한다.

POP, 직접 접속, 서버의 강제 이동은 즉시 반영한다. 힌트·정답·행사 마감도 회전 완료를 기다리지 않는다. 숨김, 리사이즈, 최신 revision, 효과 설정 변경 또는 언마운트에서 장식을 해제한다. OS 저감 모드와 앱의 효과 끄기는 JS 애니메이션 생성을 생략한다. 초대장 출발과 트리 전용 WebGL은 기존 수명주기를 사용한다.

## 폰트 및 자산 측정

공식 Nanum Pen Script normal 400을 자체 호스팅한다. 배포받은 WOFF2의 문자 범위 전체를 유지하고 파일을 변환하지 않았다. 손글씨는 흑연색 `#34332F`, 시스템 폰트 스택은 버튼·이름·비밀번호·상태·동의·오류·관리자에 사용한다. 대표 연도는 기존 이탤릭체를 유지한다. 소스 및 라이선스는 [서드파티 고지](../THIRD_PARTY_NOTICES.md)에 기록했다.

Chromium CDP로 힌트 본문의 실제 렌더링 폰트 `Nanum Pen / NanumPen-Regular` 사용을 확인했다. 배포 CSS의 unicode-range 합집합에는 현대 한글 완성형 11,172개가 포함된다. 이는 CSS 범위이며 모든 글자의 실제 글리프 검사 수는 아니다. 예제 입력에는 한글 낱자, 드문 음절, 영어·숫자·줄바꿈·이모지를 포함했다.

운영용 base로 빌드한 신규·기존 버전을 각기 빈 브라우저 컨텍스트에서 비교했다. 로컬 390px 초대장 첫 방문부터 읽기 상태까지 최초 전송량은 334,599 → 491,831바이트였다. 신규 버전 첫 화면이 요청한 WOFF2는 6개, 전송량은 140,600바이트(응답 헤더 포함)다. 전체 로컬 글꼴 자산은 1,727,488바이트다. 실제 행사장 네트워크의 속도나 프레임률 측정값은 아니다.

## 검증 결과

- TypeScript, Biome, Vite production build, Vitest 단위 35개, Playwright 브라우저 27개 통과. 27개 중 새 공책 시나리오는 4개다. 캡처 안정화 후 새 4개를 다시 실행했다.
- 실제 로컬 Supabase 가상 직원 시나리오에서 초대장, 6자리 로그인·다른 계정 전환, 설문→추천, 익명 글·다른 기기 수정, 행사 시작 마감, 관리자 진행·힌트·시상·엔딩, 트리 공개/복귀를 검증했다. 공책 전용 실패 응답·화면 캡처는 합성 fixture를 사용했다.
- 같은 참가자의 설문 답변·동의·추천 이유·익명 편집 초안 복원, 뒤로/앞으로 이동, 양방향 효과, 일반 글씨 전환, 저장 후 재조회 실패 시 현재 URL과 입력 유지, 선택 사항인 폰트 다운로드를 차단한 입력·이동을 확인했다.
- 작은 가로 화면·320/375/390/430/768/1280px·CSS 200% 확대에서 가로 넘침을 확인했다. 로컬 Pages 하위 경로에서 동적 청크·글꼴·로그인 새로고침, Chromium IME 합성/확정 후 다른 장 왕복을 확인했다.
- 실제 iOS Safari·Android 기기, 물리 키보드/가상 키보드가 열린 상태에서의 주소창·뷰포트 변화, VoiceOver·TalkBack 낭독, 실제 기기 FPS와 배터리는 미검증이다.

## 캡처

저장소의 `artifacts/screens/notebook/`에 8개 상태 × 390/1280px의 PNG 16장이 있다. `invite`, `login`, `login-fallback`, `survey`, `system`, `reduced`, `hint`, `forest`가 파일명 접두사다. 최종 이미지에서 공개 힌트와 익명 쪽지 본문이 읽히는 것을 확인했다. 장 넘김 시연은 같은 폴더의 `chapter-turn.webm`, 브라우저가 실제 사용한 글꼴 기록은 `rendered-font.json`이다.
