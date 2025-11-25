import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { resourceManager } from './services/ResourceManager'
import { ScriptureReader } from './components/ScriptureReader'

function App() {
  const [syncing, setSyncing] = useState(true)
  const [syncMessage, setSyncMessage] = useState('Initializing...')

  const startSync = useCallback(async () => {
    setSyncing(true)
    await resourceManager.syncResources((msg) => {
        setSyncMessage(msg)
    })
    setSyncing(false)
  }, [])

  useEffect(() => {
    startSync()
  }, [startSync])

  if (syncing) {
      return (
          <div className="container">
              <h1>Book Package Reader</h1>
              <div className="card">
                  <p>{syncMessage}</p>
                  <div className="loader"></div>
              </div>
          </div>
      )
  }

  return (
    <div className="app-container">
      <ScriptureReader />
    </div>
  )
}

export default App
