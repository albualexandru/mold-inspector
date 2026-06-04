import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const QUESTION_DEFINITIONS = [
  { key: 'clientName', label: 'Client Name', question: 'Client Name' },
  { key: 'currentAddress', label: 'Current Address', question: 'Current Address' },
  { key: 'contactPhoneNumber', label: 'Contact Phone Number', question: 'Contact Phone Number' },
  { key: 'emailAddress', label: 'Email Address', question: 'Email Address' },
  {
    key: 'propertyAddress',
    label: 'Property Address (where the inspection will be performed)',
    question: 'Property Address (where the inspection will be performed)',
  },
  {
    key: 'activeWaterPenetration',
    label: 'Are you aware of any active water penetration/intrusion in the building? (Yes/No)',
    question: 'Are you aware of any active water penetration/intrusion in the building? (Yes/No)',
  },
  {
    key: 'activeWaterPenetrationDetails',
    label: 'If yes, please explain',
    question: 'If yes, please explain active water penetration/intrusion details',
  },
  {
    key: 'priorMoistureWaterProblems',
    label: 'Have there ever been any prior experiences with moisture or water problems in the building? (Yes/No)',
    question: 'Have there ever been any prior experiences with moisture or water problems in the building? (Yes/No)',
  },
  {
    key: 'priorMoistureWaterProblemsDetails',
    label: 'If yes, please explain',
    question: 'If yes, please explain prior moisture or water problems details',
  },
  {
    key: 'activePlumbingLeaks',
    label: 'Are there any active plumbing leaks? (Yes/No)',
    question: 'Are there any active plumbing leaks? (Yes/No)',
  },
  {
    key: 'activePlumbingLeaksLocation',
    label: 'If yes, please specify location',
    question: 'If yes, please specify location of active plumbing leaks',
  },
  {
    key: 'repairedPlumbingLeaks',
    label: 'Have there been any plumbing leaks that have been repaired? (Yes/No)',
    question: 'Have there been any plumbing leaks that have been repaired? (Yes/No)',
  },
  {
    key: 'repairedPlumbingLeaksDetails',
    label: 'If yes, please specify when and where',
    question: 'If yes, please specify when and where repaired plumbing leaks occurred',
  },
  {
    key: 'mustyOdorAreas',
    label: 'Are there any areas of the building that have a musty odor? (Yes/No)',
    question: 'Are there any areas of the building that have a musty odor? (Yes/No)',
  },
  {
    key: 'mustyOdorAreasWhere',
    label: 'If yes, please specify where',
    question: 'If yes, please specify where there are musty odor areas',
  },
  {
    key: 'apparentMoldGrowth',
    label: 'Are you aware of any apparent mold growth (or mold) in the building? (Yes/No)',
    question: 'Are you aware of any apparent mold growth (or mold) in the building? (Yes/No)',
  },
  {
    key: 'apparentMoldGrowthDescription',
    label: 'If yes, please describe',
    question: 'If yes, please describe apparent mold growth',
  },
  {
    key: 'previouslyInspectedOrTested',
    label: 'Has the property ever been inspected or tested for mold growth (or mold)? (Yes/No)',
    question: 'Has the property ever been inspected or tested for mold growth (or mold)? (Yes/No)',
  },
  {
    key: 'previouslyInspectedOrTestedDetails',
    label: 'If yes, please provide details or a copy of the report',
    question: 'If yes, please provide details or a copy of the report',
  },
  {
    key: 'occupantHealthAffected',
    label:
      'Are any occupants experiencing or have ever experienced health effects from asthma, allergies, breathing problems, or mold exposure? (Yes/No)',
    question:
      'Are any occupants experiencing or have ever experienced health effects from asthma, allergies, breathing problems, or mold exposure? (Yes/No)',
  },
  {
    key: 'occupantsUnderPhysicianCare',
    label: 'Are any occupants under a physician’s care for significant health effects attributed to mold exposure? (Yes/No)',
    question: 'Are any occupants under a physician’s care for significant health effects attributed to mold exposure? (Yes/No)',
  },
  {
    key: 'moldLitigation',
    label: 'Is there any litigation in progress or being considered in relation to mold in the building? (Yes/No)',
    question: 'Is there any litigation in progress or being considered in relation to mold in the building? (Yes/No)',
  },
]

const emptyQuestionnaire = QUESTION_DEFINITIONS.reduce((accumulator, definition) => {
  accumulator[definition.key] = ''
  return accumulator
}, {})

const emptyDetails = {
  address: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
}

const normalizeAnswer = (value) => {
  if (value === undefined || value === null) return ''
  return String(value)
}

const readQuestionnaireAnswer = (questionnaire, definition) => {
  if (!questionnaire || typeof questionnaire !== 'object') return ''
  if (Object.hasOwn(questionnaire, definition.key)) return normalizeAnswer(questionnaire[definition.key])
  if (Object.hasOwn(questionnaire, definition.question)) return normalizeAnswer(questionnaire[definition.question])
  return ''
}

const mapQuestionnaireToForm = (questionnaire) =>
  QUESTION_DEFINITIONS.reduce(
    (accumulator, definition) => {
      accumulator[definition.key] = readQuestionnaireAnswer(questionnaire, definition)
      return accumulator
    },
    { ...emptyQuestionnaire },
  )

const mapFormToQuestionnaire = (form) =>
  QUESTION_DEFINITIONS.reduce((accumulator, definition) => {
    accumulator[definition.question] = normalizeAnswer(form[definition.key])
    return accumulator
  }, {})

const questionnaireToEntries = (questionnaire) =>
  QUESTION_DEFINITIONS.map((definition) => ({
    key: definition.key,
    question: definition.question,
    answer: readQuestionnaireAnswer(questionnaire, definition),
  }))

function App() {
  const isPublicForm = useMemo(() => /^\/public\/[^/]+\/form$/.test(window.location.pathname), [])

  if (isPublicForm) {
    return <PublicFormPage />
  }

  return <PrivateDashboard />
}

function PublicFormPage() {
  const publicId = window.location.pathname.split('/')[2]
  const [form, setForm] = useState(emptyQuestionnaire)
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState('')
  const [formLoaded, setFormLoaded] = useState(false)
  const lastSavedFormRef = useRef(JSON.stringify(emptyQuestionnaire))

  const saveForm = useCallback(
    async (nextForm, options = {}) => {
      const { showSuccess = false } = options
      setStatus(showSuccess ? 'Saving form...' : 'Auto-saving form...')

      const response = await fetch(`/api/public/${publicId}/form`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionnaire: mapFormToQuestionnaire(nextForm) }),
      })

      if (!response.ok) {
        setStatus('Failed to save form.')
        return false
      }

      lastSavedFormRef.current = JSON.stringify(nextForm)
      setStatus(showSuccess ? 'Form saved.' : 'Form auto-saved.')
      return true
    },
    [publicId],
  )

  useEffect(() => {
    fetch(`/api/public/${publicId}/form`)
      .then((response) => response.json())
      .then((payload) => {
        const mappedForm = mapQuestionnaireToForm((payload.clientForm || {}).questionnaire || {})
        setAddress(payload.address || '')
        setForm(mappedForm)
        lastSavedFormRef.current = JSON.stringify(mappedForm)
        setFormLoaded(true)
      })
      .catch(() => setStatus('Could not load form.'))
  }, [publicId])

  useEffect(() => {
    if (!formLoaded) return

    const serialized = JSON.stringify(form)
    if (serialized === lastSavedFormRef.current) return

    const timer = setTimeout(() => {
      void saveForm(form)
    }, 700)

    return () => clearTimeout(timer)
  }, [form, formLoaded, saveForm])

  const updateField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }))

  const onSubmit = async (event) => {
    event.preventDefault()
    await saveForm(form, { showSuccess: true })
  }

  return (
    <main className="app-shell">
      <h1>Pre-Inspection Mold Questionnaire</h1>
      <p>Inspection address: {address || 'Not provided yet'}</p>
      <form onSubmit={onSubmit} className="panel form-grid">
        <h2>Client and Property Information</h2>
        <label>
          Client Name
          <input value={form.clientName} onChange={(event) => updateField('clientName', event.target.value)} />
        </label>
        <label>
          Current Address
          <input value={form.currentAddress} onChange={(event) => updateField('currentAddress', event.target.value)} />
        </label>
        <label>
          Contact Phone Number
          <input
            value={form.contactPhoneNumber}
            onChange={(event) => updateField('contactPhoneNumber', event.target.value)}
          />
        </label>
        <label>
          Email Address
          <input value={form.emailAddress} onChange={(event) => updateField('emailAddress', event.target.value)} />
        </label>
        <label>
          Property Address (where the inspection will be performed)
          <input value={form.propertyAddress} onChange={(event) => updateField('propertyAddress', event.target.value)} />
        </label>

        <h2>Building History and Current Conditions</h2>
        <label>
          Are you aware of any active water penetration/intrusion in the building? (Yes/No)
          <input
            value={form.activeWaterPenetration}
            onChange={(event) => updateField('activeWaterPenetration', event.target.value)}
          />
        </label>
        <label>
          If yes, please explain
          <textarea
            rows="2"
            value={form.activeWaterPenetrationDetails}
            onChange={(event) => updateField('activeWaterPenetrationDetails', event.target.value)}
          />
        </label>
        <label>
          Have there ever been any prior experiences with moisture or water problems in the building? (Yes/No)
          <input
            value={form.priorMoistureWaterProblems}
            onChange={(event) => updateField('priorMoistureWaterProblems', event.target.value)}
          />
        </label>
        <label>
          If yes, please explain
          <textarea
            rows="2"
            value={form.priorMoistureWaterProblemsDetails}
            onChange={(event) => updateField('priorMoistureWaterProblemsDetails', event.target.value)}
          />
        </label>
        <label>
          Are there any active plumbing leaks? (Yes/No)
          <input
            value={form.activePlumbingLeaks}
            onChange={(event) => updateField('activePlumbingLeaks', event.target.value)}
          />
        </label>
        <label>
          If yes, please specify location
          <textarea
            rows="2"
            value={form.activePlumbingLeaksLocation}
            onChange={(event) => updateField('activePlumbingLeaksLocation', event.target.value)}
          />
        </label>
        <label>
          Have there been any plumbing leaks that have been repaired? (Yes/No)
          <input
            value={form.repairedPlumbingLeaks}
            onChange={(event) => updateField('repairedPlumbingLeaks', event.target.value)}
          />
        </label>
        <label>
          If yes, please specify when and where
          <textarea
            rows="2"
            value={form.repairedPlumbingLeaksDetails}
            onChange={(event) => updateField('repairedPlumbingLeaksDetails', event.target.value)}
          />
        </label>
        <label>
          Are there any areas of the building that have a musty odor? (Yes/No)
          <input value={form.mustyOdorAreas} onChange={(event) => updateField('mustyOdorAreas', event.target.value)} />
        </label>
        <label>
          If yes, please specify where
          <textarea
            rows="2"
            value={form.mustyOdorAreasWhere}
            onChange={(event) => updateField('mustyOdorAreasWhere', event.target.value)}
          />
        </label>
        <label>
          Are you aware of any apparent mold growth (or mold) in the building? (Yes/No)
          <input
            value={form.apparentMoldGrowth}
            onChange={(event) => updateField('apparentMoldGrowth', event.target.value)}
          />
        </label>
        <label>
          If yes, please describe
          <textarea
            rows="2"
            value={form.apparentMoldGrowthDescription}
            onChange={(event) => updateField('apparentMoldGrowthDescription', event.target.value)}
          />
        </label>
        <label>
          Has the property ever been inspected or tested for mold growth (or mold)? (Yes/No)
          <input
            value={form.previouslyInspectedOrTested}
            onChange={(event) => updateField('previouslyInspectedOrTested', event.target.value)}
          />
        </label>
        <label>
          If yes, please provide details or a copy of the report
          <textarea
            rows="2"
            value={form.previouslyInspectedOrTestedDetails}
            onChange={(event) => updateField('previouslyInspectedOrTestedDetails', event.target.value)}
          />
        </label>

        <h2>Occupant Health and Legal Considerations</h2>
        <label>
          Are any occupants experiencing or have ever experienced health effects from asthma, allergies, breathing problems, or mold exposure? (Yes/No)
          <input
            value={form.occupantHealthAffected}
            onChange={(event) => updateField('occupantHealthAffected', event.target.value)}
          />
        </label>
        <label>
          Are any occupants under a physician’s care for significant health effects attributed to mold exposure? (Yes/No)
          <input
            value={form.occupantsUnderPhysicianCare}
            onChange={(event) => updateField('occupantsUnderPhysicianCare', event.target.value)}
          />
        </label>
        <label>
          Is there any litigation in progress or being considered in relation to mold in the building? (Yes/No)
          <input value={form.moldLitigation} onChange={(event) => updateField('moldLitigation', event.target.value)} />
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
  const [roomNotesDrafts, setRoomNotesDrafts] = useState({})
  const [status, setStatus] = useState('')
  const [reportHtml, setReportHtml] = useState('')

  const lastSavedDetailsRef = useRef(JSON.stringify(emptyDetails))

  const authorizedFetch = useCallback(
    (url, options = {}, authToken = token) =>
      fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Token ${authToken}`,
        },
      }),
    [token],
  )

  const syncSelectedInspection = useCallback((inspection) => {
    setSelectedInspection(inspection)
    setDetailsDraft(inspection.details)
    lastSavedDetailsRef.current = JSON.stringify(inspection.details || emptyDetails)
    setRoomNotesDrafts(
      Object.fromEntries((inspection.rooms || []).map((room) => [room.id, room.notes || '']))
    )
  }, [])

  const refreshInspections = useCallback(
    async (authToken = token) => {
      const response = await authorizedFetch('/api/inspections', {}, authToken)
      if (!response.ok) return

      const payload = await response.json()
      setInspections(payload.inspections)

      if (selectedInspection) {
        const updatedSelected = payload.inspections.find((inspection) => inspection.id === selectedInspection.id)
        if (updatedSelected) {
          syncSelectedInspection(updatedSelected)
        }
      }
    },
    [authorizedFetch, selectedInspection, syncSelectedInspection, token],
  )

  const saveDetailsDraft = useCallback(
    async (nextDetails, options = {}) => {
      const { showSuccess = false } = options
      if (!selectedInspection) return false

      const response = await authorizedFetch(`/api/inspections/${selectedInspection.id}/details`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextDetails),
      })

      if (!response.ok) {
        setStatus('Failed to save inspection details.')
        return false
      }

      const payload = await response.json()
      syncSelectedInspection(payload.inspection)
      setStatus(showSuccess ? 'Inspection details saved.' : 'Inspection details auto-saved.')
      await refreshInspections()
      return true
    },
    [authorizedFetch, refreshInspections, selectedInspection, syncSelectedInspection],
  )

  useEffect(() => {
    if (!selectedInspection) return

    const serialized = JSON.stringify(detailsDraft)
    if (serialized === lastSavedDetailsRef.current) return

    const timer = setTimeout(() => {
      void saveDetailsDraft(detailsDraft)
    }, 700)

    return () => clearTimeout(timer)
  }, [detailsDraft, saveDetailsDraft, selectedInspection])

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
    syncSelectedInspection(payload.inspection)
    setStatus('Inspection created.')
    await refreshInspections()
  }

  const selectInspection = useCallback(
    async (inspectionId) => {
      const response = await authorizedFetch(`/api/inspections/${inspectionId}`)
      if (!response.ok) return

      const payload = await response.json()
      syncSelectedInspection(payload.inspection)
      setReportHtml('')
    },
    [authorizedFetch, syncSelectedInspection],
  )

  const saveDetails = async (event) => {
    event.preventDefault()
    await saveDetailsDraft(detailsDraft, { showSuccess: true })
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

  const saveRoomNotes = async (roomId) => {
    if (!selectedInspection) return

    const response = await authorizedFetch(`/api/inspections/${selectedInspection.id}/rooms/${roomId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: roomNotesDrafts[roomId] || '' }),
    })

    if (!response.ok) {
      setStatus('Failed to save room notes.')
      return
    }

    setStatus('Room notes saved.')
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

  const clientResponseEntries = useMemo(() => {
    if (!selectedInspection) return []
    return questionnaireToEntries((selectedInspection.clientForm || {}).questionnaire || {}).filter(
      ({ answer }) => typeof answer === 'string' && answer.trim(),
    )
  }, [selectedInspection])

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
              {clientResponseEntries.length ? (
                <dl className="questionnaire-list">
                  {clientResponseEntries.map((entry) => (
                    <div key={entry.key} className="questionnaire-item">
                      <dt>{entry.question}</dt>
                      <dd>{entry.answer}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>No client responses submitted.</p>
              )}

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
                    <label>
                      Room notes
                      <textarea
                        rows="3"
                        value={roomNotesDrafts[room.id] || ''}
                        onChange={(event) =>
                          setRoomNotesDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [room.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button type="button" onClick={() => saveRoomNotes(room.id)}>
                      Save room notes
                    </button>
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
