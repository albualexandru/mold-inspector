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
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
const MAX_CLIENT_FORM_FILES = 20

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

const readClientFormFiles = (clientForm) => (Array.isArray((clientForm || {}).files) ? clientForm.files : [])

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
  const [uploadedFiles, setUploadedFiles] = useState([])
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
        const clientForm = payload.clientForm || {}
        const mappedForm = mapQuestionnaireToForm((payload.clientForm || {}).questionnaire || {})
        setAddress(payload.address || '')
        setForm(mappedForm)
        setUploadedFiles(readClientFormFiles(clientForm))
        lastSavedFormRef.current = JSON.stringify(mappedForm)
        setFormLoaded(true)
      })
      .catch(() => setStatus('Could not load form.'))
  }, [publicId])

  // Auto-save disabled
  // useEffect(() => {
  //   if (!formLoaded) return
  //   const serialized = JSON.stringify(form)
  //   if (serialized === lastSavedFormRef.current) return
  //   const timer = setTimeout(() => { void saveForm(form) }, 700)
  //   return () => clearTimeout(timer)
  // }, [form, formLoaded, saveForm])

  const updateField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }))

  const onSubmit = async (event) => {
    event.preventDefault()
    await saveForm(form, { showSuccess: true })
  }

  const uploadFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    if (files.some((file) => file.size > MAX_UPLOAD_SIZE_BYTES)) {
      setStatus('Each uploaded image must be 10MB or smaller.')
      event.target.value = ''
      return
    }
    if (uploadedFiles.length + files.length > MAX_CLIENT_FORM_FILES) {
      setStatus(`A maximum of ${MAX_CLIENT_FORM_FILES} images can be uploaded.`)
      event.target.value = ''
      return
    }

    setStatus('Uploading images...')
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    const response = await fetch(`/api/public/${publicId}/form/files`, {
      method: 'POST',
      body: formData,
    })

    event.target.value = ''
    if (!response.ok) {
      setStatus('Failed to upload images.')
      return
    }

    const payload = await response.json()
    setUploadedFiles(readClientFormFiles(payload.clientForm))
    setStatus('Images uploaded.')
  }

  return (
    <div className="app-shell">
      <header className="public-header">
        <span className="public-header-brand">🔍 Mold Inspector</span>
      </header>
      <div className="public-form-content">
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Pre-Inspection Mold Questionnaire</h1>
        <p style={{ color: 'var(--c-muted)', fontSize: 14, margin: '0 0 20px' }}>
          Inspection address: <strong>{address || 'Not provided yet'}</strong>
        </p>
        <div className="panel">
          <form onSubmit={onSubmit} className="form-grid">
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
        <label>
          Upload images (max 10MB each)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={uploadFiles}
            aria-label="Upload questionnaire images, maximum 10MB each"
          />
        </label>
        {uploadedFiles.length > 0 && (
          <div className="file-list">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="file-item">
                <img
                  src={`data:${file.mimeType};base64,${file.contentBase64}`}
                  alt={file.name}
                  className="file-preview-image"
                />
                <span className="file-name">{file.name}</span>
              </div>
            ))}
          </div>
        )}
        <button type="submit">Save</button>
          </form>
        </div>
        {status ? <div className="status-toast">{status}</div> : null}
      </div>
    </div>
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
    },
    [authorizedFetch, token],
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

      lastSavedDetailsRef.current = JSON.stringify(nextDetails)
      setStatus(showSuccess ? 'Inspection details saved.' : 'Inspection details auto-saved.')
      // Update local state directly — no server read needed.
      setSelectedInspection((prev) => (prev ? { ...prev, details: nextDetails } : prev))
      setInspections((prev) =>
        prev.map((i) => (i.id === selectedInspection.id ? { ...i, details: nextDetails } : i)),
      )
      return true
    },
    [authorizedFetch, selectedInspection],
  )

  // Auto-save disabled
  // useEffect(() => {
  //   if (!selectedInspection) return
  //   const serialized = JSON.stringify(detailsDraft)
  //   if (serialized === lastSavedDetailsRef.current) return
  //   const timer = setTimeout(() => { void saveDetailsDraft(detailsDraft) }, 700)
  //   return () => clearTimeout(timer)
  // }, [detailsDraft, saveDetailsDraft, selectedInspection])

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
    setInspections((prev) => [payload.inspection, ...prev])
  }

  const selectInspection = useCallback(
    async (inspectionId) => {
      const response = await authorizedFetch(`/api/inspections/${inspectionId}`)
      if (!response.ok) return

      const payload = await response.json()
      syncSelectedInspection(payload.inspection)
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

    const { room: newRoom } = await response.json()
    setNewRoomName('')
    setNewRoomNotes('')
    setRoomNotesDrafts((prev) => ({ ...prev, [newRoom.id]: newRoom.notes || '' }))
    setSelectedInspection((prev) => (prev ? { ...prev, rooms: [...prev.rooms, newRoom] } : prev))
    setInspections((prev) =>
      prev.map((i) =>
        i.id === selectedInspection.id ? { ...i, rooms: [...i.rooms, newRoom] } : i,
      ),
    )
    setStatus('Room added.')
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

    const notes = roomNotesDrafts[roomId] || ''
    setSelectedInspection((prev) =>
      prev ? { ...prev, rooms: prev.rooms.map((r) => (r.id === roomId ? { ...r, notes } : r)) } : prev,
    )
    setInspections((prev) =>
      prev.map((i) =>
        i.id === selectedInspection.id
          ? { ...i, rooms: i.rooms.map((r) => (r.id === roomId ? { ...r, notes } : r)) }
          : i,
      ),
    )
    setStatus('Room notes saved.')
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

    const { file: newFile } = await response.json()
    setSelectedInspection((prev) =>
      prev
        ? {
            ...prev,
            rooms: prev.rooms.map((r) =>
              r.id === roomId ? { ...r, files: [...r.files, newFile] } : r,
            ),
          }
        : prev,
    )
    setStatus('File uploaded.')
  }

  const deleteInspection = async (inspectionId) => {
    const response = await authorizedFetch(`/api/inspections/${inspectionId}`, {
      method: 'DELETE',
    })

    if (!response.ok) return

    if (selectedInspection && selectedInspection.id === inspectionId) {
      setSelectedInspection(null)
      setDetailsDraft(emptyDetails)
    }
    setStatus('Inspection deleted.')
    setInspections((prev) => prev.filter((i) => i.id !== inspectionId))
  }

  const deleteRoom = async (roomId) => {
    if (!selectedInspection) return

    const response = await authorizedFetch(`/api/inspections/${selectedInspection.id}/rooms/${roomId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      setStatus('Failed to delete room.')
      return
    }

    setStatus('Room deleted.')
    setSelectedInspection((prev) =>
      prev ? { ...prev, rooms: prev.rooms.filter((r) => r.id !== roomId) } : prev,
    )
    setInspections((prev) =>
      prev.map((i) =>
        i.id === selectedInspection.id
          ? { ...i, rooms: i.rooms.filter((r) => r.id !== roomId) }
          : i,
      ),
    )
  }

  const clientResponseEntries = useMemo(() => {
    if (!selectedInspection) return []
    return questionnaireToEntries((selectedInspection.clientForm || {}).questionnaire || {}).filter(
      ({ answer }) => typeof answer === 'string' && answer.trim(),
    )
  }, [selectedInspection])
  const clientUploadedImages = useMemo(
    () => readClientFormFiles((selectedInspection || {}).clientForm).filter((file) => file.mimeType?.startsWith('image/')),
    [selectedInspection],
  )
  const openHtmlReport = () => {
    if (!selectedInspection) return
    window.open(`/public/${selectedInspection.publicId}/report`, '_blank', 'noopener,noreferrer')
  }

  if (!token) {
    return (
      <div className="login-container">
        <div className="panel login-card">
          <div className="login-header">
            <div className="login-logo">🔍</div>
            <h1 className="login-title">Mold Inspector</h1>
            <p className="login-subtitle">Sign in to manage inspections</p>
          </div>
          <form className="form-grid" onSubmit={login}>
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button type="submit">Sign in</button>
          </form>
          {loginError ? <p className="error-text" style={{ marginTop: 10 }}>{loginError}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <span className="app-topbar-brand">Mold Inspector</span>
        <button type="button" onClick={createInspection}>
          + New Inspection
        </button>
      </header>

      <main className="app-content">
        <div className="layout-grid">
          <aside className="panel sidebar">
            <h2 className="section-title">Inspections</h2>
            <ul className="list">
              {inspections.length === 0 && (
                <li style={{ color: 'var(--c-muted)', fontSize: 13, padding: '4px 2px' }}>No inspections yet.</li>
              )}
              {inspections.map((inspection) => (
                <li key={inspection.id} className="inspection-item">
                  <button
                    type="button"
                    className={`inspection-item-btn${selectedInspection?.id === inspection.id ? ' active' : ''}`}
                    onClick={() => selectInspection(inspection.id)}
                  >
                    {inspection.details.address || `#${inspection.id.slice(0, 8)}`}
                  </button>
                  <button
                    type="button"
                    className="btn-danger btn-sm btn-icon"
                    onClick={() => deleteInspection(inspection.id)}
                    title="Delete inspection"
                    aria-label="Delete inspection"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="panel">
            {selectedInspection ? (
              <>
                <h2 className="section-title">Inspection Details</h2>

                <div className="info-box" style={{ marginBottom: 16 }}>
                  <strong>Public form link: </strong>
                  <a href={`/public/${selectedInspection.publicId}/form`} target="_blank" rel="noreferrer">
                    {window.location.origin}/public/{selectedInspection.publicId}/form
                  </a>
                </div>

                <form className="form-grid" onSubmit={saveDetails}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                        type="email"
                        value={detailsDraft.contactEmail}
                        onChange={(event) => setDetailsDraft({ ...detailsDraft, contactEmail: event.target.value })}
                      />
                    </label>
                    <label>
                      Contact phone
                      <input
                        type="tel"
                        value={detailsDraft.contactPhone}
                        onChange={(event) => setDetailsDraft({ ...detailsDraft, contactPhone: event.target.value })}
                      />
                    </label>
                  </div>
                  <label>
                    Notes
                    <textarea
                      rows="3"
                      value={detailsDraft.notes}
                      onChange={(event) => setDetailsDraft({ ...detailsDraft, notes: event.target.value })}
                    />
                  </label>
                  <div>
                    <button type="submit">Save details</button>
                  </div>
                </form>

                <hr className="divider" />

                <h3 className="section-title">Client Responses</h3>
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
                  <p style={{ color: 'var(--c-muted)', fontSize: 14 }}>No client responses submitted.</p>
                )}

                <p className="subsection-title">Client uploaded images</p>
                {clientUploadedImages.length > 0 ? (
                  <div className="file-list">
                    {clientUploadedImages.map((file) => (
                      <div key={file.id} className="file-item">
                        <img
                          src={`data:${file.mimeType};base64,${file.contentBase64}`}
                          alt={file.name}
                          className="file-preview-image"
                        />
                        <span className="file-name">{file.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--c-muted)', fontSize: 14 }}>No client images uploaded.</p>
                )}

                <hr className="divider" />

                <h3 className="section-title">Rooms</h3>
                <form className="form-grid" onSubmit={addRoom} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label>
                      Room name
                      <input value={newRoomName} onChange={(event) => setNewRoomName(event.target.value)} placeholder="e.g. Basement" />
                    </label>
                    <label>
                      Notes
                      <input value={newRoomNotes} onChange={(event) => setNewRoomNotes(event.target.value)} placeholder="Optional" />
                    </label>
                  </div>
                  <div>
                    <button type="submit">Add room</button>
                  </div>
                </form>
                <ul className="list">
                  {selectedInspection.rooms.map((room) => (
                    <li key={room.id} className="room-card">
                      <div className="room-card-header">
                        <span className="room-name">{room.name}</span>
                        <button
                          type="button"
                          className="btn-danger btn-sm btn-icon"
                          onClick={() => deleteRoom(room.id)}
                          title="Delete room"
                          aria-label="Delete room"
                        >
                          ✕
                        </button>
                      </div>
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
                      <div>
                        <button type="button" onClick={() => saveRoomNotes(room.id)}>
                          Save room notes
                        </button>
                      </div>
                      {room.files.length > 0 && (
                        <div className="file-list">
                          {room.files.map((file) => (
                            <div key={file.id} className="file-item">
                              {file.mimeType && file.mimeType.startsWith('image/') ? (
                                <img
                                  src={`data:${file.mimeType};base64,${file.contentBase64}`}
                                  alt={file.name}
                                  className="file-preview-image"
                                />
                              ) : (
                                <a
                                  href={`data:${file.mimeType || 'application/octet-stream'};base64,${file.contentBase64}`}
                                  download={file.name}
                                  className="file-download-link"
                                >
                                  📄 {file.name}
                                </a>
                              )}
                              <span className="file-name">{file.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <label style={{ fontSize: 13, color: 'var(--c-muted)' }}>
                        Add photo / file
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(event) => uploadRoomFile(room.id, event.target.files?.[0])}
                        />
                      </label>
                    </li>
                  ))}
                </ul>

                <hr className="divider" />

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="report-link" onClick={openHtmlReport}>
                    📄 View Full Report
                  </button>
                  <a
                    href={`/public/${selectedInspection.publicId}/report`}
                    target="_blank"
                    rel="noreferrer"
                    className="report-link btn-secondary"
                    style={{ color: 'var(--c-primary)', background: 'var(--c-primary-light)', border: 'none' }}
                  >
                    🔗 Copy Report Link
                  </a>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p>Select an inspection from the sidebar to get started.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {status ? <div className="status-toast">{status}</div> : null}
    </div>
  )
}

export default App
