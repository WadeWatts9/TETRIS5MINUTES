const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3002;

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Ruta explícita para la administración
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Estado del servidor
const MAX_SIMULTANEOUS_PLAYERS = 6;
const RECONNECTION_GRACE_PERIOD = 10000; // 10 segundos de gracia en caso de desconexión temporal

// Mapeos para control robusto de sesiones y reconexión
const activePlayers = new Map(); // playerId -> { socketId, name, startTime, score, timeoutId }
const waitingQueue = [];         // Array de objetos { playerId, socketId, name }
const socketToPlayer = new Map(); // socket.id -> playerId

// Helper para emitir el estado general a todos los jugadores comunes
async function broadcastServerStatus() {
  let leaderboard = [];
  try {
    leaderboard = await db.getTopScores();
  } catch (err) {
    console.error('Error al obtener el leaderboard para broadcast:', err.message);
  }

  try {
    io.emit('server_status', {
      activeCount: activePlayers.size,
      maxPlayers: MAX_SIMULTANEOUS_PLAYERS,
      queueLength: waitingQueue.length,
      leaderboard: leaderboard
    });
  } catch (err) {
    console.error('Error al emitir server_status:', err.message);
  }
}

// Helper para enviar las actualizaciones en tiempo real al panel de administración (con catches aislados)
async function sendAdminUpdate() {
  let allScores = [];
  try {
    allScores = await db.getAllScores();
  } catch (err) {
    console.error('Error al recuperar historial para admin:', err.message);
  }

  try {
    const activeList = Array.from(activePlayers.entries()).map(([pId, info]) => ({
      id: info.socketId,
      playerId: pId,
      name: info.name,
      startTime: info.startTime,
      score: info.score,
      isDisconnected: !!info.timeoutId // Flag si está en periodo de gracia por desconexión
    }));

    io.to('admin').emit('admin_update', {
      activePlayers: activeList,
      queueLength: waitingQueue.length,
      allScores: allScores
    });
  } catch (err) {
    console.error('Error al enviar actualización a los administradores:', err.message);
  }
}

// Helper para enviar estado individual del turno en cola
function updateQueuePositions() {
  waitingQueue.forEach((item, index) => {
    io.to(item.socketId).emit('queue_position', {
      position: index + 1,
      total: waitingQueue.length
    });
  });
}

// Intentar promover al siguiente jugador de la cola a jugador activo
function checkQueue() {
  while (activePlayers.size < MAX_SIMULTANEOUS_PLAYERS && waitingQueue.length > 0) {
    const nextItem = waitingQueue.shift();
    const socket = io.sockets.sockets.get(nextItem.socketId);
    
    if (socket) {
      activePlayers.set(nextItem.playerId, {
        socketId: nextItem.socketId,
        name: nextItem.name || 'Jugador',
        startTime: Date.now(),
        score: 0,
        timeoutId: null
      });
      socketToPlayer.set(nextItem.socketId, nextItem.playerId);
      socket.emit('play_allowed');
      console.log(`Jugador promovido de cola a activo: ${nextItem.playerId}`);
    }
  }
  updateQueuePositions();
  broadcastServerStatus();
  sendAdminUpdate();
}

io.on('connection', async (socket) => {
  console.log(`Nueva conexión establecida: ${socket.id}`);
  
  // Enviar estado inicial inmediato al conectarse
  try {
    const leaderboard = await db.getTopScores();
    socket.emit('init_state', {
      activeCount: activePlayers.size,
      maxPlayers: MAX_SIMULTANEOUS_PLAYERS,
      isInQueue: waitingQueue.some(item => item.socketId === socket.id),
      isActive: Array.from(activePlayers.values()).some(p => p.socketId === socket.id),
      leaderboard: leaderboard
    });
  } catch (err) {
    console.error('Error enviando init_state:', err.message);
  }

  // EVENTO 1: Autenticación inicial del jugador mediante playerId persistido
  socket.on('authenticate', async ({ playerId, name }) => {
    if (!playerId) return;
    
    socketToPlayer.set(socket.id, playerId);
    
    // CASO A: El jugador ya estaba activo (reconexión dentro del periodo de gracia)
    if (activePlayers.has(playerId)) {
      const pData = activePlayers.get(playerId);
      
      // Limpiar el temporizador de desconexión pendiente
      if (pData.timeoutId) {
        clearTimeout(pData.timeoutId);
        pData.timeoutId = null;
        console.log(`Jugador ${playerId} reconectado exitosamente.`);
      }
      
      // Actualizar el socket ID del jugador
      pData.socketId = socket.id;
      if (name) pData.name = name.substring(0, 15);
      activePlayers.set(playerId, pData);
      
      socket.emit('play_allowed'); // Permitir que siga en la arena
      await sendAdminUpdate();
      return;
    }
    
    // CASO B: El jugador estaba en la cola de espera, se reconecta
    const queueIndex = waitingQueue.findIndex(item => item.playerId === playerId);
    if (queueIndex !== -1) {
      waitingQueue[queueIndex].socketId = socket.id;
      if (name) waitingQueue[queueIndex].name = name.substring(0, 15);
      socket.emit('queue_entered', {
        position: queueIndex + 1
      });
      updateQueuePositions();
      return;
    }
  });

  // EVENTO DE ADMIN: El panel se registra en la sala "admin"
  socket.on('join_admin_panel', async () => {
    socket.join('admin');
    console.log(`Socket de Admin registrado: ${socket.id}`);
    await sendAdminUpdate();
  });

  // EVENTO DE ADMIN: Eliminar un puntaje
  socket.on('admin_delete_score', async (id) => {
    try {
      await db.deleteScore(id);
      console.log(`Score ID ${id} eliminado por administrador.`);
      await sendAdminUpdate();
      await broadcastServerStatus();
    } catch (err) {
      console.error('Error de admin al eliminar score:', err.message);
    }
  });

  // EVENTO DE ADMIN: Expulsar a un jugador activo (por su playerId para mayor consistencia)
  socket.on('admin_kick_player', (targetPlayerId) => {
    if (activePlayers.has(targetPlayerId)) {
      const playerData = activePlayers.get(targetPlayerId);
      const targetSocket = io.sockets.sockets.get(playerData.socketId);
      
      if (targetSocket) {
        targetSocket.emit('kicked_by_admin');
      }
      
      if (playerData.timeoutId) {
        clearTimeout(playerData.timeoutId);
      }
      
      activePlayers.delete(targetPlayerId);
      console.log(`Jugador ${targetPlayerId} expulsado por el administrador.`);
      checkQueue();
    }
  });

  // Cliente solicita ingresar al juego (al presionar Jugar o Registrarse)
  socket.on('request_to_play', (data) => {
    const { playerId } = data;
    if (!playerId) return;

    socketToPlayer.set(socket.id, playerId);

    if (activePlayers.has(playerId)) {
      socket.emit('play_allowed');
      return;
    }
    
    if (waitingQueue.some(item => item.playerId === playerId)) {
      return;
    }

    if (activePlayers.size < MAX_SIMULTANEOUS_PLAYERS) {
      // Slot libre
      activePlayers.set(playerId, {
        socketId: socket.id,
        name: 'Jugador',
        startTime: Date.now(),
        score: 0,
        timeoutId: null
      });
      socket.emit('play_allowed');
      console.log(`Slot asignado a: ${playerId}`);
    } else {
      // En cola
      waitingQueue.push({
        playerId,
        socketId: socket.id,
        name: 'Jugador'
      });
      socket.emit('queue_entered', {
        position: waitingQueue.length
      });
      console.log(`Puesto en cola: ${playerId} (Posición: ${waitingQueue.length})`);
    }
    broadcastServerStatus();
    updateQueuePositions();
    sendAdminUpdate();
  });

  // Guardar el nombre del jugador una vez registrado en el cliente
  socket.on('register_name', (data) => {
    const { playerId, name } = data;
    if (!playerId || !name) return;

    if (activePlayers.has(playerId)) {
      const playerData = activePlayers.get(playerId);
      playerData.name = name.substring(0, 15);
      activePlayers.set(playerId, playerData);
      console.log(`Nombre registrado para ${playerId}: ${playerData.name}`);
      sendAdminUpdate();
    }
  });

  // Recibe actualizaciones periódicas del puntaje en tiempo real para el panel de admin
  socket.on('score_update', (data) => {
    const { playerId, score: scoreVal } = data;
    if (!playerId) return;

    if (activePlayers.has(playerId)) {
      const playerData = activePlayers.get(playerId);
      playerData.score = parseInt(scoreVal, 10) || 0;
      activePlayers.set(playerId, playerData);
      sendAdminUpdate();
    }
  });

  // El juego ha terminado (por Game Over o fin del tiempo de 5 minutos)
  socket.on('submit_score', async (data) => {
    const { name, score, playerId } = data;
    if (!playerId) return;

    console.log(`Puntaje recibido de ${playerId}: ${name} - ${score}`);
    
    try {
      const sanitizedName = (name || 'Sin Nombre').substring(0, 15);
      const sanitizedScore = parseInt(score, 10) || 0;
      await db.saveScore(sanitizedName, sanitizedScore);
    } catch (err) {
      console.error('Error al guardar puntaje en submit_score:', err.message);
    }

    if (activePlayers.has(playerId)) {
      const pData = activePlayers.get(playerId);
      if (pData.timeoutId) clearTimeout(pData.timeoutId);
      activePlayers.delete(playerId);
      console.log(`Slot liberado por fin de juego: ${playerId}`);
      socket.emit('game_finished');
      checkQueue();
    }
  });

  // Jugador decide abandonar la cola de espera de forma manual
  socket.on('leave_queue', (data) => {
    const { playerId } = data;
    if (!playerId) return;

    const index = waitingQueue.findIndex(item => item.playerId === playerId);
    if (index !== -1) {
      waitingQueue.splice(index, 1);
      console.log(`Jugador abandonó la cola: ${playerId}`);
      socket.emit('queue_left');
      updateQueuePositions();
      broadcastServerStatus();
      sendAdminUpdate();
    }
  });

  // Desconexión del socket (con gracia de 10 segundos para activePlayers)
  socket.on('disconnect', () => {
    console.log(`Conexión cerrada: ${socket.id}`);
    
    const playerId = socketToPlayer.get(socket.id);
    if (!playerId) return;

    socketToPlayer.delete(socket.id);

    // Si el jugador desconectado estaba jugando activamente, le damos un periodo de gracia
    if (activePlayers.has(playerId)) {
      const playerData = activePlayers.get(playerId);
      
      console.log(`Jugador ${playerId} se desconectó. Iniciando periodo de gracia de 10 segundos...`);
      
      // Limpiar timeout previo por si acaso
      if (playerData.timeoutId) clearTimeout(playerData.timeoutId);

      const timeoutId = setTimeout(() => {
        // Expirado: remover jugador y liberar slot
        if (activePlayers.has(playerId)) {
          activePlayers.delete(playerId);
          console.log(`Slot liberado por expiración del periodo de gracia: ${playerId}`);
          checkQueue();
        }
      }, RECONNECTION_GRACE_PERIOD);

      playerData.timeoutId = timeoutId;
      activePlayers.set(playerId, playerData);
      sendAdminUpdate();
    }
    
    // Si estaba en la cola de espera, se limpia de inmediato
    const queueIndex = waitingQueue.findIndex(item => item.playerId === playerId);
    if (queueIndex !== -1) {
      waitingQueue.splice(queueIndex, 1);
      console.log(`Removido de la cola por desconexión inmediata: ${playerId}`);
      updateQueuePositions();
      broadcastServerStatus();
      sendAdminUpdate();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor de Tetris Teresiano corriendo en el puerto ${PORT}`);
});
