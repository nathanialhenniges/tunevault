import { repoUrl } from "./shared";

type Download = { label: string; href: string; expires?: string };

export async function getDownloads(): Promise<{
  release: string | null;
  testedCommit: string | null;
  downloads: Download[];
}> {
  const result = { release: null, testedCommit: null, downloads: [] } as {
    release: string | null;
    testedCommit: string | null;
    downloads: Download[];
  };
  async function read(path: string) {
    const response = await fetch(
      `https://api.github.com/repos/nathanialhenniges/tunevault/${path}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return null;
    return response.json();
  }
  try {
    const [releaseResult, runsResult] = await Promise.allSettled([
      read("releases/latest"),
      read(
        "actions/workflows/verify.yml/runs?branch=main&status=success&event=push&per_page=1",
      ),
    ]);
    const release =
      releaseResult.status === "fulfilled" ? releaseResult.value : null;
    const runs = runsResult.status === "fulfilled" ? runsResult.value : null;
    const targets = [
      ["Mac · M1 and newer", "mac-arm64.dmg", "candidate-darwin-arm64"],
      ["Windows · x64", "win-x64.exe", "candidate-win32-x64"],
    ];
    if (
      release &&
      !release.draft &&
      !release.prerelease &&
      /^v?\d+\.\d+\.\d+$/.test(release.tag_name)
    ) {
      const version = release.tag_name.replace(/^v/, "");
      const assets = targets.map(([, suffix]) =>
        release.assets?.find(
          (asset: { name: string; state: string; size: number }) =>
            asset.name === `TuneVault-${version}-${suffix}` &&
            asset.state === "uploaded" &&
            asset.size > 0,
        ),
      );
      if (assets.every(Boolean)) {
        result.release = version;
        result.downloads = assets.map((asset, i) => ({
          label: targets[i][0],
          href: `${repoUrl}/releases/download/${encodeURIComponent(release.tag_name)}/${encodeURIComponent(asset.name)}`,
        }));
        return result;
      }
    }
    const run = runs?.workflow_runs?.[0];
    if (
      !run ||
      run.conclusion !== "success" ||
      run.event !== "push" ||
      run.head_branch !== "main" ||
      run.head_repository?.full_name !== "nathanialhenniges/tunevault" ||
      !Number.isSafeInteger(run.id)
    )
      return result;
    const artifacts = await read(
      `actions/runs/${run.id}/artifacts?per_page=100`,
    );
    const candidates = targets.map(([, , name]) =>
      artifacts?.artifacts?.find(
        (artifact: {
          name: string;
          expired: boolean;
          expires_at: string;
          id: number;
        }) =>
          artifact.name === name &&
          !artifact.expired &&
          Date.parse(artifact.expires_at) > Date.now() &&
          Number.isSafeInteger(artifact.id),
      ),
    );
    if (candidates.every(Boolean) && /^[a-f0-9]{40}$/.test(run.head_sha)) {
      result.testedCommit = run.head_sha.slice(0, 7);
      result.downloads = candidates.map((artifact, i) => ({
        label: targets[i][0],
        href: `${repoUrl}/actions/runs/${run.id}/artifacts/${artifact.id}`,
        expires: artifact.expires_at.slice(0, 10),
      }));
    }
  } catch {
    console.warn(
      "Download availability could not be checked; keeping the GitHub Releases link.",
    );
  }
  return result;
}
