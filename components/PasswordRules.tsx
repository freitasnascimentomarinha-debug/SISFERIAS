import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { PASSWORD_RULES } from '../lib/password';

/** Lista as exigências da senha, marcando as já atendidas. */
const PasswordRules: React.FC<{ password: string }> = ({ password }) => (
  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-bold" data-testid="regras-senha">
    {PASSWORD_RULES.map(rule => {
      const ok = rule.test(password);
      return (
        <li key={rule.label} className={`flex items-center gap-1.5 ${ok ? 'text-green-600' : 'text-slate-400'}`}>
          {ok ? <CheckCircle2 size={13} /> : <Circle size={13} />} {rule.label}
        </li>
      );
    })}
  </ul>
);

export default PasswordRules;
