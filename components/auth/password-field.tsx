'use client'

import { useState, type InputHTMLAttributes } from 'react'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  id: string
  label: string
}

export function PasswordField({ label, className = '', ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label htmlFor={props.id} className="mb-2 block text-sm font-medium text-zinc-200">{label}</label>
      <div className="relative">
        <input {...props} type={visible ? 'text' : 'password'} className={`rs-input pr-20 ${className}`} />
        <button
          type="button"
          aria-controls={props.id}
          aria-pressed={visible}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-1 min-h-11 min-w-16 rounded-lg px-3 text-sm font-medium text-zinc-300 hover:text-white"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}
