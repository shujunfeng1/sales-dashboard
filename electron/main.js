/**
 * Electron 主进程
 * 启动 Python HTTP 服务器，打开 Electron 窗口加载看板
 */
const { app, BrowserWindow, shell } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const PORT = 1421;

// ===================== 工具函数 =====================

function getFreePort(start = PORT) {
  return new Promise((resolve) => {
    for (let port = start; port < start + 200; port++) {
      const s = net.createConnection(port, '127.0.0.1', () => {
        s.destroy();
        port++;
      });
      s.on('error', () => resolve(port));
      s.on('close', () => {
        if (!s.destroyed) s.destroy();
      });
      s.setTimeout(200, () => { s.destroy(); resolve(port); });
    }
  });
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function getResourcePath() {
  // 打包后：resources 目录下
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'web-dist');
  }
  // 开发时：项目根目录
  return path.join(__dirname, '..', 'web-dist');
}

function getWebDistPath() {
  // 始终找 web-dist 目录
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'web-dist');
  }
  return path.join(__dirname, '..', 'web-dist');
}

// ===================== Python 服务器 =====================

let pythonServer = null;

async function startPythonServer() {
  const port = await getFreePort();
  const webDist = getWebDistPath();

  if (!fs.existsSync(webDist)) {
    console.error('[Electron] web-dist not found:', webDist);
    return null;
  }

  // 构造 Python 启动命令
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'run_dashboard.py')
    : path.join(__dirname, 'run_dashboard.py');

  const serverScript = `
import http.server, socketserver, json, urllib.request, urllib.error, os

PORT = ${port}
BASEDIR = r"${webDist.replace(/\\/g, '\\\\')}"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASEDIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200); self.end_headers()

    def do_POST(self):
        if self.path.startswith('/api/wecom-push'):
            self._handle_wecom_push()
        else:
            self.send_error(404, 'Not Found')

    def _handle_wecom_push(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            payload = json.loads(body.decode('utf-8'))
            webhook = payload.get('webhook')
            message = payload.get('message')
            if not webhook or not message:
                self._json(400, {'error': 'missing params'})
                return
            data = json.dumps(message).encode('utf-8')
            req = urllib.request.Request(webhook, data=data,
                headers={'Content-Type': 'application/json'}, method='POST')
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read().decode())
                if result.get('errcode') != 0:
                    self._json(200, {'ok': False, 'error': result.get('errmsg', 'send failed')})
                else:
                    self._json(200, {'ok': True})
        except Exception as e:
            self._json(200, {'ok': False, 'error': str(e)})

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def extensions_map(self):
        return {
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.html': 'text/html',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '': 'application/octet-stream',
        }

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"SERVER_READY:{PORT}")
    httpd.serve_forever()
`;

  return new Promise((resolve) => {
    pythonServer = spawn(pythonCmd, ['-c', serverScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    let output = '';
    pythonServer.stdout.on('data', (data) => {
      output += data.toString();
      const match = output.match(/SERVER_READY:(\d+)/);
      if (match) {
        console.log(`[Electron] Python server ready on port ${match[1]}`);
        resolve(parseInt(match[1]));
      }
    });

    pythonServer.stderr.on('data', (data) => {
      console.error('[Python stderr]', data.toString());
    });

    pythonServer.on('error', (err) => {
      console.error('[Electron] Failed to start Python:', err);
      resolve(null);
    });
  });
}

// ===================== Electron 窗口 =====================

let mainWindow = null;

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: '销售数据看板',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Windows 上默认打开 DevTools 方便排查
    if (process.platform === 'win32') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 点击外部链接用浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ===================== 生命周期 =====================

app.whenReady().then(async () => {
  const port = await startPythonServer();
  if (!port) {
    const { dialog } = require('electron');
    dialog.showErrorBox('启动失败', '无法启动内置 HTTP 服务器，请确保已安装 Python 3。\n\nmacOS: brew install python3\nLinux: sudo apt install python3');
    app.quit();
    return;
  }
  createWindow(`http://localhost:${port}`);
});

app.on('window-all-closed', () => {
  if (pythonServer) {
    pythonServer.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    startPythonServer().then(port => {
      if (port) createWindow(`http://localhost:${port}`);
    });
  }
});
