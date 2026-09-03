import * as React from 'react';

import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'block text-xs font-semibold text-text-primary mb-1.5 select-none',
        className
      )}
      {...props}
    />
  );
}

export { Label };
