import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bootstrapSchema, loginSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Field, Forward, Note } from "../components/ui";
import { api, configured, supabase, verify } from "../lib/api";
import { useTask } from "../lib/useTask";

export function Login() {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [code, setCode] = useState("");
  const task = useTask();
  const navigate = useNavigate();
  async function login() {
    const input = loginSchema.parse({ name, date_of_birth: dob, access_code: code });
    const existing = await supabase.auth.getUser();
    if (existing.data.user && !existing.data.user.is_anonymous) await supabase.auth.signOut();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    }
    await verify(input);
    const data = await api({ action: "bootstrap", payload: {} }, bootstrapSchema);
    navigate(data.survey ? "/event" : "/survey");
  }
  return (
    <main className="invitation">
      <section className="invitation-cover" aria-label="2026 연말 초대장">
        <div className="orbit" aria-hidden="true" />
        <div>
          <p className="overline">A little closer, together.</p>
          <h1>
            한 걸음
            <br />더 가까워진,
            <br />
            <em>그리고 가까워질 우리.</em>
          </h1>
          <p className="small" style={{ color: "var(--on-dark)" }}>
            매일 만나는 사이에도,
            <br />
            아직 모르는 이야기가 있으니까.
          </p>
        </div>
        <div>
          <p className="year">2026</p>
          <div className="cover-bottom">
            <span>YEAR-END GATHERING</span>
            <span>
              올해의 마지막 인사,
              <br />
              우리의 다음 이야기.
            </span>
          </div>
        </div>
      </section>
      <section className="login-form">
        <div>
          <p className="overline">당신의 자리를 준비했습니다</p>
          <h2>
            반갑습니다.
            <br />
            이제, 조금 더 가까이.
          </h2>
        </div>
        {!configured ? (
          <Note error>Supabase 연결 설정이 필요합니다. 관리자에게 준비 상황을 확인해주세요.</Note>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(login, "");
            }}
          >
            <Field
              label="이름"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="등록된 이름"
              required
              maxLength={60}
            />
            <Field
              label="생년월일"
              type="date"
              autoComplete="bday"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
            <Field
              label="개인 행사코드"
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              hint="개별 안내받은 코드를 입력해주세요."
              required
              minLength={8}
              maxLength={80}
            />
            {task.notice && <Note error={task.failed}>{task.notice}</Note>}
            <Button type="submit" busy={task.busy}>
              우리의 자리로 <Forward />
            </Button>
          </form>
        )}
        <div className="stack-sm">
          <p className="small">
            사전 등록된 직원만 입장할 수 있습니다. 입력한 정보는 본인 확인에만 사용합니다.
          </p>
          <Link className="small" to="/admin">
            행사 운영자 입장
          </Link>
        </div>
      </section>
    </main>
  );
}
