# 공용 WebGL 서비스

별도 서버가 아니라 브라우저 안에서 실행되는 Three.js 렌더링 서비스입니다. GitHub Pages에서 그대로 동작하며, 페이지가 렌더러를 직접 관리하지 않습니다.

- `service.ts`: 캔버스별 렌더러·카메라·리사이즈·프레임 루프·가시성·동작 줄이기·컨텍스트 손실·종료를 관리합니다. 기기 픽셀 비율은 최대 1.5입니다. 숨겨진 탭/화면 밖에서는 프레임 루프가 멈춥니다.
- `types.ts`: 효과 플러그인(`EffectFactory` → `update`/`dispose`)과 세션 계약입니다.
- `effects/tree.ts`, `effects/snow.ts`: 독립 효과입니다. 카메라는 화면 비율에 맞게 조정되며 눈은 카메라 범위 전체에 배치됩니다.
- `christmas.ts`: 트리와 눈을 조합하는 소비자입니다. 트리 전용 세로 범위만 여기서 지정합니다.
- `palette.ts`: `DESIGN.md`/CSS와 일치하는 WebGL 색상 토큰입니다.

다른 페이지에서 눈만 사용하려면 페이지가 보일 때 동적으로 서비스를 불러오고, 컴포넌트 해제 시 반드시 세션을 종료합니다.

```ts
const session = createGraphicsSession(canvas, [snowEffect], showStaticFallback);
await session.ready; // GPU 셰이더를 비동기로 준비한 뒤 장식 캔버스를 표시
session.setPaused(true); // 페이지의 효과 멈춤 버튼
session.dispose(); // 컴포넌트 해제 시; 중복 호출에도 안전
```

효과는 자신이 추가한 지오메트리·재질·텍스처를 `dispose`에서 정리해야 합니다. 렌더러를 만들거나 자체 RAF를 시작하지 않습니다. `prefers-reduced-motion`에서는 정지 프레임을 렌더링합니다. 실제 컨텍스트 손실은 DOM/SVG 대체 화면으로 전환합니다. 일반 종료에서 컨텍스트를 강제로 잃게 하지 않아 React의 같은 캔버스 재사용을 지원합니다.

트리 쪽지와 접근성·페이지 넘김·다이얼로그는 `components/tree`의 DOM 계층에 남습니다. WebGL은 장식이며, 이를 사용할 수 없어도 동일한 쪽지를 선택하고 읽을 수 있습니다. 엔진 코드는 로그인/설문 경로에서 내려받지 않습니다.
