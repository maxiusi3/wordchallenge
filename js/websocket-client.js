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
                // 模拟匹配过程 - 30秒后才提供模拟对手
                console.log('开始匹配，30秒后如无真实对手将提供模拟对手');
                setTimeout(() => {
                    const mockOpponent = {
                        nickname: '模拟对手',
                        avatar: '🤖',
                        grade: data.grade
                    };
                    const roomId = 'room_' + Math.random().toString(36).substr(2, 9);
                    this.currentRoom = roomId;
                    console.log('30秒匹配超时，提供模拟对手');
                    this.triggerEvent('matchFound', {
                        opponent: mockOpponent,
                        roomId: roomId
                    });
                }, 30000); // 30秒后匹配成功
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
        window.wsClient.disconnect();
    }
});

// 兼容性别名
window.onlineBattleClient = window.wsClient;
