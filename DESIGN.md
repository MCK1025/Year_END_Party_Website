# 한 걸음 더 가까이 · 2026

## 0. Research Log
- User revision is the visual authority: “장난스럽지만 엄숙한”. The earlier colorful gameshow image is rejected, never shipped.
- Embedded shortlist: Figma (playful), Claude (editorial warmth), Notion (restraint). Final choice: minimalist execution + Claude's serif/sans contrast and warm paper materials; navy and muted brass are project-specific.
- Lazyweb: event ticket mobile onboarding query, two screens viewed (Ticketmaster onboarding, Eventbrite welcome). Adopt single-purpose forms, strong heading hierarchy and generous touch targets. No copied assets.
- Imagen: earlier two-concept sheet rejected after user steering. Final product is native DOM, not a mock image.

## 1. Atmosphere & Identity
A private year-end invitation with a straight face and a quiet wink. Formal navy, warm ivory, serif Korean headings, a small hand-drawn orbital mark. No stage curtains, pink tickets, oversized celebration stickers or neon. The signature is the oversized italic year paired with a single irregular orbit: people coming closer without a loud game-show costume.
Content jobs: invitation hooks; identity form admits; survey starts conversations; waiting provides certainty; published hints retain attention; admin controls prevent mistakes.
Personas: a guest holding a 320px phone in one hand; an organizer working quickly in a dim room; a guest using larger text or keyboard navigation.

## 2. Color
| Token | Value | Purpose |
|---|---|---|
| --navy | #161c29 | invitation, headings, primary buttons |
| --navy-soft | #222c3a | raised dark surface |
| --paper | #f4f1e9 | page canvas |
| --ivory | #fdfbf6 | input and card surface |
| --ink | #242b35 | text |
| --muted | #62665f | secondary text on paper |
| --line | #d9d6cb | rules and field borders |
| --brass | #b6a17c | ornament only |
| --gold-ink | #756039 | readable accent on paper |
| --on-dark | #d1cbbf | secondary text on navy |
| --error | #a13932 | error text |
| --success | #315947 | saved/connected |

## 3. Typography
Display: Georgia italic for year; Korean display: Noto Serif KR, Batang, serif, weight 400; utility: system-ui, Malgun Gothic, sans-serif. No proprietary fonts or remote font requests.
Display scale clamp(36px,5vw,64px); heading 28/36px; section 22px; body 16px/1.7; small 13px/1.6; overline 11px/1.5 with 0.15em tracking. Korean headings use word-break: keep-all, overflow-wrap:anywhere only for long unbroken input. Long answers must expand naturally.

## 4. Spacing & Layout
Spacing: 4,8,12,16,24,32,48,64,96px. Mobile gutter 24px (16 at 320px). Guest max-width 680px; invitation 1100px; admin 1240px. 768px breakpoint switches invitation to 2 columns and admin grids to 2 columns. Card radius 8px; field/button 4px. Border 1px. No heavy shadows.
The content shell reserves at least 100svh so the footer stays below the initial viewport while authenticated routes load; content height can grow naturally.

## 5. Reusable Components & States
- Button: navy primary, outlined secondary, red text danger; hover lightens; visible 2px focus outline; busy label + disabled; minimum 48px height.
- Field: permanent visible label, ivory field, helper/error; required/disabled states. Textarea supports multiline and character limits.
- Panel: ivory content island or dark ceremonial panel; header + content; empty/loading/error/saved states.
- Status: connected, reconnecting, polling, paused; text accompanies color.
- Confirm: native dialog, labeled title, cancel initial focus, Escape/cancel, danger action, pending disabled. Reveals/phase changes can be reversed for display but already viewed information cannot be recalled.
- Hint: numbered editorial rule + large text, unrevealed placeholders carry no future content.
- Chart: semantic label + count + bar; numeric text conveys all information.
- Nav: active underline + aria-current; wrapped admin controls rather than hidden horizontal overflow.
- Forest: shared Panel/Select/TextArea primitives; all/own post views, cross-device own-post editing and event-start read-only states; anonymous wish/thanks/regret cards show a day only, no author identity. Empty, loading, error, success, pagination and administrator delete confirmation states. Employee navigation gains a wrapped fourth item.
- Employee management: one-person form and CSV preview use the existing two-column grid; permanent deletion uses Confirm. Login uses one numeric six-character password field.
- Primitive harness: /#/showcase in development only; verify all primitives at 375,768,1280 before product QA.

## 6. Motion
Only stateful hint entrance and button press: 180ms opacity/translateY(4px), ease-out. No decorative looping motion. prefers-reduced-motion disables animation. Focus feedback is immediate.

### Christmas message tree extension (2026-11-13)
- Preserve the invitation's solemn editorial tone. Place the stocking and gift stickers directly on the fir, varying their height, tilt and size. Added stage tokens: tree-night #102b28, tree-deep #153e33, tree-leaf #2c6551, tree-light #578b68, tree-trunk #72573c, tree-warm #ead2a0, note-rose #ead6ca, note-sage #dce5d5. Existing ivory/brass are the primary note materials.
- TreeScene is a reusable WebGL scene/effect consumer. The graphics service owns renderer, camera, resize, visibility, reduced-motion, context-loss fallback and disposal; independent TreeEffect and SnowEffect can be mounted by other pages without a backend service. Three.js loads only on the tree route. No remote textures/models.
- Each tree holds up to 30 stories. Stocking and gift stickers are keyboard-accessible buttons with a minimum 48px target. A taller tree accommodates more than 12 ornaments. The same buttons work over the SVG fir when WebGL is unavailable.
- Notes open a native focus-managed dialog with readable wrapping, category/date and anonymous body; no author identity. Dialog uses existing 180ms opacity/translate entrance, honoring reduced motion. Consulted beui center-morph-modal for focus/enter/exit mechanism; retain native dialog rather than adding a motion dependency. Fir/snow is a novel effect, not a catalog interaction.
- Snow gently drifts; lights breathe subtly, notes remain stationary. Provide an explicit effects pause; offscreen/background scenes stop, reduced-motion renders a still frame. Context loss falls back without hiding notes. Renderer DPR is capped at 1.5 and no shadows/post-processing are used on phones.
- Staff can edit and delete their own stories before event start. The organizer can publish the reviewed collection once the event has started and the configured Korean release time has arrived. Closing the public tree restores the underlying event phase.

## 7. Depth

### Invitation arrival (2026-11-14)
- During reading, a translucent yellow pen stroke loops over the heading and message. Its two fixed glints and the line fade before each new stroke. The 4.4-second cycle ends on departure and becomes a faint still heart when motion is reduced.
- Preserve the exact event theme. One matte navy envelope arrives over the paper background, opens on its top hinge, and releases an ivory letter. The letter becomes real HTML at rest; its DOM bounds own the graphics anchor, including at large text sizes.
- Reuse all existing colors, serif/system font stacks, 4px spacing scale and Button. Letter width at most 480px, heading 30–40px, mobile padding 24px (16px at 320), stage padding 48px above/96px below. Content grows and scrolls. Only a fine orbit, italic year and folded paper carry ornament.
- Arrival/settle/open/unfold ends at 1.2/1.5/2.2/3 seconds of active graphics time; departure takes 1 second. Reading pauses rendering. Preparation over 2 seconds, reduced motion or GPU failure yields the same static HTML invitation. Departure has a 1.5 second navigation safety timer.
- `/invite` is replayable. First root/login visits show it once per tab; entry records only a UI flag. Admin and protected routes retain their own flows. No API, personal data, fonts, imagery or network assets are added for the invitation.
Warm paper canvas, ivory islands separated by fine warm rules; navy invitation panel has an inset border and a subtle brass orbit. No glass, gradients or hard offset shadows. User's solemn direction takes precedence over earlier expressive references.

## 8. Accessibility & Debt
WCAG AA contrast, 48px touch areas, labels, alert/status regions, keyboard navigation, dialog focus, no color-only meaning. The invitation preloads the enabled soundtrack and starts looping “연말의 밤” as the envelope opens. The header shows the saved music preference (on by default). If autoplay needs a gesture, a separate playback action appears and the first tap can start the track. 320px without horizontal overflow; admin tables use stacked cards. Private site intentionally noindexed. Real physical-device and deployed-origin checks require the user's production project; record them as unverified until actually performed.
- Accepted performance debt: the optional WebGL tree measured Lighthouse mobile 85 with 4x CPU throttling versus desktop 100; accessible DOM notes/SVG paint before GPU preparation. Physical-device frame/battery measurements remain unverified. Noindex intentionally lowers the SEO audit score for this private event.

## Employee notebook · 2026-11-14

### 인물 카드 목록 · 2026-11-19 (이전의 한 명씩 넘기기 대체)

공개된 모든 직원을 이름·직책 버튼으로 한 페이지에 모은다. 종이·아이보리·황동 색, 12/16px 여백, 8px 모서리, 1px 경계를 재사용한다. 최소 카드 폭 112px의 자동 열 배치로 작은 화면에서도 두 열을 유지한다. 이름 16px·직책 13px은 시스템 서체로 표시한다. 터치 또는 Enter로 질문·답변을 native dialog에서 읽는다. 상세창은 최대 520px, 화면 가장자리 24px, 내부 여백 24px, 최대 높이 100dvh-48px이며 본문을 스크롤한다. 닫기·Escape·바깥 클릭으로 닫고 원래 카드로 초점을 복원한다. 질문·답변은 감자꽃 22px이다. 기존 트리 상세창 및 beui center-morph-modal의 초점·닫기 방식을 재사용하고 180ms opacity/4px 이동을 적용한다. 동작 줄이기·페이지 효과 끄기에는 즉시 표시한다. 공개 취소·행사 변경 때 열린 내용도 제거한다.

관리자의 새 인물 질문·인물 카드 답변은 공개 가능한 항목을 기본 선택한다. 이미 저장한 일부 질문 선택은 유지한다. 문제·통계의 공개 승인 체크는 폼을 열 때 기본 선택되지만 저장으로 확정한다. 신규 취향 자동 집계는 미승인으로 저장하고 결과 확인 화면의 검수 저장으로 승인한다. 원본 수정에 따른 서버 승인 취소와 공개 권한은 유지한다.

행사 종료 후 목차는 자유 관람 홈·이야기 트리·취향 카드로 이어진다. 홈 상단은 이야기 트리와 우리들의 취향 카드를 아이콘·텍스트만 있는 두 개의 보조 버튼으로 가로 배치한다. 320px에서도 두 열을 유지하고 기존 13px 시스템 서체·24px 아이콘·8px 여백을 사용한다. 제목 아래 중복 안내는 생략하고 기존 대기실 6장면 애니메이션을 재사용한다. 한 명씩 표시하는 취향 카드는 기존 종이·아이보리·황동 색과 24px 여백을 쓴다. 카드 이름과 조작은 시스템 서체, 질문·원문 답변은 감자꽃을 사용한다. 가로 스와이프는 65px 이상이며 세로 스크롤은 그대로 허용한다. 카드 전환은 180ms로 표시하고 동작 줄이기와 페이지 효과 끄기를 따른다.

직원 화면은 종이 초대장에 이어지는 연말 기록장으로 구성한다. 850px 미만은 목차 아래에 본문 한 장, 넓은 화면은 왼쪽 목차와 오른쪽 본문 한 장을 표시한다. 따뜻한 종이색과 아이보리, 왼쪽 제본선, 하단 쪽 번호, 질문 사이의 가는 선을 사용한다. 본문과 답변 칸은 무지 아이보리다. 제목 옆의 선물 상자, 첫 질문 옆의 루돌프, 동의 제목 옆의 트리와 눈사람은 종이 위에 붙인 무광 스티커로 표시한다. 종이 왼쪽 가장자리에 짧은 홈으로 연결된 둥근 구멍을 36px 간격으로 표시한다. 감자꽃 제목은 모바일 기준 28–32px, 손글씨 본문은 21px로 두며 화면 폭에 맞춰 자연스럽게 줄을 바꾼다.

이 절이 직원용 명조 제목과 외부 글꼴 추가에 대한 이전 지침을 대체한다. 제목·질문·자유 입력·힌트·편지는 흑연색 감자꽃(Gamja Flower Regular 400), 식별 정보와 조작·동의·오류·관리자는 시스템 서체로 표시한다. 보기 설정에는 페이지 효과 끄기를 제공한다. 공통 머리글의 행사명 앞에는 혜성식품 심벌을 사용한다. 폰트는 프로젝트 안에 재배포한 공식 WOFF2 파일에서 로드한다.

앞뒤 장은 실제 링크와 접근 가능한 HTML을 사용한다. 전환 중에는 보이는 본문을 640ms 동안 넘긴다. 앞으로 갈 때는 출발 장, 돌아올 때는 도착 장의 글과 스티커를 같은 불투명한 종이 앞면에 놓는다. 뒷면은 아이보리 무지다. 답변 칸은 가는 외곽선과 넉넉한 줄 높이를 사용한다. OS 저감이나 효과 끄기, 권한·행사 전환과 히스토리 복구는 즉시 반영한다. 세부 파일·측정·한계는 [공책 UI 검증 기록](docs/NOTEBOOK-UI.md)에 있다.
