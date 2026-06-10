const { createApp } = require('./app')
const { createDbStore } = require('./db-store')

const port = Number(process.env.PORT || 3000)

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required. In-memory storage is no longer supported.')
    process.exit(1)
  }

  const dbStore = createDbStore(process.env.DATABASE_URL)
  await dbStore.init()
  console.log('Connected to PostgreSQL database')

  const app = createApp({ store: dbStore })

  app.listen(port, () => {
    console.log(`Mold Inspector service listening on ${port}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
