import { Socket } from 'socket.io-client'
import { DataLevel } from '../consts/level'
import SceneKey from '../consts/scene-key'
import GameScene from './game-scene'
import { PLAYER_SIZE } from '../consts/globals'
import TextureKey from '../consts/texture-key'

interface RemotePlayer {
  sprite: Phaser.GameObjects.Rectangle
  nameText: Phaser.GameObjects.Text
}

export default class MultiGameScene extends GameScene {
  private socket!: Socket
  private remotePlayers: Map<string, RemotePlayer> = new Map()
  private lastSentX: number = 0
  private lastSentY: number = 0

  constructor() {
    super()
  }

  init(data: any) {
    super.init({ level: data.mapData })
    this.socket = data.socket

    // Créer les sprites des joueurs déjà présents
    Object.entries(data.existingPlayers || {}).forEach(([id, player]: [string, any]) => {
      if (id !== this.socket.id) {
        this.pendingRemotePlayers = this.pendingRemotePlayers || []
        this.pendingRemotePlayers.push({ id, x: player.x, y: player.y, name: player.name })
      }
    })
  }

  private pendingRemotePlayers: Array<{ id: string; x: number; y: number; name: string }> = []

  create() {
    super.create()

    // Spawner les joueurs en attente maintenant que la scène est prête
    this.pendingRemotePlayers.forEach(({ id, x, y, name }) => {
      this.spawnRemotePlayer(id, x, y, name)
    })
    this.pendingRemotePlayers = []

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

    this.remotePlayers.set(id, { sprite, nameText })
  }

  setupSocketEvents() {
    this.socket.on('player_joined', ({ id, x, y, name }: { id: string; x: number; y: number; name: string }) => {
      this.spawnRemotePlayer(id, x, y, name)
    })

    this.socket.on('player_moved', ({ id, x, y }: { id: string; x: number; y: number }) => {
      const remote = this.remotePlayers.get(id)
      if (remote) {
        remote.sprite.setPosition(x, y)
        remote.nameText.setPosition(x, y - 60)
      }
    })

    this.socket.on('player_left', ({ id }: { id: string }) => {
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
