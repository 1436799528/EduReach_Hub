export type PasswordRequirement = {
  id: 'length' | 'case' | 'number' | 'symbol' | 'common';
  label: string;
  met: boolean;
};

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too common' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  percent: number;
  requirements: PasswordRequirement[];
  acceptable: boolean;
};

// A short deny-list, not a password policy. It stops the handful of passwords
// that make an eight-character minimum meaningless without pretending to be a
// breach corpus (the real check belongs on the auth server).
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd',
  '12345678', '123456789', '1234567890', 'qwerty12', 'qwerty123',
  'iloveyou', 'letmein1', 'welcome1', 'admin123', 'abc12345',
  'edureach', 'edureach1', 'student1', 'student123', 'nigeria1',
]);

export function inspectPassword(value: string): PasswordStrength {
  const password = value || '';
  const lower = password.toLowerCase();
  const common = Boolean(password) && (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(lower.replace(/[^a-z0-9]/g, '')));
  const requirements: PasswordRequirement[] = [
    { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
    { id: 'case', label: 'Upper and lowercase letters', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: 'number', label: 'A number', met: /\d/.test(password) },
    { id: 'symbol', label: 'A symbol (recommended)', met: /[^A-Za-z0-9]/.test(password) },
    { id: 'common', label: 'Not a commonly used password', met: Boolean(password) && !common },
  ];

  if (!password) {
    return { score: 0, label: 'Weak', percent: 0, requirements, acceptable: false };
  }
  if (common) {
    return { score: 0, label: 'Too common', percent: 0, requirements, acceptable: false };
  }

  const met = requirements.filter((item) => item.id !== 'common' && item.met).length;
  // Length + mixed case + a number is already a usable password (Good).
  // "Strong" is reserved for a fourth class (symbol) or a long passphrase.
  let score: PasswordStrength['score'] = met <= 1 ? 1 : met === 2 ? 2 : met === 3 ? 3 : 4;
  // A long passphrase earns the top band even without a symbol.
  if (password.length >= 16 && met >= 3) score = 4;
  const label: PasswordStrength['label'] = score === 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  return {
    score,
    label,
    percent: score === 1 ? 28 : score === 2 ? 52 : score === 3 ? 76 : 100,
    requirements,
    acceptable: requirements[0].met && requirements[4].met,
  };
}
