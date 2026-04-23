import type { Metadata, Viewport } from 'next';
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { TabBar } from '@/components/TabBar';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-plex-arabic',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title:       'Reviewencer — AI-powered reviews for the UAE',
  description:
    'Ask anything about UAE businesses — banks, delivery, telecom, e-commerce, ride-hailing. Real reviews, AI-summarized, video-first.',
  openGraph: {
    title:       'Reviewencer',
    description: 'AI-powered, video-first review platform for the UAE.',
    type:        'website',
    siteName:    'Reviewencer',
  },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor:   '#2B8BFF',
  width:        'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexArabic.variable}`}>
      <body className="min-h-screen bg-cream-50/40 font-sans text-royal-900 antialiased">
        <Nav />
        <main className="pb-24 md:pb-0">{children}</main>
        <Footer />
        <TabBar />
      </body>
    </html>
  );
}
