import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
import { basePath } from '@/lib/shared';
import './global.css';

export const metadata: Metadata = {
  title: { default: 'TuneVault', template: '%s · TuneVault' },
  description:
    'A local music library for Mac and Windows. Import music you own, fix tags and artwork, and prepare files for portable players.',
  icons: { icon: `${basePath}/logo.png` },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
