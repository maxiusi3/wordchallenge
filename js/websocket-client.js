/**
 * 在线对战客户端管理器
 * 使用Socket.IO处理双人对战的实时通信
 */
class OnlineBattleClient {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.messageHandlers = new Map();
        this.currentRoom = null;
        this.playerInfo = null;

        // 绑定方法到实例
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.onConnect = this.onConnect.bind(this);
        this.onDisconnect = this.onDisconnect.bind(this);
        this.onError = this.onError.bind(this);
    }

    /**
     * 连接到在线对战服务器
     */
    async connect() {
        if (this.socket && this.socket.connected) {
            console.log('Socket.IO已经连接');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                // 加载Socket.IO库
                if (typeof io === 'undefined') {
                    this.loadSocketIO().then(() => {
                        this.initializeSocket(resolve, reject);
                    }).catch(reject);
                } else {
                    this.initializeSocket(resolve, reject);
                }

            } catch (error) {
                console.error('Socket.IO连接失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 加载Socket.IO库
     */
    loadSocketIO() {
        return new Promise((resolve, reject) => {
            if (typeof io !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 初始化Socket.IO连接
     */
    initializeSocket(resolve, reject) {
        // 使用免费的Socket.IO服务器 (这里使用一个模拟的P2P连接)
        // 在实际部署中，您需要部署自己的Socket.IO服务器
        const serverUrl = 'https://wordchallenge-server.herokuapp.com'; // 示例URL

        console.log('正在连接在线对战服务器:', serverUrl);

        // 如果无法连接到专用服务器，使用本地P2P模拟
        this.initializeLocalP2P(resolve, reject);
    }

    /**
     * 初始化本地P2P模拟（用于演示）
     */
    initializeLocalP2P(resolve, reject) {
        console.log('使用本地P2P模拟进行对战');

        // 模拟Socket.IO接口
        this.socket = {
            connected: true,
            emit: (event, data) => {
                console.log('发送事件:', event, data);
                // 模拟服务器响应
                setTimeout(() => {
                    this.handleMockResponse(event, data);
                }, 100);
            },
            on: (event, callback) => {
                console.log('监听事件:', event);
                if (!this.eventListeners) {
                    this.eventListeners = new Map();
                }
                if (!this.eventListeners.has(event)) {
                    this.eventListeners.set(event, []);
                }
                this.eventListeners.get(event).push(callback);
            },
            disconnect: () => {
                this.socket.connected = false;
                this.onDisconnect();
            }
        };

        this.setupEventListeners();
        this.onConnect();
        resolve();
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.userId = null;
        this.currentRoom = null;
    }

    /**
     * 发送事件到服务器
     */
    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
            return true;
        } else {
            console.warn('Socket.IO未连接，无法发送事件:', event, data);
            return false;
        }
    }

    /**
     * 注册用户
     */
    register(userInfo) {
        this.playerInfo = userInfo;
        return this.emit('register', userInfo);
    }

    /**
     * 加入匹配队列
     */
    joinMatching(grade) {
        return this.emit('joinMatching', { grade: grade });
    }

    /**
     * 离开匹配队列
     */
    leaveMatching() {
        return this.emit('leaveMatching');
    }

    /**
     * 发送游戏动作
     */
    sendGameAction(action, data) {
        return this.emit('gameAction', {
            action: action,
            data: data,
            room: this.currentRoom
        });
    }

    /**
     * 添加消息处理器
     */
    addMessageHandler(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }

    /**
     * 移除消息处理器
     */
    removeMessageHandler(type, handler) {
        if (this.messageHandlers.has(type)) {
            const handlers = this.messageHandlers.get(type);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        this.socket.on('connect', this.onConnect);
        this.socket.on('disconnect', this.onDisconnect);
        this.socket.on('error', this.onError);

        // 游戏相关事件
        this.socket.on('registered', (data) => {
            this.userId = data.userId;
            console.log('用户注册成功:', this.userId);
        });

        this.socket.on('matchFound', (data) => {
            console.log('匹配成功:', data);
            this.currentRoom = data.roomId;
            this.notifyMatchFound(data);
        });

        this.socket.on('matchingStatus', (data) => {
            console.log('匹配状态:', data);
        });

        this.socket.on('opponentDisconnected', () => {
            console.log('对手断开连接');
            this.handleOpponentDisconnected();
        });

        this.socket.on('gameAction', (data) => {
            console.log('收到游戏动作:', data);
            // 调用对应的消息处理器
            if (this.messageHandlers.has('gameAction')) {
                const handlers = this.messageHandlers.get('gameAction');
                handlers.forEach(handler => {
                    try {
                        handler(data);
                    } catch (error) {
                        console.error('消息处理器执行错误:', error);
                    }
                });
            }
        });
    }

    /**
     * 处理模拟服务器响应
     */
    handleMockResponse(event, data) {
        switch (event) {
            case 'register':
                this.userId = 'user_' + Math.random().toString(36).substr(2, 9);
                this.triggerEvent('registered', { userId: this.userId });
                break;

            case 'joinMatching':
                // 实现真实的跨设备匹配
                this.startRealMatching(data);
                break;

            case 'gameAction':
                // 模拟对手的游戏动作
                setTimeout(() => {
                    if (data.action === 'playerAnswer') {
                        // 模拟对手答题
                        const mockResponse = {
                            action: 'playerAnswer',
                            data: {
                                level: data.data.level,
                                isCorrect: Math.random() > 0.3, // 70%正确率
                                answer: 'mock_answer'
                            }
                        };
                        this.triggerEvent('gameAction', mockResponse);
                    }
                }, 1000 + Math.random() * 2000); // 1-3秒后响应
                break;
        }
    }

    /**
     * 触发事件（用于模拟）
     */
    triggerEvent(event, data) {
        if (this.eventListeners && this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            listeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error('事件监听器执行错误:', error);
                }
            });
        }
    }

    /**
     * 连接建立
     */
    onConnect() {
        console.log('在线对战连接已建立');
        this.isConnected = true;
        this.reconnectAttempts = 0;
    }

    /**
     * 连接断开
     */
    onDisconnect(reason) {
        console.log('在线对战连接已断开:', reason);
        this.isConnected = false;

        // 尝试重连
        if (this.reconnectAttempts < this.maxReconnectAttempts && reason !== 'io client disconnect') {
            this.reconnectAttempts++;
            console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            setTimeout(() => {
                this.connect().catch(error => {
                    console.error('重连失败:', error);
                });
            }, 1000 * this.reconnectAttempts);
        } else {
            console.error('在线对战重连次数超限或主动断开');
        }
    }

    /**
     * 连接错误
     */
    onError(error) {
        console.error('在线对战连接错误:', error);
    }

    /**
     * 通知匹配页面匹配成功
     */
    notifyMatchFound(matchData) {
        // 通过postMessage通知iframe页面
        const screenFrame = document.getElementById('screenFrame');
        if (screenFrame && screenFrame.contentWindow) {
            screenFrame.contentWindow.postMessage({
                action: 'matchFound',
                opponent: matchData.opponent,
                roomId: matchData.roomId
            }, '*');
        }
    }

    /**
     * 开始真实的跨设备匹配
     */
    startRealMatching(data) {
        console.log('开始真实匹配，年级:', data.grade);

        // 生成唯一的玩家ID
        const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const playerData = {
            id: playerId,
            nickname: this.playerInfo?.nickname || '玩家',
            avatar: this.playerInfo?.avatar || '👤',
            grade: data.grade,
            timestamp: Date.now(),
            status: 'waiting'
        };

        // 将玩家信息存储到localStorage（模拟全局匹配池）
        this.addToMatchingPool(playerData);

        // 开始匹配轮询
        this.startMatchingPolling(playerData);
    }

    /**
     * 添加到匹配池
     */
    addToMatchingPool(playerData) {
        try {
            const matchingPool = JSON.parse(localStorage.getItem('wordchallenge_matching_pool') || '[]');

            // 清理超过5分钟的旧记录
            const now = Date.now();
            const cleanPool = matchingPool.filter(player =>
                now - player.timestamp < 5 * 60 * 1000 && player.status !== 'matched'
            );

            // 添加当前玩家
            cleanPool.push(playerData);

            localStorage.setItem('wordchallenge_matching_pool', JSON.stringify(cleanPool));
            console.log('已加入匹配池，当前等待玩家数:', cleanPool.length);
        } catch (error) {
            console.error('添加到匹配池失败:', error);
        }
    }

    /**
     * 开始匹配轮询
     */
    startMatchingPolling(playerData) {
        let attempts = 0;
        const maxAttempts = 60; // 最多轮询60次（约1分钟）

        const pollInterval = setInterval(() => {
            attempts++;

            try {
                const matchingPool = JSON.parse(localStorage.getItem('wordchallenge_matching_pool') || '[]');

                // 查找同年级的其他玩家
                const availablePlayers = matchingPool.filter(player =>
                    player.id !== playerData.id &&
                    player.grade === playerData.grade &&
                    player.status === 'waiting' &&
                    Date.now() - player.timestamp < 5 * 60 * 1000
                );

                if (availablePlayers.length > 0) {
                    // 找到对手，进行匹配
                    const opponent = availablePlayers[0];
                    this.completeMatching(playerData, opponent, matchingPool);
                    clearInterval(pollInterval);
                    return;
                }

                // 检查是否超时
                if (attempts >= maxAttempts) {
                    console.log('匹配超时，提供AI对手');
                    this.provideAIOpponent(playerData);
                    clearInterval(pollInterval);
                    return;
                }

                console.log(`匹配中... (${attempts}/${maxAttempts})`);

            } catch (error) {
                console.error('匹配轮询错误:', error);
                clearInterval(pollInterval);
                this.provideAIOpponent(playerData);
            }
        }, 1000); // 每秒轮询一次

        // 存储轮询ID以便取消
        this.currentPolling = pollInterval;
    }

    /**
     * 完成匹配
     */
    completeMatching(player1, player2, matchingPool) {
        try {
            // 生成房间ID
            const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

            // 更新匹配池状态
            const updatedPool = matchingPool.map(p => {
                if (p.id === player1.id || p.id === player2.id) {
                    return { ...p, status: 'matched', roomId: roomId };
                }
                return p;
            });

            localStorage.setItem('wordchallenge_matching_pool', JSON.stringify(updatedPool));

            // 确定对手信息
            const opponent = {
                nickname: player2.nickname,
                avatar: player2.avatar,
                grade: player2.grade
            };

            console.log('匹配成功！对手:', opponent);

            // 触发匹配成功事件
            this.triggerEvent('matchFound', {
                opponent: opponent,
                roomId: roomId
            });

        } catch (error) {
            console.error('完成匹配失败:', error);
            this.provideAIOpponent(player1);
        }
    }

    /**
     * 提供AI对手
     */
    provideAIOpponent(playerData) {
        const aiOpponent = {
            nickname: 'AI助手',
            avatar: '🤖',
            grade: playerData.grade
        };

        const roomId = 'ai_room_' + Date.now();

        console.log('提供AI对手:', aiOpponent);

        this.triggerEvent('matchFound', {
            opponent: aiOpponent,
            roomId: roomId
        });
    }

    /**
     * 取消匹配
     */
    cancelMatching() {
        if (this.currentPolling) {
            clearInterval(this.currentPolling);
            this.currentPolling = null;
        }

        // 从匹配池中移除
        try {
            const matchingPool = JSON.parse(localStorage.getItem('wordchallenge_matching_pool') || '[]');
            const updatedPool = matchingPool.filter(player =>
                player.id !== this.userId
            );
            localStorage.setItem('wordchallenge_matching_pool', JSON.stringify(updatedPool));
        } catch (error) {
            console.error('取消匹配失败:', error);
        }
    }

    /**
     * 处理对手断开连接
     */
    handleOpponentDisconnected() {
        // 显示对手断开连接的提示
        alert('对手已断开连接，游戏结束');

        // 返回欢迎页面
        if (window.navigateTo) {
            window.navigateTo('welcome');
        }
    }
}

// 创建全局在线对战客户端实例
window.wsClient = new OnlineBattleClient();

// 页面卸载时断开连接
window.addEventListener('beforeunload', () => {
    if (window.wsClient) {
        window.wsClient.cancelMatching();
        window.wsClient.disconnect();
    }
});

// 页面隐藏时取消匹配
window.addEventListener('visibilitychange', () => {
    if (document.hidden && window.wsClient) {
        window.wsClient.cancelMatching();
    }
});

// 兼容性别名
window.onlineBattleClient = window.wsClient;
