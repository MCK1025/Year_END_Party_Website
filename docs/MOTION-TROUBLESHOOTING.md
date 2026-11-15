# 휴대폰 A/B 모션 진단

검증할 빌드의 주소에서 해시 **앞에** 쿼리를 붙인다. PC의 로컬 미리보기 예시는 `http://127.0.0.1:4173/?motionDebug=1#/invite`다. 일반 사용에는 쿼리가 필요 없다. 두 휴대폰에서 같은 [운영 모션 진단 링크](https://mck1025.github.io/Year_END_Party_Website/?motionDebug=1#/invite)를 연다.

1. 운영 링크를 사용하면 두 휴대폰에서 같은 빌드 번호인지 확인한다. 로컬에서 시험할 때는 두 휴대폰에서 접근할 수 있는 동일한 테스트 빌드를 연다. 휴대폰의 127.0.0.1은 휴대폰 자신이다. 예를 들어 개발 PC에서 테스트용 Supabase 주소를 두 기기에서 접속 가능한 값으로 설정해 빌드한 뒤 `pnpm exec vite preview --host 0.0.0.0`로 실행한다. 각각 `http://<개발 PC의 LAN 주소>:4173/?motionDebug=1#/invite`를 연다. Pages 하위 경로를 시험할 경우 저장소 경로 다음에 쿼리를 붙인다. 운영 직원 계정 대신 테스트 계정을 사용한다.
2. **처음에는 설정을 그대로 둔다.** 브라우저 앱·버전, 앱 안에서 연 링크인지, 손으로 본 장면(봉투가 날아옴/처음부터 펼쳐짐/멈춤)을 각각 적는다. 기종이나 절전 모드는 자동 판정하지 않는다.
3. 편지가 읽기 상태가 되거나 멈춘 시점에 **보기 설정 → 모션 진단 → 진단 정보 복사**를 누른다. 클립보드 사용이 제한된 LAN HTTP에서도 읽기 전용 텍스트를 선택해 수동 복사할 수 있다.
4. 같은 탭에서 입장해 테스트 계정으로 로그인하고 두 기기 모두 목차의 **같은 장**을 한 번 누른다. 같은 메뉴에서 다시 복사한다. 새로고침은 메모리 기록을 새로 시작한다. 비교 중에는 브라우저 뒤로가기와 일반 목차 이동을 구별한다.
5. 빌드가 같은지 먼저 확인한다. 설정이 같다면 편지의 마지막 성공 단계와 책장의 시작·완료·취소 코드를 각각 비교한다. 설정을 바꾸어 확인하려면 한 번에 하나만 변경한다. OS 저감을 해제해도 읽고 있는 초대장은 그대로이고, 명시적 다시 보기로 재생할 수 있다.
6. 마지막으로 쿼리 없는 동일한 빌드에서 같은 동작을 확인한다. 진단 기록 지우기는 현재 메모리의 이벤트만 지운다.

| 비교할 값 | 휴대폰 A | 휴대폰 B |
|---|---|---|
| build · 브라우저/인앱 여부 | 미수집 | 미수집 |
| reduced · pageEffectsOff | 미수집 | 미수집 |
| 편지 표시 모드 · 시작/실패 단계와 ms | 미수집 | 미수집 |
| 책장 from/to · 시작/취소·종료 · 표시 샘플 | 미수집 | 미수집 |
| 실제로 본 장면 · 진단 없는 주소 재시험 | 미확인 | 미확인 |

**기록 해석**

- `SYSTEM_REDUCED_MOTION`은 OS/브라우저가 전달한 저감 설정이다. `USER_PAGE_EFFECTS_DISABLED`는 사이트의 책장 설정만 뜻한다. `PREFERENCE_UNKNOWN`은 미디어 API를 확인하지 못했음을 뜻한다.
- `FIRST_VISIT`, `ENTRY_ALREADY_PASSED`는 로그인 진입 정책이다. `SAME_PAGE`는 같은 장을 다시 누른 경우다. `NAVIGATION_POP`, `NAVIGATION_NOT_ELIGIBLE`은 히스토리 또는 책장 효과 대상이 아닌 이동이다.
- `IMPORT_START/END → INIT_START/END → SHADER_START/READY → START_REQUESTED → FIRST_RENDER_RETURNED`의 상대 시각을 뺀 값으로 구간을 비교한다. `PREPARATION_TIMEOUT`의 stage는 제한 시점의 IMPORT/INIT/SHADER이며 특정 원인을 증명하지 않는다. JS 메인 스레드가 막힌 동안에는 타이머도 실행될 수 없다.
- `FIRST_FRAME_TIMEOUT`은 ready 이후 그릴 수 있는 상태에서 첫 애니메이션 프레임을 받지 못한 경우다. `DOCUMENT_HIDDEN`, `OFFSCREEN`, `ZERO_SIZE`, `READING_PAUSED`는 구분한다. 첫 렌더 반환은 화면 픽셀의 육안 확인이 아니다. 늦은 완료는 `LATE_IMPORT_IGNORED` 또는 `LATE_READY_IGNORED`다.
- `IMPORT_FAILED`, `WEBGL_INIT_FAILED`, `SHADER_PREPARATION_FAILED`, `WEBGL_CONTEXT_LOST`, `RENDER_ERROR`는 그래픽 경로의 실패다. 이미 읽는 중에 컨텍스트가 손실되면 읽기 화면을 유지한다.
- 책장의 `REQUEST`에는 알려진 경로, 이동 유형, 메타데이터 일치, revision/실제 행사 내용 변경 여부가 담긴다. `STARTED → DISPLAY_SAMPLE → COMPLETED`를 확인한다. `CSS_HIDDEN`, `ZERO_SIZE`, `NOT_VISIBLE_AT_SAMPLE`은 DOM과 실제 표시의 차이를 찾는 단서다. 샘플 하나로 애니메이션 전체가 보였는지 판정하지 않는다.
- `WAAPI_UNAVAILABLE`, `CSS_3D_UNAVAILABLE`, `ANIMATION_START_FAILED`에서 허용된 경량 CSS 효과를 사용한다. `POLICY_CHANGED`, `VIEWPORT_GEOMETRY_CHANGED`, `EVENT_STATE_CHANGED`, `ROUTE_SUPERSEDED`, `COMPONENT_UNMOUNTED`, `ANIMATION_CANCELLED`, `WATCHDOG_TIMEOUT`은 자연 완료와 별도다.
- 빌드는 실제 엔트리 자산의 해시다. 개발 서버처럼 해시가 없으면 unknown이다. 시간 기준은 문서의 performance.now이고, attempt는 해당 실행에서 기록을 묶는 번호다. 이벤트는 최대 150개만 메모리에 담고, 입력값·직원 ID·토큰·본문·원본 URL·전체 저장소·오류 메시지나 stack을 수집하지 않는다. 자동 전송은 없다.
