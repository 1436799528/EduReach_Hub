export interface FormFieldErrorProps {
  id?: string;
  error?: string | null;
  className?: string;
}

/**
 * Reusable, accessible inline field error component.
 * Renders directly beneath its associated input field.
 */
export function FormFieldError({ id, error, className = '' }: FormFieldErrorProps) {
  if (!error) return null;
  return (
    <span
      id={id}
      className={`er-field-error ${className}`.trim()}
      role="alert"
      aria-live="polite"
    >
      {error}
    </span>
  );
}

export default FormFieldError;
