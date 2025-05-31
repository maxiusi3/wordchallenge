/**
 * WebSocket客户端管理器
 * 处理双人对战的实时通信
 */
class WebSocketClient {
    constructor() {
        this.ws = null;
        this.userId = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 1秒
        this.messageHandlers = new Map();
        
        // 绑定方法到实例
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.send = this.send.bind(this);
        this.onMessage = this.onMessage.bind(this);
        this.onOpen = this.onOpen.bind(this);
        this.onClose = this.onClose.bind(this);
        this.onError = this.onError.bind(this);
    }
    
    /**
     * 连接到WebSocket服务器
     */
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('WebSocket已经连接');
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            try {
                // 确定WebSocket服务器地址
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const host = window.location.host;
                const wsUrl = `${protocol}//${host}`;
                
                console.log('正在连接WebSocket服务器:', wsUrl);
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = (event) => {
                    this.onOpen(event);
                    resolve();
                };
                
                this.ws.onmessage = this.onMessage;
                this.ws.onclose = this.onClose;
                this.ws.onerror = (error) => {
                    this.onError(error);
                    reject(error);
                };
                
            } catch (error) {
                console.error('WebSocket连接失败:', error);
                reject(error);
            }
        });
    }
    
    /**
     * 断开WebSocket连接
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.userId = null;
    }
    
    /**
     * 发送消息到服务器
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            return true;
        } else {
            console.warn('WebSocket未连接，无法发送消息:', message);
            return false;
        }
    }
    
    /**
     * 注册用户
     */
    register(userInfo) {
        return this.send({
            type: 'register',
            userInfo: userInfo
        });
    }
    
    /**
     * 加入匹配队列
     */
    joinMatching(grade) {
        return this.send({
            type: 'joinMatching',
            grade: grade
        });
    }
    
    /**
     * 离开匹配队列
     */
    leaveMatching() {
        return this.send({
            type: 'leaveMatching'
        });
    }
    
    /**
     * 发送游戏动作
     */
    sendGameAction(action, data) {
        return this.send({
            type: 'gameAction',
            action: action,
            data: data
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
     * 处理接收到的消息
     */
    onMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('收到WebSocket消息:', message);
            
            // 调用对应的消息处理器
            if (this.messageHandlers.has(message.type)) {
                const handlers = this.messageHandlers.get(message.type);
                handlers.forEach(handler => {
                    try {
                        handler(message);
                    } catch (error) {
                        console.error('消息处理器执行错误:', error);
                    }
                });
            }
            
            // 处理内置消息类型
            switch (message.type) {
                case 'registered':
                    this.userId = message.userId;
                    console.log('用户注册成功:', this.userId);
                    break;
                    
                case 'matchFound':
                    console.log('匹配成功:', message);
                    // 通知匹配页面
                    this.notifyMatchFound(message);
                    break;
                    
                case 'matchingStatus':
                    console.log('匹配状态:', message);
                    break;
                    
                case 'opponentDisconnected':
                    console.log('对手断开连接');
                    this.handleOpponentDisconnected();
                    break;
                    
                case 'error':
                    console.error('服务器错误:', message.message);
                    break;
            }
            
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
        }
    }
    
    /**
     * WebSocket连接打开
     */
    onOpen(event) {
        console.log('WebSocket连接已建立');
        this.isConnected = true;
        this.reconnectAttempts = 0;
    }
    
    /**
     * WebSocket连接关闭
     */
    onClose(event) {
        console.log('WebSocket连接已关闭:', event.code, event.reason);
        this.isConnected = false;
        
        // 尝试重连
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.connect().catch(error => {
                    console.error('重连失败:', error);
                });
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('WebSocket重连次数超限');
        }
    }
    
    /**
     * WebSocket连接错误
     */
    onError(error) {
        console.error('WebSocket连接错误:', error);
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

// 创建全局WebSocket客户端实例
window.wsClient = new WebSocketClient();

// 页面卸载时断开连接
window.addEventListener('beforeunload', () => {
    if (window.wsClient) {
        window.wsClient.disconnect();
    }
});
