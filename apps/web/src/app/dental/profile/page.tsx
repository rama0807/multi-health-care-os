import type { Metadata } from 'next'

import { ProfileView } from '@/components/profile/profile-view'

export const metadata: Metadata = {
  title: 'Profile | Grovyn Dental OS',
  description: 'View and manage your clinical profile and account on Grovyn Dental OS.',
}

export default function DentalProfilePage() {
  return <ProfileView basePath="/dental" />
}
