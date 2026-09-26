import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type FieldBaseProps = {
  label: string;
  id: string;
  hint?: string;
  error?: string;
  optional?: boolean;
};

type InputFieldProps = FieldBaseProps &
  InputHTMLAttributes<HTMLInputElement> & {
    options?: never;
  };

type SelectFieldProps = FieldBaseProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options: string[];
  };

type FieldProps = InputFieldProps | SelectFieldProps;

function FieldFrame({
  id,
  label,
  hint,
  error,
  optional,
  required,
  children,
}: FieldBaseProps & { children: ReactNode; required?: boolean }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[var(--pl-text)]">{label}{required ? <span className="font-normal"> (required)</span> : optional ? <span className="font-normal text-[var(--pl-muted)]"> (optional)</span> : null}</label>
      {children}
      {hint ? <p id={`${id}-hint`} className="mt-2 text-sm text-[var(--pl-muted)]">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="mt-2 text-sm font-medium text-red-800">{error}</p> : null}
    </div>
  );
}

/** Callers supply errors after blur/submit, keeping untouched fields neutral. */
export function Field({ id, label, hint, error, optional, className = "", ...props }: FieldProps) {
  const describedBy = [props["aria-describedby"], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const controlClass =
    `min-h-[var(--pl-control-height)] w-full min-w-0 rounded-[var(--pl-radius-control)] border bg-white px-3 py-2 text-base text-[var(--pl-ink)] placeholder:text-[var(--pl-muted)] disabled:bg-[var(--pl-surface-subtle)] ${error ? "border-red-700" : "border-[var(--pl-control-border)]"} ${className}`;
  const associations = { "aria-describedby": describedBy, "aria-invalid": error ? true : props["aria-invalid"] };

  if ("options" in props && props.options) {
    const { options, ...selectProps } = props;

    return (
      <FieldFrame id={id} label={label} hint={hint} error={error} optional={optional} required={props.required}>
        <select id={id} className={controlClass} {...selectProps} {...associations}>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </FieldFrame>
    );
  }

  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} optional={optional} required={props.required}>
      <input id={id} className={controlClass} {...props} {...associations} />
    </FieldFrame>
  );
}

export function FieldGroup({ id, legend, hint, error, children }: { id: string; legend: string; hint?: string; error?: string; children: ReactNode }) {
  return <fieldset aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined} aria-invalid={error ? true : undefined} className="min-w-0 space-y-3">
    <legend className="text-sm font-semibold text-[var(--pl-text)]">{legend}</legend>
    {hint && <p id={`${id}-hint`} className="text-sm text-[var(--pl-muted)]">{hint}</p>}{children}
    {error && <p id={`${id}-error`} className="text-sm font-medium text-red-800">{error}</p>}
  </fieldset>;
}
