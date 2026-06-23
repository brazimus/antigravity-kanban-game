import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Shield, User, Play, LogIn, UserPlus } from 'lucide-react';

interface MultiplayerLobbyProps {
  onJoinAsPlayer: (roomCode: string, name: string, color: string, playerId: string) => void;
  onJoinAsAdmin: (roomCode: string, adminId: string, isNew: boolean, scenarioId: string) => void;
}

const AVATAR_COLORS = [
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#10b981' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Teal', hex: '#06b6d4' }
];

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  onJoinAsPlayer,
  onJoinAsAdmin
}) => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminRegister, setIsAdminRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Player fields
  const [playerRoomCode, setPlayerRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerColor, setPlayerColor] = useState(AVATAR_COLORS[0].hex);

  // Admin credentials
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  // Admin room creation
  const [adminRoomCode, setAdminRoomCode] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('easy_mode');
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminUid, setAdminUid] = useState<string | null>(null);

  // Generate a random 6-character suggested room code
  const suggestRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'AG-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAdminRoomCode(code);
    setError(null);
  };

  // Handle student join
  const handlePlayerJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerRoomCode || !playerName) {
      setError('Please fill in room code and name.');
      return;
    }

    setLoading(true);
    setError(null);

    const formattedCode = playerRoomCode.trim().toUpperCase();

    try {
      // 1. Verify game exists
      const gameRef = doc(db, 'games', formattedCode);
      const gameSnap = await getDoc(gameRef);

      if (!gameSnap.exists()) {
        setError(`Game room "${formattedCode}" does not exist.`);
        setLoading(false);
        return;
      }

      if (gameSnap.data().status !== 'active') {
        setError(`Game room "${formattedCode}" is no longer active.`);
        setLoading(false);
        return;
      }

      // 2. Sign in player anonymously
      const userCredential = await signInAnonymously(auth);
      const playerId = userCredential.user.uid;

      // 3. Register player in room
      const playerRef = doc(db, 'games', formattedCode, 'players', playerId);
      await setDoc(playerRef, {
        id: playerId,
        name: playerName.trim(),
        color: playerColor,
        currentRoll: null,
        remainingCapacity: 0,
        workedOnCardIdsToday: [],
        assignedCardId: null,
        previousCardId: null,
        spentCapacity: 0
      });

      onJoinAsPlayer(formattedCode, playerName.trim(), playerColor, playerId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to join game room.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin Auth
  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) {
      setError('Please enter email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let userCredential;
      if (isAdminRegister) {
        userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      }
      setAdminUid(userCredential.user.uid);
      setAdminLoggedIn(true);
      suggestRoomCode(); // Suggest code immediately upon logging in
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin Game Room Creation
  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRoomCode || !adminUid) {
      setError('Room code is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const formattedCode = adminRoomCode.trim().toUpperCase();

    try {
      // Check collision
      const gameRef = doc(db, 'games', formattedCode);
      const gameSnap = await getDoc(gameRef);

      if (gameSnap.exists()) {
        const gameData = gameSnap.data();
        if (gameData.status === 'active') {
          setError(`Room code "${formattedCode}" is already in use by an active session.`);
          setLoading(false);
          return;
        }
      }

      onJoinAsAdmin(formattedCode, adminUid, true, selectedScenario);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to check or create room code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin Joining existing room
  const handleAdminResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRoomCode || !adminUid) {
      setError('Room code is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const formattedCode = adminRoomCode.trim().toUpperCase();

    try {
      const gameRef = doc(db, 'games', formattedCode);
      const gameSnap = await getDoc(gameRef);

      if (!gameSnap.exists()) {
        setError(`Room "${formattedCode}" does not exist.`);
        setLoading(false);
        return;
      }

      if (gameSnap.data().adminId !== adminUid) {
        setError(`You are not the creator of game room "${formattedCode}".`);
        setLoading(false);
        return;
      }

      onJoinAsAdmin(formattedCode, adminUid, false, gameSnap.data().activeScenarioId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to resume game room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      height: '100%',
      overflowY: 'auto'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '30px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-glass-card)'
      }}>
        {/* Toggle between Player and Admin tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(0,0,0,0.2)',
          padding: '4px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '25px'
        }}>
          <button
            onClick={() => { setIsAdminMode(false); setError(null); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              backgroundColor: !isAdminMode ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: !isAdminMode ? '#fff' : 'var(--text-secondary)',
              borderRadius: '4px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <User size={14} /> Student Player
          </button>
          <button
            onClick={() => { setIsAdminMode(true); setError(null); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              backgroundColor: isAdminMode ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: isAdminMode ? '#fff' : 'var(--text-secondary)',
              borderRadius: '4px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Shield size={14} /> Class Instructor
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(244,63,94,0.15)',
            border: '1px solid rgba(244,63,94,0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 15px',
            color: 'var(--accent-red)',
            fontSize: '0.8rem',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {/* 1. STUDENT VIEW */}
        {!isAdminMode && (
          <form onSubmit={handlePlayerJoin}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#fff' }}>Join Game Session</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Enter the room code shared by your instructor to join the flow simulation.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                  ROOM CODE
                </label>
                <input 
                  type="text"
                  placeholder="e.g. AG-FLW1"
                  value={playerRoomCode}
                  onChange={(e) => setPlayerRoomCode(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-glass)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                  YOUR NAME
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Alice"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-glass)',
                    color: '#fff',
                    fontSize: '0.9rem'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  AVATAR COLOR
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setPlayerColor(c.hex)}
                      style={{
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: c.hex,
                        border: playerColor === c.hex ? '3px solid #fff' : '2px solid transparent',
                        cursor: 'pointer',
                        boxShadow: playerColor === c.hex ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
              >
                <Play size={16} /> {loading ? 'Joining Room...' : 'Join Simulation'}
              </button>
            </div>
          </form>
        )}

        {/* 2. ADMIN VIEW */}
        {isAdminMode && (
          <div>
            {!adminLoggedIn ? (
              /* A. ADMIN LOGIN/REGISTER FORM */
              <form onSubmit={handleAdminAuth}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#fff' }}>
                  {isAdminRegister ? 'Create Instructor Account' : 'Instructor Sign In'}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Authenticate to create and coordinate multiplayer classrooms.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                      EMAIL
                    </label>
                    <input 
                      type="email"
                      placeholder="instructor@school.edu"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-glass)',
                        color: '#fff',
                        fontSize: '0.9rem'
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                      PASSWORD
                    </label>
                    <input 
                      type="password"
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-glass)',
                        color: '#fff',
                        fontSize: '0.9rem'
                      }}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                  >
                    {isAdminRegister ? <UserPlus size={16} /> : <LogIn size={16} />}
                    {loading 
                      ? 'Authenticating...' 
                      : isAdminRegister ? 'Register Account' : 'Sign In'}
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => { setIsAdminRegister(!isAdminRegister); setError(null); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {isAdminRegister ? 'Already have an account? Sign In' : 'Need an account? Register here'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* B. ADMIN SESSION CREATOR / RESUMER */
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#fff' }}>Configure Classroom Room</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Choose a custom code or check/create a room to manage.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Create New Room Section */}
                  <form onSubmit={handleCreateGame} style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '20px' }}>
                    <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      Option 1: Start New Game
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            ROOM CODE
                          </label>
                          <button 
                            type="button" 
                            onClick={suggestRoomCode}
                            style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Suggest Code
                          </button>
                        </div>
                        <input 
                          type="text"
                          placeholder="e.g. CLASS-A"
                          value={adminRoomCode}
                          onChange={(e) => setAdminRoomCode(e.target.value.toUpperCase())}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--border-glass)',
                            color: '#fff',
                            fontSize: '0.9rem',
                            fontFamily: 'monospace'
                          }}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                          STARTING SCENARIO
                        </label>
                        <select
                          value={selectedScenario}
                          onChange={(e) => setSelectedScenario(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--border-glass)',
                            color: '#fff',
                            fontSize: '0.85rem'
                          }}
                        >
                          <option value="easy_mode">Standard Software Project (10 Days)</option>
                          <option value="sandbox_mode">Sandbox/Custom Scenario (Infinite)</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '10px' }}
                      >
                        <Play size={14} /> {loading ? 'Creating...' : 'Create & Launch Room'}
                      </button>
                    </div>
                  </form>

                  {/* Resume Existing Room Section */}
                  <form onSubmit={handleAdminResume}>
                    <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      Option 2: Rejoin Active Room
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                          ROOM CODE
                        </label>
                        <input 
                          type="text"
                          placeholder="e.g. AG-FLW1"
                          value={adminRoomCode}
                          onChange={(e) => setAdminRoomCode(e.target.value.toUpperCase())}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--border-glass)',
                            color: '#fff',
                            fontSize: '0.9rem',
                            fontFamily: 'monospace'
                          }}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-secondary"
                        style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
                      >
                        Resume Running Session
                      </button>
                    </div>
                  </form>

                  <button
                    onClick={() => { setAdminLoggedIn(false); setAdminUid(null); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      textDecoration: 'underline',
                      marginTop: '10px'
                    }}
                  >
                    Logout Instructor Account
                  </button>

                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
