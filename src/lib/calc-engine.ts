/**
 * Safe scientific-calculator engine for the CBT on-screen calculator.
 * Tokenises an infix expression, converts it to RPN with the shunting-yard
 * algorithm and evaluates it. No eval / Function construction anywhere.
 *
 * Supported: + − × ÷ ^ ( ) unary minus, % (postfix ÷100), ! (factorial),
 * ² (postfix square), √ / sqrt, sin cos tan asin acos atan log ln abs,
 * constants π and e, the previous answer (Ans), implicit multiplication
 * (2π, 2(3+1), (2)(3), 3sin 30).
 */

export type AngleMode = 'DEG' | 'RAD';

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' | 'neg' }
  | { type: 'postfix'; value: '%' | '!' | 'sq' }
  | { type: 'func'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' };

const FUNCTIONS = ['asin', 'acos', 'atan', 'sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'abs'];

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
}

function isValueEnd(token: Token | undefined): boolean {
  if (!token) return false;
  return token.type === 'num' || token.type === 'rparen' || token.type === 'postfix';
}

export function tokenize(input: string, ans = 0): Token[] {
  const src = input
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/\s+/g, '');

  const tokens: Token[] = [];
  let i = 0;

  const pushWithImplicitMultiply = (token: Token) => {
    const prev = tokens[tokens.length - 1];
    const startsValue = token.type === 'num' || token.type === 'func' || token.type === 'lparen';
    if (startsValue && isValueEnd(prev)) tokens.push({ type: 'op', value: '*' });
    tokens.push(token);
  };

  while (i < src.length) {
    const ch = src[i];

    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
      const text = src.slice(i, j);
      if ((text.match(/\./g) || []).length > 1) throw new Error('Malformed number');
      pushWithImplicitMultiply({ type: 'num', value: Number(text) });
      i = j;
      continue;
    }

    if (/[a-zA-Z]/.test(ch)) {
      const rest = src.slice(i);
      if (/^Ans/i.test(rest)) {
        pushWithImplicitMultiply({ type: 'num', value: ans });
        i += 3;
        continue;
      }
      if (/^pi/i.test(rest)) {
        pushWithImplicitMultiply({ type: 'num', value: Math.PI });
        i += 2;
        continue;
      }
      const fn = FUNCTIONS.find((name) => rest.toLowerCase().startsWith(name));
      if (fn) {
        pushWithImplicitMultiply({ type: 'func', value: fn });
        i += fn.length;
        continue;
      }
      if (ch === 'e' || ch === 'E') {
        pushWithImplicitMultiply({ type: 'num', value: Math.E });
        i += 1;
        continue;
      }
      throw new Error('Unknown symbol');
    }

    if (ch === '(') {
      pushWithImplicitMultiply({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    if (ch === '%') {
      tokens.push({ type: 'postfix', value: '%' });
      i += 1;
      continue;
    }
    if (ch === '!') {
      tokens.push({ type: 'postfix', value: '!' });
      i += 1;
      continue;
    }
    if (ch === '²') {
      tokens.push({ type: 'postfix', value: 'sq' });
      i += 1;
      continue;
    }
    if (ch === '+' || ch === '*' || ch === '/' || ch === '^') {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    if (ch === '-') {
      const prev = tokens[tokens.length - 1];
      tokens.push(isValueEnd(prev) ? { type: 'op', value: '-' } : { type: 'op', value: 'neg' });
      i += 1;
      continue;
    }
    throw new Error('Unknown symbol');
  }

  return tokens;
}

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, neg: 3, func: 3, '^': 4, postfix: 5 };
const RIGHT_ASSOC = new Set(['^', 'neg', 'func']);

type StackToken = Token & { prec: number };

function toRpn(tokens: Token[]): StackToken[] {
  const output: StackToken[] = [];
  const stack: StackToken[] = [];

  const precOf = (token: Token): number => {
    if (token.type === 'op') return PRECEDENCE[token.value];
    if (token.type === 'func') return PRECEDENCE.func;
    if (token.type === 'postfix') return PRECEDENCE.postfix;
    return 0;
  };
  const keyOf = (token: Token): string => (token.type === 'op' ? token.value : token.type);

  for (const token of tokens) {
    if (token.type === 'num') {
      output.push({ ...token, prec: 0 });
    } else if (token.type === 'postfix') {
      output.push({ ...token, prec: PRECEDENCE.postfix });
    } else if (token.type === 'func' || token.type === 'op') {
      const prec = precOf(token);
      const key = keyOf(token);
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type === 'lparen') break;
        const topPrec = top.prec;
        const shouldPop = topPrec > prec || (topPrec === prec && !RIGHT_ASSOC.has(key));
        if (!shouldPop) break;
        output.push(stack.pop()!);
      }
      stack.push({ ...token, prec });
    } else if (token.type === 'lparen') {
      stack.push({ ...token, prec: 0 });
    } else if (token.type === 'rparen') {
      let matched = false;
      while (stack.length) {
        const top = stack.pop()!;
        if (top.type === 'lparen') {
          matched = true;
          break;
        }
        output.push(top);
      }
      if (!matched) throw new Error('Mismatched brackets');
    }
  }

  while (stack.length) {
    const top = stack.pop()!;
    if (top.type === 'lparen') continue; // tolerate unclosed brackets like a Casio does
    output.push(top);
  }
  return output;
}

function applyFunction(name: string, x: number, mode: AngleMode): number {
  const toRad = (v: number) => (mode === 'DEG' ? (v * Math.PI) / 180 : v);
  const fromRad = (v: number) => (mode === 'DEG' ? (v * 180) / Math.PI : v);
  switch (name) {
    case 'sin': return Math.sin(toRad(x));
    case 'cos': return Math.cos(toRad(x));
    case 'tan': return Math.tan(toRad(x));
    case 'asin': return fromRad(Math.asin(x));
    case 'acos': return fromRad(Math.acos(x));
    case 'atan': return fromRad(Math.atan(x));
    case 'sqrt': return Math.sqrt(x);
    case 'log': return Math.log10(x);
    case 'ln': return Math.log(x);
    case 'abs': return Math.abs(x);
    default: throw new Error('Unknown function');
  }
}

export function evaluateExpression(input: string, options: { mode?: AngleMode; ans?: number } = {}): number {
  const mode = options.mode ?? 'DEG';
  const tokens = tokenize(input, options.ans ?? 0);
  if (!tokens.length) throw new Error('Empty expression');
  const rpn = toRpn(tokens);
  const stack: number[] = [];

  for (const token of rpn) {
    if (token.type === 'num') {
      stack.push(token.value);
    } else if (token.type === 'postfix') {
      const x = stack.pop();
      if (x === undefined) throw new Error('Syntax error');
      if (token.value === '%') stack.push(x / 100);
      else if (token.value === '!') stack.push(factorial(x));
      else stack.push(x * x);
    } else if (token.type === 'func') {
      const x = stack.pop();
      if (x === undefined) throw new Error('Syntax error');
      stack.push(applyFunction(token.value, x, mode));
    } else if (token.type === 'op') {
      if (token.value === 'neg') {
        const x = stack.pop();
        if (x === undefined) throw new Error('Syntax error');
        stack.push(-x);
        continue;
      }
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error('Syntax error');
      switch (token.value) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': stack.push(b === 0 ? NaN : a / b); break;
        case '^': stack.push(Math.pow(a, b)); break;
      }
    }
  }

  if (stack.length !== 1) throw new Error('Syntax error');
  const value = stack[0];
  if (!Number.isFinite(value)) throw new Error('Math error');
  return value;
}

/** Trim floating-point noise (0.1 + 0.2 → 0.3) and keep long results readable. */
export function formatCalcResult(value: number): string {
  if (!Number.isFinite(value)) return 'Math error';
  const rounded = Number(value.toPrecision(12));
  if (Math.abs(rounded) >= 1e15 || (Math.abs(rounded) < 1e-9 && rounded !== 0)) return rounded.toExponential(6).replace(/\.?0+e/, 'e');
  return String(rounded);
}
