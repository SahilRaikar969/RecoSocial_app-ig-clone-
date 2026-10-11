type NetworkSearchFormProps = { placeholder: string; defaultValue?: string }

export function NetworkSearchForm({ placeholder, defaultValue = '' }: NetworkSearchFormProps) {
  return <form className="mb-5 flex flex-wrap gap-2" role="search">
    <label className="sr-only" htmlFor="network-search">Search people</label>
    <input id="network-search" type="search" name="q" defaultValue={defaultValue} placeholder={placeholder}
      className="min-h-11 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-base text-white placeholder:text-zinc-400" />
    <button type="submit" className="min-h-11 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500">Search</button>
    {defaultValue.trim() ? <a href="?" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-zinc-300 hover:bg-zinc-800">Clear</a> : null}
  </form>
}
