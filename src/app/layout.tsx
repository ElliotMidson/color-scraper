import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Site design audit',
  description: 'Style guide and design tokens from a URL',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased page-body-dot-grid" style={{ backgroundColor: '#E8E8E8' }}>
        {children}
      </body>
    </html>
  );
}
