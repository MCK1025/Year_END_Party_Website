import { useState } from "react";
import { Button, Check, Confirm, Field, Note, Panel, Select, TextArea } from "./ui";

export function Showcase() {
  const [open, setOpen] = useState(false);
  return (
    <main className="guest stack">
      <p className="overline">2026 · component study</p>
      <h1>
        정중하게,
        <br />
        조금은 짓궂게.
      </h1>
      <Panel title="작은 대화의 시작">
        <p>우리, 서로에 대해 얼마나 알고 있을까요?</p>
        <Button onClick={() => setOpen(true)}>확인 창 열기</Button>
        <Button variant="secondary">두 번째 동작</Button>
        <Button busy>저장</Button>
        <Field label="이름" placeholder="이름을 입력해주세요" />
        <Field label="마감된 문항" value="저장된 내용" disabled readOnly />
        <TextArea label="올해의 기억" />
        <Select label="동료" value="" onChange={() => undefined}>
          <option value="">한 명을 선택해주세요</option>
        </Select>
        <Check checked onChange={() => undefined}>
          내 이야기를 힌트로 사용해도 좋아요.
        </Check>
        <Note>안전하게 저장했습니다.</Note>
        <Note error>행사코드를 확인해주세요.</Note>
      </Panel>
      <Panel dark title="힌트 하나">
        <p>의외로 이분은, 주말마다 산을 오릅니다.</p>
      </Panel>
      {open && (
        <Confirm title="정답을 공개할까요?" action={async () => undefined} onClose={() => setOpen(false)}>
          공개한 내용은 이미 본 사람의 기억에서 지울 수 없습니다.
        </Confirm>
      )}
    </main>
  );
}
