export default function Sidebar({
  activePage,
  onNavigate,
  investigationCount = null,
  eventsCount = null,
}) {
  const navItems = [
    {
      id: 'investigation',
      label: 'Investigation',
      icon: '▦',
      badge: null,
      desc: 'Run on-demand AI alert investigation',
    },
    {
      id: 'alerts',
      label: 'Alert Analysis',
      icon: '⌕',
      badge: investigationCount !== null ? String(investigationCount) : null,
      desc: 'Review past investigations and risk history',
    },
    {
      id: 'evidence',
      label: 'Evidence',
      icon: '◈',
      badge: eventsCount !== null ? String(eventsCount) : null,
      desc: 'Explore imported security logs & telemetry',
    },
  ]

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">S</div>
        <div>
          <h1>Sentinel AI</h1>
          <p>Security Operations</p>
        </div>
      </div>

      <div className="nav-label">WORKSPACE</div>

      <nav className="nav-list" aria-label="Main Navigation">
        {navItems.map((item) => {
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="environment-dot" />
        <div>
          <strong>Local environment</strong>
          <p>Demo security data · SQLite</p>
        </div>
      </div>
    </aside>
  )
}
