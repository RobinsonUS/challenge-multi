import SceneKey from '../consts/scene-key'
import TextureKey from '../consts/texture-key'
import { io, Socket } from 'socket.io-client'
import { DataLevel } from '../consts/level'
import EventKey from '../consts/event-key'
import { transitionEventsEmitter } from '../utils/transition'
import customLevel from '../levels/custom.json'

const SERVER_URL = 'https://bobby-server.onrender.com'

export default class LobbyScene extends Phaser.Scene {
  private socket!: Socket
  private roomIdText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private playerName: string = 'Joueur'

  constructor() {
    super({ key: SceneKey.Lobby })
  }

  create() {
    const { width, height } = this.scale

    this.socket = io(SERVER_URL)

    this.add.text(width / 2, 80, 'MULTIJOUEUR', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '96px',
      color: '#262b44',
    }).setOrigin(0.5, 0)

    // Bouton créer une room
    this.add.text(width / 2 - 300, height / 2 - 100, 'Créer une room', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '48px',
      color: '#262b44',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.createRoom())

    // Champ code room + bouton rejoindre
    this.statusText = this.add.text(width / 2, height / 2 + 100, '', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '40px',
      color: '#262b44',
    }).setOrigin(0.5)

    this.roomIdText = this.add.text(width / 2, height / 2 - 200, '', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '64px',
      color: '#e43b44',
    }).setOrigin(0.5)

    // Saisie du code room pour rejoindre
    let roomInput = ''
    const inputText = this.add.text(width / 2 + 100, height / 2, 'Code room : ____', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '48px',
      color: '#262b44',
    }).setOrigin(0.5)

    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Backspace') {
        roomInput = roomInput.slice(0, -1)
      } else if (event.key.length === 1) {
        roomInput += event.key.toUpperCase()
      }
      inputText.setText(`Code room : ${roomInput || '____'}`)
    })

    this.add.text(width / 2 + 300, height / 2 - 100, 'Rejoindre', {
      fontFamily: TextureKey.FontHeading,
      fontSize: '48px',
      color: '#262b44',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.joinRoom(roomInput))

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
    const mapData = customLevel as unknown as DataLevel
    this.socket.emit('create_room', {
      mapData,
      playerName: this.playerName
    })
    this.statusText.setText('Création de la room...')
  }

  joinRoom(roomId: string) {
    if (!roomId || roomId.length < 4) {
      this.statusText.setText('Code invalide !')
      return
    }
    this.socket.emit('join_room', {
      roomId,
      playerName: this.playerName
    })
    this.statusText.setText('Connexion...')
  }

  setupSocketEvents() {
    this.socket.on('room_created', ({ roomId, mapData }) => {
      this.roomIdText.setText(`Code : ${roomId}`)
      this.statusText.setText('Room créée ! En attente de joueurs...')
      this.startMultiGame(mapData, roomId, this.socket)
    })

    this.socket.on('room_joined', ({ roomId, mapData, players }) => {
      this.statusText.setText('Connecté !')
      this.startMultiGame(mapData, roomId, this.socket, players)
    })

    this.socket.on('error', ({ message }) => {
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
