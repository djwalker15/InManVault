import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/protected-route'
import { PublicOnlyRoute } from './components/public-only-route'
import LandingPage from './routes/landing'
import SignInPage from './routes/sign-in'
import SignUpPage from './routes/sign-up'
import SSOCallbackPage from './routes/sso-callback'
import CrewDecisionPage from './routes/onboarding/decision'
import CrewCreationPage from './routes/onboarding/new'
import InvitePage from './routes/onboarding/invite'
import DashboardPage from './routes/dashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/sso-callback" element={<SSOCallbackPage />} />
      <Route element={<PublicOnlyRoute />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<CrewDecisionPage />} />
        <Route path="/onboarding/new" element={<CrewCreationPage />} />
        <Route path="/onboarding/invite" element={<InvitePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
