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
  private roomInputEl!: HTMLInputElement
  private nameInputEl!: HTMLInputElement

  constructor() {
    super({ key: SceneKey.Lobby })
  }

  create() {
    const { width, height } = this.scale

    this.socket = io(SERVER_URL)

    // Fond sombre
    this.add.rectangle(0, 0, width, height, 0x0d1b2a).setOrigin(0)

    // Titre
    this.add.text(width / 2, 60, 'MULTIJOUEUR', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '90px',
      color: '#00e5cc',
    }).setOrigin(0.5, 0)

    // Ligne déco
    this.add.rectangle(width / 2, 175, 600, 3, 0x00e5cc).setOrigin(0.5)

    // --- Nom du joueur ---
    this.add.text(width / 2, 210, 'Ton pseudo :', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '34px',
      color: '#ffffff',
    }).setOrigin(0.5)

    this.nameInputEl = this.createInput(width / 2, 255, 400, 'Joueur')

    // --- Import de map ---
    this.mapLabel = this.add.text(width / 2, 320, 'Map : carte par défaut', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '32px',
      color: '#00e5cc',
    }).setOrigin(0.5)

    this.add.text(width / 2, 365, 'Importer une map : Ctrl+V / Cmd+V depuis l\'éditeur', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '24px',
      color: '#aaaaaa',
    }).setOrigin(0.5)

    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
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
            this.mapLabel.setText('Map : ✓ map importée')
          } catch {
            this.mapLabel.setText('Map : ✗ code invalide')
          }
        })
      }
    })

    // Séparateur
    this.add.rectangle(width / 2, 420, width - 200, 2, 0x1e3a4a).setOrigin(0.5)

    // === COLONNE GAUCHE : Créer ===
    const col1x = width / 4

    this.add.text(col1x, 460, 'CRÉER UNE ROOM', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '44px',
      color: '#ffffff',
    }).setOrigin(0.5)

    this.add.text(col1x, 530, 'Lance une partie et partage\nle code à tes amis', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '28px',
      color: '#888888',
      align: 'center',
    }).setOrigin(0.5)

    const btnCreate = this.add.rectangle(col1x, 640, 340, 80, 0x00e5cc, 0).setOrigin(0.5)
    btnCreate.setStrokeStyle(3, 0x00e5cc)
    const btnCreateText = this.add.text(col1x, 640, 'Créer →', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '40px',
      color: '#00e5cc',
    }).setOrigin(0.5)

    btnCreate.setInteractive({ useHandCursor: true })
    btnCreate.on('pointerover', () => {
      btnCreate.setFillStyle(0x00e5cc, 0.15)
      btnCreateText.setColor('#ffffff')
    })
    btnCreate.on('pointerout', () => {
      btnCreate.setFillStyle(0x00e5cc, 0)
      btnCreateText.setColor('#00e5cc')
    })
    btnCreate.on('pointerdown', () => this.createRoom())

    // Séparateur vertical
    this.add.rectangle(width / 2, 560, 3, 280, 0x1e3a4a).setOrigin(0.5)

    // === COLONNE DROITE : Rejoindre ===
    const col2x = (width / 4) * 3

    this.add.text(col2x, 460, 'REJOINDRE', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '44px',
      color: '#ffffff',
    }).setOrigin(0.5)

    this.add.text(col2x, 530, 'Entre le code de room\npour rejoindre une partie', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '28px',
      color: '#888888',
      align: 'center',
    }).setOrigin(0.5)

    // Input HTML pour le code room (fonctionne sur tablette)
    this.roomInputEl = this.createInput(col2x, 600, 300, 'Code room')

    const btnJoin = this.add.rectangle(col2x, 668, 340, 70, 0xcc00ff, 0).setOrigin(0.5)
    btnJoin.setStrokeStyle(3, 0xcc00ff)
    const btnJoinText = this.add.text(col2x, 668, 'Rejoindre →', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '36px',
      color: '#cc00ff',
    }).setOrigin(0.5)

    btnJoin.setInteractive({ useHandCursor: true })
    btnJoin.on('pointerover', () => {
      btnJoin.setFillStyle(0xcc00ff, 0.15)
      btnJoinText.setColor('#ffffff')
    })
    btnJoin.on('pointerout', () => {
      btnJoin.setFillStyle(0xcc00ff, 0)
      btnJoinText.setColor('#cc00ff')
    })
    btnJoin.on('pointerdown', () => this.joinRoom(this.roomInputEl.value.toUpperCase()))

    // Status
    this.statusText = this.add.text(width / 2, height - 120, '', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '36px',
      color: '#e43b44',
    }).setOrigin(0.5)

    // Retour
    this.add.text(80, 80, '← Retour', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '40px',
      color: '#ffffff',
    }).setInteractive({ useHandCursor: true })
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#00e5cc') })
      .on('pointerout', function(this: Phaser.GameObjects.Text) { this.setColor('#ffffff') })
      .on('pointerdown', () => {
        this.cleanupInputs()
        this.socket.disconnect()
        transitionEventsEmitter.emit(EventKey.TransitionStart)
        transitionEventsEmitter.once(EventKey.TransitionEnd, () => this.scene.start(SceneKey.Levels))
      })

    this.setupSocketEvents()
    this.scene.launch(SceneKey.Transition)
  }

  createInput(cx: number, cy: number, w: number, placeholder: string): HTMLInputElement {
    const canvas = this.game.canvas
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width / this.scale.width
    const scaleY = rect.height / this.scale.height

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = placeholder
    input.style.position = 'absolute'
    input.style.left = `${rect.left + (cx - w / 2) * scaleX}px`
    input.style.top = `${rect.top + (cy - 24) * scaleY}px`
    input.style.width = `${w * scaleX}px`
    input.style.height = `${48 * scaleY}px`
    input.style.fontSize = `${28 * scaleY}px`
    input.style.fontFamily = 'sans-serif'
    input.style.textAlign = 'center'
    input.style.background = '#0d2a3a'
    input.style.color = '#ffffff'
    input.style.border = '2px solid #00e5cc'
    input.style.borderRadius = '8px'
    input.style.outline = 'none'
    input.style.zIndex = '1000'
    document.body.appendChild(input)
    return input
  }

  cleanupInputs() {
    if (this.roomInputEl?.parentNode) this.roomInputEl.parentNode.removeChild(this.roomInputEl)
    if (this.nameInputEl?.parentNode) this.nameInputEl.parentNode.removeChild(this.nameInputEl)
  }

  createRoom() {
    this.playerName = this.nameInputEl.value || 'Joueur'
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
    this.playerName = this.nameInputEl.value || 'Joueur'
    this.statusText.setText('Connexion...')
    this.socket.emit('join_room', { roomId, playerName: this.playerName })
  }

  setupSocketEvents() {
    this.socket.on('connect_error', () => {
      this.statusText.setText('Serveur en veille, réessaie dans 30s...')
    })

    this.socket.on('room_created', ({ roomId, mapData }: { roomId: string; mapData: DataLevel }) => {
      this.cleanupInputs()
      this.startMultiGame(mapData, roomId, this.socket)
    })

    this.socket.on('room_joined', ({ roomId, mapData, players }: { roomId: string; mapData: DataLevel; players: any }) => {
      this.cleanupInputs()
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
