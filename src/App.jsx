import { useEffect, useRef, useState } from 'react'
import { createStompClient, subscribeBlueprint } from './lib/stompClient.js'
import { login as apiLogin, logout as apiLogout, getStoredSession } from './lib/auth.js'
import { getBlueprint, createBlueprint, deleteBlueprint } from './lib/blueprintsApi.js'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'

export default function App() {
  const [session, setSession] = useState(() => getStoredSession())
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState(null)

  const [tech, setTech] = useState('stomp') // 'none' | 'stomp'
  const [author, setAuthor] = useState('juan')
  const [name, setName] = useState('plano-1')
  const canvasRef = useRef(null)

  const stompRef = useRef(null)
  const unsubRef = useRef(null)

  const canWrite = session?.scopes?.includes('blueprints.write')

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError(null)
    try {
      const s = await apiLogin(loginForm.username, loginForm.password)
      setSession(s)
    } catch (err) {
      setLoginError('Credenciales inválidas')
    }
  }

  function handleLogout() {
    apiLogout()
    setSession(null)
  }

  function drawAll(bp) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 600, 400)
    ctx.beginPath()
    bp.points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
  }

  useEffect(() => {
    if (!session) return
    getBlueprint(author, name).then(drawAll).catch(() => drawAll({ points: [] }))
  }, [author, name, session])

  useEffect(() => {
    if (!session || tech !== 'stomp') return

    unsubRef.current?.unsubscribe()   // 👈 corregido
    unsubRef.current = null
    stompRef.current?.deactivate?.()
    stompRef.current = null

    const client = createStompClient(API_BASE)
    stompRef.current = client
    client.onConnect = () => {
      unsubRef.current = subscribeBlueprint(client, author, name, (upd) => {
        drawAll({ points: upd.points })
      })
    }
    client.activate()

    return () => {
      unsubRef.current?.unsubscribe()   // 👈 corregido
      unsubRef.current = null
      stompRef.current?.deactivate?.()
    }
  }, [tech, author, name, session])

  function onClick(e) {
    if (!canWrite || tech !== 'stomp') return
    const rect = e.target.getBoundingClientRect()
    const point = { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) }

    if (stompRef.current?.connected) {
      stompRef.current.publish({ destination: '/app/draw', body: JSON.stringify({ author, name, point }) })
    }
  }

  async function handleCreate() {
    await createBlueprint({ author, name, points: [] })
    drawAll({ points: [] })
  }

  async function handleDelete() {
    await deleteBlueprint(author, name)
    drawAll({ points: [] })
  }

  if (!session) {
    return (
      <div style={{ fontFamily: 'Inter, system-ui', padding: 16, maxWidth: 400 }}>
        <h2>Login</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            placeholder="usuario"
            value={loginForm.username}
            onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
          />
          <input
            placeholder="contraseña"
            type="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          />
          <button type="submit">Entrar</button>
        </form>
        {loginError && <p style={{ color: 'red' }}>{loginError}</p>}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui', padding: 16, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>BluePrints RT – STOMP</h2>
        <div>
          <span style={{ marginRight: 8 }}>{session.username} ({session.scopes.join(', ')})</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <label>Tecnología:</label>
        <select value={tech} onChange={(e) => setTech(e.target.value)}>
          <option value="none">None</option>
          <option value="stomp">STOMP (Spring)</option>
        </select>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="autor" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="plano" />
        {canWrite && (
          <>
            <button onClick={handleCreate}>Create</button>
            <button onClick={handleDelete}>Delete</button>
          </>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        style={{ border: '1px solid #ddd', borderRadius: 12 }}
        onClick={onClick}
      />
      <p style={{ opacity: 0.7, marginTop: 8 }}>Tip: abre 2 pestañas y dibuja alternando para ver la colaboración.</p>
    </div>
  )
}