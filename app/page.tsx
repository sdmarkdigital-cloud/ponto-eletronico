'use client';
import React, { useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from './providers';
import { Role } from '../typings';

export default function HomePage() {
  const { user, loadingSession } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (loadingSession) {
      return; // Wait for session to be loaded
    }

    if (!user) {
      router.replace('/auth');
    } else if (user.role === Role.ADMIN) {
      router.replace('/dashboard/admin');
    } else if (user.role === Role.EMPLOYEE) {
      router.replace('/dashboard/employees');
    }
  }, [user, loadingSession, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary text-text-muted">
      Carregando...
    </div>
  );
}