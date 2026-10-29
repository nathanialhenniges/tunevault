import { test, expect } from "vitest";
import { redact } from "../src/core/safety";
import { run } from "../src/core/media";
test("redacts complete auth headers, quoted credentials and signed URLs", () => {
  const message = redact(
    'HTTP 403\nAuthorization: Bearer SEEDED_SECRET\nCookie: sid=COOKIE_SECRET; private=value\n"access_token":"TOKEN_SECRET"\nhttps://example.com/audio?signature=URL_SECRET',
  );
  for (const secret of [
    "SEEDED_SECRET",
    "COOKIE_SECRET",
    "TOKEN_SECRET",
    "URL_SECRET",
  ])
    expect(message).not.toContain(secret);
  expect(message).toContain("HTTP 403");
});
test("credentialed subprocess errors withhold raw output even after a large header", async () => {
  const script =
    "process.stderr.write('Authorization: Bearer '+ 'x'.repeat(5000)+'SEEDED_SECRET\\nHTTP Error 403');process.exit(1)";
  const error = await run(process.execPath, [
    "-e",
    script,
    "--",
    "--cookies",
    "fixture",
  ]).catch((error) => error as Error);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).not.toContain("SEEDED_SECRET");
  expect((error as Error).message).toContain(
    "credentialed source details withheld",
  );
});
