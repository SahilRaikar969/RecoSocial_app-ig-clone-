import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { generatedMedia, MEDIA_CATEGORIES, renderCategorySvg } from '../scripts/demo/generate-media.mjs';

const publicDirectory = new URL('../public/demo/recosocial-v1/', import.meta.url);

test('demo illustrations have a fixed, bounded and unique category manifest', () => {
  assert.equal(MEDIA_CATEGORIES.length, 10);
  assert.equal(new Set(MEDIA_CATEGORIES.map(category => category.slug)).size, 10);
  assert.deepEqual(MEDIA_CATEGORIES.map(category => category.slug), [
    'health-fitness', 'travel', 'gaming', 'technology', 'cars-bikes',
    'food', 'fashion', 'photography', 'music', 'sports',
  ]);
  assert.throws(() => renderCategorySvg({ slug: '../escape', label: '<script>' }), /Unknown fixed demo category/);
  assert.ok(Object.isFrozen(MEDIA_CATEGORIES));
  assert.ok(MEDIA_CATEGORIES.every(Object.isFrozen));
});

test('generated SVG bytes are deterministic and match every committed fixture', async () => {
  const first = generatedMedia();
  assert.deepEqual(first, generatedMedia());
  const committed = (await readdir(publicDirectory)).filter(name => name.endsWith('.svg')).sort();
  assert.deepEqual(committed, first.map(file => file.name).sort());
  for (const file of first) {
    assert.match(file.name, /^[a-z-]+\.svg$/);
    assert.equal(await readFile(new URL(file.name, publicDirectory), 'utf8'), file.source);
    assert.ok(Buffer.byteLength(file.source) < 5000);
  }
});

test('SVG fixtures are explicitly synthetic and contain no active or external resources', () => {
  for (const { source } of generatedMedia()) {
    assert.match(source, /GENERATED DEMO CONTENT/);
    assert.match(source, /DEMO \/ NOT A REAL ACCOUNT/);
    assert.match(source, /<title id="title">/);
    assert.match(source, /<desc id="desc">/);
    assert.doesNotMatch(source, /<(?:script|foreignObject|image|use|iframe)\b|\b(?:href|onload|onclick)\s*=|url\(/i);
    assert.doesNotMatch(source.replace('http://www.w3.org/2000/svg', ''), /https?:\/\//);
  }
});

test('checked-in silent video retains the reviewed project-generated provenance', async () => {
  const video = await readFile(new URL('loop.webm', publicDirectory));
  assert.equal(video.length, 19920);
  assert.equal(video.subarray(0, 4).toString('hex'), '1a45dfa3');
  assert.equal(createHash('sha256').update(video).digest('hex'), '32391c925f0c44b358ed4de7eeab192a52873e3e408c11bb4fd36a1a16a2728e');
});

test('the exact public demo video bypasses auth while nearby paths remain protected', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { NextRequest, NextResponse } = require('next/server');
  const { unstable_doesMiddlewareMatch } = require('next/experimental/testing/server');
  const { load } = await import('./helpers/m3-feed-fixture.mjs');
  let authCalls = 0;
  const { proxy: middleware, config } = load('proxy.ts', undefined, {
    'next/server': { NextResponse },
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => { authCalls++; return { data: { user: null } }; } } }) },
  });
  const path = '/demo/recosocial-v1/loop.webm';
  assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path }), false);
  const video = await middleware(new NextRequest(`http://localhost${path}`));
  assert.equal(video.headers.get('location'), null);
  assert.equal(authCalls, 0);
  for (const url of ['/demo/recosocial-v1/loop.webm/private', '/demo/recosocial-v1/other.webm', '/messages', '/api/camera/publish']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), true);
    const response = await middleware(new NextRequest(`http://localhost${url}`));
    assert.equal(new URL(response.headers.get('location')).pathname, '/login');
  }
  assert.equal(authCalls, 4);
});