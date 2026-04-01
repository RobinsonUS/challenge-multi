import { Socket } from 'socket.io-client'
import { DataLevel } from '../consts/level'
import SceneKey from '../consts/scene-key'
import GameScene from './game-scene'
import Player from '../objects/player'
import { Trail } from '../consts/level'
import { PLAYER_SIZE } from '../consts/globals'
import TextureKey from '../consts/texture-key'

interface RemotePlayer {
  sprite: Phaser.GameObjects.Rectangle
  nameText: Phaser.GameObjects.Text
  x: number
  y: number
}

interface MultiGameSceneProps {
  mapData: DataLevel
  roomId: string
  socket: Socket
  existingPlayers: Record<string, { x: number; y: number; name: string }>
}

export default class MultiGameScene extends GameScene {
  private socket!: Socket
  private roomId!: string
  private remotePlayers: Map<string, RemotePlayer> = new Map()
  private lastSentX: number = 0
  private lastSentY: number = 0
  private sendInterval: number = 50 // ms entre chaque envoi de position

  constructor() {
    super()
    this.scene.key = SceneKey.MultiGame
  }

  init(data: MultiGameSceneProps) {
    super.init({ level: data.mapData })
    this.socket = data.socket
    this.roomId = data.roomId

    // Créer les sprites des joueurs déjà présents
    Object.entries(data.existingPlayers || {}).forEach(([id, player]) => {
      if (id !== this.socket.id) {
        this.spawnRemotePlayer(id, player.x, player.y, player.name)
      }
    })
  }

  create() {
    super.create()
    this.setupSocketEvents()
  }

  spawnRemotePlayer(id: string, x: number, y: number, name: string) {
    const sprite = this.add.rectangle(x, y, PLAYER_SIZE, PLAYER_SIZE, 0xff6b6b)
    sprite.setDepth(5)

    const nameText = this.add.text(x, y - 60, name, {
      fontFamily: TextureKey.FontHeading,
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(6)

    this.remotePlayers.set(id, { sprite, nameText, x, y })
  }

  setupSocketEvents() {
    this.socket.on('player_joined', ({ id, x, y, name }) => {
      this.spawnRemotePlayer(id, x, y, name)
    })

    this.socket.on('player_moved', ({ id, x, y }) => {
      const remote = this.remotePlayers.get(id)
      if (remote) {
        remote.sprite.setPosition(x, y)
        remote.nameText.setPosition(x, y - 60)
        remote.x = x
        remote.y = y
      }
    })

    this.socket.on('player_left', ({ id }) => {
      const remote = this.remotePlayers.get(id)
      if (remote) {
        remote.sprite.destroy()
        remote.nameText.destroy()
        this.remotePlayers.delete(id)
      }
    })
  }

  update(time: number, delta: number) {
    super.update(time, delta)

    // Envoyer la position du joueur local toutes les 50ms
    if (this.playerRef) {
      const { x, y } = this.playerRef
      const dx = Math.abs(x - this.lastSentX)
      const dy = Math.abs(y - this.lastSentY)

      if (dx > 2 || dy > 2) {
        this.socket.emit('player_move', { x, y })
        this.lastSentX = x
        this.lastSentY = y
      }
    }
  }

  shutdown() {
    this.socket.off('player_joined')
    this.socket.off('player_moved')
    this.socket.off('player_left')
  }
}
