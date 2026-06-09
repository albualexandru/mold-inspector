const { randomUUID } = require('node:crypto')
const path = require('node:path')
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const { createInMemoryStore } = require('./store')
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
  const source = `data:${mimeType};base64,${file.contentBase64 || ''}`

  if (mimeType.startsWith('image/')) {
    return `<figure class="file-item">
      <img src="${source}" alt="${name}" />
      <figcaption>${name}</figcaption>
    </figure>`
  }

  return `<div class="file-item">
    <a href="${source}" download="${name}">${name}</a>
  </div>`
}

function createApp(options = {}) {
  const app = express()
  const store = options.store || createInMemoryStore()
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

  const requireAuth = (req, res, next) => {
    const header = req.get('authorization') || ''
    const [scheme, token] = header.split(' ')

    if ((scheme !== 'Bearer' && scheme !== 'Token') || !token || !sessions.has(token)) {
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
