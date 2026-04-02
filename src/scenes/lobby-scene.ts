import SceneKey from '../consts/scene-key'
import TextureKey from '../consts/texture-key'
import { io, Socket } from 'socket.io-client'
import { DataLevel } from '../consts/level'
import EventKey from '../consts/event-key'
import { transitionEventsEmitter } from '../utils/transition'
import customLevel from '../levels/custom.json'
import {
  convertFallingBlocksToCells,
  convertPlatformsToCells,
  convertSpikesToCells,
} from '../utils/editor'

const SERVER_URL = 'https://bobby-server.onrender.com'

export default class LobbyScene extends Phaser.Scene {
  private socket!: Socket
  private statusText!: Phaser.GameObjects.Text
  private playerName: string = 'Joueur'
  private mapData: DataLevel = customLevel as unknown as DataLevel
  private mapLabel!: Phaser.GameObjects.Text

  constructor() {
    super({ key: SceneKey.Lobby })
  }

  create() {
    const { width, height } = this.scale

    this.socket = io(SERVER_URL)

    this.add.text(width / 2, 60, 'MULTIJOUEUR', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '80px',
      color: '#262b44',
    }).setOrigin(0.5, 0)

    // --- Import de map ---
    this.mapLabel = this.add.text(width / 2, 200, 'Map : carte par défaut', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '36px',
      color: '#262b44',
    }).setOrigin(0.5)

    this.add.text(width / 2, 260, 'Importer une map (coller le code exporté)', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '28px',
      color: '#888',
    }).setOrigin(0.5)

    // Zone de saisie du code map
    const mapInputText = this.add.text(width / 2, 320, '[ coller ici avec Ctrl+V ]', {
      fontFamily: TextureKey.FontBody,
      fontSize: '28px',
      color: '#444',
      backgroundColor: '#ffffff',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5)

    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      // Ctrl+V ou Cmd+V
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          try {
            const decoded = JSON.parse(atob(text))
            const platformsCells = convertPlatformsToCells(decoded.platforms)
            this.mapData = {
              ...decoded,
              platforms: platformsCells,
              ...(decoded.spikes && { spikes: convertSpikesToCells(decoded.spikes) }),
              ...(decoded.fallingBlocks && { fallingBlocks: convertFallingBlocksToCells(decoded.fallingBlocks) }),
              ...(decoded.oneWayPlatforms && { oneWayPlatforms: convertPlatformsToCells(decoded.oneWayPlatforms) }),
            }
            mapInputText.setText('✓ Map importée !')
            this.mapLabel.setText('Map : map importée')
          } catch {
            mapInputText.setText('✗ Code invalide')
          }
        })
      }
    })

    // Séparateur
    this.add.rectangle(width / 2, 400, width - 200, 2, 0xcccccc).setOrigin(0.5)

    // --- Créer une room ---
    this.add.text(width / 4, 460, 'CRÉER', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '52px',
      color: '#262b44',
    }).setOrigin(0.5)

    this.add.text(width / 4, 540, 'Créer une room', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '40px',
      color: '#262b44',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#e43b44') })
      .on('pointerout', function(this: Phaser.GameObjects.Text) { this.setColor('#262b44') })
      .on('pointerdown', () => this.createRoom())

    // --- Rejoindre une room ---
    this.add.text((width / 4) * 3, 460, 'REJOINDRE', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '52px',
      color: '#262b44',
    }).setOrigin(0.5)

    let roomInput = ''
    const inputDisplay = this.add.text((width / 4) * 3, 540, 'Code : ______', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '40px',
      color: '#262b44',
    }).setOrigin(0.5)

    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) return
      if (event.key === 'Backspace') {
        roomInput = roomInput.slice(0, -1)
      } else if (event.key.length === 1 && roomInput.length < 6) {
        roomInput += event.key.toUpperCase()
      } else if (event.key === 'Enter') {
        this.joinRoom(roomInput)
      }
      inputDisplay.setText(`Code : ${roomInput || '______'}`)
    })

    this.add.text((width / 4) * 3, 620, 'Rejoindre →', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '40px',
      color: '#262b44',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#e43b44') })
      .on('pointerout', function(this: Phaser.GameObjects.Text) { this.setColor('#262b44') })
      .on('pointerdown', () => this.joinRoom(roomInput))

    // Status
    this.statusText = this.add.text(width / 2, height - 180, '', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '40px',
      color: '#e43b44',
    }).setOrigin(0.5)

    // Retour
    this.add.text(80, 80, '←', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '64px',
      color: '#262b44',
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.socket.disconnect()
        transitionEventsEmitter.emit(EventKey.TransitionStart)
        transitionEventsEmitter.once(EventKey.TransitionEnd, () => this.scene.start(SceneKey.Levels))
      })

    this.setupSocketEvents()
    this.scene.launch(SceneKey.Transition)
  }

  createRoom() {
    this.statusText.setText('Connexion au serveur...')
    this.socket.emit('create_room', {
      mapData: this.mapData,
      playerName: this.playerName,
    })
  }

  joinRoom(roomId: string) {
    if (!roomId || roomId.length < 4) {
      this.statusText.setText('Code invalide !')
      return
    }
    this.statusText.setText('Connexion...')
    this.socket.emit('join_room', { roomId, playerName: this.playerName })
  }

  setupSocketEvents() {
    this.socket.on('connect', () => {
      this.statusText.setText('')
    })

    this.socket.on('connect_error', () => {
      this.statusText.setText('Serveur en veille, réessaie dans 30s...')
    })

    this.socket.on('room_created', ({ roomId, mapData }: { roomId: string; mapData: DataLevel }) => {
      this.startMultiGame(mapData, roomId, this.socket)
    })

    this.socket.on('room_joined', ({ roomId, mapData, players }: { roomId: string; mapData: DataLevel; players: any }) => {
      this.startMultiGame(mapData, roomId, this.socket, players)
    })

    this.socket.on('error', ({ message }: { message: string }) => {
      this.statusText.setText(`Erreur : ${message}`)
    })
  }

  startMultiGame(mapData: DataLevel, roomId: string, socket: Socket, existingPlayers = {}) {
    transitionEventsEmitter.emit(EventKey.TransitionStart)
    transitionEventsEmitter.once(EventKey.TransitionEnd, () => {
      this.scene.start(SceneKey.MultiGame, { mapData, roomId, socket, existingPlayers })
    })
  }
}
