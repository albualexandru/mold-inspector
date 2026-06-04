const { randomUUID } = require('node:crypto')
const path = require('node:path')
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const { createInMemoryStore } = require('./store')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const requiredEnv = (name, fallback) => process.env[name] || fallback

function createApp(options = {}) {
  const app = express()
  const store = options.store || createInMemoryStore()
  const sessions = new Map()

  const authUsername = requiredEnv('APP_USERNAME', 'admin')
  const authPassword = requiredEnv('APP_PASSWORD', 'password')

  app.use(cors())
  app.use(express.json({ limit: '2mb' }))

  const requireAuth = (req, res, next) => {
    const header = req.get('authorization') || ''
    const [scheme, token] = header.split(' ')

    if ((scheme !== 'Bearer' && scheme !== 'Token') || !token || !sessions.has(token)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    return next()
  }

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {}

    if (username !== authUsername || password !== authPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = randomUUID()
    sessions.set(token, { createdAt: Date.now() })

    return res.json({ token })
  })

  app.get('/api/public/:publicId/form', (req, res) => {
    const inspection = store.getInspectionByPublicId(req.params.publicId)
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    return res.json({
      inspectionId: inspection.id,
      publicId: inspection.publicId,
      address: inspection.details.address,
      clientForm: inspection.clientForm,
    })
  })

  app.put('/api/public/:publicId/form', (req, res) => {
    const inspection = store.updateClientFormByPublicId(req.params.publicId, req.body || {})
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    return res.json({ clientForm: inspection.clientForm })
  })

  app.use('/api/inspections', requireAuth)

  app.get('/api/inspections', (req, res) => {
    const inspections = store.listInspections()
    res.json({ inspections })
  })

  app.post('/api/inspections', (req, res) => {
    const inspection = store.createInspection(req.body || {})
    res.status(201).json({ inspection })
  })

  app.get('/api/inspections/:inspectionId', (req, res) => {
    const inspection = store.getInspection(req.params.inspectionId)
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    return res.json({ inspection })
  })

  app.put('/api/inspections/:inspectionId/details', (req, res) => {
    const inspection = store.updateInspectionDetails(req.params.inspectionId, req.body || {})
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    return res.json({ inspection })
  })

  app.post('/api/inspections/:inspectionId/rooms', (req, res) => {
    const room = store.createRoom(req.params.inspectionId, req.body || {})
    if (!room) return res.status(404).json({ error: 'Inspection not found' })

    return res.status(201).json({ room })
  })

  app.put('/api/inspections/:inspectionId/rooms/:roomId', (req, res) => {
    const room = store.updateRoom(req.params.inspectionId, req.params.roomId, req.body || {})
    if (!room) return res.status(404).json({ error: 'Room or inspection not found' })

    return res.json({ room })
  })

  app.post('/api/inspections/:inspectionId/rooms/:roomId/files', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File is required' })

    const file = store.addFileToRoom(req.params.inspectionId, req.params.roomId, req.file)
    if (!file) return res.status(404).json({ error: 'Room or inspection not found' })

    return res.status(201).json({ file })
  })

  app.get('/api/inspections/:inspectionId/report/html', (req, res) => {
    const inspection = store.getInspection(req.params.inspectionId)
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    const roomSections = inspection.rooms
      .map(
        (room) => `<article>
          <h3>${escapeHtml(room.name)}</h3>
          <p><strong>Location:</strong> ${escapeHtml(room.location)}</p>
          <p><strong>Notes:</strong> ${escapeHtml(room.notes)}</p>
          <p><strong>Findings:</strong> ${escapeHtml(room.findings)}</p>
          <p><strong>Files:</strong> ${room.files.length}</p>
        </article>`,
      )
      .join('')

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Mold Inspection Report</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      h1, h2 { margin-bottom: 0; }
      article { border-top: 1px solid #ccc; padding-top: 12px; margin-top: 12px; }
    </style>
  </head>
  <body>
    <h1>Mold Inspection Report</h1>
    <p><strong>Address:</strong> ${escapeHtml(inspection.details.address)}</p>
    <p><strong>Contact:</strong> ${escapeHtml(inspection.details.contactName)} (${escapeHtml(inspection.details.contactEmail)})</p>
    <h2>Client Intake</h2>
    <p>${escapeHtml(inspection.clientForm.concerns || 'No client concerns submitted yet.')}</p>
    <h2>Rooms</h2>
    ${roomSections || '<p>No rooms added.</p>'}
  </body>
</html>`

    res.type('html').send(html)
  })

  const clientDistPath = path.resolve(process.cwd(), 'client', 'dist')
  app.use(express.static(clientDistPath))

  app.get(/^\/(?!api\/).*/, (req, res) => {
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
