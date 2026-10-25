import { useCallback, useEffect, useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Toast from './components/Toast'
import InvestigationView from './components/InvestigationView'
import AlertAnalysisView from './components/AlertAnalysisView'
import EvidenceView from './components/EvidenceView'
import { checkHealth, getInvestigationDetail } from './api'

export default function App() {
  const [activePage, setActivePage] = useState('investigation')
  const [alertId, setAlertId] = useState('ALT-1001')
  const [apiStatus, setApiStatus] = useState('checking')
  const [report, setReport] = useState(null)
  const [historySource, setHistorySource] = useState(null)
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9)
    const newToast = { id, ...toast }
    setToasts((prev) => [...prev, newToast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const handleCheckHealth = useCallback(async () => {
    setApiStatus('checking')
    try {
      const data = await checkHealth()
      setApiStatus(data.status === 'healthy' ? 'healthy' : 'unavailable')
      addToast({
        type: 'info',
        title: 'Backend Health Check',
        message: `Status: ${data.status} · Service: ${data.service}`,
      })
    } catch {
      setApiStatus('unavailable')
      addToast({
        type: 'error',
        title: 'Backend Offline',
        message: 'Could not connect to FastAPI at http://127.0.0.1:8000',
      })
    }
  }, [addToast])

  useEffect(() => {
    let ignore = false
    async function runInitialHealth() {
      try {
        const data = await checkHealth()
        if (!ignore) {
          setApiStatus(data.status === 'healthy' ? 'healthy' : 'unavailable')
        }
      } catch {
        if (!ignore) {
          setApiStatus('unavailable')
        }
      }
    }
    runInitialHealth()
    return () => {
      ignore = true
    }
  }, [])

  // Navigation handlers
  const handleNavigate = useCallback((page) => {
    setActivePage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Open investigation report from Alert Analysis or Evidence
  const handleOpenInvestigation = useCallback(
    async (historyId) => {
      try {
        const saved = await getInvestigationDetail(historyId)
        setReport(saved.report || saved)
        setAlertId(saved.alert_id || 'ALT-1001')
        setHistorySource({
          id: saved.id,
          alert_id: saved.alert_id,
        })
        setActivePage('investigation')
        addToast({
          type: 'success',
          title: 'Investigation Report Loaded',
          message: `Opened saved case #${saved.id} for alert ${saved.alert_id}`,
        })
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Failed to Open Investigation',
          message: err.message || 'Could not load saved investigation details.',
        })
      }
    },
    [addToast],
  )

  // Pre-fill alert and jump to investigation view
  const handleInvestigateAlert = useCallback(
    (targetAlertId) => {
      setAlertId(targetAlertId)
      setHistorySource(null)
      setActivePage('investigation')
      addToast({
        type: 'info',
        title: 'Alert Selected',
        message: `Ready to investigate ${targetAlertId}`,
      })
    },
    [addToast],
  )

  const handleClearLoadedHistory = useCallback(() => {
    setHistorySource(null)
    addToast({
      type: 'info',
      title: 'History Mode Cleared',
      message: 'Switched to new investigation mode.',
    })
  }, [addToast])

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={handleNavigate} />

      <main className="main-content">
        <Header
          activePage={activePage}
          onNavigate={handleNavigate}
          apiStatus={apiStatus}
          onCheckHealth={handleCheckHealth}
        />

        <Toast toasts={toasts} onDismiss={removeToast} />

        {activePage === 'investigation' && (
          <InvestigationView
            alertId={alertId}
            setAlertId={setAlertId}
            apiStatus={apiStatus}
            report={report}
            setReport={setReport}
            historySource={historySource}
            onClearLoadedHistory={handleClearLoadedHistory}
            onViewInEvidence={() => handleNavigate('evidence')}
            onToast={addToast}
          />
        )}

        {activePage === 'alerts' && (
          <AlertAnalysisView
            onOpenInvestigation={handleOpenInvestigation}
            onInvestigateAlert={handleInvestigateAlert}
            onToast={addToast}
          />
        )}

        {activePage === 'evidence' && (
          <EvidenceView
            onOpenInvestigation={handleOpenInvestigation}
            onToast={addToast}
          />
        )}

        <footer>
          Sentinel AI · Local SOC Investigation Platform · AI outputs require
          analyst verification.
        </footer>
      </main>
    </div>
  )
}
