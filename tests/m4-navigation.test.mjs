import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const jsx = (type, props) => ({ type, props: props ?? {} })
function loadTs(path, mocks = {}) {
  const filename = fileURLToPath(new URL('../' + path, import.meta.url))
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const testModule = { exports: {} }
  runInNewContext(outputText, {
    module: testModule, exports: testModule.exports, URLSearchParams,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (Object.hasOwn(mocks, name)) return mocks[name]
      throw new Error('Unexpected dependency: ' + name)
    },
  }, { filename })
  return testModule.exports
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props))
  return [tree, ...nodes(tree.props.children)]
}
function content(tree) {
  if (tree == null) return ''
  if (Array.isArray(tree)) return tree.map(content).join('')
  if (typeof tree !== 'object') return String(tree)
  if (typeof tree.type === 'function') return content(tree.type(tree.props))
  return content(tree.props.children)
}
const icon = props => jsx('svg', props)
const react = (pending, calls = []) => ({
  useState: initial => [initial, value => calls.push(['state', value])],
  useMemo: fn => fn(),
  useTransition: () => [pending, fn => { calls.push(['transition']); fn() }],
})

for (const pending of [false, true]) {
  test('navigation link forwards native props and shows the current router pending state: ' + pending, () => {
    const { NavigationLink } = loadTs('components/ui/navigation-link.tsx', {
      'next/link': { __esModule: true, default: props => jsx('a', props), useLinkStatus: () => ({ pending }) },
    })
    const handler = () => {}
    const tree = NavigationLink({ href: '/feed?view=following&page=2', children: 'Following', className: 'tab', onClick: handler, target: '_blank' })
    const output = nodes(tree)
    const link = output.find(node => node.type === 'a')
    assert.equal(link.props.href, '/feed?view=following&page=2')
    assert.equal(link.props.onClick, handler)
    assert.equal(link.props.target, '_blank')
    assert.equal(link.props.prefetch, undefined, 'retain Next default partial prefetch')
    const status = output.find(node => node.props.role === 'status')
    assert.equal(status.props['data-navigation-pending'], pending || undefined)
    assert.equal(content(status), pending ? 'Loading page…' : '')
    assert.match(status.props.className, /absolute/, 'feedback must not move the link contents')
  })
}

function searchFixture({ initialQuery = '  cats & dogs  ', activeCategory = 'pets', pending = false } = {}) {
  const calls = []
  const { SearchPanel } = loadTs('components/explore/search-panel.tsx', {
    react: react(pending, calls),
    'next/navigation': {
      useRouter: () => ({ push: href => calls.push(['push', href]) }),
      useSearchParams: () => new URLSearchParams('category=pets&q=old'),
    },
    'lucide-react': { Search: icon, SlidersHorizontal: icon, X: icon },
  })
  return { calls, tree: SearchPanel({ initialQuery, activeCategory }) }
}

test('search enters a transition and preserves category while encoding trimmed query', () => {
  const f = searchFixture()
  const form = nodes(f.tree).find(node => node.type === 'form')
  let prevented = false
  form.props.onSubmit({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.deepEqual(f.calls, [['transition'], ['push', '/explore?category=pets&q=cats+%26+dogs']])
})

test('clear search uses a transition and retains the active discovery category', () => {
  const f = searchFixture()
  nodes(f.tree).find(node => node.type === 'button' && node.props.type === 'button').props.onClick()
  assert.deepEqual(f.calls, [['transition'], ['push', '/explore?category=pets'], ['state', '']])
})

test('search displays visible and announced feedback while transition is pending', () => {
  const f = searchFixture({ pending: true })
  const output = nodes(f.tree)
  assert.equal(output.find(node => node.type === 'form').props['aria-busy'], true)
  assert.equal(content(output.find(node => node.type === 'button' && node.props.type === 'submit')), 'Searching…')
  assert.equal(content(output.find(node => node.props.role === 'status')), 'Loading search results…')
})

test('empty search removes stale query and category without a full document navigation', () => {
  const f = searchFixture({ initialQuery: ' ', activeCategory: '' })
  nodes(f.tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.deepEqual(f.calls, [['transition'], ['push', '/explore']])
})

test('route error stays within root layout, hides raw errors, and refetches on retry', () => {
  const calls = []
  const { default: RouteError } = loadTs('app/error.tsx', {
    react: react(false, calls),
    '@/components/ui/navigation-link': { NavigationLink: props => jsx('a', props) },
    'lucide-react': { AlertTriangle: icon, RefreshCcw: icon },
  })
  const tree = RouteError({ error: new Error('private database failure'), unstable_retry: () => calls.push(['retry']) })
  const output = nodes(tree)
  assert.ok(output.every(node => node.type !== 'html' && node.type !== 'body'))
  assert.ok(!content(tree).includes('private database failure'))
  output.find(node => node.type === 'button').props.onClick()
  assert.deepEqual(calls, [['transition'], ['retry']])
})
