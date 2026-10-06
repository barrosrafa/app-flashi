'use client';

import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type FieldProps = { id: string; label: string; error?: string; hint?: string; children: ReactNode };
export function FormField({ id, label, error, hint, children }: FieldProps) {
  return <div className="field" data-field={id}>
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && !error && <span className="status-text" id={`${id}-hint`}>{hint}</span>}
    {error && <span className="status-text error-text" id={`${id}-error`} role="alert">{error}</span>}
  </div>;
}
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} aria-describedby={[props['aria-describedby'], props.id && `${props.id}-hint`].filter(Boolean).join(' ') || undefined} />; }
export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} />; }
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} />; }
