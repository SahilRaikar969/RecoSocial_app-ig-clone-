import type { Metadata, Viewport } from 'next'
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
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><RootChrome>{children}</RootChrome></body></html>
}
