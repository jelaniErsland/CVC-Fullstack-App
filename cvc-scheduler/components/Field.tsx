import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type FieldBaseProps = {
  label: string;
  id: string;
  hint?: string;
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
  children,
}: FieldBaseProps & { children: ReactNode }) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-2 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Field({ id, label, hint, ...props }: FieldProps) {
  const controlClass =
    "h-[52px] w-full rounded-lg border border-white/80 bg-white/68 px-4 text-base text-slate-950 shadow-inner shadow-white/35 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white/86 focus:ring-4 focus:ring-slate-200/70";

  if ("options" in props && props.options) {
    const { options, ...selectProps } = props;

    return (
      <FieldFrame id={id} label={label} hint={hint}>
        <select id={id} className={`${controlClass} appearance-none`} {...selectProps}>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </FieldFrame>
    );
  }

  return (
    <FieldFrame id={id} label={label} hint={hint}>
      <input id={id} className={controlClass} {...props} />
    </FieldFrame>
  );
}
