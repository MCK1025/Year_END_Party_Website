import { useState } from "react";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { type ForestPost, forestKindSchema, forestKinds } from "../../supabase/functions/_shared/forest";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { Button, Note, Select, TextArea } from "./ui";

export function ForestForm({
  post,
  locked,
  saved,
  cancel,
}: {
  readonly post?: ForestPost;
  readonly locked: boolean;
  readonly saved: () => Promise<void>;
  readonly cancel?: () => void;
}) {
  const [body, setBody] = useState(post?.body ?? "");
  const [kind, setKind] = useState<ForestPost["kind"]>(post?.kind ?? "wish");
  const task = useTask();
  return (
    <form
      className="stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void task.run(
          async () => {
            await api(
              post
                ? { action: "forest_edit", payload: { id: post.id, kind, body } }
                : { action: "forest_post", payload: { kind, body } },
              okSchema,
            );
            setBody("");
            await saved();
          },
          post ? "마음을 수정했습니다." : "이름 없이, 마음이 도착했습니다.",
        );
      }}
    >
      <Select
        label="어떤 마음인가요?"
        value={kind}
        onChange={(value) => setKind(forestKindSchema.parse(value))}
        disabled={locked || task.busy}
      >
        {Object.entries(forestKinds).map(([key, label]) => (
          <option value={key} key={key}>
            {label}
          </option>
        ))}
      </Select>
      <TextArea
        label="혜성식품에게 전하고 싶은 말"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        maxLength={2000}
        disabled={locked || task.busy}
      />
      <p className="small">
        {body.length} / 2,000자 ·{" "}
        {post ? "행사 시작 전까지 수정 가능합니다." : "새 글은 하루 10회까지 남길 수 있어요."}
      </p>
      <div className="actions">
        <Button type="submit" busy={task.busy} disabled={locked || !body.trim()}>
          {post ? "내 글 수정 저장" : "익명으로 마음 남기기"}
        </Button>
        {cancel && (
          <Button variant="secondary" disabled={task.busy} onClick={cancel}>
            수정 취소
          </Button>
        )}
      </div>
      {task.notice && <Note error={task.failed}>{task.notice}</Note>}
    </form>
  );
}
