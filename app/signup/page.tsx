import type { Metadata } from 'next';
import { AuthScreen } from '@/components/site/AuthScreen';

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Create your Quarter member account to manage your plan, bookings and perks.',
  alternates: { canonical: '/signup' },
};

export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}
