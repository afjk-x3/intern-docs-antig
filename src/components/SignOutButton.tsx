'use client';

import React, { useState, useRef } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ConfirmAction';

interface SignOutButtonProps {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  children?: React.ReactNode;
}

export function SignOutButton({
  variant = 'outline',
  size = 'sm',
  className,
  children = 'Sign out',
}: SignOutButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleConfirm = () => {
    setIsSigningOut(true);
    formRef.current?.submit();
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowConfirm(true)}
      >
        {children}
      </Button>

      <form ref={formRef} action="/auth/signout" method="post" className="hidden">
        <input type="hidden" name="logout" value="true" />
      </form>

      <ConfirmAction
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Sign Out"
        description="Are you sure you want to sign out of InternDocs?"
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        variant="destructive"
        isLoading={isSigningOut}
        loadingLabel="Signing out…"
        onConfirm={handleConfirm}
      />
    </>
  );
}
