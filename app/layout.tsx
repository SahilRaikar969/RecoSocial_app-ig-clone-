import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RootChrome } from '@/components/layout/root-chrome'

export const metadata: Metadata = {
  metadataBase: new URL('https://recosocial.app'),
  title: {
    default: 'RecoSocial',
    template: '%s · RecoSocial',
  },
  description:
    'RecoSocial is a modern social platform for discovering creators, posts, reels, and personalized recommendations.',
  applicationName: 'RecoSocial',
  openGraph: {
    title: 'RecoSocial',
    description:
      'A premium dark social product for creators, posts, reels, and personalized discovery.',
    siteName: 'RecoSocial',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RecoSocial',
    description:
      'A premium dark social product for creators, posts, reels, and personalized discovery.',
  },
}

export const viewport: Viewport = {
  themeColor: '#050505',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-black text-white antialiased">
        <RootChrome>{children}</RootChrome>
      </body>
    </html>
  )
}