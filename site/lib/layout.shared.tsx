import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, basePath, repoUrl } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${basePath}/logo.png`} alt="" width={24} height={24} />
          {appName}
        </>
      ),
    },
    githubUrl: repoUrl,
  };
}
