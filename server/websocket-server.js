const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// 创建HTTP服务器用于提供静态文件
const server = http.createServer((req, res) => {
    // 简单的静态文件服务
    let filePath = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url);
    
    // 安全检查，防止目录遍历
    if (!filePath.startsWith(path.join(__dirname, '..'))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        
        // 设置正确的Content-Type
        const ext = path.extname(filePath);
        const contentType = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json'
        }[ext] || 'text/plain';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 存储连接的客户端和匹配队列
const clients = new Map(); // userId -> { ws, userInfo, status }
const matchingQueue = new Map(); // grade -> [userIds]
const gameRooms = new Map(); // roomId -> { players, gameState }

// 生成唯一ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// 广播消息给房间内的所有玩家
function broadcastToRoom(roomId, message) {
    const room = gameRooms.get(roomId);
    if (room) {
        room.players.forEach(playerId => {
            const client = clients.get(playerId);
            if (client && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(message));
            }
        });
    }
}

// 发送消息给特定客户端
function sendToClient(userId, message) {
    const client = clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
    }
}

// 处理匹配逻辑
function findMatch(userId, grade) {
    const queue = matchingQueue.get(grade) || [];
    
    // 寻找等待中的玩家
    for (let i = 0; i < queue.length; i++) {
        const waitingUserId = queue[i];
        if (waitingUserId !== userId && clients.has(waitingUserId)) {
            // 找到匹配，创建游戏房间
            const roomId = generateId();
            const players = [userId, waitingUserId];
            
            // 创建游戏房间
            gameRooms.set(roomId, {
                players,
                gameState: {
                    currentLevel: 1,
                    scores: { [userId]: 0, [waitingUserId]: 0 },
                    levelWins: { [userId]: 0, [waitingUserId]: 0 }
                },
                createdAt: Date.now()
            });
            
            // 从匹配队列中移除两个玩家
            queue.splice(i, 1);
            const userIndex = queue.indexOf(userId);
            if (userIndex > -1) {
                queue.splice(userIndex, 1);
            }
            
            // 更新玩家状态
            clients.get(userId).status = 'matched';
            clients.get(userId).roomId = roomId;
            clients.get(waitingUserId).status = 'matched';
            clients.get(waitingUserId).roomId = roomId;
            
            // 通知双方匹配成功
            const userInfo = clients.get(userId).userInfo;
            const opponentInfo = clients.get(waitingUserId).userInfo;
            
            sendToClient(userId, {
                type: 'matchFound',
                roomId,
                opponent: opponentInfo
            });
            
            sendToClient(waitingUserId, {
                type: 'matchFound',
                roomId,
                opponent: userInfo
            });
            
            console.log(`匹配成功: ${userInfo.nickname} vs ${opponentInfo.nickname}`);
            return true;
        }
    }
    
    return false;
}

// WebSocket连接处理
wss.on('connection', (ws) => {
    let userId = null;
    
    console.log('新的WebSocket连接');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'register':
                    // 注册用户
                    userId = generateId();
                    clients.set(userId, {
                        ws,
                        userInfo: data.userInfo,
                        status: 'online'
                    });
                    
                    ws.send(JSON.stringify({
                        type: 'registered',
                        userId
                    }));
                    
                    console.log(`用户注册: ${data.userInfo.nickname} (${userId})`);
                    break;
                    
                case 'joinMatching':
                    // 加入匹配队列
                    if (!userId || !clients.has(userId)) {
                        ws.send(JSON.stringify({ type: 'error', message: '用户未注册' }));
                        return;
                    }
                    
                    const grade = data.grade;
                    if (!matchingQueue.has(grade)) {
                        matchingQueue.set(grade, []);
                    }
                    
                    const queue = matchingQueue.get(grade);
                    if (!queue.includes(userId)) {
                        queue.push(userId);
                    }
                    
                    clients.get(userId).status = 'matching';
                    
                    // 尝试立即匹配
                    if (!findMatch(userId, grade)) {
                        ws.send(JSON.stringify({
                            type: 'matchingStatus',
                            status: 'waiting',
                            queuePosition: queue.indexOf(userId) + 1
                        }));
                    }
                    
                    console.log(`${clients.get(userId).userInfo.nickname} 加入匹配队列 (${grade})`);
                    break;
                    
                case 'leaveMatching':
                    // 离开匹配队列
                    if (userId && clients.has(userId)) {
                        const userGrade = clients.get(userId).userInfo.grade;
                        const queue = matchingQueue.get(userGrade);
                        if (queue) {
                            const index = queue.indexOf(userId);
                            if (index > -1) {
                                queue.splice(index, 1);
                            }
                        }
                        clients.get(userId).status = 'online';
                        console.log(`${clients.get(userId).userInfo.nickname} 离开匹配队列`);
                    }
                    break;
                    
                case 'gameAction':
                    // 处理游戏中的动作
                    if (!userId || !clients.has(userId)) {
                        return;
                    }
                    
                    const client = clients.get(userId);
                    const roomId = client.roomId;
                    
                    if (!roomId || !gameRooms.has(roomId)) {
                        return;
                    }
                    
                    // 广播游戏动作给房间内的其他玩家
                    broadcastToRoom(roomId, {
                        type: 'gameAction',
                        action: data.action,
                        playerId: userId,
                        data: data.data
                    });
                    
                    break;
                    
                default:
                    console.log('未知消息类型:', data.type);
            }
        } catch (error) {
            console.error('处理消息时出错:', error);
            ws.send(JSON.stringify({ type: 'error', message: '服务器错误' }));
        }
    });
    
    ws.on('close', () => {
        if (userId && clients.has(userId)) {
            const client = clients.get(userId);
            
            // 从匹配队列中移除
            if (client.status === 'matching') {
                const grade = client.userInfo.grade;
                const queue = matchingQueue.get(grade);
                if (queue) {
                    const index = queue.indexOf(userId);
                    if (index > -1) {
                        queue.splice(index, 1);
                    }
                }
            }
            
            // 如果在游戏中，通知对手
            if (client.roomId && gameRooms.has(client.roomId)) {
                const room = gameRooms.get(client.roomId);
                const opponentId = room.players.find(id => id !== userId);
                if (opponentId) {
                    sendToClient(opponentId, {
                        type: 'opponentDisconnected'
                    });
                }
                gameRooms.delete(client.roomId);
            }
            
            clients.delete(userId);
            console.log(`用户断开连接: ${client.userInfo.nickname} (${userId})`);
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket错误:', error);
    });
});

// 定期清理过期的游戏房间
setInterval(() => {
    const now = Date.now();
    const expireTime = 30 * 60 * 1000; // 30分钟
    
    for (const [roomId, room] of gameRooms.entries()) {
        if (now - room.createdAt > expireTime) {
            console.log(`清理过期房间: ${roomId}`);
            gameRooms.delete(roomId);
        }
    }
}, 5 * 60 * 1000); // 每5分钟检查一次

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(`WebSocket服务器已启动`);
    console.log(`访问 http://localhost:${PORT} 开始游戏`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到SIGTERM信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('收到SIGINT信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});
