import type { OnboardingStatus } from '../features/onboarding/useOnboardingStatus'

/** Single source of truth for where each onboarding status should land. */
export function pathForOnboardingStatus(status: OnboardingStatus): string {
  switch (status) {
    case 'no-family':
      return '/onboarding'
    case 'no-child':
      return '/onboarding/add-child'
    case 'ready':
      return '/today'
  }
}
