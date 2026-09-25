import { useEffect, useRef, useState } from 'react';
import { Calculator, X } from 'lucide-react';
import { evaluateExpression, formatCalcResult, type AngleMode } from '../lib/calc-engine';

type Key = { label: string; insert?: string; action?: 'ac' | 'del' | 'eq' | 'mode'; kind?: 'fn' | 'op' | 'num' | 'eq' | 'danger' };

const KEYS: Key[][] = [
  [
    { label: 'DEG', action: 'mode', kind: 'fn' },
    { label: 'sin', insert: 'sin(', kind: 'fn' },
    { label: 'cos', insert: 'cos(', kind: 'fn' },
    { label: 'tan', insert: 'tan(', kind: 'fn' },
    { label: 'AC', action: 'ac', kind: 'danger' },
  ],
  [
    { label: 'x²', insert: '²', kind: 'fn' },
    { label: '^', insert: '^', kind: 'fn' },
    { label: '√', insert: '√(', kind: 'fn' },
    { label: 'log', insert: 'log(', kind: 'fn' },
    { label: 'ln', insert: 'ln(', kind: 'fn' },
  ],
  [
    { label: '(', insert: '(', kind: 'fn' },
    { label: ')', insert: ')', kind: 'fn' },
    { label: 'π', insert: 'π', kind: 'fn' },
    { label: 'e', insert: 'e', kind: 'fn' },
    { label: 'DEL', action: 'del', kind: 'danger' },
  ],
  [
    { label: '7', insert: '7', kind: 'num' },
    { label: '8', insert: '8', kind: 'num' },
    { label: '9', insert: '9', kind: 'num' },
    { label: '÷', insert: '÷', kind: 'op' },
    { label: '%', insert: '%', kind: 'op' },
  ],
  [
    { label: '4', insert: '4', kind: 'num' },
    { label: '5', insert: '5', kind: 'num' },
    { label: '6', insert: '6', kind: 'num' },
    { label: '×', insert: '×', kind: 'op' },
    { label: 'n!', insert: '!', kind: 'op' },
  ],
  [
    { label: '1', insert: '1', kind: 'num' },
    { label: '2', insert: '2', kind: 'num' },
    { label: '3', insert: '3', kind: 'num' },
    { label: '−', insert: '−', kind: 'op' },
    { label: 'Ans', insert: 'Ans', kind: 'op' },
  ],
  [
    { label: '0', insert: '0', kind: 'num' },
    { label: '.', insert: '.', kind: 'num' },
    { label: '00', insert: '00', kind: 'num' },
    { label: '+', insert: '+', kind: 'op' },
    { label: '=', action: 'eq', kind: 'eq' },
  ],
];

const OPERATOR_INSERTS = new Set(['+', '−', '×', '÷', '^', '%', '!', '²']);

/**
 * On-screen scientific calculator for the CBT simulator (JAMB-style popup).
 * Keyboard input works while the panel is focused; key events never leak to
 * the exam shortcuts because the panel stops propagation.
 */
export default function ScientificCalculator({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ans, setAns] = useState(0);
  const [mode, setMode] = useState<AngleMode>('DEG');
  const [justEvaluated, setJustEvaluated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function insert(text: string) {
    setError('');
    setExpr((current) => {
      if (justEvaluated) {
        setJustEvaluated(false);
        // Continue from the answer when an operator follows "=", otherwise start fresh.
        return OPERATOR_INSERTS.has(text) ? `Ans${text}` : text;
      }
      return current + text;
    });
    setResult(null);
    inputRef.current?.focus();
  }

  function clearAll() {
    setExpr('');
    setResult(null);
    setError('');
    setJustEvaluated(false);
    inputRef.current?.focus();
  }

  function deleteLast() {
    setError('');
    setJustEvaluated(false);
    setExpr((current) => {
      const multi = current.match(/(sin\(|cos\(|tan\(|log\(|ln\(|√\(|Ans)$/);
      return multi ? current.slice(0, -multi[0].length) : current.slice(0, -1);
    });
    setResult(null);
    inputRef.current?.focus();
  }

  function evaluate() {
    if (!expr.trim()) return;
    try {
      const value = evaluateExpression(expr, { mode, ans });
      const formatted = formatCalcResult(value);
      setResult(formatted);
      setAns(value);
      setError('');
      setJustEvaluated(true);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Syntax error');
    }
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === 'Enter' || event.key === '=') {
      event.preventDefault();
      evaluate();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div className="er-calc" role="dialog" aria-label="Scientific calculator" onKeyDown={onKeyDown}>
      <div className="er-calc-head">
        <span><Calculator size={14} /> Calculator</span>
        <span className="er-calc-mode">{mode}</span>
        <button type="button" className="er-calc-close" onClick={onClose} aria-label="Close calculator">
          <X size={16} />
        </button>
      </div>

      <div className="er-calc-screen" onClick={() => inputRef.current?.focus()}>
        <input
          ref={inputRef}
          className="er-calc-input"
          value={expr}
          onChange={(event) => {
            setExpr(event.target.value);
            setResult(null);
            setError('');
            setJustEvaluated(false);
          }}
          placeholder="0"
          inputMode="none"
          autoComplete="off"
          spellCheck={false}
          aria-label="Calculator expression"
        />
        <div className={`er-calc-result${error ? ' is-error' : ''}`} aria-live="polite">
          {error || (result !== null ? `= ${result}` : '\u00a0')}
        </div>
      </div>

      <div className="er-calc-keys">
        {KEYS.flat().map((key) => (
          <button
            key={key.label}
            type="button"
            className={`er-calc-key kind-${key.kind || 'num'}`}
            onClick={() => {
              if (key.action === 'ac') return clearAll();
              if (key.action === 'del') return deleteLast();
              if (key.action === 'eq') return evaluate();
              if (key.action === 'mode') {
                setMode((current) => (current === 'DEG' ? 'RAD' : 'DEG'));
                setResult(null);
                return;
              }
              if (key.insert) insert(key.insert);
            }}
          >
            {key.action === 'mode' ? (mode === 'DEG' ? 'DEG' : 'RAD') : key.label}
          </button>
        ))}
      </div>
    </div>
  );
}
