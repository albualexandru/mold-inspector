const { randomUUID } = require('node:crypto')
const { Pool } = require('pg')
const { normalizeQuestionnaire } = require('./questionnaire')

const nowIso = () => new Date().toISOString()
const emptyQuestionnaire = () => normalizeQuestionnaire({})
const emptyClientForm = () => ({ questionnaire: emptyQuestionnaire(), submittedAt: null })

function createDbStore(connectionString) {
  const isLocal =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1')

  // For hosted PostgreSQL (e.g. Render) set DATABASE_SSL=true to enable SSL with certificate
  // verification. When DATABASE_SSL_REJECT_UNAUTHORIZED is set to 'false' (the Render default
  // for internal connections that use self-signed certs), certificate verification is skipped.
  // Local connections always skip SSL.
  let ssl = false
  if (!isLocal && process.env.DATABASE_SSL !== 'false') {
    const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
    ssl = { rejectUnauthorized }
  }

  const pool = new Pool({
    connectionString,
    ssl,
  })

  const init = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id UUID PRIMARY KEY,
        public_id UUID NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        contact_name TEXT NOT NULL DEFAULT '',
        contact_email TEXT NOT NULL DEFAULT '',
        contact_phone TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        client_form JSONB NOT NULL DEFAULT '{}'::jsonb
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY,
        inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        findings TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await pool.query('DROP TABLE IF EXISTS files')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY,
        inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'room',
        name TEXT NOT NULL DEFAULT '',
        mime_type TEXT NOT NULL DEFAULT '',
        size INTEGER NOT NULL DEFAULT 0,
        uploaded_at TIMESTAMPTZ NOT NULL,
        content_base64 TEXT NOT NULL DEFAULT ''
      )
    `)
  }

  const rowToFile = (row) => ({
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    size: row.size,
    uploadedAt: row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : row.uploaded_at,
    url: `/api/files/${row.id}`,
  })

  const rowToRoom = (row, files = []) => ({
    id: row.id,
    name: row.name,
    location: row.location,
    notes: row.notes,
    findings: row.findings,
    files,
  })

  const rowToInspection = (row, rooms = []) => ({
    id: row.id,
    publicId: row.public_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    details: {
      address: row.address,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      notes: row.notes,
    },
    clientForm: {
      questionnaire: normalizeQuestionnaire((row.client_form || {}).questionnaire || {}),
      submittedAt: (row.client_form || {}).submittedAt || null,
      files: [],
    },
    rooms,
  })

  const loadRoomsWithFiles = async (inspectionId) => {
    const { rows: roomRows } = await pool.query(
      'SELECT * FROM rooms WHERE inspection_id = $1 ORDER BY created_at',
      [inspectionId],
    )
    return Promise.all(
      roomRows.map(async (roomRow) => {
        const { rows: fileRows } = await pool.query(
          'SELECT * FROM files WHERE room_id = $1 ORDER BY uploaded_at',
          [roomRow.id],
        )
        return rowToRoom(roomRow, fileRows.map(rowToFile))
      }),
    )
  }

  const loadClientFormFiles = async (inspectionId) => {
    const { rows } = await pool.query(
      "SELECT * FROM files WHERE inspection_id = $1 AND category = 'client_form' ORDER BY uploaded_at",
      [inspectionId],
    )
    return rows.map(rowToFile)
  }

  const getFile = async (fileId) => {
    const { rows } = await pool.query('SELECT * FROM files WHERE id = $1', [fileId])
    if (!rows.length) return null
    const row = rows[0]
    return { mimeType: row.mime_type, name: row.name, contentBase64: row.content_base64 }
  }

  const createInspection = async (input = {}) => {
    const id = randomUUID()
    const publicId = randomUUID()
    const timestamp = nowIso()
    const clientForm = emptyClientForm()

    await pool.query(
      `INSERT INTO inspections
         (id, public_id, created_at, updated_at, address, contact_name, contact_email, contact_phone, notes, client_form)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        publicId,
        timestamp,
        timestamp,
        input.address ?? '',
        input.contactName ?? '',
        input.contactEmail ?? '',
        input.contactPhone ?? '',
        input.notes ?? '',
        JSON.stringify(clientForm),
      ],
    )

    const { rows } = await pool.query('SELECT * FROM inspections WHERE id = $1', [id])
    return rowToInspection(rows[0], [])
  }

  const listInspections = async () => {
    const { rows } = await pool.query('SELECT * FROM inspections ORDER BY created_at DESC')
    return Promise.all(
      rows.map(async (row) => {
        const [rooms, clientFiles] = await Promise.all([
          loadRoomsWithFiles(row.id),
          loadClientFormFiles(row.id),
        ])
        const inspection = rowToInspection(row, rooms)
        inspection.clientForm.files = clientFiles
        return inspection
      }),
    )
  }

  const getInspection = async (id) => {
    const { rows } = await pool.query('SELECT * FROM inspections WHERE id = $1', [id])
    if (!rows.length) return null
    const [rooms, clientFiles] = await Promise.all([loadRoomsWithFiles(id), loadClientFormFiles(id)])
    const inspection = rowToInspection(rows[0], rooms)
    inspection.clientForm.files = clientFiles
    return inspection
  }

  const getInspectionByPublicId = async (publicId) => {
    const { rows } = await pool.query('SELECT * FROM inspections WHERE public_id = $1', [publicId])
    if (!rows.length) return null
    const id = rows[0].id
    const [rooms, clientFiles] = await Promise.all([loadRoomsWithFiles(id), loadClientFormFiles(id)])
    const inspection = rowToInspection(rows[0], rooms)
    inspection.clientForm.files = clientFiles
    return inspection
  }

  const updateInspectionDetails = async (id, patch = {}) => {
    const { rows } = await pool.query('SELECT * FROM inspections WHERE id = $1', [id])
    if (!rows.length) return null

    const current = rows[0]
    await pool.query(
      `UPDATE inspections
       SET address = $2, contact_name = $3, contact_email = $4, contact_phone = $5, notes = $6, updated_at = $7
       WHERE id = $1`,
      [
        id,
        patch.address ?? current.address,
        patch.contactName ?? current.contact_name,
        patch.contactEmail ?? current.contact_email,
        patch.contactPhone ?? current.contact_phone,
        patch.notes ?? current.notes,
        nowIso(),
      ],
    )

    return getInspection(id)
  }

  const updateClientFormByPublicId = async (publicId, patch = {}) => {
    const { rows } = await pool.query('SELECT * FROM inspections WHERE public_id = $1', [publicId])
    if (!rows.length) return null

    const current = rows[0]
    const currentQuestionnaire = (current.client_form || {}).questionnaire || {}
    const updatedClientForm = {
      questionnaire: normalizeQuestionnaire({ ...currentQuestionnaire, ...(patch.questionnaire || {}) }),
      submittedAt: nowIso(),
    }

    await pool.query(
      'UPDATE inspections SET client_form = $2, updated_at = $3 WHERE public_id = $1',
      [publicId, JSON.stringify(updatedClientForm), nowIso()],
    )

    return getInspectionByPublicId(publicId)
  }

  const addClientFormFilesByPublicId = async (publicId, files = []) => {
    const { rows } = await pool.query('SELECT * FROM inspections WHERE public_id = $1', [publicId])
    if (!rows.length) return null

    const inspectionId = rows[0].id
    const timestamp = nowIso()

    for (const file of files) {
      await pool.query(
        'INSERT INTO files (id, inspection_id, room_id, category, name, mime_type, size, uploaded_at, content_base64) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [randomUUID(), inspectionId, null, 'client_form', file.originalname, file.mimetype, file.size, timestamp, file.buffer.toString('base64')],
      )
    }

    await pool.query('UPDATE inspections SET updated_at = $2 WHERE id = $1', [inspectionId, timestamp])
    return getInspectionByPublicId(publicId)
  }

  const createRoom = async (inspectionId, input = {}) => {
    const { rows: inspExists } = await pool.query('SELECT id FROM inspections WHERE id = $1', [inspectionId])
    if (!inspExists.length) return null

    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) AS count FROM rooms WHERE inspection_id = $1',
      [inspectionId],
    )
    const roomCount = parseInt(countRows[0].count, 10)

    const id = randomUUID()
    await pool.query(
      'INSERT INTO rooms (id, inspection_id, name, location, notes, findings) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, inspectionId, input.name ?? `Room ${roomCount + 1}`, input.location ?? '', input.notes ?? '', input.findings ?? ''],
    )

    await pool.query('UPDATE inspections SET updated_at = $2 WHERE id = $1', [inspectionId, nowIso()])

    const { rows } = await pool.query('SELECT * FROM rooms WHERE id = $1', [id])
    return rowToRoom(rows[0], [])
  }

  const updateRoom = async (inspectionId, roomId, patch = {}) => {
    const { rows: inspExists } = await pool.query('SELECT id FROM inspections WHERE id = $1', [inspectionId])
    if (!inspExists.length) return null

    const { rows } = await pool.query(
      'SELECT * FROM rooms WHERE id = $1 AND inspection_id = $2',
      [roomId, inspectionId],
    )
    if (!rows.length) return null

    const current = rows[0]
    await pool.query(
      `UPDATE rooms SET name = $3, location = $4, notes = $5, findings = $6
       WHERE id = $1 AND inspection_id = $2`,
      [
        roomId,
        inspectionId,
        patch.name ?? current.name,
        patch.location ?? current.location,
        patch.notes ?? current.notes,
        patch.findings ?? current.findings,
      ],
    )

    await pool.query('UPDATE inspections SET updated_at = $2 WHERE id = $1', [inspectionId, nowIso()])

    const { rows: updated } = await pool.query('SELECT * FROM rooms WHERE id = $1', [roomId])
    const { rows: fileRows } = await pool.query(
      'SELECT * FROM files WHERE room_id = $1 ORDER BY uploaded_at',
      [roomId],
    )
    return rowToRoom(updated[0], fileRows.map(rowToFile))
  }

  const addFileToRoom = async (inspectionId, roomId, file) => {
    const { rows: inspExists } = await pool.query('SELECT id FROM inspections WHERE id = $1', [inspectionId])
    if (!inspExists.length) return null

    const { rows: roomExists } = await pool.query(
      'SELECT id FROM rooms WHERE id = $1 AND inspection_id = $2',
      [roomId, inspectionId],
    )
    if (!roomExists.length) return null

    const id = randomUUID()
    const uploadedAt = nowIso()
    const contentBase64 = file.buffer.toString('base64')

    await pool.query(
      'INSERT INTO files (id, inspection_id, room_id, category, name, mime_type, size, uploaded_at, content_base64) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, inspectionId, roomId, 'room', file.originalname, file.mimetype, file.size, uploadedAt, contentBase64],
    )

    await pool.query('UPDATE inspections SET updated_at = $2 WHERE id = $1', [inspectionId, nowIso()])

    const { rows } = await pool.query('SELECT * FROM files WHERE id = $1', [id])
    return rowToFile(rows[0])
  }

  const deleteInspection = async (id) => {
    const { rows } = await pool.query('SELECT id FROM inspections WHERE id = $1', [id])
    if (!rows.length) return false
    await pool.query('DELETE FROM inspections WHERE id = $1', [id])
    return true
  }

  const deleteRoom = async (inspectionId, roomId) => {
    const { rows } = await pool.query(
      'SELECT id FROM rooms WHERE id = $1 AND inspection_id = $2',
      [roomId, inspectionId],
    )
    if (!rows.length) return false
    await pool.query('DELETE FROM rooms WHERE id = $1', [roomId])
    await pool.query('UPDATE inspections SET updated_at = $2 WHERE id = $1', [inspectionId, nowIso()])
    return true
  }

  return {
    init,
    createInspection,
    listInspections,
    getInspection,
    getInspectionByPublicId,
    getFile,
    updateInspectionDetails,
    updateClientFormByPublicId,
    addClientFormFilesByPublicId,
    createRoom,
    updateRoom,
    addFileToRoom,
    deleteInspection,
    deleteRoom,
  }
}

module.exports = { createDbStore }
