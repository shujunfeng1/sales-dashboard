"""
销售数据看板 - 一键启动器（支持 PyInstaller 打包）
双击运行，自动打开浏览器；支持服务端企微推送
"""
import http.server
import socketserver
import webbrowser
import threading
import sys
import os
import json
import urllib.request
import urllib.error

PORT = 1421

def get_basedir():
    """获取资源目录：开发时用脚本同目录，打包后用 PyInstaller 的 _MEIPASS"""
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, 'web-dist')
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(script_dir, 'web-dist')

def get_available_port(start=PORT):
    """找可用端口"""
    import socket
    for port in range(start, start + 100):
        try:
            s = socket.socket()
            s.bind(('', port))
            s.close()
            return port
        except OSError:
            continue
    return start

# ============================================================
# 自定义 Handler：支持静态文件 + 企微推送 API
# ============================================================
class DashboardHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        # extensions_map 放在实例上
        self._extensions_map = {
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
        super().__init__(*args, directory=get_basedir(), **kwargs)

    def end_headers(self):
        # 允许跨域（前端和后端同源，但多端口也没问题）
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        """处理 /api/* 请求"""
        if self.path.startswith('/api/wecom-push'):
            self._handle_wecom_push()
        else:
            self.send_error(404, 'Not Found')

    def _handle_wecom_push(self):
        """服务端转发企微推送（绕过浏览器代理）"""
        try:
            # 读取请求体
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            payload = json.loads(body.decode('utf-8'))
            webhook = payload.get('webhook')
            message = payload.get('message')

            if not webhook or not message:
                self._json_response(400, {'error': '缺少 webhook 或 message 参数'})
                return

            # 用 Python urllib 发送（默认不使用系统代理，绕过浏览器限制）
            data = json.dumps(message).encode('utf-8')
            req = urllib.request.Request(
                webhook,
                data=data,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = resp.read().decode('utf-8')
                result_obj = json.loads(result)
                if result_obj.get('errcode') != 0:
                    self._json_response(200, {'ok': False, 'error': result_obj.get('errmsg', '发送失败')})
                else:
                    self._json_response(200, {'ok': True})

        except urllib.error.URLError as e:
            self._json_response(200, {'ok': False, 'error': f'网络错误: {e.reason}'})
        except json.JSONDecodeError:
            self._json_response(400, {'error': '无效的 JSON'})
        except Exception as e:
            self._json_response(200, {'ok': False, 'error': str(e)})

    def _json_response(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    # 覆盖 extensions_map 属性访问
    @property
    def extensions_map(self):
        return self._extensions_map

    @extensions_map.setter
    def extensions_map(self, value):
        self._extensions_map = value


def start_server(port):
    """启动服务器"""
    basedir = get_basedir()
    os.chdir(basedir)

    # 复用端口
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), DashboardHandler) as httpd:
        print(f"🚀 看板已启动: http://localhost:{port}")
        print(f"📁 资源目录: {basedir}")
        print(f"按 Ctrl+C 停止服务器")
        httpd.serve_forever()

def open_browser(port):
    """延迟打开浏览器"""
    def _open():
        import time
        time.sleep(1.5)
        webbrowser.open(f"http://localhost:{port}")
        print("✅ 浏览器已打开")
    t = threading.Thread(target=_open, daemon=True)
    t.start()

if __name__ == "__main__":
    port = get_available_port(PORT)
    open_browser(port)
    try:
        start_server(port)
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")
        sys.exit(0)
