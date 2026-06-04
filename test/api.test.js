const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../src/app')

test('auth + inspection + public form flow', async (t) => {
  process.env.APP_USERNAME = 'tester'
  process.env.APP_PASSWORD = 'secret'

  const app = createApp()

  await request(app)
    .post('/api/auth/login')
    .send({ username: 'wrong', password: 'wrong' })
    .expect(401)

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ username: 'tester', password: 'secret' })
    .expect(200)

  const token = loginResponse.body.token
  assert.ok(token)

  const createResponse = await request(app)
    .post('/api/inspections')
    .set('Authorization', 'Token ' + token)
    .send({ address: '42 Sample Street', contactName: 'Alex' })
    .expect(201)

  const inspection = createResponse.body.inspection
  assert.equal(inspection.details.address, '42 Sample Street')

  await request(app)
    .put(`/api/inspections/${inspection.id}/details`)
    .set('Authorization', 'Token ' + token)
    .send({ contactEmail: 'client@example.com' })
    .expect(200)

  await request(app)
    .put(`/api/public/${inspection.publicId}/form`)
    .send({ concerns: 'Possible mold in bathroom.' })
    .expect(200)

  const report = await request(app)
    .get(`/api/inspections/${inspection.id}/report/html`)
    .set('Authorization', 'Token ' + token)
    .expect(200)

  assert.match(report.text, /Mold Inspection Report/)
  assert.match(report.text, /Possible mold in bathroom/)

  await t.test('requires auth on private routes', async () => {
    await request(app).get('/api/inspections').expect(401)
  })
})
