import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

function load(relative, env = {}) {
  const filename = fileURLToPath(new URL('../' + relative, import.meta.url))
  const source = readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  })
  const mod = { exports: {} }
  runInNewContext(outputText, { module: mod, exports: mod.exports, URL, Uint8Array, process: { env } })
  return mod.exports
}
const { assertMediaUpload, isOwnedMediaPath } = load('lib/media/upload-validation.ts')
const { getMediaUrl } = load('lib/media/get-media-url.ts', { NEXT_PUBLIC_SUPABASE_URL: 'https://local.example' })
const owner = '11111111-1111-4111-8111-111111111111'
const stranger = '22222222-2222-4222-8222-222222222222'

test('known image/video signatures pass bounded screening, not full decoding', async () => {
  for (const [name, type, bytes] of [
    ['x.jpg', 'image/jpeg', [255,216,255,224]],
    ['x.png', 'image/png', [137,80,78,71,13,10,26,10]],
    ['x.gif', 'image/gif', new TextEncoder().encode('GIF89a')],
    ['x.webp', 'image/webp', new TextEncoder().encode('RIFF1234WEBP')],
    ['x.webm', 'video/webm', [26,69,223,163]],
    ['x.mp4', 'video/mp4', [0,0,0,24,102,116,121,112]],
    ['x.mov', 'video/quicktime', [0,0,0,24,102,116,121,112]],
    ['x.ogv', 'video/ogg', new TextEncoder().encode('OggS')],
  ]) await assert.doesNotReject(assertMediaUpload(new File([new Uint8Array(bytes)], name, { type })))
})
test('rejects MIME/extension mismatch and executable markup masquerading as media', async () => {
  for (const [name, type, body] of [
    ['x.png','image/jpeg','content'],
    ['x.jpg','text/html','<script>alert(1)</script>'],
    ['x.jpg','image/jpeg','<script>alert(1)</script>'],
    ['x.svg','image/svg+xml','<svg></svg>'],
    ['x.mp4','video/mp4','MZ executable'],
    ['x.jpg','','content'],
  ]) await assert.rejects(assertMediaUpload(new File([body],name,{type})), /invalid_media|signature_mismatch/)
})
test('rejects empty and oversized data before reading file contents', async () => {
  await assert.rejects(assertMediaUpload(new File([], 'x.jpg', {type:'image/jpeg'})), /size/)
  await assert.rejects(assertMediaUpload({
    name:'x.jpg',type:'image/jpeg',size:50*1024*1024+1,
    slice() { throw new Error('must not read') },
  }), /size/)
})
test('allows only owner-scoped canonical relative references', () => {
  for (const folder of ['images','videos','avatars','thumbnails','story-images','camera-post-videos']) {
    assert.equal(isOwnedMediaPath(folder+'/'+owner+'/123-safe_file.jpg',owner),true)
  }
  for (const path of [
    'images/'+stranger+'/x.jpg','images/'+owner+'/../x.jpg',
    'images/'+owner+'/%2e%2e','images/'+owner+'/x.jpg?token=x',
    'other/'+owner+'/x.jpg','images//x.jpg',
  ]) assert.equal(isOwnedMediaPath(path,owner),false)
  assert.equal(isOwnedMediaPath('images//x.jpg',''),false)
})
test('preserves signed URL token and foreign origin without transplanting paths', async () => {
  for (const value of [
    'https://local.example/storage/v1/object/sign/media/images/a/x.jpg?token=secret-fixture',
    'https://other.example/storage/v1/object/public/media/images/b/x.jpg',
    'https://cdn.example/x.jpg?version=2',
  ]) assert.equal(await getMediaUrl(value),value)
})
test('relative signed reference keeps token while ordinary owner paths resolve publicly', async () => {
  assert.equal(await getMediaUrl('storage/v1/object/sign/media/images/a/x.jpg?token=fixture'),
    'https://local.example/storage/v1/object/sign/media/images/a/x.jpg?token=fixture')
  assert.equal(await getMediaUrl('images/'+owner+'/test image.jpg'),
    'https://local.example/storage/v1/object/public/media/images/'+owner+'/test%20image.jpg')
  assert.equal(await getMediaUrl(null),null)
})
