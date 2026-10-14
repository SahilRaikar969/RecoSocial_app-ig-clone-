import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../', import.meta.url))
let pathname = '/feed'
function load(file) {
  const filename = resolve(root, file)
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const mod = { exports: {} }
  runInNewContext(code, { module: mod, exports: mod.exports, URL, URLSearchParams, require(name) {
    if(name === 'next/navigation') return { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push() {} }) }
    if(name === '@/components/ui/navigation-link') return { NavigationLink: props => React.createElement('a', props) }
    if(name === '@/components/camera/swipe-camera-gateway') return { SwipeCameraGateway: () => null }
    if(name === '@/components/activity/activity-notification-dot') return { ActivityNotificationDot: () => React.createElement('span', { 'data-unread-indicator': true }) }
    if(name === '@/components/activity/unread-notifications-provider') return { UnreadNotificationsProvider: props => React.createElement('div', {'data-monitor-owner': true}, props.children) }
    if(name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? resolve(root, name.slice(2)) : resolve(dirname(filename), name)
      return load(existsSync(base + '.tsx') ? base + '.tsx' : base + '.ts')
    }
    return require(name)
  } }, {filename})
  return mod.exports
}
const render = (Component, props = {}) => renderToStaticMarkup(React.createElement(Component, props))
const shell = load('components/layout/app-shell.tsx').AppShell
const mobile = load('components/layout/mobile-nav.tsx').MobileNav
test('mobile primary navigation has exactly five named links and one active destination', () => {
  pathname = '/saved'
  const html = render(mobile)
  assert.equal((html.match(/<a /g) || []).length, 5)
  for(const label of ['Home','Explore','Create','Saved','Profile']) assert.ok(html.includes('>' + label + '</span>'))
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1)
  assert.ok(html.includes('href="/saved" aria-current="page"'))
  assert.match(html, /md:hidden/)
  assert.match(html, /safe-area-inset-bottom/)
})
test('shell keeps complementary tablet/phone breakpoints, one main and a working skip target', () => {
  pathname = '/feed'
  const html = render(shell, {children: React.createElement('p', null, 'content')})
  assert.equal((html.match(/<main/g) || []).length, 1)
  assert.match(html, /href="#main-content"/)
  assert.match(html, /id="main-content" tabindex="-1"/)
  assert.match(html, /md:block xl:px-4/)
  assert.match(html, /hidden xl:inline/)
  assert.match(html, /title="Home" aria-label="Home" aria-current="page"/)
  assert.match(html, /aria-label="Messages"/)
  assert.match(html, /aria-label="Activity"/)
  assert.equal((html.match(/data-unread-indicator/g) || []).length, 1)
  assert.doesNotMatch(html, /Keep creating|creator surface|ranking|Premium/)
})
test('nested primary route retains active state without matching unrelated prefixes', () => {
  const { isActivePath } = load('components/layout/navigation-items.ts')
  assert.equal(isActivePath('/profile/edit','/profile'),true)
  assert.equal(isActivePath('/profile-other','/profile'),false)
})
test('recovery routes bypass social chrome and story creation keeps a main landmark', () => {
  const Chrome=load('components/layout/root-chrome.tsx').RootChrome
  for(const route of ['/login','/signup','/forgot-password','/reset-password']) {
    pathname=route
    assert.doesNotMatch(render(Chrome,{children:'page'}), /data-monitor-owner|<nav/)
  }
  for(const route of ['/reel/id','/stories/id','/camera']) {
    pathname=route
    const html=render(Chrome,{children:'page'})
    assert.equal((html.match(/data-monitor-owner/g)||[]).length,1)
    assert.doesNotMatch(html, /<nav/)
  }
  pathname='/stories/create'
  const html=render(Chrome,{children:'page'})
  assert.equal((html.match(/data-monitor-owner/g)||[]).length,1)
  assert.equal((html.match(/<main/g)||[]).length,1)
})
test('shared feedback announces failure and success without adding main landmarks', () => {
  const { FeedbackBanner }=load('components/ui/feedback-banner.tsx')
  assert.match(render(FeedbackBanner,{tone:'error',children:'Try again'}), /role="alert"/)
  assert.match(render(FeedbackBanner,{children:'Saved'}), /role="status"/)
  const { PageShell }=load('components/ui/page-shell.tsx')
  assert.doesNotMatch(render(PageShell,{children:'content'}), /<main/)
})
test('lightweight loading announces once and keeps decorative skeletons hidden', () => {
  const { RouteLoading }=load('components/ui/route-loading.tsx')
  const html=render(RouteLoading,{label:'Loading feed…',media:true})
  assert.equal((html.match(/role="status"/g)||[]).length,1)
  assert.match(html,/aria-busy="true"/)
  assert.match(html,/aria-hidden="true"/)
  assert.doesNotMatch(html,/gradient|shadow|<main/)
})
test('global focus and reduced motion remain effective without masking horizontal overflow', () => {
  const css=readFileSync(resolve(root,'app/globals.css'),'utf8')
  assert.match(css,/:focus-visible \{ outline: 2px solid var\(--rs-focus\)/)
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(css,/overflow-x:\s*hidden|radial-gradient|blur\(/)
})
test('image fit is applied to native media rather than only its wrapper', () => {
  const { SmartImage }=load('components/ui/smart-image.tsx')
  assert.match(render(SmartImage,{src:'https://example.test/image.jpg',alt:'Landscape',className:'object-contain'}),/object-fit:contain/)
  assert.match(render(SmartImage,{src:'https://example.test/image.jpg',alt:'Landscape',className:'object-cover'}),/object-fit:cover/)
})
