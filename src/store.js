const { randomUUID } = require('node:crypto')
const { normalizeQuestionnaire } = require('./questionnaire')

const nowIso = () => new Date().toISOString()

const emptyQuestionnaire = () => normalizeQuestionnaire({})

function createInMemoryStore() {
  const inspections = new Map()

  const createInspection = (input = {}) => {
    const id = randomUUID()
    const timestamp = nowIso()
    const inspection = {
      id,
      publicId: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
      details: {
        address: input.address ?? '',
        contactName: input.contactName ?? '',
        contactEmail: input.contactEmail ?? '',
        contactPhone: input.contactPhone ?? '',
        notes: input.notes ?? '',
      },
      clientForm: {
        questionnaire: emptyQuestionnaire(),
        submittedAt: null,
      },
      rooms: [],
    }

    inspections.set(id, inspection)
    return inspection
  }

  const listInspections = () => Array.from(inspections.values())

  const getInspection = (id) => inspections.get(id) || null

  const getInspectionByPublicId = (publicId) => {
    for (const inspection of inspections.values()) {
      if (inspection.publicId === publicId) return inspection
    }

    return null
  }

  const updateInspectionDetails = (id, patch = {}) => {
    const inspection = getInspection(id)
    if (!inspection) return null

    inspection.details = {
      ...inspection.details,
      ...patch,
    }
    inspection.updatedAt = nowIso()

    return inspection
  }

  const updateClientFormByPublicId = (publicId, patch = {}) => {
    const inspection = getInspectionByPublicId(publicId)
    if (!inspection) return null

    const mergedQuestionnaire = {
      ...(inspection.clientForm.questionnaire || {}),
      ...(patch.questionnaire || {}),
    }

    inspection.clientForm = {
      ...inspection.clientForm,
      questionnaire: normalizeQuestionnaire(mergedQuestionnaire),
      submittedAt: nowIso(),
    }
    inspection.updatedAt = nowIso()

    return inspection
  }

  const createRoom = (inspectionId, input = {}) => {
    const inspection = getInspection(inspectionId)
    if (!inspection) return null

    const room = {
      id: randomUUID(),
      name: input.name ?? `Room ${inspection.rooms.length + 1}`,
      location: input.location ?? '',
      notes: input.notes ?? '',
      findings: input.findings ?? '',
      files: [],
    }

    inspection.rooms.push(room)
    inspection.updatedAt = nowIso()
    return room
  }

  const updateRoom = (inspectionId, roomId, patch = {}) => {
    const inspection = getInspection(inspectionId)
    if (!inspection) return null

    const room = inspection.rooms.find((candidate) => candidate.id === roomId)
    if (!room) return null

    Object.assign(room, patch)
    inspection.updatedAt = nowIso()

    return room
  }

  const addFileToRoom = (inspectionId, roomId, file) => {
    const inspection = getInspection(inspectionId)
    if (!inspection) return null

    const room = inspection.rooms.find((candidate) => candidate.id === roomId)
    if (!room) return null

    const fileRecord = {
      id: randomUUID(),
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: nowIso(),
      contentBase64: file.buffer.toString('base64'),
    }

    room.files.push(fileRecord)
    inspection.updatedAt = nowIso()

    return fileRecord
  }

  return {
    createInspection,
    listInspections,
    getInspection,
    getInspectionByPublicId,
    updateInspectionDetails,
    updateClientFormByPublicId,
    createRoom,
    updateRoom,
    addFileToRoom,
  }
}

module.exports = {
  createInMemoryStore,
}
