export default function Header({
  activePage,
  onNavigate,
  apiStatus,
  onCheckHealth,
}) {
  const pageMeta = {
    investigation: {
      eyebrow: 'SECURITY INTELLIGENCE PLATFORM',
      title: 'Investigation Dashboard',
      description: 'Run on-demand AI investigations against security alerts using local reasoning models.',
    },
    alerts: {
      eyebrow: 'THREAT HUNTING & HISTORY',
      title: 'Alert Analysis',
      description: 'Search historical investigations, examine risk scores, and review analyst findings.',
    },
    evidence: {
      eyebrow: 'TELEMETRY & LOG REPOSITORY',
      title: 'Evidence Repository',
      description: 'Inspect imported security log events, analyze authentication activity, and correlate artifacts.',
    },
  }

  const current = pageMeta[activePage] || pageMeta.investigation

  return (
    <header className="topbar">
      <div className="topbar-left">
        <p className="eyebrow">{current.eyebrow}</p>
        <h2>{current.title}</h2>
        <p className="topbar-desc">{current.description}</p>
      </div>

      <div className="topbar-right">
        {/* Mobile Navigation Tabs */}
        <div className="mobile-nav-bar" role="tablist" aria-label="Mobile Navigation">
          <button
            type="button"
            className={`mobile-nav-btn ${activePage === 'investigation' ? 'active' : ''}`}
            onClick={() => onNavigate('investigation')}
          >
            ▦ Investigation
          </button>
          <button
            type="button"
            className={`mobile-nav-btn ${activePage === 'alerts' ? 'active' : ''}`}
            onClick={() => onNavigate('alerts')}
          >
            ⌕ Alert Analysis
          </button>
          <button
            type="button"
            className={`mobile-nav-btn ${activePage === 'evidence' ? 'active' : ''}`}
            onClick={() => onNavigate('evidence')}
          >
            ◈ Evidence
          </button>
        </div>

        <button
          type="button"
          className={`api-pill ${apiStatus}`}
          onClick={onCheckHealth}
          title="Click to check backend status"
        >
          <span className="status-dot" />
          API {apiStatus === 'checking' ? 'Checking…' : apiStatus}
        </button>
      </div>
    </header>
  )
}
