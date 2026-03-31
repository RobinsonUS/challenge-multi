const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' }
})

// rooms[roomId] = { mapData, players: { socketId: { x, y, name } } }
const rooms = {}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

io.on('connection', (socket) => {
  console.log('Joueur connecté:', socket.id)

  // Créer une room
  socket.on('create_room', ({ mapData, playerName }) => {
    const roomId = generateRoomId()
    rooms[roomId] = {
      mapData,
      players: {
        [socket.id]: { x: mapData.player.x, y: mapData.player.y, name: playerName }
      }
    }
    socket.join(roomId)
    socket.data.roomId = roomId
    socket.emit('room_created', { roomId, mapData })
    console.log(`Room ${roomId} créée par ${playerName}`)
  })

  // Rejoindre une room
  socket.on('join_room', ({ roomId, playerName }) => {
    const room = rooms[roomId]
    if (!room) {
      socket.emit('error', { message: 'Room introuvable' })
      return
    }
    room.players[socket.id] = {
      x: room.mapData.player.x,
      y: room.mapData.player.y,
      name: playerName
    }
    socket.join(roomId)
    socket.data.roomId = roomId

    // Envoie la map et les joueurs existants au nouveau
    socket.emit('room_joined', {
      roomId,
      mapData: room.mapData,
      players: room.players
    })

    // Informe les autres
    socket.to(roomId).emit('player_joined', {
      id: socket.id,
      ...room.players[socket.id]
    })
    console.log(`${playerName} a rejoint la room ${roomId}`)
  })

  // Mise à jour de position
  socket.on('player_move', ({ x, y }) => {
    const roomId = socket.data.roomId
    if (!roomId || !rooms[roomId]) return
    rooms[roomId].players[socket.id].x = x
    rooms[roomId].players[socket.id].y = y

    // Broadcast aux autres joueurs de la room
    socket.to(roomId).emit('player_moved', {
      id: socket.id,
      x,
      y
    })
  })

  // Déconnexion
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId
    if (roomId && rooms[roomId]) {
      delete rooms[roomId].players[socket.id]
      socket.to(roomId).emit('player_left', { id: socket.id })

      // Supprimer la room si vide
      if (Object.keys(rooms[roomId].players).length === 0) {
        delete rooms[roomId]
        console.log(`Room ${roomId} supprimée (vide)`)
      }
    }
    console.log('Joueur déconnecté:', socket.id)
  })
})

httpServer.listen(3000, () => {
  console.log('Serveur démarré sur le port 3000')
})
