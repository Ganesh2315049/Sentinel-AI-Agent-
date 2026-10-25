import { useEffect, useMemo, useState } from 'react'
import { getLogs } from '../api'
import LogImportModal from './LogImportModal'

export default function EvidenceView({
  onOpenInvestigation,
  onToast,
}) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [resultFilter, setResultFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  async function loadLogs() {
    setLoading(true)
    setError('')
    try {
      const data = await getLogs(null, 500)
      setEvents(data.events || [])
      if (onToast) {
        onToast({
          type: 'info',
          title: 'Evidence Logs Refreshed',
          message: `Loaded ${data.events?.length || 0} events from security telemetry`,
        })
      }
    } catch (err) {
      setError(err.message || 'Failed to load security log events.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    async function fetchInitial() {
      try {
        const data = await getLogs(null, 500)
        if (!ignore) {
          setEvents(data.events || [])
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Failed to load security log events.')
          setLoading(false)
        }
      }
    }
    fetchInitial()
    return () => {
      ignore = true
    }
  }, [])

  function handleImportSuccess(importResult) {
    if (onToast) {
      onToast({
        type: 'success',
        title: 'Logs Imported Successfully',
        message: `${importResult.events_inserted} new events added from ${importResult.source_file}`,
      })
    }
    loadLogs()
  }

  // Derive unique event types for filter dropdown
  const availableEventTypes = useMemo(() => {
    const set = new Set()
    for (const evt of events) {
      if (evt.event_type) set.add(evt.event_type)
    }
    return Array.from(set).sort()
  }, [events])

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const idMatch = evt.event_id?.toLowerCase().includes(q)
        const userMatch = evt.username?.toLowerCase().includes(q)
        const ipMatch = evt.source_ip?.toLowerCase().includes(q)
        const typeMatch = evt.event_type?.toLowerCase().includes(q)
        const fileMatch = evt.source_file?.toLowerCase().includes(q)
        const alertMatch = evt.related_alert_id?.toLowerCase().includes(q)
        if (!idMatch && !userMatch && !ipMatch && !typeMatch && !fileMatch && !alertMatch) {
          return false
        }
      }

      // Event type filter
      if (typeFilter !== 'ALL' && evt.event_type !== typeFilter) {
        return false
      }

      // Result filter
      const isSuccess = evt.event_type?.toLowerCase().includes('successful')
      if (resultFilter === 'SUCCESS' && !isSuccess) return false
      if (resultFilter === 'FAILED' && isSuccess) return false

      return true
    })
  }, [events, searchTerm, typeFilter, resultFilter])

  // Statistics
  const stats = useMemo(() => {
    const total = events.length
    const failed = events.filter((e) =>
      e.event_type?.toLowerCase().includes('failed'),
    ).length
    const successful = events.filter((e) =>
      e.event_type?.toLowerCase().includes('successful'),
    ).length
    const uniqueUsers = new Set(events.map((e) => e.username)).size
    const uniqueIps = new Set(events.map((e) => e.source_ip)).size

    return { total, failed, successful, uniqueUsers, uniqueIps }
  }, [events])

  return (
    <div className="view-container">
      <section className="welcome-section">
        <div>
          <p className="eyebrow">SECURITY TELEMETRY & LOG EVIDENCE</p>
          <h2>Evidence Repository</h2>
          <p className="welcome-copy">
            Analyze authentication logs and security events ingested into the platform. Inspect raw
            telemetry, correlate events with investigations, or import external JSON/CSV log batches.
          </p>
        </div>
        <div className="hero-shield">◈</div>
      </section>

      {/* Summary Cards */}
      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-heading">Total log events</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-foot">Ingested security records</div>
        </article>

        <article className="stat-card">
          <div className="stat-heading">Failed logins</div>
          <div className="stat-value">{stats.failed}</div>
          <div className="stat-foot">Suspicious attempt signals</div>
        </article>

        <article className="stat-card">
          <div className="stat-heading">Successful logins</div>
          <div className="stat-value">{stats.successful}</div>
          <div className="stat-foot">Authorized authentication events</div>
        </article>

        <article className="stat-card">
          <div className="stat-heading">Telemetry scope</div>
          <div className="stat-value">
            {stats.uniqueUsers}
            <span style={{ fontSize: '13px', color: '#8899b2', fontWeight: 400 }}>
              {' '}
              users · {stats.uniqueIps} IPs
            </span>
          </div>
          <div className="stat-foot">Identities & source endpoints</div>
        </article>
      </section>

      {/* Actions and Filter Toolbar */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Security Event Telemetry</h3>
            <p>
              Records fetched live from <code>GET /logs</code>. Click any row or Inspect button to
              examine the full event payload.
            </p>
          </div>
          <div className="panel-action-buttons">
            <button
              type="button"
              className="primary-button"
              onClick={() => setIsImportModalOpen(true)}
            >
              ⇪ Import Logs
            </button>
            <button
              type="button"
              className="secondary-button refresh-btn"
              onClick={loadLogs}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : '↻'} Refresh
            </button>
          </div>
        </div>

        <div className="filter-toolbar">
          <div className="search-input-wrap">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search event ID, username, IP, event type, or source…"
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
              <label htmlFor="type-select">Event Type:</label>
              <select
                id="type-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="toolbar-select"
              >
                <option value="ALL">All Event Types</option>
                {availableEventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="select-group">
              <label htmlFor="result-select">Result:</label>
              <select
                id="result-select"
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className="toolbar-select"
              >
                <option value="ALL">All Results</option>
                <option value="SUCCESS">Successful</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="message error-message" role="alert">
            <strong>Could not retrieve security logs</strong>
            <p>{error}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={loadLogs}
              style={{ marginTop: '10px' }}
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="table-loading-state">
            <span className="spinner" /> Loading security log evidence…
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="empty-state">
            <strong>No security events found in the database.</strong>
            <p>
              Use the <strong>Import Logs</strong> button above to upload sample security logs (e.g.,{' '}
              <code>sample-logs.json</code>) or ingest your own JSON/CSV log files.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setIsImportModalOpen(true)}
              style={{ marginTop: '12px' }}
            >
              Import Logs Now
            </button>
          </div>
        )}

        {!loading && !error && events.length > 0 && filteredEvents.length === 0 && (
          <div className="empty-state">
            <strong>No events match your search or filter.</strong>
            <p>Try loosening your search criteria or resetting filters.</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setSearchTerm('')
                setTypeFilter('ALL')
                setResultFilter('ALL')
              }}
              style={{ marginTop: '10px' }}
            >
              Reset filters
            </button>
          </div>
        )}

        {!loading && !error && filteredEvents.length > 0 && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Timestamp</th>
                  <th>Username</th>
                  <th>Source IP</th>
                  <th>Event Type</th>
                  <th>Result</th>
                  <th>Source / Ingestion</th>
                  <th>Linked Investigation</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((evt, index) => {
                  const isSuccess = evt.event_type
                    ?.toLowerCase()
                    .includes('successful')
                  const isImported = Boolean(evt.source_file)

                  return (
                    <tr
                      key={evt.event_id || `${evt.source_file || 'evt'}-${index}`}
                      className={
                        selectedEvent?.event_id === evt.event_id
                          ? 'row-selected'
                          : ''
                      }
                    >
                      <td className="cell-id">
                        <strong className="mono-id">{evt.event_id}</strong>
                      </td>
                      <td className="cell-date">
                        {evt.timestamp
                          ? new Date(evt.timestamp).toLocaleString()
                          : '—'}
                      </td>
                      <td>
                        <span className="cell-username">{evt.username}</span>
                      </td>
                      <td>
                        <code className="cell-ip">{evt.source_ip}</code>
                      </td>
                      <td>
                        <span className="event-type-tag">{evt.event_type}</span>
                      </td>
                      <td>
                        <span
                          className={`event-badge ${
                            isSuccess ? 'event-success' : 'event-failed'
                          }`}
                        >
                          {isSuccess ? '✓ Success' : '! Failed'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`source-badge ${
                            isImported ? 'source-imported' : 'source-demo'
                          }`}
                          title={`Imported from ${evt.source_file || 'Synthetic Demo'}`}
                        >
                          {isImported ? `File: ${evt.source_file}` : 'Demo Data'}
                        </span>
                      </td>
                      <td>
                        {evt.investigation_id ? (
                          <button
                            type="button"
                            className="link-investigation-badge"
                            onClick={() =>
                              onOpenInvestigation(evt.investigation_id)
                            }
                            title="Open related investigation report"
                          >
                            Case #{evt.investigation_id}
                            {evt.related_alert_id && ` (${evt.related_alert_id})`} →
                          </button>
                        ) : (
                          <span className="text-muted">Not linked</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="secondary-button action-btn-inspect"
                          onClick={() => setSelectedEvent(evt)}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Event Details Drawer/Modal */}
      {selectedEvent && (
        <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <div
            className="modal-container modal-detail"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">EVENT TELEMETRY RECORD</p>
                <h3 id="detail-title">{selectedEvent.event_id}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close details"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="report-grid">
                <div className="report-field">
                  <span>Event ID</span>
                  <strong>{selectedEvent.event_id}</strong>
                </div>
                <div className="report-field">
                  <span>Timestamp</span>
                  <strong>
                    {selectedEvent.timestamp
                      ? new Date(selectedEvent.timestamp).toISOString()
                      : 'Not available'}
                  </strong>
                </div>
                <div className="report-field">
                  <span>Username</span>
                  <strong>{selectedEvent.username}</strong>
                </div>
                <div className="report-field">
                  <span>Source IP (Observed Host)</span>
                  <strong>{selectedEvent.source_ip}</strong>
                </div>
                <div className="report-field">
                  <span>Event Type</span>
                  <strong>{selectedEvent.event_type}</strong>
                </div>
                <div className="report-field">
                  <span>Source File</span>
                  <strong>{selectedEvent.source_file || 'Synthetic Demo'}</strong>
                </div>
                {selectedEvent.imported_at && (
                  <div className="report-field">
                    <span>Imported At</span>
                    <strong>{new Date(selectedEvent.imported_at).toLocaleString()}</strong>
                  </div>
                )}
                {selectedEvent.investigation_id && (
                  <div className="report-field">
                    <span>Linked Case</span>
                    <strong>
                      Investigation #{selectedEvent.investigation_id}{' '}
                      {selectedEvent.related_alert_id &&
                        `(${selectedEvent.related_alert_id})`}
                    </strong>
                  </div>
                )}
              </div>

              <div className="detail-json-wrap">
                <div className="detail-json-header">
                  <strong>Full Event Record JSON</strong>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        JSON.stringify(selectedEvent, null, 2),
                      )
                      if (onToast) {
                        onToast({
                          type: 'info',
                          title: 'Copied',
                          message: 'Event JSON copied to clipboard',
                        })
                      }
                    }}
                  >
                    Copy JSON
                  </button>
                </div>
                <pre className="json-view">
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </div>
            </div>

            <div className="modal-footer">
              {selectedEvent.investigation_id && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    const id = selectedEvent.investigation_id
                    setSelectedEvent(null)
                    onOpenInvestigation(id)
                  }}
                >
                  View Linked Investigation Report →
                </button>
              )}
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedEvent(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Import Modal */}
      <LogImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  )
}
