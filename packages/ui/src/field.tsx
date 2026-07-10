import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

interface FieldChrome {
  label: string;
  hint?: string;
  error?: string;
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement>, FieldChrome {}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="mq-field">
      <label className="mq-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        className={cn('mq-input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <p className="mq-field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mq-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export interface TextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    FieldChrome {}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, className, id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="mq-field">
      <label className="mq-field__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        className={cn('mq-input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <p className="mq-field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mq-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});
