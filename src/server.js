const { createApp } = require('./app')
const { createDbStore } = require('./db-store')

const port = Number(process.env.PORT || 3000)

async function main() {
  let store

  if (process.env.DATABASE_URL) {
    const dbStore = createDbStore(process.env.DATABASE_URL)
    await dbStore.init()
    store = dbStore
    console.log('Connected to PostgreSQL database')
  }

  const app = createApp({ store })

  app.listen(port, () => {
    console.log(`Mold Inspector service listening on ${port}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
