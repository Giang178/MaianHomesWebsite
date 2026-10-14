import { CheckCircle2, Circle } from 'lucide-react';

import { passwordPolicyChecks, type PasswordPolicy } from '@/lib/password-policy';

export function PasswordRequirements({password, policy}: {password: string; policy: PasswordPolicy}) {
  return (
    <ul className="grid grid-cols-1 gap-1.5 rounded-xl border border-white/10 bg-black/10 p-3 text-xs sm:grid-cols-2">
      {passwordPolicyChecks(password, policy).map((item) => (
        <li key={item.label} className={`flex items-center gap-2 ${item.valid ? 'text-emerald-300' : 'text-white/50'}`}>
          {item.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
          {item.label}
        </li>
      ))}
    </ul>
  );
}
