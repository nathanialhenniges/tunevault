export const appName = 'TuneVault';
export const docsRoute = '/docs';
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const gitConfig = {
  user: 'nathanialhenniges',
  repo: 'tunevault',
  branch: 'main',
};

export const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
export const releasesUrl = `${repoUrl}/releases`;
