import type { Metadata } from 'next';
import { Inter, IBM_Plex_Sans_Thai } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const thai = IBM_Plex_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  variable: '--font-thai',
});

export const metadata: Metadata = {
  title: 'AI Analytics — POS Intelligence',
  description: 'AI-powered business analytics for your POS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${inter.variable} ${thai.variable} font-sans bg-background`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
