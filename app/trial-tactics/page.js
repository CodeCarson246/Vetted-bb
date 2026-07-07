'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import JuryGrid from '@/components/trialTactics/JuryGrid'
import { CASES, STATEMENTS, TURNS, OBJECTION_TYPES, getStatementById } from '@/lib/trialTactics/cases'
import {
  createInitialJurors,
  applyStatement,
  evaluateObjection,
  applyCredibilityHit,
  computeVerdict,
  analyzeMoves,
  countLeanings,
  roleForTurn,
} from '@/lib/trialTactics/engine'

// ---- theme ----
const C = {
  bg: '#0a1228',
  panel: '#101c3d',
  panel2: '#16244d',
  border: '#243358',
  gold: '#f5c451',
  goldDim: '#caa53f',
  white: '#f8fafc',
  grey: '#9fb0cc',
  pro: '#dc2626',
  def: '#2563eb',
}
const OBJECTION_WINDOW_MS = 10000

const ROLE_LABEL = { prosecution: 'Prosecution', defence: 'Defence' }
const roleColor = (r) => (r === 'prosecution' ? C.pro : C.def)

function genRoomCode() {
  return 'TRIAL-' + Math.floor(1000 + Math.random() * 9000)
}

// ---- small shared UI bits ----
function Btn({ children, onClick, kind = 'gold', disabled, style }) {
  const base = {
    gold: { background: C.gold, color: '#1a1205', border: 'none' },
    ghost: { background: 'transparent', color: C.gold, border: `1px solid ${C.gold}` },
    pro: { background: C.pro, color: '#fff', border: 'none' },
    def: { background: C.def, color: '#fff', border: 'none' },
    dark: { background: C.panel2, color: C.white, border: `1px solid ${C.border}` },
  }[kind]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...base,
        padding: '12px 20px',
        borderRadius: 10,
        fontWeight: 700,
        fontSize: 15,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 120ms ease, opacity 120ms',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function Tag({ children, color }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 999,
        background: (color || C.gold) + '22',
        color: color || C.gold,
        border: `1px solid ${(color || C.gold)}66`,
      }}
    >
      {children}
    </span>
  )
}

const input = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: '#0c1530',
  color: C.white,
  fontSize: 16,
  outline: 'none',
  boxSizing: 'border-box',
}

export default function TrialTactics() {
  const [view, setView] = useState('home') // home | create | join | game
  const [game, setGame] = useState(null)
  const [session, setSession] = useState(null) // { role, name, isHost }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const channelRef = useRef(null)
  const resolvingRef = useRef(false)

  const myRole = session?.role
  const isHost = session?.isHost

  // ---- realtime subscription ----
  const subscribe = useCallback((roomCode) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const ch = supabase
      .channel(`tt_${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tt_games', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          if (payload.new) setGame(payload.new)
        }
      )
      .subscribe()
    channelRef.current = ch
  }, [])

  // ---- restore session on refresh ----
  useEffect(() => {
    const room = localStorage.getItem('tt_current_room')
    if (!room) return
    const raw = localStorage.getItem('tt_session_' + room)
    if (!raw) return
    ;(async () => {
      const { data } = await supabase.from('tt_games').select('*').eq('room_code', room).maybeSingle()
      if (data) {
        setSession(JSON.parse(raw))
        setGame(data)
        setView('game')
        subscribe(room)
      } else {
        localStorage.removeItem('tt_current_room')
      }
    })()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [subscribe])

  function persistSession(roomCode, sess) {
    localStorage.setItem('tt_current_room', roomCode)
    localStorage.setItem('tt_session_' + roomCode, JSON.stringify(sess))
  }

  function leave() {
    const room = game?.room_code
    if (room) {
      localStorage.removeItem('tt_current_room')
      localStorage.removeItem('tt_session_' + room)
    }
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = null
    setGame(null)
    setSession(null)
    setError('')
    setView('home')
  }

  // ---- create ----
  async function createGame(name, role) {
    setBusy(true)
    setError('')
    const roomCode = genRoomCode()
    const row = {
      room_code: roomCode,
      game_status: 'waiting',
      host_player_name: name,
      prosecution_player_name: role === 'prosecution' ? name : null,
      defence_player_name: role === 'defence' ? name : null,
      current_turn: 1,
      active_role: 'prosecution',
      selected_case: 'missing_laptop',
      jurors: createInitialJurors(),
      statement_history: [],
      pending_statement: null,
      prosecution_objection_used: false,
      defence_objection_used: false,
    }
    const { data, error: err } = await supabase.from('tt_games').insert(row).select().single()
    setBusy(false)
    if (err) {
      setError('Could not create game: ' + err.message)
      return
    }
    const sess = { role, name, isHost: true }
    setSession(sess)
    setGame(data)
    persistSession(roomCode, sess)
    setView('game')
    subscribe(roomCode)
  }

  // ---- join ----
  async function joinGame(name, code) {
    setBusy(true)
    setError('')
    const roomCode = code.trim().toUpperCase()
    const { data, error: err } = await supabase
      .from('tt_games')
      .select('*')
      .eq('room_code', roomCode)
      .maybeSingle()
    if (err || !data) {
      setBusy(false)
      setError('No game found with that room code.')
      return
    }
    if (data.guest_player_name) {
      setBusy(false)
      setError('That game already has two players.')
      return
    }
    const remaining = data.prosecution_player_name ? 'defence' : 'prosecution'
    const update = {
      guest_player_name: name,
      game_status: 'briefing',
      briefing_ends_at: new Date(Date.now() + 120000).toISOString(),
    }
    update[`${remaining}_player_name`] = name
    const { data: updated, error: uErr } = await supabase
      .from('tt_games')
      .update(update)
      .eq('room_code', roomCode)
      .select()
      .single()
    setBusy(false)
    if (uErr) {
      setError('Could not join: ' + uErr.message)
      return
    }
    const sess = { role: remaining, name, isHost: false }
    setSession(sess)
    setGame(updated)
    persistSession(roomCode, sess)
    setView('game')
    subscribe(roomCode)
  }

  async function patch(fields) {
    if (!game) return
    const { data } = await supabase
      .from('tt_games')
      .update(fields)
      .eq('room_code', game.room_code)
      .select()
      .single()
    if (data) setGame(data)
  }

  // ---- begin trial (from briefing) ----
  async function startTrial() {
    await patch({ game_status: 'active', current_turn: 1, active_role: 'prosecution' })
  }

  // ---- active player picks a statement ----
  async function chooseStatement(statement) {
    await patch({
      pending_statement: {
        statementId: statement.id,
        role: myRole,
        turn: game.current_turn,
        playerName: session.name,
        deadline: new Date(Date.now() + OBJECTION_WINDOW_MS).toISOString(),
        objection: null,
      },
    })
  }

  // ---- resolve the pending statement (apply jury changes, advance) ----
  const resolvePending = useCallback(
    async (objection = null) => {
      if (!game || !game.pending_statement) return
      if (resolvingRef.current) return
      resolvingRef.current = true
      try {
        // Re-read the row so two clients can't both apply the same statement
        // (the inactive player resolves at the deadline, the active player is a
        // fallback). Whoever writes first clears pending; the other aborts here.
        const { data: fresh } = await supabase
          .from('tt_games')
          .select('*')
          .eq('room_code', game.room_code)
          .single()
        if (!fresh || !fresh.pending_statement) {
          if (fresh) setGame(fresh)
          return
        }
        const pending = fresh.pending_statement
        const statement = getStatementById(pending.statementId)
        const objType = objection || pending.objection?.type || null
        const objectorRole = objType ? roleForTurn(pending.turn) === 'prosecution' ? 'defence' : 'prosecution' : null

        let jurors = fresh.jurors
        let weight = 1
        let objectionEffective = null
        if (objType) {
          const res = evaluateObjection(objType, statement)
          weight = res.weight
          objectionEffective = res.effective
          if (!res.effective) {
            jurors = applyCredibilityHit(jurors, objectorRole, res.credibilityHit)
          }
        }

        const { jurors: jurors2, swing } = applyStatement(jurors, statement, pending.role, weight)

        const entry = {
          turn: pending.turn,
          role: pending.role,
          playerName: pending.playerName,
          statementId: pending.statementId,
          statementText: statement.text,
          category: statement.category,
          reaction: statement.reaction,
          swing,
          objection: objType,
          objectionEffective,
        }
        const history = [...(fresh.statement_history || []), entry]

        const fields = {
          jurors: jurors2,
          statement_history: history,
          pending_statement: null,
        }
        if (objType) {
          fields[`${objectorRole}_objection_used`] = true
        }

        const nextTurn = pending.turn + 1
        if (nextTurn > 10) {
          const v = computeVerdict(jurors2)
          fields.game_status = 'complete'
          fields.final_verdict = v.verdict
          fields.winner = v.winner
          fields.current_turn = 10
        } else {
          fields.current_turn = nextTurn
          fields.active_role = roleForTurn(nextTurn)
        }
        await patch(fields)
      } finally {
        resolvingRef.current = false
      }
    },
    [game]
  )

  // ---- objection window timers ----
  const pending = game?.pending_statement
  useEffect(() => {
    if (!pending || !myRole) return
    const amActive = pending.role === myRole
    const msLeft = new Date(pending.deadline).getTime() - Date.now()
    // Inactive (potential objector) resolves at the deadline.
    // Active player resolves as a fallback shortly after.
    const delay = amActive ? Math.max(0, msLeft) + 2500 : Math.max(0, msLeft)
    const t = setTimeout(() => resolvePending(), delay)
    return () => clearTimeout(t)
  }, [pending, myRole, resolvePending])

  async function objectNow(type) {
    await resolvePending(type)
  }

  // ---- play again (reset same room, swap not required) ----
  async function playAgain() {
    await patch({
      game_status: 'briefing',
      current_turn: 1,
      active_role: 'prosecution',
      jurors: createInitialJurors(),
      statement_history: [],
      pending_statement: null,
      prosecution_objection_used: false,
      defence_objection_used: false,
      final_verdict: null,
      winner: null,
      briefing_ends_at: new Date(Date.now() + 120000).toISOString(),
    })
  }

  // ---- render ----
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(1200px 600px at 50% -10%, #14244f 0%, ${C.bg} 60%)`,
        color: C.white,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        padding: '24px 16px 64px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {view === 'home' && <Home onCreate={() => { setError(''); setView('create') }} onJoin={() => { setError(''); setView('join') }} />}
        {view === 'create' && (
          <CreateFlow busy={busy} error={error} onBack={() => setView('home')} onSubmit={createGame} />
        )}
        {view === 'join' && (
          <JoinFlow busy={busy} error={error} onBack={() => setView('home')} onSubmit={joinGame} />
        )}
        {view === 'game' && game && (
          <Game
            game={game}
            session={session}
            isHost={isHost}
            myRole={myRole}
            onStart={startTrial}
            onChoose={chooseStatement}
            onObject={objectNow}
            onAllow={() => resolvePending()}
            onPlayAgain={playAgain}
            onLeave={leave}
          />
        )}
      </div>
    </div>
  )
}

// ============================================================
// Screens
// ============================================================

function Header({ small }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: small ? 20 : 36 }}>
      <div
        style={{
          fontSize: small ? 26 : 46,
          fontWeight: 900,
          letterSpacing: 1,
          color: C.gold,
          textShadow: '0 2px 20px rgba(245,196,81,0.25)',
        }}
      >
        ⚖️ Trial Tactics
      </div>
      {!small && (
        <div style={{ color: C.grey, marginTop: 8, fontSize: 17 }}>
          Convince the jury. Win the verdict.
        </div>
      )}
    </div>
  )
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Home({ onCreate, onJoin }) {
  return (
    <div style={{ paddingTop: 40 }}>
      <Header />
      <Card style={{ maxWidth: 420, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Btn onClick={onCreate}>Create Game</Btn>
          <Btn kind="ghost" onClick={onJoin}>
            Join Game
          </Btn>
        </div>
        <p style={{ color: C.grey, fontSize: 13, textAlign: 'center', marginTop: 18, marginBottom: 0 }}>
          Two players, two devices, one jury. Create a room and share the code, or join with a
          friend&apos;s code.
        </p>
      </Card>
    </div>
  )
}

function CreateFlow({ busy, error, onBack, onSubmit }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('prosecution')
  return (
    <div style={{ paddingTop: 30 }}>
      <Header small />
      <Card style={{ maxWidth: 460, margin: '0 auto' }}>
        <h2 style={{ marginTop: 0, color: C.gold }}>Create Game</h2>
        <label style={{ fontSize: 13, color: C.grey }}>Your display name</label>
        <input style={{ ...input, marginTop: 6, marginBottom: 18 }} value={name} maxLength={20}
          onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" />

        <label style={{ fontSize: 13, color: C.grey }}>Choose your role</label>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, marginBottom: 22 }}>
          {['prosecution', 'defence'].map((r) => (
            <button key={r} onClick={() => setRole(r)} style={{
              flex: 1, padding: '14px', borderRadius: 12, cursor: 'pointer', fontWeight: 800,
              color: '#fff', background: role === r ? roleColor(r) : C.panel2,
              border: `2px solid ${role === r ? roleColor(r) : C.border}`,
            }}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>

        {error && <p style={{ color: C.pro, fontSize: 14 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 12 }}>
          <Btn kind="dark" onClick={onBack} style={{ flex: '0 0 auto' }}>Back</Btn>
          <Btn onClick={() => name.trim() && onSubmit(name.trim(), role)} disabled={busy || !name.trim()} style={{ flex: 1 }}>
            {busy ? 'Creating…' : 'Create Room'}
          </Btn>
        </div>
      </Card>
    </div>
  )
}

function JoinFlow({ busy, error, onBack, onSubmit }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  return (
    <div style={{ paddingTop: 30 }}>
      <Header small />
      <Card style={{ maxWidth: 460, margin: '0 auto' }}>
        <h2 style={{ marginTop: 0, color: C.gold }}>Join Game</h2>
        <label style={{ fontSize: 13, color: C.grey }}>Your display name</label>
        <input style={{ ...input, marginTop: 6, marginBottom: 18 }} value={name} maxLength={20}
          onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" />
        <label style={{ fontSize: 13, color: C.grey }}>Room code</label>
        <input style={{ ...input, marginTop: 6, marginBottom: 22, letterSpacing: 2, textTransform: 'uppercase' }}
          value={code} onChange={(e) => setCode(e.target.value)} placeholder="TRIAL-0000" />
        {error && <p style={{ color: C.pro, fontSize: 14 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 12 }}>
          <Btn kind="dark" onClick={onBack} style={{ flex: '0 0 auto' }}>Back</Btn>
          <Btn onClick={() => name.trim() && code.trim() && onSubmit(name.trim(), code)} disabled={busy || !name.trim() || !code.trim()} style={{ flex: 1 }}>
            {busy ? 'Joining…' : 'Join Room'}
          </Btn>
        </div>
      </Card>
    </div>
  )
}

// ---- in-game router ----
function Game(props) {
  const { game } = props
  if (game.game_status === 'waiting') return <Waiting {...props} />
  if (game.game_status === 'briefing') return <Briefing {...props} />
  if (game.game_status === 'active') return <Trial {...props} />
  if (game.game_status === 'complete') return <Verdict {...props} />
  return null
}

function PlayersBar({ game }) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
      <div style={{ padding: '8px 14px', borderRadius: 10, background: C.pro + '22', border: `1px solid ${C.pro}66` }}>
        <span style={{ color: C.pro, fontWeight: 800 }}>Prosecution</span>{' '}
        <span style={{ color: C.white }}>{game.prosecution_player_name || '—'}</span>
      </div>
      <div style={{ padding: '8px 14px', borderRadius: 10, background: C.def + '22', border: `1px solid ${C.def}66` }}>
        <span style={{ color: '#7aa2ff', fontWeight: 800 }}>Defence</span>{' '}
        <span style={{ color: C.white }}>{game.defence_player_name || '—'}</span>
      </div>
    </div>
  )
}

function Waiting({ game, myRole, onLeave }) {
  return (
    <div style={{ paddingTop: 30 }}>
      <Header small />
      <Card style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: C.grey, letterSpacing: 1 }}>ROOM CODE</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: C.gold, letterSpacing: 3, margin: '6px 0 18px' }}>
          {game.room_code}
        </div>
        <div style={{ marginBottom: 18 }}>
          <Btn kind="dark" onClick={() => navigator.clipboard?.writeText(game.room_code)}>Copy code</Btn>
        </div>
        <div className="tt-pulse" style={{ color: C.white, fontSize: 18, fontWeight: 600 }}>
          Waiting for second player…
        </div>
        <p style={{ color: C.grey, fontSize: 14, marginTop: 10 }}>
          You are the <strong style={{ color: roleColor(myRole) }}>{ROLE_LABEL[myRole]}</strong>. Share
          the room code so your opponent can join.
        </p>
        <div style={{ marginTop: 16 }}>
          <Btn kind="ghost" onClick={onLeave}>Cancel</Btn>
        </div>
      </Card>
      <style>{`.tt-pulse{animation:ttp 1.4s ease-in-out infinite}@keyframes ttp{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
    </div>
  )
}

function useCountdown(deadlineIso) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  if (!deadlineIso) return null
  return Math.max(0, Math.ceil((new Date(deadlineIso).getTime() - now) / 1000))
}

function Briefing({ game, isHost, myRole, onStart }) {
  const c = CASES[game.selected_case]
  const left = useCountdown(game.briefing_ends_at)

  useEffect(() => {
    if (isHost && left === 0) onStart()
  }, [left, isHost, onStart])

  const mins = left != null ? Math.floor(left / 60) : 2
  const secs = left != null ? String(left % 60).padStart(2, '0') : '00'

  return (
    <div style={{ paddingTop: 16 }}>
      <Header small />
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <Tag>Case Briefing</Tag>
        <div style={{ fontSize: 30, fontWeight: 900, color: C.white, marginTop: 8 }}>{c.title}</div>
        <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: left <= 15 ? C.pro : C.gold }}>
          {mins}:{secs}
        </div>
        <div style={{ color: C.grey, fontSize: 13 }}>Trial begins automatically when the timer ends</div>
      </div>

      <PlayersBar game={game} />

      <Card style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0, color: C.gold }}>Case Summary</h3>
        <p style={{ color: '#d8e0f0', lineHeight: 1.6, margin: 0 }}>{c.summary}</p>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="tt-theories">
        <Card style={{ borderColor: C.pro + '66' }}>
          <h3 style={{ marginTop: 0, color: C.pro }}>Prosecution Theory</h3>
          <p style={{ color: '#d8e0f0', lineHeight: 1.6, margin: 0 }}>{c.prosecutionTheory}</p>
        </Card>
        <Card style={{ borderColor: C.def + '66' }}>
          <h3 style={{ marginTop: 0, color: '#7aa2ff' }}>Defence Theory</h3>
          <p style={{ color: '#d8e0f0', lineHeight: 1.6, margin: 0 }}>{c.defenceTheory}</p>
        </Card>
      </div>

      <div style={{ textAlign: 'center', marginTop: 22 }}>
        <p style={{ color: C.grey, fontSize: 14 }}>
          You are the <strong style={{ color: roleColor(myRole) }}>{ROLE_LABEL[myRole]}</strong>.
        </p>
        {isHost ? (
          <Btn onClick={onStart}>Start Trial Now</Btn>
        ) : (
          <p style={{ color: C.grey }}>Waiting for the host to begin…</p>
        )}
      </div>
      <style>{`@media(max-width:640px){.tt-theories{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}

function Trial({ game, myRole, session, onChoose, onObject, onAllow }) {
  const turn = game.current_turn
  const turnDef = TURNS.find((t) => t.n === turn)
  const activeRole = game.active_role
  const amActive = myRole === activeRole
  const pending = game.pending_statement
  const history = game.statement_history || []
  const last = history[history.length - 1]
  const objUsedKey = `${myRole}_objection_used`
  const myObjectionUsed = game[objUsedKey]

  const objLeft = useCountdown(pending?.deadline)
  const [objMode, setObjMode] = useState(false)
  useEffect(() => { setObjMode(false) }, [pending?.statementId])

  const options = STATEMENTS[turn] || []
  const pendingStatement = pending ? getStatementById(pending.statementId) : null

  return (
    <div style={{ paddingTop: 6 }}>
      <Header small />

      {/* status bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div>
          <Tag color={C.gold}>Turn {turn} / 10</Tag>{' '}
          <span style={{ color: C.white, fontWeight: 700 }}>
            {ROLE_LABEL[activeRole]} — {turnDef?.phase}
          </span>
        </div>
        <div style={{ fontSize: 13, color: C.grey }}>
          You: <strong style={{ color: roleColor(myRole) }}>{ROLE_LABEL[myRole]}</strong>
          {' · '}Objection {myObjectionUsed ? 'used' : 'available'}
        </div>
      </div>

      <Card style={{ marginBottom: 14, padding: 16 }}>
        <JuryGrid jurors={game.jurors} compact />
      </Card>

      {/* last play banner */}
      {last && !pending && (
        <Card style={{ marginBottom: 14, borderColor: roleColor(last.role) + '66' }}>
          <div style={{ fontSize: 12, color: C.grey, marginBottom: 6 }}>
            Turn {last.turn} · {ROLE_LABEL[last.role]} ({last.playerName})
          </div>
          <div style={{ color: C.white, fontStyle: 'italic', lineHeight: 1.5 }}>“{last.statementText}”</div>
          <div style={{ marginTop: 10, color: C.gold, fontSize: 14 }}>🗣️ {last.reaction}</div>
          {last.objection && (
            <div style={{ marginTop: 6, color: last.objectionEffective ? '#7aa2ff' : C.grey, fontSize: 13 }}>
              {last.objectionEffective
                ? `Objection (${last.objection}) sustained — impact reduced.`
                : `Objection (${last.objection}) overruled — credibility cost.`}
            </div>
          )}
        </Card>
      )}

      {/* pending: inactive objection window */}
      {pending && !amActive && (
        <Card style={{ borderColor: C.gold + '88' }}>
          <div style={{ fontSize: 12, color: C.grey }}>
            {ROLE_LABEL[pending.role]} ({pending.playerName}) stated:
          </div>
          <div style={{ color: C.white, fontStyle: 'italic', margin: '8px 0 14px', lineHeight: 1.5 }}>
            “{pendingStatement?.text}”
          </div>
          <div style={{ color: C.gold, fontWeight: 700, marginBottom: 12 }}>
            Object within {objLeft ?? 0}s — or allow it to stand.
          </div>
          {!objMode ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn kind="pro" onClick={() => setObjMode(true)} disabled={myObjectionUsed}>
                {myObjectionUsed ? 'Objection used' : 'Object!'}
              </Btn>
              <Btn kind="dark" onClick={onAllow}>Allow it</Btn>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: C.grey, marginBottom: 8 }}>Choose your objection:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {OBJECTION_TYPES.map((t) => (
                  <Btn key={t} kind="ghost" onClick={() => onObject(t)}>{t}</Btn>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <Btn kind="dark" onClick={() => setObjMode(false)}>Cancel</Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* pending: active waiting */}
      {pending && amActive && (
        <Card style={{ textAlign: 'center' }}>
          <div className="tt-pulse" style={{ color: C.white, fontSize: 16 }}>
            Statement locked in. Waiting to see if {ROLE_LABEL[game.active_role === 'prosecution' ? 'defence' : 'prosecution']} objects… ({objLeft ?? 0}s)
          </div>
          <style>{`.tt-pulse{animation:ttp 1.4s ease-in-out infinite}@keyframes ttp{0%,100%{opacity:.55}50%{opacity:1}}`}</style>
        </Card>
      )}

      {/* my turn: choose statement */}
      {!pending && amActive && (
        <Card>
          <div style={{ color: C.gold, fontWeight: 800, marginBottom: 4 }}>Your move — choose a statement</div>
          <div style={{ color: C.grey, fontSize: 13, marginBottom: 14 }}>{turnDef?.phase}</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {options.map((s) => (
              <button key={s.id} onClick={() => onChoose(s)} style={{
                textAlign: 'left', background: C.panel2, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: 14, cursor: 'pointer', color: C.white,
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.gold)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
              >
                <div style={{ lineHeight: 1.5, marginBottom: 8 }}>{s.text}</div>
                <Tag>{s.category}</Tag>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* opponent's turn */}
      {!pending && !amActive && (
        <Card style={{ textAlign: 'center' }}>
          <div className="tt-pulse" style={{ color: C.white, fontSize: 17, fontWeight: 600 }}>
            Waiting for opponent to choose their statement…
          </div>
          <style>{`.tt-pulse{animation:ttp 1.4s ease-in-out infinite}@keyframes ttp{0%,100%{opacity:.55}50%{opacity:1}}`}</style>
        </Card>
      )}
    </div>
  )
}

function Verdict({ game, onPlayAgain, onLeave }) {
  const tally = countLeanings(game.jurors)
  const { strongest, weakest } = analyzeMoves(game.statement_history)
  const v = game.final_verdict
  const winner = game.winner
  const winColor = winner === 'prosecution' ? C.pro : winner === 'defence' ? C.def : C.gold

  return (
    <div style={{ paddingTop: 16 }}>
      <Header small />
      <Card style={{ textAlign: 'center', marginBottom: 16, borderColor: winColor + '88' }}>
        <Tag color={winColor}>Verdict</Tag>
        <div style={{ fontSize: 44, fontWeight: 900, color: winColor, margin: '10px 0' }}>{v}</div>
        <div style={{ fontSize: 18, color: C.white }}>
          {winner === 'none'
            ? 'Hung jury — no side prevails.'
            : `${ROLE_LABEL[winner]} wins.`}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, color: C.gold }}>Final Jury Split</h3>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div><div style={{ fontSize: 32, fontWeight: 900, color: C.pro }}>{tally.pro}</div><div style={{ color: C.grey, fontSize: 13 }}>Prosecution</div></div>
          <div><div style={{ fontSize: 32, fontWeight: 900, color: C.grey }}>{tally.undecided}</div><div style={{ color: C.grey, fontSize: 13 }}>Undecided</div></div>
          <div><div style={{ fontSize: 32, fontWeight: 900, color: '#7aa2ff' }}>{tally.def}</div><div style={{ color: C.grey, fontSize: 13 }}>Defence</div></div>
        </div>
        <JuryGrid jurors={game.jurors} compact />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }} className="tt-theories">
        <Card>
          <div style={{ color: '#7CFC9B', fontWeight: 800, marginBottom: 8 }}>💪 Strongest Move</div>
          {strongest ? (
            <>
              <div style={{ fontSize: 12, color: C.grey }}>Turn {strongest.turn} · {ROLE_LABEL[strongest.role]}</div>
              <div style={{ color: C.white, fontStyle: 'italic', marginTop: 6, lineHeight: 1.5 }}>“{strongest.statementText}”</div>
            </>
          ) : <div style={{ color: C.grey }}>—</div>}
        </Card>
        <Card>
          <div style={{ color: C.pro, fontWeight: 800, marginBottom: 8 }}>📉 Weakest Move</div>
          {weakest ? (
            <>
              <div style={{ fontSize: 12, color: C.grey }}>Turn {weakest.turn} · {ROLE_LABEL[weakest.role]}</div>
              <div style={{ color: C.white, fontStyle: 'italic', marginTop: 6, lineHeight: 1.5 }}>“{weakest.statementText}”</div>
            </>
          ) : <div style={{ color: C.grey }}>—</div>}
        </Card>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <Btn onClick={onPlayAgain}>Play Again</Btn>
        <Btn kind="ghost" onClick={onLeave}>Return Home</Btn>
      </div>
      <style>{`@media(max-width:640px){.tt-theories{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
