import { useRef, useState } from "react";
import { message } from "./api";

export function useTask() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  async function run(work: () => Promise<void>, success = "저장했습니다.") {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setNotice("");
    setFailed(false);
    try {
      await work();
      setNotice(success);
    } catch (error) {
      setNotice(message(error));
      setFailed(true);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, notice, failed, run };
}
