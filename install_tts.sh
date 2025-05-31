#!/bin/bash

echo "安装 Edge TTS 服务依赖..."

# 检查 Python 是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到 Python3，请先安装 Python3"
    exit 1
fi

# 检查 pip 是否安装
if ! command -v pip3 &> /dev/null; then
    echo "错误: 未找到 pip3，请先安装 pip3"
    exit 1
fi

# 安装依赖
echo "安装 edge-tts..."
pip3 install edge-tts

echo "安装 Flask..."
pip3 install Flask

echo "安装 Flask-CORS..."
pip3 install Flask-CORS

echo "依赖安装完成！"
echo ""
echo "使用方法："
echo "1. 启动 TTS 服务器: python3 tts_server.py"
echo "2. 服务器将在 http://localhost:5000 启动"
echo "3. 测试: curl 'http://localhost:5000/tts?text=hello'"
