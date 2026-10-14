import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { RootChrome } from '@/components/layout/root-chrome'
export const metadata: Metadata = {
  title: { default: 'RecoSocial', template: '%s · RecoSocial' },
  description: 'Discover posts and creators through your interests, likes and saves.',
  applicationName: 'RecoSocial',
  openGraph: { title: 'RecoSocial', description: 'Discover posts and creators through your interests, likes and saves.', siteName: 'RecoSocial', type: 'website' },
  twitter: { card: 'summary', title: 'RecoSocial', description: 'Discover posts and creators through your interests, likes and saves.' },
}
export const viewport: Viewport = { themeColor: '#111113', colorScheme: 'dark' }
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Proxy already verified this request. Reuse its identity without another
  // Auth/profile query; only the public viewer ID crosses the client boundary.
  const initialViewerId = (await headers()).get('x-recosocial-viewer-id') || null
  return <html lang="en"><body><RootChrome initialViewerId={initialViewerId}>{children}</RootChrome></body></html>
}
