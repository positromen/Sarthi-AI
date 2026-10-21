import { useEffect, useState } from 'react'
import { ToastProvider } from '../ui/components'
import { useSettings } from '../useSettings'
import { AboutPage } from './pages/AboutPage'
import { AnswersPage } from './pages/AnswersPage'
import { HistoryPage } from './pages/HistoryPage'
import { HotkeysPage } from './pages/HotkeysPage'
import { LanguagePage } from './pages/LanguagePage'
import { PrivacyPage } from './pages/PrivacyPage'
import { ProfilePage } from './pages/ProfilePage'
import { SetupPage } from './pages/SetupPage'
import { Shell, usePage } from './Shell'

function useHistoryCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    window.sarthi.listHistory().then((list) => setCount(list.length))
    return window.sarthi.onHistoryChanged((list) => setCount(list.length))
  }, [])
  return count
}

export function SettingsApp() {
  const [settings, update] = useSettings()
  const [page, navigate] = usePage()
  const historyCount = useHistoryCount()
  if (!settings) return null

  const props = { settings, update }
  return (
    <ToastProvider>
      <Shell page={page} onNavigate={navigate} settings={settings} historyCount={historyCount}>
        {page === 'setup' && <SetupPage />}
        {page === 'profile' && <ProfilePage {...props} />}
        {page === 'answers' && <AnswersPage {...props} />}
        {page === 'language' && <LanguagePage {...props} />}
        {page === 'privacy' && <PrivacyPage {...props} />}
        {page === 'hotkeys' && <HotkeysPage />}
        {page === 'history' && <HistoryPage />}
        {page === 'about' && <AboutPage />}
      </Shell>
    </ToastProvider>
  )
}
