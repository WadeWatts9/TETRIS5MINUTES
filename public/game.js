// ==========================================
// PERSISTENCIA DE ID DE JUGADOR (RECONEXIÓN)
// ==========================================
let playerId = localStorage.getItem('tetris_player_id');
if (!playerId) {
  playerId = 'p_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
  localStorage.setItem('tetris_player_id', playerId);
}

// Variables de WebSocket
const socket = io();

// Elementos del DOM
const screenWaiting = document.getElementById('screen-waiting');
const screenLobby = document.getElementById('screen-lobby');
const screenGame = document.getElementById('screen-game');
const screenGameOver = document.getElementById('screen-gameover');

const formRegister = document.getElementById('form-register');
const inputPlayerName = document.getElementById('player-name');
const btnLeaveQueue = document.getElementById('btn-leave-queue');
const btnRestart = document.getElementById('btn-restart');
const btnToggleRetro = document.getElementById('btn-toggle-retro');
const scanlines = document.getElementById('retro-scanlines');

const activePlayersText = document.getElementById('active-count');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const leaderboardList = document.getElementById('leaderboard-list');
const queuePositionVal = document.getElementById('queue-position-val');

const gameTimerText = document.getElementById('game-timer');
const gameScoreText = document.getElementById('game-score');
const nextObstacleTimerText = document.getElementById('next-obstacle-timer');
const finalScoreValText = document.getElementById('final-score-val');
const rankBadge = document.getElementById('rank-badge');

const obstacleBanner = document.getElementById('obstacle-banner');
const obstacleTitle = document.getElementById('obstacle-title');
const obstacleDesc = document.getElementById('obstacle-desc');
const obstacleProgress = document.getElementById('obstacle-progress');
const fogOverlay = document.getElementById('fog-overlay');

// Canvas de Tetris
const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

// Configuración del tablero
const ROW = 20;
const COL = 10;
const SQ = 30; // Tamaño del bloque en px (300x600 canvas)
const VACANTE = '#020409'; // Color de celda vacía

// Definición de las piezas (Tetrominos) y sus colores
const PIEZAS = [
  [ // I
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]
  ],
  [ // J
    [[1,0,0],[1,1,1],[0,0,0]],
    [[0,1,1],[0,1,0],[0,1,0]],
    [[0,0,0],[1,1,1],[0,0,1]],
    [[0,1,0],[0,1,0],[1,1,0]]
  ],
  [ // L
    [[0,0,1],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,0],[0,1,1]],
    [[0,0,0],[1,1,1],[1,0,0]],
    [[1,1,0],[0,1,0],[0,1,0]]
  ],
  [ // O
    [[1,1],[1,1]]
  ],
  [ // S
    [[0,1,1],[1,1,0],[0,0,0]],
    [[0,1,0],[0,1,1],[0,0,1]],
    [[0,0,0],[0,1,1],[1,1,0]],
    [[1,0,0],[1,1,0],[0,1,0]]
  ],
  [ // T
    [[0,1,0],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,1],[0,1,0]],
    [[0,1,0],[1,1,0],[0,1,0]]
  ],
  [ // Z
    [[1,1,0],[0,1,1],[0,0,0]],
    [[0,0,1],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,0],[0,1,1]],
    [[0,1,0],[1,1,0],[1,0,0]]
  ]
];

// Colores premium con degradados/sombras (Temática Bordeau/Navy)
const COLORES = [
  { main: '#38bdf8', border: '#0284c7' }, // I: Celeste
  { main: '#60a5fa', border: '#2563eb' }, // J: Azul
  { main: '#fb923c', border: '#ea580c' }, // L: Naranja
  { main: '#800020', border: '#500010' }, // O: Bordeau
  { main: '#fca5a5', border: '#ef4444' }, // S: Bordeau claro
  { main: '#c084fc', border: '#9333ea' }, // T: Púrpura
  { main: '#f43f5e', border: '#e11d48' }  // Z: Rosa/Rojo
];

// Estado del Juego
let tablero = [];
let score = 0;
let gameOver = false;
let playerName = localStorage.getItem('tetris_player_name') || '';
if (playerName) {
  inputPlayerName.value = playerName;
}
let isRetroMode = false;

// Variables de tiempo
let matchTimeLeft = 300;
let gameTimerInterval = null;
let gravityInterval = null;

// Lógica de caída
let dropStart = Date.now();
let baseSpeed = 800;
let currentSpeed = baseSpeed;

// Piezas activas
let piezaActiva = null;
let piezaSiguiente = null;

// Sistema de Obstáculos
const CYCLE_DURATION = 45; 
const OBSTACLE_DURATION = 15;
let cycleTimer = 0;
let obstaculoActivo = null;
let nextObstacleTimerInterval = null;

const OBSTACULOS = {
  REVERSED_CONTROLS: {
    name: 'CONTROLES INVERTIDOS',
    desc: '¡Izquierda es Derecha y Derecha es Izquierda!',
    color: '#800020'
  },
  FOG: {
    name: 'NIEBLA DE RIVERA',
    desc: 'Una densa niebla dificulta ver el centro del tablero.',
    color: '#475569'
  },
  SPEED_UP: {
    name: 'VELOCIDAD EXTREMA',
    desc: '¡La gravedad ha aumentado drásticamente!',
    color: '#800020'
  },
  EARTHQUAKE: {
    name: 'TERREMOTO',
    desc: '¡El tablero tiembla y aparecen bloques de basura!',
    color: '#b45309'
  },
  ZERO_GRAVITY: {
    name: 'GRAVEDAD ZERO',
    desc: 'La gravedad se desvanece. ¡Mueve y baja la pieza tú mismo!',
    color: '#38bdf8'
  }
};

// Helper para centralizar e informar los incrementos de puntaje en tiempo real pasándole el playerId
function addScore(points) {
  score += points;
  gameScoreText.textContent = String(score).padStart(5, '0');
  socket.emit('score_update', { playerId: playerId, score: score });
}

// ==========================================
// 1. CONEXIÓN Y EVENTOS DE SOCKET.IO
// ==========================================

socket.on('connect', () => {
  statusDot.className = 'status-dot green';
  statusText.textContent = 'Conectado';
  
  // Autenticar la sesión del socket inmediatamente al conectar o reconectar
  socket.emit('authenticate', { playerId: playerId, name: playerName });
});

socket.on('disconnect', () => {
  statusDot.className = 'status-dot red';
  statusText.textContent = 'Desconectado (Reconectando...)';
});

// Estado inicial
socket.on('init_state', (state) => {
  updateServerStatusUI(state);
  updateLeaderboard(state.leaderboard);
  
  if (state.isActive) {
    showScreen(screenLobby);
  } else if (state.isInQueue) {
    showScreen(screenWaiting);
  } else {
    showScreen(screenLobby);
  }
});

// Actualizaciones de estado periódicas
socket.on('server_status', (state) => {
  updateServerStatusUI(state);
  updateLeaderboard(state.leaderboard);
});

// Asignación de posición en cola
socket.on('queue_entered', (data) => {
  queuePositionVal.textContent = data.position;
  showScreen(screenWaiting);
});

socket.on('queue_position', (data) => {
  queuePositionVal.textContent = data.position;
});

// Luz verde para entrar al Lobby
socket.on('play_allowed', () => {
  showScreen(screenLobby);
});

// Recibir orden de expulsión del Administrador
socket.on('kicked_by_admin', () => {
  alert('Has sido expulsado de la partida por el administrador.');
  endGame();
  showScreen(screenLobby);
});

socket.on('game_finished', () => {
  // Confirmado
});

// ==========================================
// 2. CONTROL DE PANTALLAS Y SELECTOR RETRO
// ==========================================

function showScreen(screenToShow) {
  [screenWaiting, screenLobby, screenGame, screenGameOver].forEach(screen => {
    screen.classList.add('hidden');
  });
  screenToShow.classList.remove('hidden');
}

// Envío del formulario de registro
formRegister.addEventListener('submit', (e) => {
  e.preventDefault();
  playerName = inputPlayerName.value.trim().substring(0, 15);
  if (!playerName) return;

  localStorage.setItem('tetris_player_name', playerName);
  socket.emit('register_name', { playerId: playerId, name: playerName });
  startGame();
});

// Abandonar cola
btnLeaveQueue.addEventListener('click', () => {
  socket.emit('leave_queue', { playerId: playerId });
  showScreen(screenLobby);
});

// Volver a jugar
btnRestart.addEventListener('click', () => {
  socket.emit('request_to_play', { playerId: playerId });
});

// Alternancia de Modo Retro
btnToggleRetro.addEventListener('click', () => {
  isRetroMode = !isRetroMode;
  if (isRetroMode) {
    document.body.classList.add('retro-active');
    scanlines.classList.remove('hidden');
    btnToggleRetro.textContent = "Modo Normal [x]";
  } else {
    document.body.classList.remove('retro-active');
    scanlines.classList.add('hidden');
    btnToggleRetro.textContent = "Modo Retro [ ]";
  }
  
  // Redibujar inmediatamente el canvas
  drawBoard();
  if (piezaActiva) piezaActiva.draw();
  if (piezaSiguiente) drawNextPiece();
});

function updateServerStatusUI(state) {
  activePlayersText.textContent = state.activeCount;
  if (state.activeCount >= state.maxPlayers) {
    statusDot.className = 'status-dot yellow';
    statusText.textContent = 'Servidor Lleno';
  } else {
    statusDot.className = 'status-dot green';
    statusText.textContent = 'Slots Disponibles';
  }
}

function updateLeaderboard(scores) {
  leaderboardList.innerHTML = '';
  if (!scores || scores.length === 0) {
    leaderboardList.innerHTML = '<li class="empty-list">No hay puntajes registrados aún.</li>';
    return;
  }
  
  scores.forEach((item, index) => {
    const li = document.createElement('li');
    if (index === 0) li.classList.add('top-1');
    else if (index === 1) li.classList.add('top-2');
    else if (index === 2) li.classList.add('top-3');
    
    li.innerHTML = `
      <div class="rank-info">
        <span class="rank-num">#${index + 1}</span>
        <span class="player-name-val">${escapeHTML(item.name)}</span>
      </div>
      <span class="score-val">${item.score}</span>
    `;
    leaderboardList.appendChild(li);
  });
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Solicitar un puesto al inicio
socket.emit('request_to_play', { playerId: playerId });

// ==========================================
// 3. MOTOR DEL JUEGO TETRIS
// ==========================================

class Piece {
  constructor(tetromino, color, colorBorder) {
    this.tetromino = tetromino;
    this.color = color;
    this.colorBorder = colorBorder;
    this.tetrominoN = 0;
    this.activeTetromino = this.tetromino[this.tetrominoN];
    this.x = 3;
    this.y = -2;
  }

  draw() {
    this.fill(this.color, this.colorBorder);
  }

  unDraw() {
    this.fill(VACANTE, 'transparent');
  }

  fill(color, borderColor) {
    for (let r = 0; r < this.activeTetromino.length; r++) {
      for (let c = 0; c < this.activeTetromino[r].length; c++) {
        if (this.activeTetromino[r][c]) {
          drawSquare(this.x + c, this.y + r, color, borderColor);
        }
      }
    }
  }

  moveDown() {
    if (!this.collision(0, 1, this.activeTetromino)) {
      this.unDraw();
      this.y++;
      this.draw();
    } else {
      this.lock();
    }
  }

  moveRight() {
    if (!this.collision(1, 0, this.activeTetromino)) {
      this.unDraw();
      this.x++;
      this.draw();
    }
  }

  moveLeft() {
    if (!this.collision(-1, 0, this.activeTetromino)) {
      this.unDraw();
      this.x--;
      this.draw();
    }
  }

  rotate() {
    let nextPattern = this.tetromino[(this.tetrominoN + 1) % this.tetromino.length];
    let kick = 0;

    if (this.collision(0, 0, nextPattern)) {
      if (this.x > COL / 2) {
        kick = -1;
      } else {
        kick = 1;
      }
    }

    if (!this.collision(kick, 0, nextPattern)) {
      this.unDraw();
      this.x += kick;
      this.tetrominoN = (this.tetrominoN + 1) % this.tetromino.length;
      this.activeTetromino = nextPattern;
      this.draw();
    }
  }

  hardDrop() {
    let steps = 0;
    while (!this.collision(0, 1, this.activeTetromino)) {
      this.unDraw();
      this.y++;
      steps++;
    }
    this.draw();
    this.lock();
    if (steps > 0) {
      addScore(steps * 2);
    }
  }

  collision(x, y, piece) {
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (!piece[r][c]) continue;
        
        let newX = this.x + c + x;
        let newY = this.y + r + y;

        if (newX < 0 || newX >= COL || newY >= ROW) {
          return true;
        }
        
        if (newY < 0) continue;

        if (tablero[newY][newX] !== VACANTE) {
          return true;
        }
      }
    }
    return false;
  }

  lock() {
    for (let r = 0; r < this.activeTetromino.length; r++) {
      for (let c = 0; c < this.activeTetromino[r].length; c++) {
        if (!this.activeTetromino[r][c]) continue;

        if (this.y + r < 0) {
          endGame();
          return;
        }
        
        tablero[this.y + r][this.x + c] = this.color;
      }
    }

    let linesCleared = 0;
    for (let r = 0; r < ROW; r++) {
      let isRowFull = true;
      for (let c = 0; c < COL; c++) {
        if (tablero[r][c] === VACANTE) {
          isRowFull = false;
          break;
        }
      }
      if (isRowFull) {
        tablero.splice(r, 1);
        tablero.unshift(new Array(COL).fill(VACANTE));
        linesCleared++;
      }
    }

    if (linesCleared > 0) {
      const linePoints = [0, 100, 300, 500, 800];
      addScore(linePoints[linesCleared] || 800);
    }

    drawBoard();

    piezaActiva = piezaSiguiente;
    piezaSiguiente = randomPieza();
    drawNextPiece();
  }
}

function randomPieza() {
  const r = Math.floor(Math.random() * PIEZAS.length);
  return new Piece(PIEZAS[r], COLORES[r].main, COLORES[r].border);
}

function initBoard() {
  tablero = [];
  for (let r = 0; r < ROW; r++) {
    tablero[r] = [];
    for (let c = 0; c < COL; c++) {
      tablero[r][c] = VACANTE;
    }
  }
}

// Dibuja una celda en el canvas
function drawSquare(x, y, color, borderColor) {
  if (isRetroMode) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(x * SQ, y * SQ, SQ, SQ);
    
    if (color !== VACANTE) {
      ctx.fillStyle = '#00ff00';
      ctx.font = "20px 'Courier New', monospace";
      ctx.fontWeight = "bold";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("[]", x * SQ + SQ / 2, y * SQ + SQ / 2);
    }
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(x * SQ, y * SQ, SQ, SQ);
    
    if (color !== VACANTE) {
      ctx.strokeStyle = borderColor || '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * SQ + 1, y * SQ + 1, SQ - 2, SQ - 2);
      
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x * SQ + 3, y * SQ + 3, SQ - 6, 6);
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x * SQ, y * SQ, SQ, SQ);
    }
  }
}

function drawBoard() {
  ctx.fillStyle = isRetroMode ? '#000000' : VACANTE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  for (let r = 0; r < ROW; r++) {
    for (let c = 0; c < COL; c++) {
      drawSquare(c, r, tablero[r][c]);
    }
  }
}

function drawNextPiece() {
  nextCtx.fillStyle = isRetroMode ? '#000000' : VACANTE;
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  
  const pieceLayout = piezaSiguiente.activeTetromino;
  
  const offsetCol = (nextCanvas.width - pieceLayout[0].length * 20) / 2;
  const offsetRow = (nextCanvas.height - pieceLayout.length * 20) / 2;

  for (let r = 0; r < pieceLayout.length; r++) {
    for (let c = 0; c < pieceLayout[r].length; c++) {
      if (pieceLayout[r][c]) {
        if (isRetroMode) {
          nextCtx.fillStyle = '#00ff00';
          nextCtx.font = "14px 'Courier New', monospace";
          nextCtx.textAlign = "center";
          nextCtx.textBaseline = "middle";
          nextCtx.fillText("[]", offsetCol + c * 20 + 10, offsetRow + r * 20 + 10);
        } else {
          nextCtx.fillStyle = piezaSiguiente.color;
          nextCtx.fillRect(offsetCol + c * 20, offsetRow + r * 20, 18, 18);
          nextCtx.strokeStyle = piezaSiguiente.colorBorder;
          nextCtx.lineWidth = 1.5;
          nextCtx.strokeRect(offsetCol + c * 20 + 0.5, offsetRow + r * 20 + 0.5, 17, 17);
        }
      }
    }
  }
}

// ==========================================
// 4. LÓGICA DE CONTROL DEL JUEGO Y FLUJO
// ==========================================

function startGame() {
  showScreen(screenGame);
  initBoard();
  drawBoard();
  
  score = 0;
  gameOver = false;
  matchTimeLeft = 300;
  cycleTimer = 0;
  obstaculoActivo = null;
  currentSpeed = baseSpeed;
  
  gameScoreText.textContent = '00000';
  gameTimerText.textContent = '05:00';
  nextObstacleTimerText.textContent = 'Prepárate...';
  
  fogOverlay.classList.add('hidden');
  canvas.classList.remove('shake');
  obstacleBanner.classList.add('hidden');
  
  piezaActiva = randomPieza();
  piezaSiguiente = randomPieza();
  
  piezaActiva.draw();
  drawNextPiece();
  
  if (gameTimerInterval) clearInterval(gameTimerInterval);
  if (nextObstacleTimerInterval) clearInterval(nextObstacleTimerInterval);
  
  gameTimerInterval = setInterval(updateGameTimer, 1000);
  nextObstacleTimerInterval = setInterval(updateObstacleCycle, 1000);
  
  // Informar score inicial de 0 al servidor
  socket.emit('score_update', { playerId: playerId, score: 0 });
  
  dropStart = Date.now();
  requestAnimationFrame(gameLoop);
}

function gameLoop() {
  if (gameOver) return;

  const now = Date.now();
  const delta = now - dropStart;

  if (obstaculoActivo !== 'ZERO_GRAVITY') {
    if (delta > currentSpeed) {
      piezaActiva.moveDown();
      dropStart = Date.now();
    }
  }

  requestAnimationFrame(gameLoop);
}

function endGame() {
  if (gameOver) return;
  gameOver = true;
  
  clearInterval(gameTimerInterval);
  clearInterval(nextObstacleTimerInterval);
  
  canvas.classList.remove('shake');
  fogOverlay.classList.add('hidden');
  obstacleBanner.classList.add('hidden');
  
  finalScoreValText.textContent = score;
  showScreen(screenGameOver);
  
  socket.emit('submit_score', {
    name: playerName,
    score: score,
    playerId: playerId
  });
}

function updateGameTimer() {
  matchTimeLeft--;
  if (matchTimeLeft <= 0) {
    matchTimeLeft = 0;
    endGame();
    return;
  }

  const mins = String(Math.floor(matchTimeLeft / 60)).padStart(2, '0');
  const secs = String(matchTimeLeft % 60).padStart(2, '0');
  gameTimerText.textContent = `${mins}:${secs}`;
}

// ==========================================
// 5. SISTEMA DE OBSTÁCULOS
// ==========================================

function updateObstacleCycle() {
  cycleTimer++;
  
  if (obstaculoActivo) {
    const timeLeft = OBSTACLE_DURATION - cycleTimer;
    const percentage = (timeLeft / OBSTACLE_DURATION) * 100;
    obstacleProgress.style.width = `${percentage}%`;
    
    if (cycleTimer >= OBSTACLE_DURATION) {
      deactivateObstacle();
    }
  } else {
    const peaceDuration = CYCLE_DURATION - OBSTACLE_DURATION;
    const timeLeft = peaceDuration - cycleTimer;
    
    nextObstacleTimerText.textContent = `Obstáculo en ${timeLeft}s`;
    
    if (cycleTimer >= peaceDuration) {
      activateRandomObstacle();
    }
  }
}

function activateRandomObstacle() {
  cycleTimer = 0;
  
  const keys = Object.keys(OBSTACULOS);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  obstaculoActivo = randomKey;
  
  const obs = OBSTACULOS[randomKey];
  
  obstacleTitle.textContent = `¡OBSTÁCULO: ${obs.name}!`;
  obstacleDesc.textContent = obs.desc;
  obstacleBanner.style.backgroundColor = `${obs.color}e6`;
  obstacleBanner.style.borderColor = obs.color;
  obstacleProgress.style.width = '100%';
  obstacleBanner.classList.remove('hidden');
  nextObstacleTimerText.textContent = '¡ACTIVO!';
  
  switch (obstaculoActivo) {
    case 'SPEED_UP':
      currentSpeed = 120;
      break;
      
    case 'FOG':
      fogOverlay.classList.remove('hidden');
      break;
      
    case 'EARTHQUAKE':
      canvas.classList.add('shake');
      triggerEarthquakeGarbage();
      break;
  }
}

function deactivateObstacle() {
  const oldObstacle = obstaculoActivo;
  obstaculoActivo = null;
  cycleTimer = 0;
  
  obstacleBanner.classList.add('hidden');
  nextObstacleTimerText.textContent = 'Normal';
  
  switch (oldObstacle) {
    case 'SPEED_UP':
      currentSpeed = baseSpeed;
      break;
      
    case 'FOG':
      fogOverlay.classList.add('hidden');
      break;
      
    case 'EARTHQUAKE':
      canvas.classList.remove('shake');
      break;
  }
}

function triggerEarthquakeGarbage() {
  tablero.shift();
  const newRow = new Array(COL).fill('#3f3f46');
  const emptyCol = Math.floor(Math.random() * COL);
  newRow[emptyCol] = VACANTE;
  
  tablero.push(newRow);
  drawBoard();
}

// ==========================================
// 6. MANEJO DE CONTROLES
// ==========================================

function handleControl(action) {
  if (gameOver || !piezaActiva) return;
  
  let finalAction = action;
  
  if (obstaculoActivo === 'REVERSED_CONTROLS') {
    if (action === 'LEFT') finalAction = 'RIGHT';
    else if (action === 'RIGHT') finalAction = 'LEFT';
  }

  switch (finalAction) {
    case 'LEFT':
      piezaActiva.moveLeft();
      break;
    case 'RIGHT':
      piezaActiva.moveRight();
      break;
    case 'ROTATE':
      piezaActiva.rotate();
      break;
    case 'DOWN':
      piezaActiva.moveDown();
      break;
    case 'DROP':
      piezaActiva.hardDrop();
      break;
  }
}

document.addEventListener('keydown', (e) => {
  if (screenGame.classList.contains('hidden')) return;

  switch (e.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      handleControl('LEFT');
      e.preventDefault();
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      handleControl('RIGHT');
      e.preventDefault();
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
    case ' ':
      handleControl('ROTATE');
      e.preventDefault();
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      handleControl('DOWN');
      e.preventDefault();
      break;
    case 'Enter':
    case 'Control':
      handleControl('DROP');
      e.preventDefault();
      break;
  }
});

const touchButtons = [
  { id: 'ctrl-left', action: 'LEFT' },
  { id: 'ctrl-right', action: 'RIGHT' },
  { id: 'ctrl-rotate', action: 'ROTATE' },
  { id: 'ctrl-down', action: 'DOWN' },
  { id: 'ctrl-drop', action: 'DROP' }
];

touchButtons.forEach(btnInfo => {
  const btn = document.getElementById(btnInfo.id);
  if (!btn) return;
  
  let touchInterval = null;

  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleControl(btnInfo.action);
    
    if (['LEFT', 'RIGHT', 'DOWN'].includes(btnInfo.action)) {
      touchInterval = setInterval(() => {
        handleControl(btnInfo.action);
      }, 150);
    }
  });

  const stopAction = (e) => {
    if (touchInterval) {
      clearInterval(touchInterval);
      touchInterval = null;
    }
  };

  btn.addEventListener('touchend', stopAction);
  btn.addEventListener('touchcancel', stopAction);
  
  btn.addEventListener('mousedown', (e) => {
    if (e.pointerType === 'touch') return;
    handleControl(btnInfo.action);
  });
});
