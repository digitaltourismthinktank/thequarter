import type { Metadata } from 'next';
import { AuthScreen } from '@/components/site/AuthScreen';

export const metadata: Metadata = {
  title: 'Member login',
  description: 'Sign in to your Quarter member account to manage your plan, bookings and perks.',
  alternates: { canonical: '/login' },
};

export default function LoginPage() {
  return <AuthScreen mode="login" />;
}
