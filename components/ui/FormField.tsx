'use client';

import { cloneElement, isValidElement, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

type FieldControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-invalid'?: boolean | 'false' | 'true';
  'data-field-state'?: string;
};
type FieldProps = { id: string; label: string; error?: string; hint?: string; children: ReactNode };

function appendId(value: string | undefined, id: string) {
  const ids = new Set((value ?? '').split(/\s+/).filter(Boolean));
  ids.add(id);
  return [...ids].join(' ');
}

/**
 * A field owns its label and feedback contract. Controls passed as children
 * receive the same id and the correct description/error relationship.
 */
export function FormField({ id, label, error, hint, children }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const feedbackIds = [hint ? hintId : undefined, error ? errorId : undefined].filter((value): value is string => Boolean(value));
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<FieldControlProps>, {
        id: (children.props as FieldControlProps).id ?? id,
        'aria-describedby': feedbackIds.reduce((value, feedbackId) => appendId(value, feedbackId), (children.props as FieldControlProps)['aria-describedby']) || undefined,
        'aria-errormessage': error ? errorId : (children.props as FieldControlProps)['aria-errormessage'],
        'aria-invalid': error ? 'true' : (children.props as FieldControlProps)['aria-invalid'],
        'data-field-state': error ? 'error' : undefined,
      })
    : children;
  return <div className={`field${error ? ' has-error' : ''}`} data-field={id} data-field-state={error ? 'error' : undefined}>
    <label htmlFor={id}>{label}</label>
    {control}
    {hint && <span className="status-text field-hint" id={hintId}>{hint}</span>}
    {error && <span className="status-text error-text field-error" id={errorId} role="alert">{error}</span>}
  </div>;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} />; }
export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} />; }
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} />; }
export function FileUpload(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) { return <input {...props} type="file" />; }

// Canonical short names for new consumers; the legacy names remain supported.
export const Input = TextInput;
export const Select = SelectInput;
export const Textarea = TextArea;
