import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SharedCred | Smart Provider Onboarding',
  description: 'A transparent, multi-organization provider onboarding and credentialing prototype.',
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
