import { useEffect, useMemo, useState } from 'react'
import './App.css'

const emptyClientForm = {
  clientName: '',
  clientEmail: '',
  clientPhone: '',
  concerns: '',
}

const emptyDetails = {
  address: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
}

function App() {
  const isPublicForm = useMemo(() => /^\/public\/[^/]+\/form$/.test(window.location.pathname), [])

  if (isPublicForm) {
    return <PublicFormPage />
  }

  return <PrivateDashboard />
}

function PublicFormPage() {
  const publicId = window.location.pathname.split('/')[2]
  const [form, setForm] = useState(emptyClientForm)
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    fetch(`/api/public/${publicId}/form`)
      .then((response) => response.json())
      .then((payload) => {
        setAddress(payload.address || '')
        setForm({ ...emptyClientForm, ...(payload.clientForm || {}) })
      })
      .catch(() => setStatus('Could not load form.'))
  }, [publicId])

  const onSubmit = async (event) => {
    event.preventDefault()

    const response = await fetch(`/api/public/${publicId}/form`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setStatus(response.ok ? 'Form saved.' : 'Failed to save form.')
  }

  return (
    <main className="app-shell">
      <h1>Client Intake Form</h1>
      <p>Inspection address: {address || 'Not provided yet'}</p>
      <form onSubmit={onSubmit} className="panel form-grid">
        <label>
          Name
          <input value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} />
        </label>
        <label>
          Email
          <input value={form.clientEmail} onChange={(event) => setForm({ ...form, clientEmail: event.target.value })} />
        </label>
        <label>
          Phone
          <input value={form.clientPhone} onChange={(event) => setForm({ ...form, clientPhone: event.target.value })} />
        </label>
        <label>
          Concerns
          <textarea
            rows="4"
            value={form.concerns}
            onChange={(event) => setForm({ ...form, concerns: event.target.value })}
          />
        </label>
        <button type="submit">Save</button>
      </form>
      {status ? <p>{status}</p> : null}
    </main>
  )
}

function PrivateDashboard() {
  const [token, setToken] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [inspections, setInspections] = useState([])
  const [selectedInspection, setSelectedInspection] = useState(null)
  const [detailsDraft, setDetailsDraft] = useState(emptyDetails)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomNotes, setNewRoomNotes] = useState('')
  const [status, setStatus] = useState('')
  const [reportHtml, setReportHtml] = useState('')

  const authorizedFetch = (url, options = {}, authToken = token) =>
    fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Token ${authToken}`,
      },
    })

  const refreshInspections = async (authToken = token) => {
    const response = await authorizedFetch('/api/inspections', {}, authToken)
    if (!response.ok) return

    const payload = await response.json()
    setInspections(payload.inspections)

    if (selectedInspection) {
      const updatedSelected = payload.inspections.find((inspection) => inspection.id === selectedInspection.id)
      if (updatedSelected) {
        setSelectedInspection(updatedSelected)
        setDetailsDraft(updatedSelected.details)
      }
    }
  }

  const login = async (event) => {
    event.preventDefault()
    setLoginError('')

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!response.ok) {
      setLoginError('Invalid credentials')
      return
    }

    const payload = await response.json()
    setToken(payload.token)
    await refreshInspections(payload.token)
  }

  const createInspection = async () => {
    const response = await authorizedFetch('/api/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    if (!response.ok) return

    const payload = await response.json()
    setSelectedInspection(payload.inspection)
    setDetailsDraft(payload.inspection.details)
    setStatus('Inspection created.')
    await refreshInspections()
  }

  const selectInspection = async (inspectionId) => {
    const response = await authorizedFetch(`/api/inspections/${inspectionId}`)
    if (!response.ok) return

    const payload = await response.json()
    setSelectedInspection(payload.inspection)
    setDetailsDraft(payload.inspection.details)
    setReportHtml('')
  }

  const saveDetails = async (event) => {
    event.preventDefault()
    if (!selectedInspection) return

    const response = await authorizedFetch(`/api/inspections/${selectedInspection.id}/details`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detailsDraft),
    })

    if (!response.ok) return

    const payload = await response.json()
    setSelectedInspection(payload.inspection)
    setStatus('Inspection details saved.')
    await refreshInspections()
  }

  const addRoom = async (event) => {
    event.preventDefault()
    if (!selectedInspection) return

    const response = await authorizedFetch(`/api/inspections/${selectedInspection.id}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoomName, notes: newRoomNotes }),
    })

    if (!response.ok) return

    setNewRoomName('')
    setNewRoomNotes('')
    setStatus('Room added.')
    await selectInspection(selectedInspection.id)
    await refreshInspections()
  }

  const uploadRoomFile = async (roomId, file) => {
    if (!selectedInspection || !file) return

    const formData = new FormData()
    formData.append('file', file)

    const response = await authorizedFetch(`/api/inspections/${selectedInspection.id}/rooms/${roomId}/files`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) return

    setStatus('File uploaded.')
    await selectInspection(selectedInspection.id)
  }

  const generateReport = async () => {
    if (!selectedInspection) return

    const response = await authorizedFetch(`/api/inspections/${selectedInspection.id}/report/html`)
    if (!response.ok) return

    const html = await response.text()
    setReportHtml(html)
  }

  if (!token) {
    return (
      <main className="app-shell">
        <h1>Mold Inspector</h1>
        <form className="panel form-grid" onSubmit={login}>
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit">Log in</button>
        </form>
        {loginError ? <p>{loginError}</p> : null}
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="header-row">
        <h1>Mold Inspections</h1>
        <button type="button" onClick={createInspection}>
          New inspection
        </button>
      </header>

      <section className="layout-grid">
        <aside className="panel">
          <h2>Inspections</h2>
          <ul className="list">
            {inspections.map((inspection) => (
              <li key={inspection.id}>
                <button type="button" onClick={() => selectInspection(inspection.id)}>
                  {inspection.details.address || inspection.id.slice(0, 8)}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="panel">
          {selectedInspection ? (
            <>
              <h2>Inspection details</h2>
              <p>
                Public form link:{' '}
                <a href={`/public/${selectedInspection.publicId}/form`} target="_blank" rel="noreferrer">
                  {window.location.origin}/public/{selectedInspection.publicId}/form
                </a>
              </p>

              <form className="form-grid" onSubmit={saveDetails}>
                <label>
                  Address
                  <input
                    value={detailsDraft.address}
                    onChange={(event) => setDetailsDraft({ ...detailsDraft, address: event.target.value })}
                  />
                </label>
                <label>
                  Contact name
                  <input
                    value={detailsDraft.contactName}
                    onChange={(event) => setDetailsDraft({ ...detailsDraft, contactName: event.target.value })}
                  />
                </label>
                <label>
                  Contact email
                  <input
                    value={detailsDraft.contactEmail}
                    onChange={(event) => setDetailsDraft({ ...detailsDraft, contactEmail: event.target.value })}
                  />
                </label>
                <label>
                  Contact phone
                  <input
                    value={detailsDraft.contactPhone}
                    onChange={(event) => setDetailsDraft({ ...detailsDraft, contactPhone: event.target.value })}
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    rows="3"
                    value={detailsDraft.notes}
                    onChange={(event) => setDetailsDraft({ ...detailsDraft, notes: event.target.value })}
                  />
                </label>
                <button type="submit">Save details</button>
              </form>

              <h3>Client response</h3>
              <p>{selectedInspection.clientForm.concerns || 'No response yet.'}</p>

              <h3>Rooms</h3>
              <form className="form-grid" onSubmit={addRoom}>
                <label>
                  Room name
                  <input value={newRoomName} onChange={(event) => setNewRoomName(event.target.value)} />
                </label>
                <label>
                  Notes
                  <input value={newRoomNotes} onChange={(event) => setNewRoomNotes(event.target.value)} />
                </label>
                <button type="submit">Add room</button>
              </form>
              <ul className="list">
                {selectedInspection.rooms.map((room) => (
                  <li key={room.id} className="room-card">
                    <strong>{room.name}</strong>
                    <p>{room.notes || 'No notes yet.'}</p>
                    <p>{room.files.length} file(s)</p>
                    <input
                      type="file"
                      onChange={(event) => uploadRoomFile(room.id, event.target.files?.[0])}
                    />
                  </li>
                ))}
              </ul>

              <button type="button" onClick={generateReport}>
                Generate HTML report
              </button>
              {reportHtml ? <textarea readOnly rows="12" value={reportHtml} /> : null}
            </>
          ) : (
            <p>Select an inspection to begin.</p>
          )}
        </section>
      </section>

      {status ? <p>{status}</p> : null}
    </main>
  )
}

export default App
