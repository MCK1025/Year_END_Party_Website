import { useState } from "react";
import { Button, Field, Note, Panel } from "../components/ui";
import { ApiError, supabase } from "../lib/api";
import { useTask } from "../lib/useTask";

export function AdminLogin({ onLogin }: { readonly onLogin: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [factor, setFactor] = useState("");
  const [code, setCode] = useState("");
  const task = useTask();
  return (
    <main className="guest stack">
      <header className="page-heading">
        <p className="overline">For the organizer</p>
        <h1>
          오늘의 시간을
          <br />
          함께 만드는 자리.
        </h1>
      </header>
      <Panel title="운영자 로그인">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              if (factor) {
                const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor, code });
                if (error) throw new ApiError("인증번호를 확인해주세요.");
                await onLogin();
                return;
              }
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) throw new ApiError("이메일과 비밀번호를 확인해주세요.");
              const { data } = await supabase.auth.mfa.listFactors();
              const totp = data?.totp.find((f) => f.status === "verified");
              if (totp) {
                setFactor(totp.id);
                return;
              }
              await onLogin();
            }, "");
          }}
        >
          {factor ? (
            <Field
              label="인증 앱의 6자리 번호"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              minLength={6}
              maxLength={6}
              required
            />
          ) : (
            <>
              <Field
                label="관리자 이메일"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Field
                label="비밀번호"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </>
          )}
          {task.notice && <Note error={task.failed}>{task.notice}</Note>}
          <Button type="submit" busy={task.busy}>
            운영 화면으로
          </Button>
        </form>
      </Panel>
    </main>
  );
}
