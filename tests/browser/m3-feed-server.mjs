// Local synthetic browser fixture: actual query/actions/FeedList, mocked database,
// auth and PostCard. No Supabase configuration or user media is loaded.
import http from 'node:http'
import { createRequire } from 'node:module'
import { fixture, load, post, category, getFeed } from '../helpers/m3-feed-fixture.mjs'
const require = createRequire(import.meta.url)
const React = require('react')
const jsx = require('react/jsx-runtime')
const { renderToStaticMarkup } = require('react-dom/server')
let viewers
function reset() {
  const posts = [post('a-travel', { post_categories: [category('travel')] }), post('b-cooking'), post('history'), post('friend', { author_id: 'followed-creator' })]
  viewers = {
    a: fixture({ posts, hidden: ['history'], follows: ['followed-creator'], profileId: 'viewer-a' }),
    b: fixture({ posts, hidden: ['history'], follows: ['followed-creator'], preferences: ['travel'], profileId: 'viewer-b' }),
  }
}
reset()
async function listing(context, view = 'for-you') {
  const result = await getFeed(context, { view })
  const { FeedList } = load('components/feed/feed-list.tsx', context, {
    'react/jsx-runtime': jsx,
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/components/feed/post-card': { PostCard: ({ post }) => React.createElement('article', { 'data-post-id': post.id }, `${post.id} · score ${post.feed_score} · ${post.source_bucket}`) },
  })
  return renderToStaticMarkup(await FeedList({ posts: result.posts, devProfileId: context.viewer, feedView: view }))
}
async function response() {
  return { a: await listing(viewers.a), b: await listing(viewers.b), following: await listing(viewers.a, 'following') }
}
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>M3 feed browser verification</title>
<style>body{font:16px system-ui;margin:24px;max-width:1100px;background:#fff;color:#17212b}button{padding:12px;margin:4px}article{padding:12px;margin:8px 0;background:#eaf0fc;border:1px solid #aac}pre{white-space:pre-wrap;padding:16px;background:#edf7ed}#views{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:20px}#views h2,#views h3{font-size:17px}a{color:#245}p{font-size:13px}#views section{margin-bottom:12px}</style>
<h1>M3 feed verification</h1><p>Actual ranking queries, mutation handlers and FeedList. Synthetic data, database/auth and post cards; no live Supabase.</p>
<button id="run">Run ranking journey</button><pre id="results">Ready</pre>
<div id="views"><div><h2>Viewer A · For You</h2><div id="a"></div></div><div><h2>Viewer B · For You</h2><div id="b"></div></div><div><h2>Viewer A · Following</h2><div id="following"></div></div></div>
<script>
const result=document.getElementById('results');
async function request(input){const r=await fetch('/fixture',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});if(!r.ok)throw Error('Fixture failed');const data=await r.json();for(const id of ['a','b','following'])document.getElementById(id).innerHTML=data[id];return data;}
const ids=id=>[...document.querySelectorAll('#'+id+' [data-post-id]')].map(el=>el.dataset.postId).join(',');
document.getElementById('run').onclick=async()=>{let n=0;result.textContent='';const check=(pass,label)=>{if(!pass)throw Error(label);n++;result.textContent+='PASS '+label+'\\n'};try{
 await request({reset:true});const baseline=ids('a'),other=ids('b');check(baseline==='friend,a-travel,b-cooking','cold start ranks followed post then deterministic ties');
 check(other==='a-travel,friend,b-cooking','second viewer uses independent selected interests');check(ids('following')==='friend','Following contains only actual followed creator');
 await request({signal:'like',active:false});check(ids('a')==='friend,b-cooking,a-travel','like changes later ranked and rendered category order');check(ids('b')===other,'other viewer ranking is unchanged');const liked=document.querySelector('#a [data-post-id="b-cooking"]').textContent;
 await request({signal:'like',active:false});check(document.querySelector('#a [data-post-id="b-cooking"]').textContent===liked,'duplicate like does not inflate category weight');
 await request({signal:'like',active:true});check(ids('a')===baseline,'unlike restores current-state ordering');
 await request({signal:'save',active:false});check(ids('a')==='friend,b-cooking,a-travel','save changes later ranked render order');const saved=document.querySelector('#a [data-post-id="b-cooking"]').textContent;
 await request({signal:'save',active:false});check(document.querySelector('#a [data-post-id="b-cooking"]').textContent===saved,'duplicate save does not inflate weight');
 await request({signal:'save',active:true});check(ids('a')===baseline,'unsave restores baseline');check(ids('following')==='friend','personalization never inserts fallback into Following');
 result.textContent+='ALL '+n+' M3 BROWSER CHECKS PASSED';
}catch(error){result.textContent+='STOPPED: '+error.message}};
</script></html>`
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/fixture' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) { body += chunk; if (body.length > 4096) throw new Error('Too large') }
      const input = JSON.parse(body)
      if (input.reset) reset()
      if (input.signal === 'like' || input.signal === 'save') {
        const like = input.signal === 'like'
        const action = load(like ? 'actions/likes.ts' : 'actions/saves.ts', viewers.a)[like ? 'toggleLikeInline' : 'toggleSaveInline']
        await action({ postId: 'history', [like ? 'liked' : 'saved']: !!input.active })
      }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(await response()))
    } else { res.setHeader('Content-Type','text/html'); res.end(html) }
  } catch { res.statusCode = 500; res.end('Synthetic fixture failed') }
})
server.listen(4318, '127.0.0.1', () => console.log('M3 synthetic browser fixture http://127.0.0.1:4318'))
