'use client';
import React, { useContext } from 'react';
import LoginScreen from '../components/LoginScreen';
import EmployeeDashboard from '../components/EmployeeDashboard';
import AdminDashboard from '../components/AdminDashboard';
import { AuthContext, ThemeContext } from '../components/Providers';
import { Role } from '../types';

export default function HomePage() {
  const { user } = useContext(AuthContext);
  const { themeSettings } = useContext(ThemeContext);

  if (!user) {
    return <LoginScreen customMessage={themeSettings.loginMessage} />;
  }
  if (user.role === Role.ADMIN) {
    return <AdminDashboard />;
  }
  if (user.role === Role.EMPLOYEE) {
    return <EmployeeDashboard user={user} />;
  }
  
  return <LoginScreen customMessage={themeSettings.loginMessage} />;
}
