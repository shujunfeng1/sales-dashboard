"""
销售数据看板 - Flask 服务端
功能：接收前端发送的HTML数据 → Playwright截图 → 推送到企业微信群
"""

import os
import uuid
import subprocess
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ============ 配置区 ============
# 企业微信群机器人 Webhook 地址
WECHAT_WEBHOOK = os.environ.get(
    "WECHAT_WEBHOOK",
    "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_WEBHOOK_KEY"
)

# 截图临时存放目录
SCREENSHOT_DIR = "/tmp/screenshots"

# ============= 路由 =============

@app.route("/")
def index():
    """前端页面"""
    return send_from_directory("static", "index.html")

@app.route("/api/push", methods=["POST"])
def push():
    """
    接收前端发送的数据，推送到企业微信群
    请求体: { "html": "...", "message": "可选的文本消息" }
    """
    data = request.get_json()
    if not data or "html" not in data:
        return jsonify({"error": "缺少 html 字段"}), 400

    html_content = data.get("html", "")
    text_msg = data.get("message", "📊 销售数据看板")

    try:
        # 1. 生成截图
        screenshot_path = generate_screenshot(html_content)

        # 2. 推送到企业微信
        result = push_to_wechat(screenshot_path, text_msg)

        return jsonify({"success": True, "result": result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        # 3. 清理截图
        if "screenshot_path" in dir() and os.path.exists(screenshot_path):
            os.remove(screenshot_path)


def generate_screenshot(html_content: str) -> str:
    """用 Playwright 将 HTML 渲染为截图"""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    screenshot_path = os.path.join(SCREENSHOT_DIR, f"{uuid.uuid4().hex}.png")

    # Playwright 脚本：渲染HTML并截图
    playwright_script = f"""
const {{ chromium }} = require('playwright');
(async () => {{
    const browser = await chromium.launch({{
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }});
    const page = await browser.newPage();
    // 设置页面内容
    await page.setContent(`{html_content}`, {{ waitUntil: 'networkidle' }});
    // 等待表格渲染
    await page.waitForTimeout(1000);
    // 截图
    await page.screenshot({{
        path: '{screenshot_path}',
        type: 'png',
        fullPage: true
    }});
    await browser.close();
}})();
"""

    script_path = os.path.join(SCREENSHOT_DIR, "_playwright_render.js")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(playwright_script)

    result = subprocess.run(
        ["node", script_path],
        capture_output=True,
        text=True,
        cwd=SCREENSHOT_DIR,
        timeout=60
    )

    os.remove(script_path)

    if result.returncode != 0:
        raise Exception(f"Playwright截图失败: {result.stderr}")

    if not os.path.exists(screenshot_path):
        raise Exception("截图文件未生成")

    return screenshot_path


def push_to_wechat(image_path: str, text: str) -> dict:
    """调用企业微信群机器人接口推送图片"""
    import requests

    with open(image_path, "rb") as f:
        image_data = f.read()

    # 上传图片到微信临时素材（获取 media_id）
    upload_url = WECHAT_WEBHOOK.replace("cgi-bin/webhook/send", "cgi-bin/webhook/upload_media")
    upload_url += "&type=image"

    upload_resp = requests.post(
        upload_url,
        files={"media": ("screenshot.png", image_data, "image/png")},
        timeout=30
    )
    upload_data = upload_resp.json()

    if upload_data.get("errcode") != 0:
        raise Exception(f"图片上传失败: {upload_data.get('errmsg')}")

    media_id = upload_data["media_id"]

    # 发送图文消息
    send_url = WECHAT_WEBHOOK
    payload = {
        "msgtype": "image",
        "image": {"media_id": media_id}
    }

    resp = requests.post(send_url, json=payload, timeout=30)
    result = resp.json()

    if result.get("errcode") != 0:
        raise Exception(f"推送失败: {result.get('errmsg')}")

    return result


if __name__ == "__main__":
    # 启动服务
    app.run(host="0.0.0.0", port=5000, debug=False)
