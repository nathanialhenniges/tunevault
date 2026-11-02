import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, basePath, repoUrl } from "./shared";

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
    links: [
      { text: "Features", url: "/#features" },
      { text: "Docs", url: "/docs", active: "nested-url" },
      { type: "button", text: "Download", url: "/#downloads", secondary: true },
    ],
    themeSwitch: { enabled: true, mode: "light-dark-system" },
  };
}
