// Regra de senha da DCTIMBOTEC 31/002/2020, item 3.2.b (a mesma conferida
// pelo servidor em server/crypto.js).
import { MIN_PASSWORD_LENGTH } from '../types';

export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`, test: p => p.length >= MIN_PASSWORD_LENGTH },
  { label: 'Uma letra maiúscula', test: p => /[A-Z]/.test(p) },
  { label: 'Uma letra minúscula', test: p => /[a-z]/.test(p) },
  { label: 'Um número', test: p => /[0-9]/.test(p) },
  { label: 'Um caractere especial (ex.: @ # $ %)', test: p => /[^A-Za-z0-9]/.test(p) },
];

/** Regras ainda não atendidas (vazia = senha aceita). */
export const passwordProblems = (password: string) =>
  PASSWORD_RULES.filter(r => !r.test(password)).map(r => r.label.toLowerCase());

export const passwordRuleMessage = (password: string) => {
  const missing = passwordProblems(password);
  return missing.length ? `A senha ainda precisa ter: ${missing.join(', ')}.` : '';
};
