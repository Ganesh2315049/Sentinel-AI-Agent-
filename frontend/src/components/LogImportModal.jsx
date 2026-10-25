import { useState, useRef } from 'react'
import { importLogs } from '../api'

const SAMPLE_LOGS_PRESET = [
  {
    event_id: 'EVT-101',
    event_type: 'failed_login',
    username: 'employee01',
    source_ip: '192.0.2.15',
    timestamp: '2026-10-12T10:30:00Z',
  },
  {
    event_id: 'EVT-102',
    event_type: 'successful_login',
    username: 'employee01',
    source_ip: '192.0.2.15',
    timestamp: '2026-10-12T10:32:00Z',
  },
]

export default function LogImportModal({ isOpen, onClose, onImportSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  function handleFileSelect(e) {
    setError('')
    setResult(null)
    const file = e.target.files?.[0]
    if (!file) return

    const suffix = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (suffix !== '.json' && suffix !== '.csv') {
      setError('Only .json and .csv files are supported by Sentinel AI.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File exceeds the 5 MiB upload limit.')
      return
    }

    setSelectedFile(file)
  }

  function handlePresetSelect() {
    setError('')
    setResult(null)
    const blob = new Blob([JSON.stringify(SAMPLE_LOGS_PRESET, null, 2)], {
      type: 'application/json',
    })
    const file = new File([blob], 'sample-logs.json', {
      type: 'application/json',
    })
    setSelectedFile(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedFile) {
      setError('Please select a JSON or CSV file to import.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await importLogs(selectedFile)
      setResult(data)
      if (onImportSuccess) {
        onImportSuccess(data)
      }
    } catch (err) {
      setError(err.message || 'Failed to import security logs.')
    } finally {
      setLoading(false)
    }
  }

  function resetAndClose() {
    setSelectedFile(null)
    setError('')
    setResult(null)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={resetAndClose}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">TELEMETRY INGESTION</p>
            <h3 id="import-title">Import Security Logs</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={resetAndClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <p className="modal-desc">
            Upload security log events in <strong>JSON</strong> or{' '}
            <strong>CSV</strong> format. Required event fields: <code>event_id</code>,{' '}
            <code>event_type</code>, <code>username</code>, <code>source_ip</code>, and{' '}
            <code>timestamp</code> (ISO-8601). Maximum file size: 5 MiB.
          </p>

          <div className="import-dropzone">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              onChange={handleFileSelect}
              id="file-upload"
              style={{ display: 'none' }}
              disabled={loading}
            />

            <div className="dropzone-content">
              <span className="dropzone-icon">⇪</span>
              {selectedFile ? (
                <div className="selected-file-info">
                  <strong>{selectedFile.name}</strong>
                  <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : (
                <>
                  <p>Drag and drop a log file here, or choose from disk</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    Select File (.json or .csv)
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="preset-row">
            <span>Need sample data?</span>
            <button
              type="button"
              className="link-button"
              onClick={handlePresetSelect}
              disabled={loading}
            >
              Use sample-logs.json template
            </button>
          </div>

          {error && (
            <div className="message error-message" role="alert">
              <strong>Import failed</strong>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="message success-message" role="status">
              <strong>{result.message}</strong>
              <div className="import-stats-summary">
                <div>Source: <strong>{result.source_file}</strong></div>
                <div>Events in file: <strong>{result.events_in_file}</strong></div>
                <div>Newly inserted: <strong>{result.events_inserted}</strong></div>
                <div>Duplicates skipped: <strong>{result.events_skipped_as_duplicates}</strong></div>
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={resetAndClose}
              disabled={loading}
            >
              {result ? 'Done' : 'Cancel'}
            </button>
            {!result && (
              <button
                type="submit"
                className="primary-button"
                disabled={loading || !selectedFile}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> Ingesting…
                  </>
                ) : (
                  'Import logs'
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
