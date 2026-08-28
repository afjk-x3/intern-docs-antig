import React from 'react';

/**
 * InternDocs brand mark: a document with a folded corner plus an accent-colored
 * approval check badge, since the product's core action is "submit a document,
 * get it signed off." Uses currentColor for the document so the wrapping element's
 * text color (white in a colored box, brand-primary on light backgrounds) applies.
 */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 3.5h7.5L18 8v12a1 1 0 01-1 1H6a1 1 0 01-1-1v-15.5a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M13.5 3.5V8H18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="16.5" cy="16.5" r="5" className="fill-brand-accent" stroke="white" strokeWidth="1.25" />
      <path
        d="M14.4 16.6l1.4 1.4 2.8-2.9"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className = '', onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span className={`font-extrabold tracking-tight leading-none ${className}`}>
      <span className={onDark ? 'text-white' : 'text-brand-primary'}>Intern</span>
      <span className={onDark ? 'text-brand-accent-on-dark' : 'text-brand-accent'}>Docs</span>
    </span>
  );
}

interface LogoProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  onDark?: boolean;
  showWordmark?: boolean;
}

export function Logo({
  className = '',
  markClassName = 'h-10 w-10',
  textClassName = 'text-xl',
  onDark = false,
  showWordmark = true,
}: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`shrink-0 rounded-xl flex items-center justify-center p-2 ${
          onDark ? 'bg-white/10 text-white' : 'bg-brand-primary text-white'
        } ${markClassName}`}
      >
        <LogoMark className="h-full w-full" />
      </div>
      {showWordmark && <Wordmark className={textClassName} onDark={onDark} />}
    </div>
  );
}
