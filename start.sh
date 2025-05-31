#!/bin/bash

# 单词闯关双人对战版启动脚本

echo "🎮 单词闯关 - 双人对战版"
echo "=========================="

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到Node.js"
    echo "请先安装Node.js (https://nodejs.org/)"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到npm"
    echo "请先安装npm"
    exit 1
fi

echo "✅ Node.js版本: $(node --version)"
echo "✅ npm版本: $(npm --version)"
echo ""

# 检查package.json是否存在
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 未找到package.json文件"
    echo "请确保在项目根目录运行此脚本"
    exit 1
fi

# 检查node_modules是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    
    echo "✅ 依赖安装完成"
    echo ""
fi

# 启动服务器
echo "🚀 正在启动服务器..."
echo "📍 服务器地址: http://localhost:3000"
echo "🔗 WebSocket地址: ws://localhost:3000"
echo ""
echo "💡 提示:"
echo "   - 可以开启多个浏览器窗口测试双人对战"
echo "   - 按 Ctrl+C 停止服务器"
echo ""

# 启动服务器
npm start
