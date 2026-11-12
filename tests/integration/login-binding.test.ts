import { afterAll, beforeAll, expect, it } from "vitest";
import { boot, employee, sql } from "./helpers";

beforeAll(async () => {
  await sql`update private.settings set enabled=true where id`;
  await sql`delete from private.login_attempts`;
});
afterAll(async () => {
  await sql.end();
});
it("does not rebind an existing employee actor even when another employee password is valid", async () => {
  // Given: a verified synthetic A identity.
  const c = await employee(0);
  const before = (await boot(c)).self.id;
  // When: directly bypass the login screen and try B's valid password with A's token.
  const attempt = await c.functions.invoke("verify-employee", { body: { password: "910202" } });
  // Then: server-side identity isolation survives the browser switching fix.
  expect(attempt.error?.context?.status).toBe(401);
  expect((await boot(c)).self.id).toBe(before);
  await c.auth.signOut();
});
