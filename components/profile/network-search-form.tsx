type NetworkSearchFormProps = {
  placeholder: string
  defaultValue?: string
}

export function NetworkSearchForm({
  placeholder,
  defaultValue = '',
}: NetworkSearchFormProps) {
  const hasValue = defaultValue.trim().length > 0

  return (
    <form className="mb-6">
      <div className="overflow-hidden rounded-[28px] border border-zinc-800/90 bg-black">
        <div className="border-b border-zinc-800/80 px-5 py-4 sm:px-6">
          <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
            Search
          </div>

          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Search by username, display name, or bio to move faster through the creator graph.
          </p>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              name="q"
              defaultValue={defaultValue}
              placeholder={placeholder}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700"
            />

            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-2xl border border-white bg-white px-5 py-4 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Search
              </button>

              {hasValue ? (
                <a
                  href="?"
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                >
                  Clear
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}