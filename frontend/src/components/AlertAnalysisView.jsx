import { useEffect, useMemo, useState } from 'react'
import { getInvestigations } from '../api'

export default function AlertAnalysisView({
  onOpenInvestigation,
  onInvestigateAlert,
  onToast,
}) {
  const [investigations, setInvestigations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortField, setSortField] = useState('id')
  const [sortAsc, setSortAsc] = useState(false)

  async function loadInvestigations() {
    setLoading(true)
    setError('')
    try {
      const data = await getInvestigations(100)
      setInvestigations(data.investigations || [])
      if (onToast) {
        onToast({
          type: 'info',
          title: 'Investigations Refreshed',
          message: `Loaded ${data.investigations?.length || 0} records from SQLite`,
        })
      }
    } catch (err) {
      setError(
        err.message || 'Failed to retrieve investigation records from the backend.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    async function fetchInitial() {
      try {
        const data = await getInvestigations(100)
        if (!ignore) {
          setInvestigations(data.investigations || [])
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err.message || 'Failed to retrieve investigation records from the backend.',
          )
          setLoading(false)
        }
      }
    }
    fetchInitial()
    return () => {
      ignore = true
    }
  }, [])

  function handleSort(field) {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  // Derived filtered & sorted investigations
  const filteredInvestigations = useMemo(() => {
    let result = [...investigations]

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      result = result.filter((item) => {
        const alertMatch = item.alert_id?.toLowerCase().includes(q)
        const userMatch = item.username?.toLowerCase().includes(q)
        const ipMatch = item.source_ip?.toLowerCase().includes(q)
        const sevMatch = item.severity?.toLowerCase().includes(q)
        const idMatch = String(item.id).includes(q)
        return alertMatch || userMatch || ipMatch || sevMatch || idMatch
      })
    }

    // Severity filter
    if (severityFilter !== 'ALL') {
      result = result.filter(
        (item) => item.severity?.toUpperCase() === severityFilter,
      )
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((item) => item.status?.toLowerCase() === statusFilter.toLowerCase())
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortField]
      let valB = b[sortField]

      if (valA === null || valA === undefined) valA = ''
      if (valB === null || valB === undefined) valB = ''

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA
      }

      const strA = String(valA).toLowerCase()
      const strB = String(valB).toLowerCase()
      if (strA < strB) return sortAsc ? -1 : 1
      if (strA > strB) return sortAsc ? 1 : -1
      return 0
    })

    return result
  }, [investigations, searchTerm, severityFilter, statusFilter, sortField, sortAsc])

  // Statistics
  const stats = useMemo(() => {
    const total = investigations.length
    const highCrit = investigations.filter(
      (item) =>
        item.severity?.toLowerCase() === 'high' ||
        item.severity?.toLowerCase() === 'critical',
    ).length
    const avgScore =
      total > 0
        ? Math.round(
            investigations.reduce(
              (acc, curr) => acc + (Number(curr.risk_score) || 0),
              0,
            ) / total,
          )
        : 0
    const uniqueAlerts = new Set(investigations.map((i) => i.alert_id)).size

    return { total, highCrit, avgScore, uniqueAlerts }
  }, [investigations])

  return (
    <div className="view-container">
      <section className="welcome-section">
        <div>
          <p className="eyebrow">HISTORICAL INVESTIGATIONS & TRIAGE</p>
          <h2>Alert Analysis & Case History</h2>
          <p className="welcome-copy">
            Review completed security investigations from the SQLite repository. Filter by severity,
            examine rule-based risk scores, and reopen reports on demand.
          </p>
        </div>
        <div className="hero-shield">⌕</div>
      </section>

      {/* Stats Summary */}
      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-heading">Total cases</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-foot">Recorded in SQLite</div>
        </article>

        <article className="stat-card">
          <div className="stat-heading">High & Critical</div>
          <div className="stat-value">{stats.highCrit}</div>
          <div className="stat-foot">Requires immediate triage</div>
        </article>

        <article className="stat-card">
          <div className="stat-heading">Average risk score</div>
          <div className="stat-value">
            {stats.avgScore}
            <span style={{ fontSize: '13px', color: '#8899b2', fontWeight: 400 }}> /100</span>
          </div>
          <div className="stat-foot">Calculated by rule engine</div>
        </article>

        <article className="stat-card">
          <div className="stat-heading">Unique alerts</div>
          <div className="stat-value">{stats.uniqueAlerts}</div>
          <div className="stat-foot">Distinct alert identifiers</div>
        </article>
      </section>

      {/* Search & Filter Toolbar */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Investigation Records</h3>
            <p>
              Showing real investigations stored in the database. Use search and filters to refine
              results.
            </p>
          </div>
          <button
            type="button"
            className="secondary-button refresh-btn"
            onClick={loadInvestigations}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : '↻'} Refresh
          </button>
        </div>

        <div className="filter-toolbar">
          <div className="search-input-wrap">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search alert ID, username, IP, or severity…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="toolbar-search"
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="toolbar-controls">
            <div className="select-group">
              <label htmlFor="severity-select">Severity:</label>
              <select
                id="severity-select"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="toolbar-select"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div className="select-group">
              <label htmlFor="status-select">Status:</label>
              <select
                id="status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="toolbar-select"
              >
                <option value="ALL">All Statuses</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="message error-message" role="alert">
            <strong>Could not load investigations</strong>
            <p>{error}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={loadInvestigations}
              style={{ marginTop: '10px' }}
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="table-loading-state">
            <span className="spinner" /> Loading investigation records from database…
          </div>
        )}

        {!loading && !error && investigations.length === 0 && (
          <div className="empty-state">
            <strong>No investigations recorded yet.</strong>
            <p>
              Run an alert investigation on the <strong>Investigation</strong> tab to create
              and save your first case record.
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          investigations.length > 0 &&
          filteredInvestigations.length === 0 && (
            <div className="empty-state">
              <strong>No matching records found.</strong>
              <p>No investigations matched your filter criteria. Try adjusting your search term or filters.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSearchTerm('')
                  setSeverityFilter('ALL')
                  setStatusFilter('ALL')
                }}
                style={{ marginTop: '10px' }}
              >
                Reset filters
              </button>
            </div>
          )}

        {!loading && !error && filteredInvestigations.length > 0 && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('id')} className="sortable-th">
                    ID {sortField === 'id' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => handleSort('alert_id')} className="sortable-th">
                    Alert ID {sortField === 'alert_id' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => handleSort('username')} className="sortable-th">
                    Username {sortField === 'username' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => handleSort('source_ip')} className="sortable-th">
                    Source IP {sortField === 'source_ip' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => handleSort('severity')} className="sortable-th">
                    Severity {sortField === 'severity' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => handleSort('risk_score')} className="sortable-th">
                    Risk Score {sortField === 'risk_score' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => handleSort('status')} className="sortable-th">
                    Status {sortField === 'status' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => handleSort('created_at')} className="sortable-th">
                    Investigated At {sortField === 'created_at' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestigations.map((item) => {
                  const sevLower = String(item.severity || 'unknown').toLowerCase()
                  const risk = typeof item.risk_score === 'number' ? item.risk_score : 0

                  return (
                    <tr key={item.id}>
                      <td className="cell-id">#{item.id}</td>
                      <td>
                        <span className="badge-alert-id">{item.alert_id}</span>
                      </td>
                      <td>
                        <span className="cell-username">{item.username || '—'}</span>
                      </td>
                      <td>
                        <code className="cell-ip">{item.source_ip || '—'}</code>
                      </td>
                      <td>
                        <span className={`severity-badge ${sevLower}`}>
                          {item.severity || 'Unknown'}
                        </span>
                      </td>
                      <td>
                        <div className="table-score-pill">
                          <span
                            className="score-dot"
                            style={{
                              background:
                                risk >= 70
                                  ? '#fb7185'
                                  : risk >= 50
                                    ? '#f59e0b'
                                    : risk >= 25
                                      ? '#facc15'
                                      : '#34d399',
                            }}
                          />
                          <strong>{risk}</strong>
                          <span className="score-max">/100</span>
                        </div>
                      </td>
                      <td>
                        <span className="cell-status">
                          <span className="status-dot-mini" /> {item.status}
                        </span>
                      </td>
                      <td className="cell-date">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString()
                          : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="action-btn-primary"
                            onClick={() => onOpenInvestigation(item.id)}
                            title="Open full investigation report"
                          >
                            Open Report
                          </button>
                          <button
                            type="button"
                            className="action-btn-secondary"
                            onClick={() => onInvestigateAlert(item.alert_id)}
                            title={`Run new investigation on ${item.alert_id}`}
                          >
                            Investigate
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
