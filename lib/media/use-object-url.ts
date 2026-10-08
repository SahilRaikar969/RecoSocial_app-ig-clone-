'use client'

import { useEffect, useState } from 'react'

export function useObjectUrl(file: Blob | null) {
  const [value, setValue] = useState<{ file: Blob; url: string } | null>(null)
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Store the external resource created by this effect; cleanup owns its lifetime.
    setValue({ file, url })
    return () => URL.revokeObjectURL(url)
  }, [file])
  return value?.file === file ? value.url : ''
}
