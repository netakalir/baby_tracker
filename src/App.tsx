import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthPage } from './features/auth/AuthPage'
import { ForgotPasswordScreen } from './features/auth/ForgotPasswordScreen'
import { ResetPasswordScreen } from './features/auth/ResetPasswordScreen'
import { VerifyEmailScreen } from './features/auth/VerifyEmailScreen'
import { AddChildScreen } from './features/onboarding/AddChildScreen'
import { CreateFamilyScreen } from './features/onboarding/CreateFamilyScreen'
import { CreateOrJoinScreen } from './features/onboarding/CreateOrJoinScreen'
import { JoinFamilyScreen } from './features/onboarding/JoinFamilyScreen'
import { TodayScreen } from './features/today/TodayScreen'
import { RootRedirect } from './routes/RootRedirect'
import {
  RedirectIfSignedIn,
  RequireAuth,
  RequireOnboardingStatus,
  RequireVerifiedEmail,
} from './routes/guards'

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
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
