#!/bin/bash
# 启动销售数据看板服务

# 设置企业微信群机器人 Webhook（替换为你的实际 key）
export WECHAT_WEBHOOK="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_WEBHOOK_KEY_HERE"

# 进入脚本所在目录
cd "$(dirname "$0")"

# 激活虚拟环境
source ~/flask_env/bin/activate

# 启动服务
python app.py
