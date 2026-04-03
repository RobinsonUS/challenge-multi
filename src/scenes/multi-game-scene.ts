import { Socket } from 'socket.io-client'
import GameScene from './game-scene'
import { PLAYER_SIZE } from '../consts/globals'
import TextureKey from '../consts/texture-key'
import SceneKey from '../consts/scene-key'
import {
  convertFallingBlocksToCells,
  convertPlatformsToCells,
  convertSpikesToCells,
} from '../utils/editor'
import { DataLevel } from '../consts/level'

interface RemotePlayer {
  sprite: Phaser.GameObjects.Rectangle
  nameText: Phaser.GameObjects.Text
}

export default class MultiGameScene extends GameScene {
  private socket!: Socket
  private remotePlayers: Map<string, RemotePlayer> = new Map()
  private lastSentX: number = 0
  private lastSentY: number = 0
  private pendingRemotePlayers: Array<{ id: string; x: number; y: number; name: string }> = []
  private roomId: string = ''

  constructor() {
    super({ key: SceneKey.MultiGame })
  }

  init(data: any) {
    // On prépare la mapData correctement avant de passer à GameScene
    // sans déclencher importLevel (qui appellerait restartGame)
    const rawMap = data.mapData as DataLevel
    const platformsCells = convertPlatformsToCells(rawMap.platforms)
    const preparedMap: DataLevel = {
      ...rawMap,
      platforms: platformsCells,
      ...(rawMap.spikes && { spikes: convertSpikesToCells(rawMap.spikes) }),
      ...(rawMap.fallingBlocks && { fallingBlocks: convertFallingBlocksToCells(rawMap.fallingBlocks) }),
      ...(rawMap.oneWayPlatforms && { oneWayPlatforms: convertPlatformsToCells(rawMap.oneWayPlatforms) }),
    }

    super.init({ level: preparedMap })
    this.socket = data.socket
    this.roomId = data.roomId

    Object.entries(data.existingPlayers || {}).forEach(([id, player]: [string, any]) => {
      if (id !== this.socket.id) {
        this.pendingRemotePlayers.push({ id, x: player.x, y: player.y, name: player.name })
      }
    })
  }

  create() {
    super.create()

    // Afficher le code de room
    this.add.text(16, 16, `Room : ${this.roomId}`, {
      fontFamily: TextureKey.FontHeading,
      fontSize: '32px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 12, y: 6 },
    }).setScrollFactor(0).setDepth(100)

    // Flèches tactiles manuelles (le HUD solo ne marche pas en multi)
    if (!this.sys.game.device.os.desktop) {
      this.addMobileControls()
    }

    this.pendingRemotePlayers.forEach(({ id, x, y, name }) => {
      this.spawnRemotePlayer(id, x, y, name)
    })
    this.pendingRemotePlayers = []
    this.setupSocketEvents()
  }

  addMobileControls() {
    const { width, height } = this.scale

    // Flèche gauche
    const leftBtn = this.add.triangle(
      180, height - 80,
      0, 40, 80, 0, 80, 80,
      0xffffff, 0.5
    ).setScrollFactor(0).setDepth(100).setInteractive()

    // Flèche droite
    const rightBtn = this.add.triangle(
      420, height - 80,
      0, 0, 80, 40, 0, 80,
      0xffffff, 0.5
    ).setScrollFactor(0).setDepth(100).setInteractive()

    // Saut (zone droite de l'écran)
    const jumpZone = this.add.zone(width - 300, height - 200, 600, 400)
      .setScrollFactor(0).setDepth(100).setInteractive()

    leftBtn.on('pointerdown', () => this.setTouchLeft(true))
    leftBtn.on('pointerup', () => this.setTouchLeft(false))
    leftBtn.on('pointerout', () => this.setTouchLeft(false))

    rightBtn.on('pointerdown', () => this.setTouchRight(true))
    rightBtn.on('pointerup', () => this.setTouchRight(false))
    rightBtn.on('pointerout', () => this.setTouchRight(false))

    jumpZone.on('pointerdown', () => this.playerRef?.jump())
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
