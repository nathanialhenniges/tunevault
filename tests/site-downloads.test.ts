import { afterEach, expect, it, vi } from "vitest";
import { getDownloads } from "../site/lib/downloads";

afterEach(() => vi.unstubAllGlobals());
const run = {
  id: 123,
  conclusion: "success",
  event: "push",
  head_branch: "main",
  head_repository: { full_name: "nathanialhenniges/tunevault" },
  head_sha: "a".repeat(40),
};
function mock(release: unknown, artifacts: unknown[] = [], workflow = run) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("releases/latest"))
        return Response.json(release, { status: release ? 200 : 404 });
      if (url.includes("/runs?"))
        return Response.json({ workflow_runs: [workflow] });
      return Response.json({ artifacts });
    }),
  );
}
const artifacts = ["candidate-darwin-arm64", "candidate-win32-x64"].map(
  (name, i) => ({
    name,
    id: i + 1,
    expired: false,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  }),
);

it("offers only a complete pair of public installer assets", async () => {
  mock({
    tag_name: "v4.0.0",
    draft: false,
    prerelease: false,
    assets: ["mac-arm64.dmg", "win-x64.exe"].map((suffix) => ({
      name: `TuneVault-4.0.0-${suffix}`,
      size: 50,
      state: "uploaded",
    })),
  });
  const result = await getDownloads();
  expect(result.release).toBe("4.0.0");
  expect(result.downloads).toHaveLength(2);
  expect(result.downloads[0].href).toBe(
    "https://github.com/nathanialhenniges/tunevault/releases/download/v4.0.0/TuneVault-4.0.0-mac-arm64.dmg",
  );
  expect(result.downloads[0].expires).toBeUndefined();
});

it("offers signed-in ZIP links from a successful main build when no release exists", async () => {
  mock(null, artifacts);
  const result = await getDownloads();
  expect(result.release).toBeNull();
  expect(result.testedCommit).toBe("aaaaaaa");
  expect(result.downloads.map((item) => item.href)).toEqual([
    "https://github.com/nathanialhenniges/tunevault/actions/runs/123/artifacts/1",
    "https://github.com/nathanialhenniges/tunevault/actions/runs/123/artifacts/2",
  ]);
  expect(result.downloads.every((item) => item.expires)).toBe(true);
});

it.each(["expired", "missing", "fork", "failed"])(
  "hides %s candidates rather than offering incomplete downloads",
  async (kind) => {
    mock(
      null,
      kind === "missing"
        ? artifacts.slice(0, 1)
        : artifacts.map((item) => ({ ...item, expired: kind === "expired" })),
      {
        ...run,
        conclusion: kind === "failed" ? "failure" : "success",
        head_repository: {
          full_name:
            kind === "fork" ? "other/tunevault" : run.head_repository.full_name,
        },
      },
    );
    expect((await getDownloads()).downloads).toEqual([]);
  },
);

it("keeps the website usable when GitHub is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  expect((await getDownloads()).downloads).toEqual([]);
});

it("hides expired timestamps even if GitHub's expired flag has not changed", async () => {
  mock(
    null,
    artifacts.map((item) => ({ ...item, expires_at: "2020-01-01T00:00:00Z" })),
  );
  expect((await getDownloads()).downloads).toEqual([]);
});
