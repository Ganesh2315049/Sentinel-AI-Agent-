import { useState } from 'react'
import { investigateAlert } from '../api'

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Not available'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

export default function InvestigationView({
  alertId,
  setAlertId,
  apiStatus,
  report,
  setReport,
  historySource = null,
  onClearLoadedHistory,
  onViewInEvidence,
  onToast,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState('')

  async function handleInvestigate(event) {
    if (event) event.preventDefault()

    const normalizedId = alertId.trim()
    if (!normalizedId) {
      setError('Please enter an alert ID.')
      return
    }

    setLoading(true)
    setError('')
    setLastChecked('')
    if (onClearLoadedHistory) onClearLoadedHistory()

    try {
      const data = await investigateAlert(normalizedId)
      setReport(data)
      setLastChecked(new Date().toLocaleTimeString())
      if (onToast) {
        onToast({
          type: 'success',
          title: 'Investigation Completed',
          message: `Generated report for alert ${normalizedId}`,
        })
      }
    } catch (err) {
      setError(
        err.message ||
          'Could not connect to Sentinel AI. Check that the backend is running.',
      )
      if (onToast) {
        onToast({
          type: 'error',
          title: 'Investigation Failed',
          message: err.message || 'Investigation request failed',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  function exportReport() {
    if (!report) return

    const exportData = {
      application: 'Sentinel AI',
      exported_at: new Date().toISOString(),
      ...report,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json;charset=utf-8',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const exportedAlertId = String(
      report.structured_report?.alert_id || alertId.trim() || 'investigation',
    ).replace(/[^a-zA-Z0-9_-]/g, '_')

    link.href = url
    link.download = `sentinel-report-${exportedAlertId}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    if (onToast) {
      onToast({
        type: 'info',
        title: 'Report Exported',
        message: `Saved as sentinel-report-${exportedAlertId}.json`,
      })
    }
  }

  function handleCopyJson() {
    if (!report) return
    navigator.clipboard?.writeText(JSON.stringify(report, null, 2))
    if (onToast) {
      onToast({
        type: 'info',
        title: 'Copied',
        message: 'JSON response copied to clipboard.',
      })
    }
  }

  const structuredReport = report?.structured_report
  const riskScore = structuredReport?.risk_score
  const severity = structuredReport?.severity
  const riskReasons = Array.isArray(structuredReport?.risk_reason)
    ? structuredReport.risk_reason
    : []

  const evidence = structuredReport?.evidence
  const recommendations = structuredReport?.recommendations

  const evidenceItems = Array.isArray(evidence)
    ? evidence
    : Array.isArray(report?.evidence)
      ? report.evidence
      : []

  const recommendationItems = Array.isArray(recommendations)
    ? recommendations
    : Array.isArray(report?.recommendations)
      ? report.recommendations
      : []

  const trace = Array.isArray(report?.trace) ? report.trace : []

  // Older events first; newest events last
  const timelineItems = [...evidenceItems].sort(
    (a, b) => (b.minutes_ago ?? 0) - (a.minutes_ago ?? 0),
  )

  return (
    <div className="view-container">
      <section className="welcome-section">
        <div>
          <p className="eyebrow">AI-ASSISTED SECURITY OPERATIONS</p>
          <h2>Investigate. Understand. Respond.</h2>
          <p className="welcome-copy">
            Investigate security alerts using available log evidence and
            generate an audit-ready structured report with Sentinel AI.
          </p>
        </div>
        <div className="hero-shield">⬡</div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-heading">Backend status</div>
          <div className="stat-value">
            {apiStatus === 'healthy'
              ? 'Online'
              : apiStatus === 'checking'
                ? 'Checking…'
                : 'Offline'}
          </div>
          <div className="stat-foot">FastAPI service</div>
        </article>

        <article className="stat-card">
          <div className="stat-heading">Current alert</div>
          <div className="stat-value">{alertId.trim() || '—'}</div>
          <div className="stat-foot">Alert under investigation</div>
        </article>

        <article className="stat-card">
          <div className="stat-heading">Evidence items</div>
          <div className="stat-value">{report ? evidenceItems.length : '—'}</div>
          <div className="stat-foot">Returned by the API</div>
        </article>

        <article className="stat-card">
          <div className="stat-heading">Investigation</div>
          <div className="stat-value">
            {loading ? 'Running…' : report ? 'Complete' : 'Ready'}
          </div>
          <div className="stat-foot">On-demand analysis</div>
        </article>
      </section>

      <section className="panel investigation-panel">
        <div className="panel-heading">
          <div>
            <h3>New investigation</h3>
            <p>Enter the ID of an alert in the demo dataset or SQLite repository.</p>
          </div>
          <span className="panel-icon">⌕</span>
        </div>

        {historySource && (
          <div className="history-banner">
            <div>
              <strong>Saved Report Mode</strong>
              <p>
                Viewing report loaded from saved history record #{historySource.id} (Alert{' '}
                {historySource.alert_id}).
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={onClearLoadedHistory}
            >
              Clear & Start Fresh
            </button>
          </div>
        )}

        <form onSubmit={handleInvestigate}>
          <label htmlFor="alertId">Alert ID</label>
          <div className="input-row">
            <input
              id="alertId"
              value={alertId}
              onChange={(e) => setAlertId(e.target.value)}
              placeholder="e.g. ALT-1001"
              maxLength={50}
              disabled={loading}
            />

            <button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Investigating…
                </>
              ) : (
                <>
                  Run investigation <span>→</span>
                </>
              )}
            </button>
          </div>

          <p className="helper-text">
            Example alert: ALT-1001 · Unknown IDs return 404 · Whitespace is trimmed.
          </p>
        </form>

        {error && (
          <div className="message error-message" role="alert">
            <strong>Investigation failed</strong>
            <p>{error}</p>
          </div>
        )}

        {report && !error && (
          <div className="message success-message" role="status">
            <strong>Investigation response received</strong>
            <p>
              The backend returned a successful response for{' '}
              {structuredReport?.alert_id || alertId.trim()}.
            </p>
          </div>
        )}
      </section>

      {report && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Investigation report</h3>
                <p>Structured output returned by your backend</p>
              </div>

              <div className="report-actions">
                <span className="complete-badge">RESPONSE RECEIVED</span>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={exportReport}
                >
                  ↓ Export JSON
                </button>
              </div>
            </div>

            {structuredReport && (
              <section className="risk-panel">
                <div className="risk-panel-heading">
                  <div>
                    <p className="risk-eyebrow">RULE-BASED ASSESSMENT</p>
                    <h4>Alert Risk Assessment</h4>
                  </div>

                  <span
                    className={`severity-badge ${String(severity || 'unknown').toLowerCase()}`}
                  >
                    {severity || 'Not available'}
                  </span>
                </div>

                <div className="risk-score-row">
                  <div>
                    <span className="risk-label">Risk score</span>
                    <div className="risk-score">
                      {typeof riskScore === 'number' ? riskScore : '—'}
                      <span>/100</span>
                    </div>
                  </div>

                  <div className="risk-score-description">
                    <strong>Evidence-based scoring</strong>
                    <p>Calculated by backend rules from the observed login events.</p>
                  </div>
                </div>

                <div
                  className="risk-progress-track"
                  role="progressbar"
                  aria-label="Risk score"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={typeof riskScore === 'number' ? riskScore : 0}
                >
                  <div
                    className={`risk-progress-fill ${String(severity || '').toLowerCase()}`}
                    style={{
                      width: `${Math.max(0, Math.min(100, Number(riskScore) || 0))}%`,
                    }}
                  />
                </div>

                <h5 className="risk-reasons-title">Why this score?</h5>

                {riskReasons.length > 0 ? (
                  <ul className="risk-reasons">
                    {riskReasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="helper-text">No risk reasons were returned.</p>
                )}

                <p className="risk-disclaimer">
                  Demo heuristic only. This score is not a probability of compromise
                  and requires analyst review.
                </p>
              </section>
            )}

            {structuredReport ? (
              <div className="report-grid">
                <div className="report-field">
                  <span>Alert ID</span>
                  <strong>
                    {formatValue(structuredReport.alert_id || alertId)}
                  </strong>
                </div>

                <div className="report-field">
                  <span>Username</span>
                  <strong>{formatValue(structuredReport.username)}</strong>
                </div>

                <div className="report-field">
                  <span>Source IP</span>
                  <strong>{formatValue(structuredReport.source_ip)}</strong>
                </div>

                <div className="report-field">
                  <span>Data source</span>
                  <strong>{formatValue(structuredReport.data_source)}</strong>
                </div>
              </div>
            ) : (
              <p className="helper-text">
                No structured_report field was returned. See the raw response below.
              </p>
            )}

            {(structuredReport?.summary || report?.answer) && (
              <div className="summary-box">
                <h4>Summary</h4>
                <p>{formatValue(structuredReport?.summary || report?.answer)}</p>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Evidence timeline</h3>
                <p>
                  Security events returned by the investigation agent, ordered from
                  oldest to newest
                </p>
              </div>
              <div className="heading-actions">
                <span className="count-badge">{evidenceItems.length} events</span>
                {onViewInEvidence && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={onViewInEvidence}
                  >
                    View in Evidence Page →
                  </button>
                )}
              </div>
            </div>

            {timelineItems.length > 0 ? (
              <div className="timeline">
                {timelineItems.map((item, index) => {
                  const isSuccess = item.event_type
                    ?.toLowerCase()
                    .includes('successful')

                  return (
                    <article
                      className="timeline-event"
                      key={item.event_id || index}
                    >
                      <div className="timeline-marker-column">
                        <div
                          className={`timeline-marker ${
                            isSuccess ? 'success' : 'failed'
                          }`}
                        >
                          {isSuccess ? '✓' : '!'}
                        </div>

                        {index < timelineItems.length - 1 && (
                          <div className="timeline-line" />
                        )}
                      </div>

                      <div className="timeline-card">
                        <div className="timeline-card-header">
                          <div>
                            <span
                              className={`event-badge ${
                                isSuccess ? 'event-success' : 'event-failed'
                              }`}
                            >
                              {item.event_type || 'Unknown event'}
                            </span>
                            <h4>{item.event_id || 'Event ID unavailable'}</h4>
                          </div>

                          <span className="timeline-time">
                            {item.minutes_ago !== undefined
                              ? `${item.minutes_ago} min ago`
                              : item.timestamp
                                ? item.timestamp
                                : 'Time unavailable'}
                          </span>
                        </div>

                        <div className="timeline-details">
                          <div>
                            <span>Username</span>
                            <strong>{item.username || 'Unknown'}</strong>
                          </div>
                          <div>
                            <span>Source IP</span>
                            <strong>{item.source_ip || 'Unknown'}</strong>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="empty-state">
                No evidence events were returned for this investigation.
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Recommended actions</h3>
                <p>Suggested next steps from the report</p>
              </div>
            </div>

            {recommendationItems.length ? (
              <ol className="recommendation-list">
                {recommendationItems.map((item, index) => (
                  <li key={index}>
                    {typeof item === 'string' ? item : formatValue(item)}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-state">No recommendations were returned.</p>
            )}
          </section>

          {trace.length > 0 && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Agent execution trace</h3>
                  <p>Tool activity reported by the agent</p>
                </div>
                <span className="count-badge">{trace.length} steps</span>
              </div>

              <pre className="json-view">{JSON.stringify(trace, null, 2)}</pre>
            </section>
          )}

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Raw API response</h3>
                <p>Exact JSON received from FastAPI</p>
              </div>

              <button
                className="secondary-button"
                type="button"
                onClick={handleCopyJson}
              >
                Copy JSON
              </button>
            </div>

            <pre className="json-view">{JSON.stringify(report, null, 2)}</pre>

            {lastChecked && (
              <p className="helper-text">Response received at {lastChecked}</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
