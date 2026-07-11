import type { Metadata } from 'next';
import { Inter, IBM_Plex_Sans_Thai, IBM_Plex_Mono } from 'next/font/google';
import { Providers } from './providers';
import { DashboardShell } from '@/components/DashboardShell';
import { LangProvider } from '@/lib/i18n';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const thai = IBM_Plex_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  variable: '--font-thai',
});
// Used for receipt-style tags (KPI marks, ticket stubs) — echoes a POS printout
// instead of reaching for a generic icon set.
const mono = IBM_Plex_Mono({ weight: ['600', '700'], subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'AI Analytics — POS Intelligence',
  description: 'AI-powered business analytics for your POS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${inter.variable} ${thai.variable} ${mono.variable} font-sans bg-background`}>
        <Providers>
          <LangProvider>
            <DashboardShell>{children}</DashboardShell>
          </LangProvider>
        </Providers>
      </body>
    </html>
  );
}
