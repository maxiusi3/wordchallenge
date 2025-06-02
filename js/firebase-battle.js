// Firebase在线对战系统
class FirebaseBattleManager {
    constructor() {
        this.database = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.matchingRef = null;
        this.roomRef = null;
        this.isMatching = false;
        this.matchingTimeout = null;
        this.lastProcessedActionId = null; // 记录最后处理的动作ID

        // 事件监听器
        this.eventListeners = new Map();

        // 绑定方法
        this.init = this.init.bind(this);
        this.startMatching = this.startMatching.bind(this);
        this.onMatchingPoolChange = this.onMatchingPoolChange.bind(this);
        this.onRoomUpdate = this.onRoomUpdate.bind(this);
    }

    /**
     * 初始化Firebase对战系统
     */
    async init() {
        try {
            // 确保Firebase已初始化
            const firebaseReady = await window.firebaseManager.init();

            if (!firebaseReady) {
                console.log('Firebase不可用，使用本地匹配模式');
                return false;
            }

            this.database = window.firebaseManager.getDatabase();
            console.log('🎮 Firebase对战系统初始化成功');
            return true;
        } catch (error) {
            console.error('Firebase对战系统初始化失败:', error);
            return false;
        }
    }

    /**
     * 开始匹配
     */
    async startMatching(userInfo) {
        if (this.isMatching) {
            console.log('已在匹配中...');
            return;
        }

        try {
            // 生成用户ID和数据
            const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            this.currentUser = {
                id: userId,
                nickname: userInfo.nickname || '玩家',
                avatar: userInfo.avatar || '👤',
                grade: userInfo.grade,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                status: 'waiting'
            };

            // 将用户ID存储到全局变量，供角色分配使用
            if (window.battleUserInfo) {
                window.battleUserInfo.id = userId;
            }

            console.log('🔍 开始匹配，用户信息:', this.currentUser);

            // 添加到匹配池
            const matchingPoolRef = this.database.ref(`matching/${this.currentUser.grade}`);
            const userRef = matchingPoolRef.child(this.currentUser.id);

            // 设置用户数据
            await userRef.set(this.currentUser);

            // 设置断线时自动移除
            userRef.onDisconnect().remove();

            this.isMatching = true;
            this.matchingRef = matchingPoolRef;

            // 监听匹配池变化
            this.matchingRef.on('child_added', this.onMatchingPoolChange);
            this.matchingRef.on('child_changed', this.onMatchingPoolChange);

            // 设置匹配超时（20秒后提供AI对手）
            this.matchingTimeout = setTimeout(() => {
                if (this.isMatching) {
                    console.log('⏰ 匹配超时，提供AI对手');
                    this.provideAIOpponent();
                }
            }, 20000);

            console.log('⏳ 正在匹配中，20秒后将提供AI对手...');

        } catch (error) {
            console.error('开始匹配失败:', error);
            this.stopMatching();
            // 回退到AI对手
            this.provideAIOpponent();
        }
    }

    /**
     * 处理匹配池变化
     */
    async onMatchingPoolChange(snapshot) {
        if (!this.isMatching) return;

        const userData = snapshot.val();
        const userId = snapshot.key;

        // 忽略自己
        if (userId === this.currentUser.id) return;

        // 检查是否是等待中的用户
        if (userData.status !== 'waiting') return;

        console.log('👥 发现潜在对手:', userData);

        try {
            // 尝试创建房间（原子操作）
            const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            const roomRef = this.database.ref(`rooms/${roomId}`);

            // 使用事务确保只有一个玩家能创建房间
            const result = await roomRef.transaction((currentData) => {
                if (currentData === null) {
                    // 房间不存在，创建新房间
                    return {
                        id: roomId,
                        status: 'waiting_for_players',
                        players: {
                            [this.currentUser.id]: {
                                ...this.currentUser,
                                status: 'ready'
                            },
                            [userId]: {
                                ...userData,
                                status: 'pending'
                            }
                        },
                        createdAt: firebase.database.ServerValue.TIMESTAMP,
                        grade: this.currentUser.grade
                    };
                } else {
                    // 房间已存在，取消事务
                    return undefined;
                }
            });

            if (result.committed) {
                console.log('🏠 成功创建房间:', roomId);

                // 更新双方状态为已匹配
                const updates = {};
                updates[`matching/${this.currentUser.grade}/${this.currentUser.id}/status`] = 'matched';
                updates[`matching/${this.currentUser.grade}/${this.currentUser.id}/roomId`] = roomId;
                updates[`matching/${this.currentUser.grade}/${userId}/status`] = 'matched';
                updates[`matching/${this.currentUser.grade}/${userId}/roomId`] = roomId;

                await this.database.ref().update(updates);

                // 加入房间
                this.joinRoom(roomId, userData);
            }

        } catch (error) {
            console.error('创建房间失败:', error);
        }
    }

    /**
     * 加入房间
     */
    async joinRoom(roomId, opponent) {
        try {
            this.currentRoom = roomId;
            this.roomRef = this.database.ref(`rooms/${roomId}`);

            // 停止匹配
            this.stopMatching();

            // 监听房间状态
            this.roomRef.on('value', this.onRoomUpdate);

            console.log('🎯 匹配成功！对手:', opponent);

            // 通知匹配成功
            this.triggerEvent('matchFound', {
                opponent: {
                    nickname: opponent.nickname,
                    avatar: opponent.avatar,
                    grade: opponent.grade
                },
                roomId: roomId
            });

        } catch (error) {
            console.error('加入房间失败:', error);
        }
    }

    /**
     * 处理房间状态更新
     */
    onRoomUpdate(snapshot) {
        const roomData = snapshot.val();

        if (!roomData) {
            console.log('房间已被删除');
            this.leaveRoom();
            return;
        }

        console.log('🏠 房间状态更新:', roomData);

        // 检查对手是否离线
        const players = Object.values(roomData.players || {});
        const opponent = players.find(p => p.id !== this.currentUser.id);

        if (opponent && opponent.status === 'disconnected') {
            console.log('对手已断开连接');
            this.triggerEvent('opponentDisconnected');
        }

        // 处理游戏动作
        if (roomData.gameActions) {
            const actions = Object.values(roomData.gameActions);
            console.log('🎮 房间中的所有游戏动作:', actions);

            // 找到最新的对手动作
            const opponentActions = actions.filter(action =>
                action.playerId !== this.currentUser.id
            );

            if (opponentActions.length > 0) {
                const latestAction = opponentActions[opponentActions.length - 1];
                console.log('📨 最新的对手动作:', latestAction);

                // 检查是否是新动作（避免重复处理）
                if (!this.lastProcessedActionId || this.lastProcessedActionId !== latestAction.timestamp) {
                    this.lastProcessedActionId = latestAction.timestamp;
                    this.triggerEvent('gameAction', latestAction);
                }
            }
        }
    }

    /**
     * 发送游戏动作
     */
    async sendGameAction(action, data) {
        if (!this.roomRef) return;

        try {
            const actionData = {
                playerId: this.currentUser.id,
                action: action,
                data: data,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            // 添加到游戏动作列表
            await this.roomRef.child('gameActions').push(actionData);

        } catch (error) {
            console.error('发送游戏动作失败:', error);
        }
    }

    /**
     * 停止匹配
     */
    stopMatching() {
        if (!this.isMatching) return;

        this.isMatching = false;

        // 清除超时
        if (this.matchingTimeout) {
            clearTimeout(this.matchingTimeout);
            this.matchingTimeout = null;
        }

        // 移除匹配池监听
        if (this.matchingRef) {
            this.matchingRef.off('child_added', this.onMatchingPoolChange);
            this.matchingRef.off('child_changed', this.onMatchingPoolChange);
            this.matchingRef = null;
        }

        // 从匹配池中移除自己
        if (this.currentUser) {
            const userRef = this.database.ref(`matching/${this.currentUser.grade}/${this.currentUser.id}`);
            userRef.remove().catch(error => {
                console.error('移除匹配池记录失败:', error);
            });
        }

        console.log('🛑 已停止匹配');
    }

    /**
     * 离开房间
     */
    leaveRoom() {
        if (this.roomRef) {
            this.roomRef.off('value', this.onRoomUpdate);
            this.roomRef = null;
        }
        this.currentRoom = null;
        console.log('🚪 已离开房间');
    }

    /**
     * 提供AI对手
     */
    provideAIOpponent() {
        this.stopMatching();

        const aiOpponent = {
            nickname: 'AI助手',
            avatar: '🤖',
            grade: this.currentUser?.grade || 'g3'
        };

        const roomId = 'ai_room_' + Date.now();

        console.log('🤖 提供AI对手:', aiOpponent);

        this.triggerEvent('matchFound', {
            opponent: aiOpponent,
            roomId: roomId
        });
    }

    /**
     * 取消匹配
     */
    cancelMatching() {
        this.stopMatching();
        this.leaveRoom();
    }

    /**
     * 添加事件监听器
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * 移除事件监听器
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 触发事件
     */
    triggerEvent(event, data) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('事件监听器执行错误:', error);
                }
            });
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        this.cancelMatching();
        this.eventListeners.clear();
    }
}

// 创建全局Firebase对战管理器实例
window.firebaseBattle = new FirebaseBattleManager();

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (window.firebaseBattle) {
        window.firebaseBattle.cleanup();
    }
});

console.log('🔥 Firebase对战系统已加载');
