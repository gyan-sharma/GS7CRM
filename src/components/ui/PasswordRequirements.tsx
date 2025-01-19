import React from 'react';
import { Check, X } from 'lucide-react';
import { clsx } from 'clsx';

interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: Requirement[] = [
  {
    label: 'At least 8 characters long',
    test: (password) => password.length >= 8,
  },
  {
    label: 'Contains at least one uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: 'Contains at least one lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: 'Contains at least one number',
    test: (password) => /\d/.test(password),
  },
  {
    label: 'Contains at least one special character',
    test: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
  },
];

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <div className="mt-2 space-y-2">
      {PASSWORD_REQUIREMENTS.map((req, index) => {
        const isMet = req.test(password);
        return (
          <div
            key={index}
            className={clsx(
              'flex items-center gap-2 text-sm transition-colors',
              isMet ? 'text-green-600' : 'text-gray-500'
            )}
          >
            {isMet ? (
              <Check className="w-4 h-4" />
            ) : (
              <X className="w-4 h-4" />
            )}
            {req.label}
          </div>
        );
      })}
    </div>
  );
}

export function validatePassword(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every(req => req.test(password));
}