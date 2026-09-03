import * as React from 'react';

import { cn } from '@/lib/utils';

function Checkbox({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        'mt-0.5 h-4 w-4 shrink-0 rounded border-border-default text-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Checkbox };
