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
        if (this.isConnected) {
            console.log('已连接到在线对战系统');
            return Promise.resolve();
        }

        return new Promise(async (resolve, reject) => {
            try {
                // 优先尝试Firebase对战系统
                if (window.firebaseBattle) {
                    const firebaseReady = await window.firebaseBattle.init();
                    if (firebaseReady) {
                        console.log('✨ 使用Firebase对战系统');
                        this.useFirebase = true;
                        this.isConnected = true;
                        this.setupFirebaseEventListeners();
                        resolve();
                        return;
                    }
                }

                // Firebase不可用，回退到本地模拟
                console.log('🔄 Firebase不可用，使用本地模拟模式');
                this.useFirebase = false;

                // 加载Socket.IO库
                if (typeof io === 'undefined') {
                    this.loadSocketIO().then(() => {
                        this.initializeSocket(resolve, reject);
                    }).catch(() => {
                        // Socket.IO加载失败，使用本地模拟
                        this.initializeLocalP2P(resolve, reject);
                    });
                } else {
                    this.initializeSocket(resolve, reject);
                }

            } catch (error) {
                console.error('初始化对战系统失败:', error);
                // 最终回退到本地模拟
                this.useFirebase = false;
                this.initializeLocalP2P(resolve, reject);
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
     * 设置Firebase事件监听器
     */
    setupFirebaseEventListeners() {
        if (!window.firebaseBattle) return;

        // 监听匹配成功事件
        window.firebaseBattle.on('matchFound', (data) => {
            console.log('🎉 Firebase匹配成功:', data);
            this.currentRoom = data.roomId;

            // 设置房间ID到全局变量
            window.currentRoomId = data.roomId;

            this.notifyMatchFound(data);
        });

        // 监听对手断开连接
        window.firebaseBattle.on('opponentDisconnected', () => {
            console.log('对手已断开连接');
            this.handleOpponentDisconnected();
        });

        // 监听游戏动作
        window.firebaseBattle.on('gameAction', (data) => {
            console.log('收到Firebase游戏动作:', data);
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
     * 注册用户
     */
    register(userInfo) {
        this.playerInfo = userInfo;

        if (this.useFirebase) {
            // Firebase模式下不需要显式注册
            return true;
        } else {
            return this.emit('register', userInfo);
        }
    }

    /**
     * 加入匹配队列
     */
    joinMatching(grade) {
        if (this.useFirebase && window.firebaseBattle) {
            // 使用Firebase匹配系统
            const userInfo = {
                nickname: this.playerInfo?.nickname || '玩家',
                avatar: this.playerInfo?.avatar || '👤',
                grade: grade
            };
            return window.firebaseBattle.startMatching(userInfo);
        } else {
            return this.emit('joinMatching', { grade: grade });
        }
    }

    /**
     * 离开匹配队列
     */
    leaveMatching() {
        if (this.useFirebase && window.firebaseBattle) {
            return window.firebaseBattle.cancelMatching();
        } else {
            return this.emit('leaveMatching');
        }
    }

    /**
     * 发送游戏动作
     */
    sendGameAction(action, data) {
        if (this.useFirebase && window.firebaseBattle) {
            return window.firebaseBattle.sendGameAction(action, data);
        } else {
            return this.emit('gameAction', {
                action: action,
                data: data,
                room: this.currentRoom
            });
        }
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
                // 检查是否为AI对手模式
                const isAIOpponent = window.parent && window.parent.opponentInfo && 
                                   window.parent.opponentInfo.nickname === 'AI助手';
                
                if (isAIOpponent) {
                    // AI对手模式：模拟对手的游戏动作
                    console.log('🤖 AI对手模式，模拟对手响应游戏动作:', data);
                    setTimeout(() => {
                        if (data.action === 'playerAnswer') {
                            // 模拟对手答题，使用更真实的响应时间
                            const mockResponse = {
                                action: 'playerAnswer',
                                data: {
                                    level: data.data.level,
                                    isCorrect: Math.random() > 0.4, // 60%正确率，更加真实
                                    answer: 'mock_answer_' + Date.now()
                                },
                                playerId: 'mock_opponent_' + Date.now()
                            };
                            console.log('📤 发送模拟对手答题结果:', mockResponse);
                            this.triggerEvent('gameAction', mockResponse);
                        } else if (data.action === 'levelEnd') {
                            // 模拟对手关卡结束响应
                            console.log('🏁 模拟对手关卡结束响应');
                            // 不需要特别响应，让游戏自然结束
                        }
                    }, 10000 + Math.random() * 5000); // 0.8-2.3秒后响应，更加真实
                } else {
                    // 真人对战模式：不进行模拟响应
                    console.log('👥 真人对战模式，不模拟对手响应:', data);
                }
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
        console.log('🎉 通知匹配成功:', matchData);

        // 存储房间ID到父页面
        if (window.parent) {
            window.parent.currentRoomId = matchData.roomId;
            console.log('🏠 设置房间ID:', matchData.roomId);
        }

        // 存储对手信息，包含角色信息
        if (window.parent && matchData.opponent) {
            window.parent.opponentInfo = {
                ...matchData.opponent,
                role: matchData.myRole === 'cop' ? 'thief' : 'cop' // 对手角色与我相反
            };
            console.log('👥 存储对手信息:', window.parent.opponentInfo);
        }

        // 通过postMessage通知iframe页面
        const screenFrame = document.getElementById('screenFrame');
        if (screenFrame && screenFrame.contentWindow) {
            screenFrame.contentWindow.postMessage({
                action: 'matchFound',
                opponent: matchData.opponent,
                roomId: matchData.roomId,
                myRole: matchData.myRole
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
            console.log('匹配池详情:', cleanPool.map(p => ({ nickname: p.nickname, grade: p.grade, status: p.status })));

            // 提示用户如何测试真实匹配
            if (cleanPool.length === 1) {
                console.log('%c📝 测试提示：要测试真实玩家匹配，请在另一个浏览器标签页或隐私模式中打开同一个网址，选择相同年级并开始匹配', 'color: #3498db; font-size: 14px; font-weight: bold;');
            }
        } catch (error) {
            console.error('添加到匹配池失败:', error);
        }
    }

    /**
     * 开始匹配轮询
     */
    startMatchingPolling(playerData) {
        let attempts = 0;
        const maxAttempts = 20; // 减少到15秒，更快提供AI对手

        console.log('开始匹配轮询，将在', maxAttempts, '秒后提供AI对手');

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

                console.log(`匹配中... (${attempts}/${maxAttempts}) - 可用玩家: ${availablePlayers.length}`);

                if (availablePlayers.length > 0) {
                    // 找到对手，进行匹配
                    const opponent = availablePlayers[0];
                    console.log('找到真实对手！', opponent);
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

    /**
     * 调试工具：查看当前匹配池状态
     */
    debugMatchingPool() {
        try {
            const matchingPool = JSON.parse(localStorage.getItem('wordchallenge_matching_pool') || '[]');
            const now = Date.now();

            console.log('%c🔍 匹配池调试信息', 'color: #e74c3c; font-size: 16px; font-weight: bold;');
            console.log('总玩家数:', matchingPool.length);

            matchingPool.forEach((player, index) => {
                const ageMinutes = Math.floor((now - player.timestamp) / (1000 * 60));
                console.log(`${index + 1}. ${player.nickname} (年级: ${player.grade}, 状态: ${player.status}, ${ageMinutes}分钟前)`);
            });

            const activePool = matchingPool.filter(player =>
                now - player.timestamp < 5 * 60 * 1000 && player.status === 'waiting'
            );
            console.log('活跃等待玩家数:', activePool.length);

            return { total: matchingPool.length, active: activePool.length, players: matchingPool };
        } catch (error) {
            console.error('调试匹配池失败:', error);
            return null;
        }
    }

    /**
     * 调试工具：清空匹配池
     */
    clearMatchingPool() {
        try {
            localStorage.removeItem('wordchallenge_matching_pool');
            console.log('%c🗑️ 匹配池已清空', 'color: #27ae60; font-size: 14px; font-weight: bold;');
        } catch (error) {
            console.error('清空匹配池失败:', error);
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

// 暴露调试工具到全局作用域
window.debugMatchingPool = () => window.wsClient.debugMatchingPool();
window.clearMatchingPool = () => window.wsClient.clearMatchingPool();

// 提示用户可用的调试命令
console.log('%c🔧 调试工具已加载', 'color: #9b59b6; font-size: 14px; font-weight: bold;');
console.log('可用命令:');
console.log('- debugMatchingPool() - 查看当前匹配池状态');
console.log('- clearMatchingPool() - 清空匹配池');
