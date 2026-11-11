import { afterAll, describe, expect, it } from "vitest";
import { sql } from "./helpers";

afterAll(() => sql.end());
describe("server signup policy", () => {
  it.each([
    { user: { is_anonymous: true }, allowed: true },
    { user: { is_anonymous: false }, allowed: false },
    { user: { is_anonymous: false, user_metadata: { party_admin_provisioning: true } }, allowed: false },
    { user: { is_anonymous: false, app_metadata: { party_admin_provisioning: true } }, allowed: true },
  ])("permits only anonymous or server-provisioned users: $allowed", async ({ user, allowed }) => {
    // Given: Auth supplies the user object, including protected app_metadata.
    const event = sql.json({ user });
    // When: the same SQL hook used by hosted Auth evaluates the request.
    const rows = await sql`select private.before_user_created(${event}::jsonb) result`;
    // Then: untrusted user_metadata cannot grant permission to register a permanent account.
    if (allowed) expect(rows[0]?.result).toEqual({});
    else expect(rows[0]?.result.error.http_code).toBe(403);
  });
});
