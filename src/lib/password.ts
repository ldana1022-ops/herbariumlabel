const COMMON_PASSWORDS = new Set([
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "passw0rd",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "111111",
  "000000",
  "abc123",
  "abcd1234",
  "iloveyou",
  "admin",
  "admin123",
  "letmein",
  "welcome",
  "welcome1",
  "monkey",
  "dragon",
  "football",
  "sunshine",
  "princess",
  "master",
  "login",
  "starwars",
  "aa123456",
  "1q2w3e4r",
  "zaq12wsx",
  "p@ssw0rd",
  "p@ssword",
]);

export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  symbol: boolean;
  notCommon: boolean;
};

export function checkPassword(password: string): PasswordChecks {
  const normalized = password.trim().toLowerCase();
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
    notCommon: password.length > 0 && !COMMON_PASSWORDS.has(normalized),
  };
}

export function isStrongPassword(password: string): boolean {
  return Object.values(checkPassword(password)).every(Boolean);
}

/** Strict-enough email shape check (beyond the browser's loose validation). */
export function isValidEmail(email: string): boolean {
  const value = email.trim();
  if (value.length < 5 || value.length > 255) return false;
  if (/\s/.test(value)) return false;
  if (value.includes("..")) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(value);
}
