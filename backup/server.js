/**
 * 简单的HTTP服务器脚本
 * 用于在本地运行单词闯关游戏
 * 
 * 使用方法：
 * 1. 安装Node.js
 * 2. 在终端中导航到游戏目录
 * 3. 运行 node server.js
 * 4. 在浏览器中访问 http://localhost:8000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 端口配置
const PORT = process.env.PORT || 8000;

// MIME类型映射
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.pdf': 'application/pdf',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf'
};

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    // 解析URL
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;
    
    // 如果请求根路径，默认提供index.html
    if (pathname === '/') {
        pathname = '/new_project/index.html';
    }
    
    // 获取文件的完整路径
    const filePath = path.join(__dirname, pathname);
    
    // 获取文件扩展名
    const extname = path.extname(filePath);
    
    // 默认内容类型为纯文本
    let contentType = 'text/plain';
    
    // 根据文件扩展名设置正确的内容类型
    if (MIME_TYPES[extname]) {
        contentType = MIME_TYPES[extname];
    }
    
    // 读取文件
    fs.readFile(filePath, (err, data) => {
        if (err) {
            // 如果文件不存在，返回404
            if (err.code === 'ENOENT') {
                console.error(`文件不存在: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1><p>请求的文件不存在。</p>');
                return;
            }
            
            // 对于其他错误，返回500
            console.error(`服务器错误: ${err.code}`);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>500 Internal Server Error</h1><p>服务器内部错误。</p>');
            return;
        }
        
        // 成功读取文件，返回内容
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}/`);
    console.log(`访问游戏: http://localhost:${PORT}/new_project/index.html`);
    console.log('按 Ctrl+C 停止服务器');
});

// 处理服务器错误
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`端口 ${PORT} 已被占用，请尝试其他端口`);
    } else {
        console.error(`服务器错误: ${err.code}`);
    }
});
