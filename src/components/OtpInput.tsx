import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

type OtpInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
};

/**
 * A one-time-code field with one box per digit.
 *
 * The boxes are a presentation of ONE value, so paste, backspace and arrow keys
 * are handled across the whole group rather than per box. The first box owns
 * the visible label; each box also has a "Digit n of N" name so a screen reader
 * knows where it is in the sequence. The default is six digits; email
 * verification passes eight because the hosted project's `mailer_otp_length`
 * is eight.
 */
export default function OtpInput({ id, label, value, onChange, length = 6, disabled = false }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] || '');

  useEffect(() => {
    refs.current = refs.current.slice(0, length);
  }, [length]);

  function write(next: string, focusIndex?: number) {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (focusIndex !== undefined) {
      const target = Math.max(0, Math.min(length - 1, focusIndex));
      refs.current[target]?.focus();
      refs.current[target]?.select();
    }
  }

  function handleInput(index: number, raw: string) {
    const incoming = raw.replace(/\D/g, '');
    if (!incoming) {
      const next = digits.slice();
      next[index] = '';
      write(next.join(''), index);
      return;
    }
    // A paste or a fast keyboard can deliver more than one digit to one box.
    const next = digits.slice();
    let cursor = index;
    for (const digit of incoming) {
      if (cursor >= length) break;
      next[cursor] = digit;
      cursor += 1;
    }
    write(next.join(''), cursor < length ? cursor : length - 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const next = digits.slice();
      next[index - 1] = '';
      write(next.join(''), index - 1);
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
      return;
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      refs.current[0]?.focus();
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      refs.current[length - 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    write(pasted, Math.min(pasted.length, length - 1));
  }

  return (
    <div className="auth-field">
      <label htmlFor={`${id}-0`}>{label}</label>
      <div className="auth-otp" role="group" aria-label={label} data-length={length}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => { refs.current[index] = element; }}
            id={`${id}-${index}`}
            name={`one-time-code-${index + 1}`}
            type="text"
            value={digit}
            onChange={(event) => handleInput(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.currentTarget.select()}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            aria-label={index === 0 ? undefined : `Digit ${index + 1} of ${length}`}
            disabled={disabled}
            required={index === 0}
          />
        ))}
      </div>
    </div>
  );
}
