import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CertifyOS | Provider Credentialing Made Simple',
  description: 'A guided provider onboarding and credentialing workspace designed for fast, complete applications.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
