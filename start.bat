@echo off
chcp 65001 >nul

echo 🎮 单词闯关 - 双人对战版
echo ==========================

REM 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Node.js
    echo 请先安装Node.js (https://nodejs.org/)
    pause
    exit /b 1
)

REM 检查npm是否安装
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到npm
    echo 请先安装npm
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo ✅ Node.js版本: %NODE_VERSION%
echo ✅ npm版本: %NPM_VERSION%
echo.

REM 检查package.json是否存在
if not exist "package.json" (
    echo ❌ 错误: 未找到package.json文件
    echo 请确保在项目根目录运行此脚本
    pause
    exit /b 1
)

REM 检查node_modules是否存在
if not exist "node_modules" (
    echo 📦 正在安装依赖...
    npm install
    
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    
    echo ✅ 依赖安装完成
    echo.
)

REM 启动服务器
echo 🚀 正在启动服务器...
echo 📍 服务器地址: http://localhost:3000
echo 🔗 WebSocket地址: ws://localhost:3000
echo.
echo 💡 提示:
echo    - 可以开启多个浏览器窗口测试双人对战
echo    - 按 Ctrl+C 停止服务器
echo.

REM 启动服务器
npm start

pause
