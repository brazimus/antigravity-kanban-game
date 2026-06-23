import { useState } from 'react';
import { useGameState } from './useGameState';
import { useMultiplayerState } from './useMultiplayerState';
import { Board } from './components/Board';
import { Controls } from './components/Controls';
import { Dashboard } from './components/Dashboard';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { 
  LayoutGrid, BarChart3, Play, HelpCircle 
} from 'lucide-react';
import type { GameConfig } from './types';
import './App.css';

function App() {
  // Global App State Variables (analogous to global package variables in Perl)
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [pendingConfig, setPendingConfig] = useState<GameConfig | undefined>(undefined);

  // Instantiating the two state engines.
  // singleEngine: runs purely in-memory (local state hashes) for offline single-player.
  // multiEngine: sets up reactive Firestore listeners and transactional mutations for cloud sync.
  const singleEngine = useGameState();
  const multiEngine = useMultiplayerState(roomCode, currentPlayerId, isAdmin, pendingConfig);

  const isMulti = mode === 'multi' && roomCode !== null;

  // Active Engine Dispatcher:
  // Dynamically assigns the active controller engine based on the multiplayer toggle switch.
  // Think of this as dynamic dispatching of a method call to either local or DB backend packages.
  const activeEngine = isMulti 
    ? { ...multiEngine, startGame: () => multiEngine.createRoom('easy_mode') } 
    : singleEngine;

  const {
    gameState,
    rollDice,
    allocateCapacity,
    resetDailyWork,
    moveCard,
    endDay,
    startNextDay,
    replenishBacklog,
    startGame,
    fastForwardToWeekEnd,
    injectCustomExpediteCards,
    splitEpic,
    queueEvent
  } = activeEngine;

  const [activeTab, setActiveTab] = useState<'board' | 'metrics'>('board');
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  const completedCards = gameState.cards.filter(c => c.columnId === 'done');
  const activeCards = gameState.cards.filter(c => c.columnId !== 'done');

  // Calculate some simple overview stats
  const activeWIP = activeCards.filter(c => c.columnId !== 'backlog' && c.columnId !== 'ready').length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
    }}>
      
      {/* Top Navigation Header */}
      <header className="glass-panel" style={{
        height: '65px',
        margin: '10px 10px 0 10px',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 'var(--radius-md)',
        zIndex: 10,
        backgroundColor: 'var(--bg-glass-card)'
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1rem',
            boxShadow: 'var(--shadow-neon-primary)'
          }}>
            AG
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              Antigravity Kanban Game
            </h1>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '-2px' }}>
              Educational Agile Flow Simulator
            </p>
          </div>
        </div>

        {/* Tab Controls (Only visible when game is active) */}
        {gameState.gamePhase !== 'intro' && (
          <div style={{ display: 'flex', gap: '5px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => setActiveTab('board')}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                backgroundColor: activeTab === 'board' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: activeTab === 'board' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '4px',
                gap: '6px'
              }}
            >
              <LayoutGrid size={14} /> Board View
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                backgroundColor: activeTab === 'metrics' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: activeTab === 'metrics' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '4px',
                gap: '6px'
              }}
            >
              <BarChart3 size={14} /> Metrics & Reports
            </button>
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Mode Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Mode:</span>
            <select
              value={mode}
              onChange={(e) => {
                const selectedMode = e.target.value as 'single' | 'multi';
                setMode(selectedMode);
                if (selectedMode === 'single') {
                  setRoomCode(null);
                  setCurrentPlayerId(null);
                  setIsAdmin(false);
                }
              }}
              style={{
                padding: '4px 8px',
                fontSize: '0.75rem',
                backgroundColor: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-glass)',
                color: '#fff',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'var(--font-title)',
                fontWeight: 600
              }}
            >
              <option value="single">Single Player (Offline)</option>
              <option value="multi">Multiplayer (Classroom)</option>
            </select>
          </div>

          {/* Room Display Code */}
          {isMulti && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              padding: '4px 10px',
              borderRadius: '4px',
              border: '1px solid var(--border-glass)',
              fontSize: '0.75rem'
            }}>
              <span>Room: <strong style={{ color: 'var(--secondary)', fontFamily: 'monospace' }}>{roomCode}</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ color: isAdmin ? 'var(--accent-amber)' : 'var(--primary)', fontWeight: 600 }}>
                {isAdmin ? 'Instructor' : playerName}
              </span>
              <button
                onClick={() => {
                  setRoomCode(null);
                  setCurrentPlayerId(null);
                  setIsAdmin(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-red)',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  marginLeft: '5px',
                  textDecoration: 'underline'
                }}
              >
                Leave
              </button>
            </div>
          )}

          <button 
            onClick={() => setShowTutorialModal(true)} 
            className="btn btn-secondary" 
            style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}
          >
            <HelpCircle size={14} /> How to Play
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main style={{
        flex: 1,
        padding: '10px',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
      }}>
        
        {mode === 'multi' && !roomCode ? (
          <MultiplayerLobby 
            onJoinAsPlayer={(code, name, _color, playerId) => {
              setRoomCode(code);
              setPlayerName(name);
              setCurrentPlayerId(playerId);
              setIsAdmin(false);
            }}
            onJoinAsAdmin={(code, adminId, _isNew, _scenarioId, config) => {
              if (config) {
                setPendingConfig(config);
              }
              setRoomCode(code);
              setCurrentPlayerId(adminId);
              setIsAdmin(true);
            }}
          />
        ) : gameState.gamePhase === 'intro' ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '20px'
          }}>
            <div className="glass-panel" style={{
              maxWidth: '650px',
              padding: '40px',
              textAlign: 'center',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-glass-card)'
            }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--primary)',
                backgroundColor: 'rgba(139, 92, 246, 0.12)',
                padding: '4px 12px',
                borderRadius: '100px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Interactive Teaching Game
              </span>
              
              <h2 style={{ fontSize: '2rem', marginTop: '15px', marginBottom: '15px', color: '#fff' }}>
                Master Kanban Flow Mechanics
              </h2>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '25px' }}>
                Manage a software squad through a 10-day release script. Compare two operating models: 
                <strong> Week 1 (Unconstrained WIP)</strong> where multitasking and high queue build-up disrupt throughput, and 
                <strong> Week 2 (Kanban & WIP Limits)</strong> where focus and pairing unlock optimal lead time.
              </p>

              {/* Core Features Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', textAlign: 'left', marginBottom: '35px' }}>
                <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '5px' }}>🎲 Capacity Dice</h4>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Roll capacity dice daily for each team member to assign points.</p>
                </div>
                <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-amber)', marginBottom: '5px' }}>⚡ Penalty & Pair</h4>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Cognitive loading rules switch penalties, while pairing speeds up and rolls with advantage.</p>
                </div>
                <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-green)', marginBottom: '5px' }}>📈 Flow Analytics</h4>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Analyze real-time metrics including CFD, Control Charts, and Aging WIP.</p>
                </div>
              </div>

              <button 
                onClick={startGame} 
                className="btn btn-primary pulse-primary" 
                style={{ padding: '15px 35px', fontSize: '1rem', borderRadius: 'var(--radius-md)' }}
              >
                <Play size={18} /> Start Scripted Simulation
              </button>
            </div>
          </div>
        ) : (
          
          /* ACTIVE GAMEPLAY AREA */
          <div style={{
            flex: 1,
            display: 'flex',
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            gap: '15px'
          }}>
            {activeTab === 'board' ? (
              <>
                {/* Left Side: Kanban Board */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                  
                  {/* Active limits dashboard mini */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 15px',
                    marginBottom: '10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-glass)',
                    fontSize: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <span>Active WIP: <strong>{activeWIP}</strong> cards</span>
                      <span>Pairing Allowed: <strong>{gameState.pairingAllowed ? 'Yes' : 'No'}</strong></span>
                      <span>WIP Limits: <strong>{gameState.day >= 6 ? 'Enforced' : 'None (Week 1)'}</strong></span>
                    </div>
                    {gameState.day < 6 ? (
                      <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>⚠️ Try starting everything to see the impact of high WIP!</span>
                    ) : (
                      <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>✅ WIP Limits are active. Focus on completing active work!</span>
                    )}
                  </div>

                  <Board 
                    columns={gameState.columns}
                    cards={gameState.cards}
                    avatars={gameState.avatars}
                    pairingAllowed={gameState.pairingAllowed}
                    onAllocateCapacity={allocateCapacity}
                    onMoveCard={moveCard}
                    gamePhase={gameState.gamePhase}
                    onReplenishBacklog={replenishBacklog}
                    currentPlayerId={currentPlayerId}
                    isAdmin={isAdmin}
                    onSplitEpic={splitEpic}
                  />
                </div>

                {/* Right Side: Sidebar Controls */}
                <div style={{ width: '340px', height: '100%', overflowY: 'auto', paddingRight: '5px' }}>
                  <Controls 
                    gameState={gameState}
                    onRollDice={rollDice}
                    onEndDay={endDay}
                    onStartNextDay={startNextDay}
                    onRestartGame={startGame}
                    onResetDailyWork={resetDailyWork}
                    isMultiplayer={mode === 'multi'}
                    isAdmin={isAdmin}
                    onQueueEvent={queueEvent}
                    onFastForward={fastForwardToWeekEnd}
                    onInjectCustomExpediteCards={injectCustomExpediteCards}
                  />
                </div>
              </>
            ) : (
              /* Metrics Dashboard view tab */
              <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
                <Dashboard 
                  logs={gameState.dailyLogs}
                  completedCards={completedCards}
                  activeCards={activeCards}
                  currentDay={gameState.day}
                  isMultiplayer={mode === 'multi'}
                  isAdmin={isAdmin}
                />
              </div>
            )}

          </div>
        )}
      </main>

      {/* HOW TO PLAY TUTORIAL MODAL */}
      {showTutorialModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '600px',
            width: '100%',
            padding: '30px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'hsl(222, 47%, 10%)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ fontSize: '1.4rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px', marginBottom: '15px' }}>
              How to Play Antigravity Kanban
            </h3>
            
            <div style={{ fontSize: '0.85rem', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <h4 style={{ color: 'var(--primary)', marginBottom: '4px' }}>1. Flow of the Day</h4>
                <p>Each day starts by rolling capacity dice. Then, assign your available developer points to cards on the board by clicking the <strong>"+"</strong> button on a card and choosing a dev. Once allocated, click <strong>"Run Day Work"</strong> to process effort, clear blockers, and log metrics.</p>
              </div>

              <div>
                <h4 style={{ color: 'var(--secondary)', marginBottom: '4px' }}>2. Card Progression & Pulling</h4>
                <p>Cards have effort points in stages matching columns (Analysis, Dev, Testing). Complete effort in a column stage to mark it "Ready to Pull". Click <strong>"Ready to Pull"</strong> to move it forward. You can move cards backward if you need to redo work.</p>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-amber)', marginBottom: '4px' }}>3. Context Switching Penalty</h4>
                <p>Assigning a developer to a card different from the previous day incurs a <strong>-1 capacity penalty</strong>. Keep developers focused on tasks until completion to maximize efficiency!</p>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-green)', marginBottom: '4px' }}>4. Paired Tasking (Week 2 onwards)</h4>
                <p>Pairing is allowed on tasks from Day 6. The second helper dev contributes <strong>50% capacity</strong>, but rolls unblocks or blocker checks with <strong>advantage</strong> (rolls twice, takes best). Pair up to unblock stuck items!</p>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-red)', marginBottom: '4px' }}>5. Blockers & Defects</h4>
                <p>Work on tasks has a 15% chance to trigger a blocker. Blocked tasks cannot progress until unblocked (assign a dev to roll 4+ on d6). Also, testing cards have a chance to fail QA and get sent back to Dev for rework!</p>
              </div>
            </div>

            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowTutorialModal(false)} 
                className="btn btn-primary"
                style={{ padding: '8px 20px' }}
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
