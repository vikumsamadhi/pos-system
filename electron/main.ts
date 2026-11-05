import path from 'node:path'
import { app, BrowserWindow, Menu, shell } from 'electron'
import { closeDatabase, openDatabase, resolveDbPath, type Db } from './db/database'
import { registerIpc } from './ipc'

let mainWindow: BrowserWindow | null = null
let db: Db | null = null

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0a0f14',
    title: 'POS Counter',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)

  const dbPath = resolveDbPath(app.getPath('userData'))
  db = openDatabase(dbPath)
  console.log(`[pos] database ready at ${dbPath}`)

  registerIpc({ db, receiptsDir: path.join(app.getPath('userData'), 'receipts') })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase(db)
  db = null
})

if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}
