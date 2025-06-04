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
        this.gameStarted = false;

        // 事件监听器
        this.eventListeners = new Map();

        // 绑定方法
        this.init = this.init.bind(this);
        this.startMatching = this.startMatching.bind(this);
        this.onMatchingPoolChange = this.onMatchingPoolChange.bind(this);
        this.onRoomUpdate = this.onRoomUpdate.bind(this);

        // 自动初始化Firebase
        this.initFirebase();
    }

    /**
     * 初始化Firebase连接
     */
    async initFirebase() {
        try {
            // 等待Firebase管理器初始化
            if (window.firebaseManager) {
                const success = await window.firebaseManager.init();
                if (success) {
                    this.database = window.firebaseManager.getDatabase();
                    console.log('✅ Firebase对战系统初始化成功');
                } else {
                    console.log('⚠️ Firebase不可用，使用本地模式');
                }
            } else {
                // 如果Firebase管理器还没有加载，等待一下
                setTimeout(() => {
                    this.initFirebase();
                }, 1000);
            }
        } catch (error) {
            console.error('❌ Firebase初始化失败:', error);
        }
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

        // 重置游戏状态，确保新匹配时状态正确
        this.gameStarted = false;
        console.log('🔄 重置游戏状态: gameStarted = false');

        try {
            // 检查Firebase连接状态
            if (!this.database) {
                console.log('❌ Firebase数据库未初始化，使用本地匹配模式');
                this.provideAIOpponent();
                return;
            }

            // 测试Firebase连接
            console.log('🔍 测试Firebase连接...');
            try {
                const testRef = this.database.ref('.info/connected');
                const snapshot = await testRef.once('value');
                const connected = snapshot.val();
                
                if (!connected) {
                    console.log('❌ Firebase连接断开，使用本地匹配模式');
                    this.provideAIOpponent();
                    return;
                }
                console.log('✅ Firebase连接正常');
            } catch (error) {
                console.error('❌ Firebase连接测试失败:', error);
                console.log('🔄 回退到本地匹配模式');
                this.provideAIOpponent();
                return;
            }

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
            console.log('📍 匹配池路径:', `matching/${this.currentUser.grade}`);

            // 检查匹配池是否存在其他玩家
            const matchingPoolRef = this.database.ref(`matching/${this.currentUser.grade}`);
            const existingPlayersSnapshot = await matchingPoolRef.once('value');
            const existingPlayers = existingPlayersSnapshot.val();
            
            console.log('👥 当前匹配池状态:', existingPlayers);
            
            if (existingPlayers) {
                const waitingPlayers = Object.entries(existingPlayers)
                    .filter(([id, player]) => player.status === 'waiting')
                    .map(([id, player]) => ({ id, ...player }));
                
                console.log('⏳ 等待中的玩家:', waitingPlayers);
                
                if (waitingPlayers.length > 0) {
                    console.log('🎯 发现等待中的玩家，尝试直接匹配');
                }
            }

            // 添加到匹配池
            const userRef = matchingPoolRef.child(this.currentUser.id);

            // 设置用户数据
            try {
                await userRef.set(this.currentUser);
                console.log('✅ 成功加入匹配池');
            } catch (error) {
                console.error('❌ 加入匹配池失败:', error);
                if (error.code === 'PERMISSION_DENIED') {
                    console.log('🚫 Firebase权限被拒绝，请检查数据库安全规则');
                    console.log('建议的安全规则: { "rules": { ".read": true, ".write": true } }');
                }
                this.provideAIOpponent();
                return;
            }

            // 设置断线时自动移除
            userRef.onDisconnect().remove();

            this.isMatching = true;
            this.matchingRef = matchingPoolRef;

            // 监听匹配池变化
            this.matchingRef.on('child_added', this.onMatchingPoolChange);
            this.matchingRef.on('child_changed', this.onMatchingPoolChange);
            
            console.log('👂 开始监听匹配池变化');

            // 设置匹配超时（15秒后提供AI对手，缩短等待时间）
            this.matchingTimeout = setTimeout(() => {
                if (this.isMatching) {
                    console.log('⏰ 匹配超时，提供AI对手');
                    this.provideAIOpponent();
                }
            }, 15000);

            console.log('⏳ 正在匹配中，15秒后将提供AI对手...');

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
        if (userId === this.currentUser.id) {
            // 检查自己是否已被匹配
            if (userData && userData.status === 'matched' && userData.roomId) {
                console.log('🎯 我已被其他玩家匹配，加入房间:', userData.roomId);

                // 获取房间信息
                const roomRef = this.database.ref(`rooms/${userData.roomId}`);
                const roomSnapshot = await roomRef.once('value');
                const roomData = roomSnapshot.val();

                if (roomData && roomData.players) {
                    // 找到对手
                    const opponentId = Object.keys(roomData.players).find(id => id !== this.currentUser.id);
                    const opponent = roomData.players[opponentId];

                    if (opponent) {
                        // 加入房间
                        this.joinRoom(userData.roomId, opponent, userData.role);
                    }
                }
            }
            return;
        }

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

                // 确定性角色分配（基于用户ID排序）
                const sortedIds = [this.currentUser.id, userId].sort();
                const player1 = sortedIds[0];
                const player2 = sortedIds[1];

                // 第一个玩家是警察，第二个玩家是小偷
                const roles = {
                    [player1]: 'cop',
                    [player2]: 'thief'
                };

                // 更新双方状态为已匹配，并包含角色信息
                const updates = {};
                updates[`matching/${this.currentUser.grade}/${this.currentUser.id}/status`] = 'matched';
                updates[`matching/${this.currentUser.grade}/${this.currentUser.id}/roomId`] = roomId;
                updates[`matching/${this.currentUser.grade}/${this.currentUser.id}/role`] = roles[this.currentUser.id];
                updates[`matching/${this.currentUser.grade}/${userId}/status`] = 'matched';
                updates[`matching/${this.currentUser.grade}/${userId}/roomId`] = roomId;
                updates[`matching/${this.currentUser.grade}/${userId}/role`] = roles[userId];

                await this.database.ref().update(updates);

                // 在房间中设置角色信息
                await roomRef.child('roles').set(roles);

                // 初始化玩家准备状态为false
                await roomRef.child('playerReady').set({
                    [this.currentUser.id]: false,
                    [userId]: false
                });

                console.log('📝 初始化房间准备状态:', {
                    [this.currentUser.id]: false,
                    [userId]: false
                });

                // 加入房间
                this.joinRoom(roomId, userData, roles[this.currentUser.id]);
            }

        } catch (error) {
            console.error('创建房间失败:', error);
        }
    }

    /**
     * 加入房间
     */
    async joinRoom(roomId, opponent, myRole) {
        try {
            this.currentRoom = roomId;
            this.roomRef = this.database.ref(`rooms/${roomId}`);
            this.myRole = myRole; // 保存我的角色
            this.gameStarted = false; // 重置游戏状态

            // 停止匹配
            this.stopMatching();

            // 监听房间状态
            this.roomRef.on('value', this.onRoomUpdate.bind(this));

            console.log('🎯 匹配成功！对手:', opponent, '我的角色:', myRole);
            console.log('🔍 房间加入完成，开始监听状态变化');

            // 等待房间监听完全建立后再触发事件
            setTimeout(() => {
                console.log('🏠 房间监听已建立，触发roomReady事件');
                this.triggerEvent('roomReady', {
                    roomId: roomId,
                    myRole: myRole
                });
            }, 500);

            // 通知匹配成功，包含角色信息
            this.triggerEvent('matchFound', {
                opponent: {
                    nickname: opponent.nickname,
                    avatar: opponent.avatar,
                    grade: opponent.grade,
                    id: opponent.id
                },
                roomId: roomId,
                myRole: myRole
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

        // 检查当前用户是否存在
        if (!this.currentUser) {
            console.error('⚠️ 当前用户信息不存在');
            return;
        }

        // 检查对手是否离线
        const players = Object.values(roomData.players || {});
        const opponent = players.find(p => p.id !== this.currentUser.id);

        if (opponent && opponent.status === 'disconnected') {
            console.log('对手已断开连接');
            this.triggerEvent('opponentDisconnected');
        }

        // 处理玩家准备状态
        const totalPlayers = Object.keys(roomData.players || {}).length;
        console.log('👥 房间中总玩家数:', totalPlayers);
        
        if (roomData.playerReady && totalPlayers >= 2) {
            const readyStates = roomData.playerReady;
            const playerIds = Object.keys(roomData.players || {});
            
            console.log('🔍 详细调试 - 准备状态检查开始:');
            console.log('  - 房间玩家ID列表:', playerIds);
            console.log('  - 准备状态对象完整结构:', JSON.stringify(readyStates, null, 2));
            console.log('  - 准备状态对象类型:', typeof readyStates);
            console.log('  - 准备状态对象键:', Object.keys(readyStates));
<<<<<<< HEAD
=======
            console.log('  - 当前用户ID:', this.currentUser?.id);
            console.log('  - 游戏已开始状态:', this.gameStarted);
>>>>>>> c924c5048b9cadc3928134863dea528f630c0bab
            
            // 逐个检查每个玩家的准备状态
            console.log('🔍 逐个检查玩家准备状态:');
            playerIds.forEach(playerId => {
                const readyValue = readyStates[playerId];
<<<<<<< HEAD
                console.log(`  - 玩家 ${playerId}: ${readyValue} (类型: ${typeof readyValue})`);
            });
            
            // 检查每个玩家是否都已准备
            const allReady = playerIds.every(playerId => {
                const isReady = readyStates[playerId] === true;
                console.log(`  - 玩家 ${playerId} 准备检查: ${readyStates[playerId]} === true -> ${isReady}`);
                return isReady;
            });
            
            const readyCount = playerIds.filter(playerId => readyStates[playerId] === true).length;
=======
                const playerInfo = roomData.players[playerId];
                console.log(`  - 玩家 ${playerId}: 准备状态=${readyValue} (类型: ${typeof readyValue}), 玩家信息:`, playerInfo);
            });
            
            // 检查每个玩家是否都已准备 - 使用更严格的检查
            const readyPlayerIds = [];
            const notReadyPlayerIds = [];
            
            playerIds.forEach(playerId => {
                const isReady = readyStates[playerId] === true;
                if (isReady) {
                    readyPlayerIds.push(playerId);
                } else {
                    notReadyPlayerIds.push(playerId);
                }
                console.log(`  - 玩家 ${playerId} 准备检查: ${readyStates[playerId]} === true -> ${isReady}`);
            });
            
            const allReady = readyPlayerIds.length === totalPlayers && notReadyPlayerIds.length === 0;
            const readyCount = readyPlayerIds.length;
>>>>>>> c924c5048b9cadc3928134863dea528f630c0bab

            console.log('📝 玩家准备状态详情:');
            console.log('  - 房间玩家ID列表:', playerIds);
            console.log('  - 准备状态对象:', readyStates);
<<<<<<< HEAD
=======
            console.log('  - 已准备玩家ID:', readyPlayerIds);
            console.log('  - 未准备玩家ID:', notReadyPlayerIds);
>>>>>>> c924c5048b9cadc3928134863dea528f630c0bab
            console.log('  - 已准备玩家数:', readyCount);
            console.log('  - 总玩家数:', totalPlayers);
            console.log('  - 全部准备:', allReady);
            console.log('  - 游戏已开始:', this.gameStarted);
            
            // 额外的安全检查
            const readyStateKeys = Object.keys(readyStates);
            const allPlayersHaveReadyState = playerIds.every(playerId => readyStateKeys.includes(playerId));
            console.log('🔍 额外检查:');
            console.log('  - 所有玩家都有准备状态记录:', allPlayersHaveReadyState);
            console.log('  - 准备状态记录的玩家:', readyStateKeys);
<<<<<<< HEAD

            if (allReady && !this.gameStarted) {
=======
            console.log('  - 准备状态键数量:', readyStateKeys.length);
            console.log('  - 玩家ID数量:', playerIds.length);
            
            // 检查是否存在数据不一致
            if (!allPlayersHaveReadyState) {
                console.warn('⚠️ 警告: 存在玩家没有准备状态记录!');
                console.warn('  - 缺少准备状态的玩家:', playerIds.filter(id => !readyStateKeys.includes(id)));
            }
            
            // 强制检查 - 确保所有条件都满足
            const canStartGame = allReady && 
                                !this.gameStarted && 
                                totalPlayers >= 2 && 
                                readyCount === totalPlayers &&
                                allPlayersHaveReadyState;
            
            console.log('🎯 游戏开始条件检查:');
            console.log('  - 全部准备:', allReady);
            console.log('  - 游戏未开始:', !this.gameStarted);
            console.log('  - 玩家数量足够:', totalPlayers >= 2);
            console.log('  - 准备数量匹配:', readyCount === totalPlayers);
            console.log('  - 所有玩家有状态记录:', allPlayersHaveReadyState);
            console.log('  - 可以开始游戏:', canStartGame);

            if (canStartGame) {
>>>>>>> c924c5048b9cadc3928134863dea528f630c0bab
                this.gameStarted = true;
                console.log('🎮 所有玩家已准备，开始游戏！');
                this.triggerEvent('allPlayersReady');
            } else {
                console.log('⏳ 等待条件满足，游戏暂未开始');
                if (allReady && this.gameStarted) {
                    console.log('  - 原因: 游戏已经开始');
                } else if (!allReady) {
                    console.log('  - 原因: 不是所有玩家都准备好');
                } else if (totalPlayers < 2) {
                    console.log('  - 原因: 玩家数量不足');
                } else if (!allPlayersHaveReadyState) {
                    console.log('  - 原因: 存在玩家没有准备状态记录');
                }
            } else if (!allReady) {
                console.log('⏳ 等待更多玩家准备...');
                console.log('  - 未准备的玩家:', playerIds.filter(playerId => !readyStates[playerId]));
            }
        } else if (totalPlayers < 2) {
            console.log('⏳ 等待更多玩家加入房间...');
        } else {
            console.log('📝 房间中没有准备状态数据');
        }

        // 处理游戏动作
        if (roomData.gameActions) {
            const actions = Object.values(roomData.gameActions);
            console.log('🎮 房间中的所有游戏动作:', actions);

            // 找到最新的对手动作
            const opponentActions = actions.filter(action =>
                action.playerId !== this.currentUser.id
            );

            console.log('👥 对手动作数量:', opponentActions.length);

            if (opponentActions.length > 0) {
                // 按时间排序，获取最新动作
                const sortedActions = opponentActions.sort((a, b) => {
                    const timeA = a.timestamp || 0;
                    const timeB = b.timestamp || 0;
                    return timeA - timeB;
                });

                const latestAction = sortedActions[sortedActions.length - 1];
                console.log('📨 最新的对手动作:', latestAction);

                // 使用动作的唯一标识符来避免重复处理
                const actionKey = `${latestAction.playerId}_${latestAction.timestamp}_${latestAction.action}`;

                if (!this.lastProcessedActionId || this.lastProcessedActionId !== actionKey) {
                    console.log('🆕 处理新动作:', actionKey);
                    console.log('📊 动作详情:', latestAction);
                    this.lastProcessedActionId = actionKey;

                    // 确保动作数据格式正确
                    const processedAction = {
                        action: latestAction.action,
                        data: latestAction.data || latestAction,
                        playerId: latestAction.playerId,
                        timestamp: latestAction.timestamp
                    };

                    console.log('🚀 触发事件:', processedAction);
                    this.triggerEvent('gameAction', processedAction);
                } else {
                    console.log('🔄 跳过重复动作:', actionKey);
                }
            } else {
                console.log('🚫 没有找到对手动作');
            }
        } else {
            console.log('💭 房间中没有游戏动作');
        }
    }

    /**
     * 发送游戏动作
     */
    async sendGameAction(action, data) {
        if (!this.roomRef) {
            console.error('⚠️ 无法发送游戏动作：房间引用不存在');
            return;
        }

        if (!this.currentUser) {
            console.error('⚠️ 无法发送游戏动作：用户信息不存在');
            return;
        }

        try {
            // 使用客户端时间戳以确保唯一性
            const clientTimestamp = Date.now();
            const actionData = {
                playerId: this.currentUser.id,
                action: action,
                data: data,
                timestamp: clientTimestamp,
                serverTimestamp: firebase.database.ServerValue.TIMESTAMP
            };

            console.log('📤 发送Firebase游戏动作:', actionData);

            // 添加到游戏动作列表
            const result = await this.roomRef.child('gameActions').push(actionData);

            console.log('✅ Firebase游戏动作发送成功:', result.key, '时间戳:', clientTimestamp);

        } catch (error) {
            console.error('❌ 发送游戏动作失败:', error);

            // 检查Firebase连接状态
            if (this.database) {
                console.log('🔍 Firebase数据库状态:', this.database.app.options);
            }
        }
    }

    /**
     * 停止匹配
     */
    stopMatching() {
        if (!this.isMatching) return;

        this.isMatching = false;
        // 重置游戏状态
        this.gameStarted = false;
        console.log('🔄 停止匹配时重置游戏状态: gameStarted = false');

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
            this.roomRef.off('value');
            this.roomRef = null;
        }
        this.currentRoom = null;
        this.gameStarted = false;
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
     * 设置玩家准备状态
     */
    async setPlayerReady(ready = true, retryCount = 0) {
        const maxRetries = 3;
        
        console.log(`🎯 设置准备状态开始 (第${retryCount + 1}次尝试)`);
        console.log('📊 当前状态检查:');
        console.log('  - roomRef存在:', !!this.roomRef);
        console.log('  - currentUser存在:', !!this.currentUser);
        console.log('  - currentRoom:', this.currentRoom);
        
        if (this.currentUser) {
            console.log('👤 用户详细信息:');
            console.log('  - ID:', this.currentUser.id);
            console.log('  - 昵称:', this.currentUser.nickname);
            console.log('  - 完整对象:', this.currentUser);
        }
        
        // 检查Firebase连接状态
        if (this.database) {
            try {
                const connectedRef = this.database.ref('.info/connected');
                const snapshot = await connectedRef.once('value');
                const connected = snapshot.val();
                console.log('🔗 Firebase连接状态:', connected);
                
                if (!connected) {
                    console.error('❌ Firebase未连接');
                    if (retryCount < maxRetries) {
                        console.log(`⏳ 等待2秒后重试...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        return this.setPlayerReady(ready, retryCount + 1);
                    }
                    return false;
                }
            } catch (error) {
                console.error('❌ 检查Firebase连接状态失败:', error);
            }
        }
        
        if (!this.roomRef || !this.currentUser || !this.currentRoom) {
            console.error('❌ 必要条件不满足:');
            console.log('  - roomRef:', !!this.roomRef);
            console.log('  - currentUser:', !!this.currentUser);
            console.log('  - currentRoom:', this.currentRoom);
            
            if (retryCount < maxRetries) {
                console.log(`⏳ 等待2秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.setPlayerReady(ready, retryCount + 1);
            }
            return false;
        }
        
        if (!this.currentUser.id) {
            console.error('❌ 用户ID不存在:', this.currentUser);
            if (retryCount < maxRetries) {
                console.log(`⏳ 等待2秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.setPlayerReady(ready, retryCount + 1);
            }
            return false;
        }

        try {
            const path = `rooms/${this.currentRoom}/playerReady/${this.currentUser.id}`;
            console.log('📝 准备写入数据:');
            console.log('  - 路径:', path);
            console.log('  - 值:', ready);
            console.log('  - 用户ID:', this.currentUser.id);
            
            // 写入数据
            await this.roomRef.child(`playerReady/${this.currentUser.id}`).set(ready);
            console.log('✅ 数据写入完成，等待1.5秒后验证...');
            
            // 等待更长时间确保数据同步
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // 验证设置是否成功
            console.log('🔍 开始验证写入结果...');
            const snapshot = await this.roomRef.child(`playerReady/${this.currentUser.id}`).once('value');
            const actualValue = snapshot.val();
            
            console.log('📊 验证结果:');
            console.log('  - 期望值:', ready);
            console.log('  - 实际值:', actualValue);
            console.log('  - 类型匹配:', typeof actualValue, '===', typeof ready);
            
            if (actualValue === ready) {
                console.log('✅ 准备状态设置成功并验证通过!');
                return true;
            } else {
                console.error('❌ 准备状态验证失败');
                if (retryCount < maxRetries) {
                    console.log(`⏳ 等待2秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return this.setPlayerReady(ready, retryCount + 1);
                }
                return false;
            }
        } catch (error) {
            console.error('❌ 设置准备状态异常:', error);
            console.error('❌ 错误详情:', {
                name: error.name,
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            
            if (retryCount < maxRetries) {
                console.log(`⏳ 发生异常，等待2秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.setPlayerReady(ready, retryCount + 1);
            }
            return false;
        }
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
