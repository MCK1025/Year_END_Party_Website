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

## 7. Depth
Warm paper canvas, ivory islands separated by fine warm rules; navy invitation panel has an inset border and a subtle brass orbit. No glass, gradients or hard offset shadows. User's solemn direction takes precedence over earlier expressive references.

## 8. Accessibility & Debt
WCAG AA contrast, 48px touch areas, labels, alert/status regions, keyboard navigation, dialog focus, no color-only meaning, no autoplay audio. 320px without horizontal overflow; admin tables use stacked cards. Private site intentionally noindexed. Real physical-device and deployed-origin checks require the user's production project; record them as unverified until actually performed.
