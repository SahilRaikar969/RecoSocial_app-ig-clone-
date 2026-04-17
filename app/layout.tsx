import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { RootChrome } from '@/components/layout/root-chrome'

export const metadata: Metadata = {
  metadataBase: new URL('https://recosocial.app'),
  title: {
    default: 'RecoSocial',
    template: '%s · RecoSocial',
  },
  description:
    'RecoSocial is a modern social platform for discovering creators, posts, reels, stories, direct messages, and personalized recommendations.',
  applicationName: 'RecoSocial',
  openGraph: {
    title: 'RecoSocial',
    description:
      'A premium dark social product for creators, posts, reels, lightweight stories, direct messages, and personalized discovery.',
    siteName: 'RecoSocial',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RecoSocial',
    description:
      'A premium dark social product for creators, posts, reels, lightweight stories, direct messages, and personalized discovery.',
  },
}

export const viewport: Viewport = {
  themeColor: '#050505',
  colorScheme: 'dark light',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const theme = cookieStore.get('reco_theme')?.value === 'light' ? 'light' : 'dark'

  return (
    <html lang="en" suppressHydrationWarning data-theme={theme}>
      <body
        data-theme={theme}
        className={
          theme === 'light'
            ? 'bg-white text-black antialiased'
            : 'bg-black text-white antialiased'
        }
      >
        <RootChrome>{children}</RootChrome>
      </body>
    </html>
  )
}