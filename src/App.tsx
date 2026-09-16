import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthPage } from './features/auth/AuthPage'
import { ForgotPasswordScreen } from './features/auth/ForgotPasswordScreen'
import { ResetPasswordScreen } from './features/auth/ResetPasswordScreen'
import { VerifyEmailScreen } from './features/auth/VerifyEmailScreen'
import { AddChildScreen } from './features/onboarding/AddChildScreen'
import { CreateFamilyScreen } from './features/onboarding/CreateFamilyScreen'
import { CreateOrJoinScreen } from './features/onboarding/CreateOrJoinScreen'
import { JoinFamilyScreen } from './features/onboarding/JoinFamilyScreen'
import { BabyFamilyScreen } from './features/settings/BabyFamilyScreen'
import { DisplayScreen } from './features/settings/DisplayScreen'
import { NotificationsScreen } from './features/settings/NotificationsScreen'
import { ProfileScreen } from './features/settings/ProfileScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { TodayScreen } from './features/today/TodayScreen'
import { WeekScreen } from './features/week/WeekScreen'
import { RootRedirect } from './routes/RootRedirect'
import {
  RedirectIfSignedIn,
  RequireAuth,
  RequireOnboardingStatus,
  RequireVerifiedEmail,
} from './routes/guards'

/**
 * Test-only harness that throws during render to exercise the app-level Sentry
 * ErrorBoundary (see AppErrorFallback). It is mounted at `/__boundary-check`
 * ONLY when `import.meta.env.DEV` is true, so Vite dead-code-eliminates it from
 * production builds — there is no reachable crash path in the shipped bundle.
 */
function BoundaryCheck(): never {
  throw new Error('BoundaryCheck: forced render error for E2E ErrorBoundary test')
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route element={<RedirectIfSignedIn />}>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordScreen />} />
      </Route>

      <Route path="/auth/reset-password" element={<ResetPasswordScreen />} />

      {/* No session exists yet for a freshly signed-up, unconfirmed user -
          this screen must be reachable without RequireAuth. It redirects
          onward itself once a confirmed session shows up. */}
      <Route path="/auth/verify-email" element={<VerifyEmailScreen />} />

      <Route element={<RequireAuth />}>
        <Route element={<RequireVerifiedEmail />}>
          {/* Reachable at any onboarding status: an invite link can be opened
              by someone who already belongs to a family, which the screen
              itself must reject with a specific message (see JoinFamilyScreen). */}
          <Route path="/onboarding/join" element={<JoinFamilyScreen />} />
          <Route path="/join" element={<JoinFamilyScreen />} />

          <Route element={<RequireOnboardingStatus allow="no-family" />}>
            <Route path="/onboarding" element={<CreateOrJoinScreen />} />
            <Route path="/onboarding/create" element={<CreateFamilyScreen />} />
          </Route>

          <Route element={<RequireOnboardingStatus allow="no-child" />}>
            <Route path="/onboarding/add-child" element={<AddChildScreen />} />
          </Route>

          <Route element={<RequireOnboardingStatus allow="ready" />}>
            <Route path="/today" element={<TodayScreen />} />

            {/* Week is a pushed screen reached from the Today header, not a
                bottom-nav tab (the app has no bottom nav yet). */}
            <Route path="/week" element={<WeekScreen />} />

            {/* Settings is a pushed screen reached from the Today header gear,
                not a bottom-nav tab. Placeholders here are filled by later
                slices (12d-12g), each owning exactly one route/file. */}
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/settings/profile" element={<ProfileScreen />} />
            <Route path="/settings/baby-family" element={<BabyFamilyScreen />} />
            <Route path="/settings/display" element={<DisplayScreen />} />
            <Route path="/settings/notifications" element={<NotificationsScreen />} />
          </Route>
        </Route>
      </Route>

      {/* Dev-only crash route for the ErrorBoundary E2E test. Gated on DEV so
          it is stripped from production builds (see BoundaryCheck above). */}
      {import.meta.env.DEV && (
        <Route path="/__boundary-check" element={<BoundaryCheck />} />
      )}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
