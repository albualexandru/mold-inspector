const { randomUUID } = require('node:crypto')
const path = require('node:path')
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const { questionnaireToEntries } = require('./questionnaire')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const requiredEnv = (name, fallback) => process.env[name] || fallback
const MAX_CLIENT_FORM_FILES = 20
const questionnaireUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return callback(null, true)
    return callback(new Error('Only image uploads are allowed'))
  },
})

const buildFileHtml = (file) => {
  const name = escapeHtml(file.name || '')
  const mimeType = file.mimeType || 'application/octet-stream'
  const url = `/api/files/${file.id}`

  if (mimeType.startsWith('image/')) {
    return `<figure class="file-item">
      <img src="${url}" alt="${name}" />
      <figcaption>${name}</figcaption>
    </figure>`
  }

  return `<div class="file-item">
    <a href="${url}" download="${name}">${name}</a>
  </div>`
}

function createApp(options = {}) {
  if (!options.store) throw new Error('A store must be provided to createApp. In-memory storage is no longer supported.')
  const app = express()
  const store = options.store
  const sessions = new Map()

  const authUsername = requiredEnv('APP_USERNAME', 'admin')
  const authPassword = requiredEnv('APP_PASSWORD', 'password')

  app.use(cors())
  app.use(express.json({ limit: '2mb' }))

  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  })

  const pageLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })

  const SESSION_TTL_MS = 24 * 60 * 60 * 1000

  const requireAuth = (req, res, next) => {
    const header = req.get('authorization') || ''
    const [scheme, token] = header.split(' ')

    if ((scheme !== 'Bearer' && scheme !== 'Token') || !token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const session = sessions.get(token)
    if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(token)
      return res.status(401).json({ error: 'Unauthorized' })
    }

    return next()
  }

  app.post('/api/auth/login', authLimiter, (req, res) => {
    const { username, password } = req.body || {}

    if (username !== authUsername || password !== authPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = randomUUID()
    sessions.set(token, { createdAt: Date.now() })

    return res.json({ token })
  })

  app.get('/public/:publicId/report', pageLimiter, async (req, res) => {
    const inspection = await store.getInspectionByPublicId(req.params.publicId)
    if (!inspection) return res.status(404).send('<h1>Report not found</h1>')

    const roomSections = inspection.rooms
      .map((room) => {
        const files = Array.isArray(room.files) ? room.files : []
        const fileBlock = files.length
          ? `<div class="file-grid">${files.map((file) => buildFileHtml(file)).join('')}</div>`
          : '<p class="empty-note">No room files uploaded.</p>'

        return `<div class="room-card">
          <h3 class="room-title">${escapeHtml(room.name)}</h3>
          <table class="info-table">
            <tr><th>Location</th><td>${escapeHtml(room.location) || '<em>—</em>'}</td></tr>
            <tr><th>Notes</th><td>${escapeHtml(room.notes) || '<em>—</em>'}</td></tr>
            <tr><th>Findings</th><td>${escapeHtml(room.findings) || '<em>—</em>'}</td></tr>
          </table>
          <h4 class="subsection-heading">Room Photos</h4>
          ${fileBlock}
        </div>`
      })
      .join('')

    const questionnaireEntries = questionnaireToEntries(inspection.clientForm.questionnaire || {}).filter(
      ({ answer }) => typeof answer === 'string' && answer.trim(),
    )
    const questionnaireBlock = questionnaireEntries.length
      ? `<dl class="questionnaire-list">${questionnaireEntries
          .map(
            ({ question, answer }) =>
              `<div class="q-item"><dt>${escapeHtml(question)}</dt><dd>${escapeHtml(answer)}</dd></div>`,
          )
          .join('')}</dl>`
      : '<p class="empty-note">No client responses submitted.</p>'

    const clientFormFiles = Array.isArray((inspection.clientForm || {}).files) ? inspection.clientForm.files : []
    const clientFilesBlock = clientFormFiles.length
      ? `<div class="file-grid">${clientFormFiles.map((file) => buildFileHtml(file)).join('')}</div>`
      : '<p class="empty-note">No client images uploaded.</p>'

    const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mold Inspection Report — ${escapeHtml(inspection.details.address || 'No address')}</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; line-height: 1.6; -webkit-font-smoothing: antialiased; }
      .page { max-width: 860px; margin: 0 auto; padding: 32px 24px 64px; }
      .report-header { background: #1e40af; color: #fff; border-radius: 12px; padding: 28px 32px; margin-bottom: 32px; }
      .report-header h1 { margin: 0 0 6px; font-size: 26px; font-weight: 800; letter-spacing: -0.3px; }
      .report-meta { font-size: 13px; opacity: 0.8; }
      .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgb(0 0 0 / .06); }
      .card h2 { margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #1e40af; border-bottom: 2px solid #dbeafe; padding-bottom: 10px; }
      .info-table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px; }
      .info-table th { text-align: left; width: 160px; padding: 7px 12px 7px 0; font-weight: 600; color: #64748b; vertical-align: top; }
      .info-table td { padding: 7px 0; color: #0f172a; }
      .room-card { background: #fafafa; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 14px; }
      .room-title { margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #1e40af; }
      .subsection-heading { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 14px 0 8px; }
      .questionnaire-list { margin: 0; display: grid; gap: 10px; }
      .q-item { border-left: 3px solid #2563eb; padding: 8px 12px; background: #f8fafc; border-radius: 0 6px 6px 0; }
      .q-item dt { font-weight: 600; font-size: 13px; color: #475569; }
      .q-item dd { margin: 3px 0 0; font-size: 14px; }
      .file-grid { display: flex; flex-wrap: wrap; gap: 12px; }
      .file-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
      .file-item img { max-width: 200px; max-height: 150px; border-radius: 6px; border: 1px solid #e2e8f0; object-fit: cover; }
      .file-item figcaption { font-size: 11px; color: #64748b; word-break: break-word; text-align: center; max-width: 200px; }
      .file-item a { display: inline-block; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; text-decoration: none; color: #2563eb; font-size: 13px; background: #fff; }
      .empty-note { color: #94a3b8; font-style: italic; font-size: 14px; margin: 0; }
      .rooms-section h2 { margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #1e40af; }
      @media print { body { background: #fff; } .card, .room-card { box-shadow: none; } }
      @media (max-width: 600px) { .info-table th { width: 120px; } .report-header { padding: 20px; } }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="report-header">
        <h1>Mold Inspection Report</h1>
        <div class="report-meta">Generated ${escapeHtml(generatedAt)}</div>
      </div>

      <div class="card">
        <h2>Inspection Details</h2>
        <table class="info-table">
          <tr><th>Address</th><td>${escapeHtml(inspection.details.address) || '<em>—</em>'}</td></tr>
          <tr><th>Contact Name</th><td>${escapeHtml(inspection.details.contactName) || '<em>—</em>'}</td></tr>
          <tr><th>Contact Email</th><td>${escapeHtml(inspection.details.contactEmail) || '<em>—</em>'}</td></tr>
          <tr><th>Contact Phone</th><td>${escapeHtml(inspection.details.contactPhone) || '<em>—</em>'}</td></tr>
          <tr><th>Notes</th><td>${escapeHtml(inspection.details.notes) || '<em>—</em>'}</td></tr>
        </table>
      </div>

      <div class="card">
        <h2>Client Intake Questionnaire</h2>
        ${questionnaireBlock}
      </div>

      <div class="card">
        <h2>Client Uploaded Images</h2>
        ${clientFilesBlock}
      </div>

      <div class="card rooms-section">
        <h2>Rooms</h2>
        ${roomSections || '<p class="empty-note">No rooms added.</p>'}
      </div>
    </div>
  </body>
</html>`

    res.type('html').send(html)
  })

  app.delete('/api/public/:publicId/form/files/:fileId', async (req, res) => {
    const inspection = await store.getInspectionByPublicId(req.params.publicId)
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })
    // Verify this file belongs to this inspection's client form
    const owned = inspection.clientForm.files.some((f) => f.id === req.params.fileId)
    if (!owned) return res.status(404).json({ error: 'File not found' })
    const deleted = await store.deleteFile(req.params.fileId)
    if (!deleted) return res.status(404).json({ error: 'File not found' })
    return res.status(204).end()
  })

  app.get('/api/public/:publicId/form', async (req, res) => {
    const inspection = await store.getInspectionByPublicId(req.params.publicId)
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    return res.json({
      inspectionId: inspection.id,
      publicId: inspection.publicId,
      address: inspection.details.address,
      clientForm: inspection.clientForm,
    })
  })

  app.put('/api/public/:publicId/form', async (req, res) => {
    const inspection = await store.updateClientFormByPublicId(req.params.publicId, req.body || {})
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    return res.json({ clientForm: inspection.clientForm })
  })

  app.post(
    '/api/public/:publicId/form/files',
    questionnaireUpload.array('files', MAX_CLIENT_FORM_FILES),
    async (req, res) => {
      const files = Array.isArray(req.files) ? req.files : []
      if (!files.length) return res.status(400).json({ error: 'No files were uploaded' })

      const inspection = await store.addClientFormFilesByPublicId(req.params.publicId, files)
      if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

      return res.status(201).json({ clientForm: inspection.clientForm })
    },
  )

  app.get('/api/files/:fileId', pageLimiter, async (req, res) => {
    const file = await store.getFile(req.params.fileId)
    if (!file) return res.status(404).json({ error: 'File not found' })

    const buffer = Buffer.from(file.contentBase64, 'base64')
    const disposition = (file.mimeType || '').startsWith('image/') ? 'inline' : 'attachment'
    res.set('Content-Type', file.mimeType || 'application/octet-stream')
    res.set('Content-Disposition', `${disposition}; filename="${file.name}"`)
    res.set('Content-Length', buffer.length)
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    return res.send(buffer)
  })

  app.delete('/api/files/:fileId', requireAuth, async (req, res) => {
    const deleted = await store.deleteFile(req.params.fileId)
    if (!deleted) return res.status(404).json({ error: 'File not found' })
    return res.status(204).end()
  })

  app.use('/api/inspections', requireAuth)

  app.get('/api/inspections', async (req, res) => {
    const inspections = await store.listInspections()
    res.json({ inspections })
  })

  app.post('/api/inspections', async (req, res) => {
    const inspection = await store.createInspection(req.body || {})
    res.status(201).json({ inspection })
  })

  app.get('/api/inspections/:inspectionId', async (req, res) => {
    const inspection = await store.getInspection(req.params.inspectionId)
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    return res.json({ inspection })
  })

  app.delete('/api/inspections/:inspectionId', async (req, res) => {
    const deleted = await store.deleteInspection(req.params.inspectionId)
    if (!deleted) return res.status(404).json({ error: 'Inspection not found' })

    return res.status(204).end()
  })

  app.put('/api/inspections/:inspectionId/details', async (req, res) => {
    const inspection = await store.updateInspectionDetails(req.params.inspectionId, req.body || {})
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    return res.json({ inspection })
  })

  app.post('/api/inspections/:inspectionId/rooms', async (req, res) => {
    const room = await store.createRoom(req.params.inspectionId, req.body || {})
    if (!room) return res.status(404).json({ error: 'Inspection not found' })

    return res.status(201).json({ room })
  })

  app.put('/api/inspections/:inspectionId/rooms/:roomId', async (req, res) => {
    const room = await store.updateRoom(req.params.inspectionId, req.params.roomId, req.body || {})
    if (!room) return res.status(404).json({ error: 'Room or inspection not found' })

    return res.json({ room })
  })

  app.delete('/api/inspections/:inspectionId/rooms/:roomId', async (req, res) => {
    const deleted = await store.deleteRoom(req.params.inspectionId, req.params.roomId)
    if (!deleted) return res.status(404).json({ error: 'Room or inspection not found' })

    return res.status(204).end()
  })

  app.post('/api/inspections/:inspectionId/rooms/:roomId/files', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File is required' })

    const file = await store.addFileToRoom(req.params.inspectionId, req.params.roomId, req.file)
    if (!file) return res.status(404).json({ error: 'Room or inspection not found' })

    return res.status(201).json({ file })
  })

  app.get('/api/inspections/:inspectionId/report/html', async (req, res) => {
    const inspection = await store.getInspection(req.params.inspectionId)
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    const roomSections = inspection.rooms
      .map((room) => {
        const files = Array.isArray(room.files) ? room.files : []
        const fileBlock = files.length
          ? `<div class="file-grid">${files.map((file) => buildFileHtml(file)).join('')}</div>`
          : '<p>No room files uploaded.</p>'

        return `<article>
          <h3>${escapeHtml(room.name)}</h3>
          <p><strong>Location:</strong> ${escapeHtml(room.location)}</p>
          <p><strong>Notes:</strong> ${escapeHtml(room.notes)}</p>
          <p><strong>Findings:</strong> ${escapeHtml(room.findings)}</p>
          <h4>Room Files</h4>
          ${fileBlock}
        </article>`
      })
      .join('')
    const questionnaireEntries = questionnaireToEntries(inspection.clientForm.questionnaire || {}).filter(
      ({ answer }) => typeof answer === 'string' && answer.trim(),
    )
    const questionnaireBlock = questionnaireEntries.length
      ? `<ul>${questionnaireEntries
          .map(
            ({ question, answer }) =>
              `<li><strong>${escapeHtml(question)}:</strong> ${escapeHtml(answer)}</li>`,
          )
          .join('')}</ul>`
      : '<p>No client responses submitted.</p>'
    const clientFormFiles = Array.isArray((inspection.clientForm || {}).files) ? inspection.clientForm.files : []
    const clientFilesBlock = clientFormFiles.length
      ? `<div class="file-grid">${clientFormFiles.map((file) => buildFileHtml(file)).join('')}</div>`
      : '<p>No client images uploaded.</p>'

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Mold Inspection Report</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      h1, h2 { margin-bottom: 0; }
      article { border-top: 1px solid #ccc; padding-top: 12px; margin-top: 12px; }
      .file-grid { display: flex; flex-wrap: wrap; gap: 12px; }
      .file-item img { max-width: 220px; max-height: 160px; border-radius: 4px; border: 1px solid #d1d5db; object-fit: cover; }
      .file-item figcaption { margin-top: 4px; font-size: 12px; color: #4b5563; word-break: break-word; }
      .file-item a { display: inline-block; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; text-decoration: none; color: #1d4ed8; }
    </style>
  </head>
  <body>
    <h1>Mold Inspection Report</h1>
    <p><strong>Address:</strong> ${escapeHtml(inspection.details.address)}</p>
    <p><strong>Contact Name:</strong> ${escapeHtml(inspection.details.contactName)}</p>
    <p><strong>Contact Email:</strong> ${escapeHtml(inspection.details.contactEmail)}</p>
    <p><strong>Contact Phone:</strong> ${escapeHtml(inspection.details.contactPhone)}</p>
    <p><strong>Inspection notes:</strong> ${escapeHtml(inspection.details.notes)}</p>
    <h2>Client Intake Questionnaire</h2>
    ${questionnaireBlock}
    <h2>Client Uploaded Images</h2>
    ${clientFilesBlock}
    <h2>Rooms</h2>
    ${roomSections || '<p>No rooms added.</p>'}
  </body>
</html>`

    res.type('html').send(html)
  })

  app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Each uploaded file must be 10MB or smaller' })
    }
    if (error && error.message === 'Only image uploads are allowed') {
      return res.status(400).json({ error: 'Only image uploads are allowed' })
    }
    return next(error)
  })

  const clientDistPath = path.resolve(process.cwd(), 'client', 'dist')
  app.use(express.static(clientDistPath))

  app.get(/^\/(?!api\/).*/, pageLimiter, (req, res) => {
    return res.sendFile(path.join(clientDistPath, 'index.html'), (error) => {
      if (error) {
        res.status(404).json({ error: 'Frontend build not found. Run npm run build first.' })
      }
    })
  })

  return app
}

module.exports = {
  createApp,
}
