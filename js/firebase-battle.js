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
            console.log('⚠️ 已在匹配中，忽略重复请求');
            return;
        }

        // 重置游戏状态，确保新匹配时状态正确
        this.gameStarted = false;
        this.lastProcessedActionId = null;
        console.log('🔄 重置游戏状态: gameStarted = false');

        // 验证用户信息
        if (!userInfo || !userInfo.grade) {
            console.error('❌ 用户信息无效:', userInfo);
            this.provideAIOpponent();
            return;
        }

        try {
            // 检查Firebase连接状态
            if (!this.database) {
                console.log('❌ Firebase数据库未初始化，等待初始化...');
                
                // 等待Firebase初始化
                let retryCount = 0;
                const maxRetries = 3;
                
                while (!this.database && retryCount < maxRetries) {
                    console.log(`⏳ 等待Firebase初始化... (${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    retryCount++;
                }
                
                if (!this.database) {
                    console.log('❌ Firebase初始化超时，使用本地匹配模式');
                    this.provideAIOpponent();
                    return;
                }
            }

            // 测试Firebase连接
            console.log('🔍 测试Firebase连接...');
            try {
                const testRef = this.database.ref('.info/connected');
                const snapshot = await Promise.race([
                    testRef.once('value'),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('连接测试超时')), 5000))
                ]);
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
                status: 'waiting',
                joinTime: Date.now()
            };

            // 将用户ID存储到全局变量，供角色分配使用
            if (window.battleUserInfo) {
                window.battleUserInfo.id = userId;
            }

            console.log('🔍 开始匹配，用户信息:', this.currentUser);
            console.log('📍 匹配池路径:', `matching/${this.currentUser.grade}`);

            // 检查匹配池是否存在其他玩家
            const matchingPoolRef = this.database.ref(`matching/${this.currentUser.grade}`);
            
            try {
                const existingPlayersSnapshot = await matchingPoolRef.once('value');
                const existingPlayers = existingPlayersSnapshot.val();
                
                console.log('👥 当前匹配池状态:', existingPlayers);
                
                if (existingPlayers) {
                    const waitingPlayers = Object.entries(existingPlayers)
                        .filter(([id, player]) => {
                            // 检查玩家状态和时间戳，过滤掉过期的玩家
                            const isWaiting = player.status === 'waiting';
                            const isRecent = !player.joinTime || (Date.now() - player.joinTime < 60000); // 1分钟内
                            return isWaiting && isRecent;
                        })
                        .map(([id, player]) => ({ id, ...player }));
                    
                    console.log('⏳ 等待中的有效玩家:', waitingPlayers);
                    
                    if (waitingPlayers.length > 0) {
                        console.log('🎯 发现等待中的玩家，尝试直接匹配');
                    }
                }
            } catch (error) {
                console.error('❌ 检查匹配池失败:', error);
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
                    console.error('🚫 Firebase权限被拒绝，请检查数据库安全规则');
                    console.log('💡 建议的安全规则配置:');
                    console.log(`{
  "rules": {
    ".read": true,
    ".write": true
  }
}`);
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

            // 设置匹配超时（12秒后提供AI对手，缩短等待时间）
            this.matchingTimeout = setTimeout(() => {
                if (this.isMatching) {
                    console.log('⏰ 匹配超时，提供AI对手');
                    this.provideAIOpponent();
                }
            }, 12000);

            console.log('⏳ 正在匹配中，12秒后将提供AI对手...');

        } catch (error) {
            console.error('❌ 开始匹配失败:', error);
            console.error('❌ 错误详情:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
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

        const matchingPool = snapshot.val();
        console.log('🔄 匹配池更新:', matchingPool);

        if (!matchingPool) {
            console.log('🤷 匹配池为空或不存在');
            return;
        }

        const currentUserGrade = this.currentUser.grade;
        const currentUserId = this.currentUser.id;

        // 过滤出同一年级且不是当前用户的其他玩家
        const otherPlayers = Object.entries(matchingPool)
            .map(([uid, playerData]) => ({ uid, ...playerData }))
            .filter(player => player.grade === currentUserGrade && player.uid !== currentUserId && player.status === 'waiting');

        console.log(`🔍 找到 ${otherPlayers.length} 个同级 (${currentUserGrade}) 且等待中的其他玩家:`, otherPlayers.map(p => p.uid));

        if (otherPlayers.length > 0) {
            // 停止匹配轮询和AI对手的超时
            if (this.matchingTimeout) {
                clearTimeout(this.matchingTimeout);
                this.matchingTimeout = null;
                console.log('🛑 找到对手，停止AI匹配超时');
            }

            // 尝试与找到的玩家逐个创建房间
            let roomCreated = false;
            for (const opponent of otherPlayers) {
                if (roomCreated) break; // 如果已经成功创建房间，则停止尝试

                const opponentId = opponent.uid;
                console.log(`🤝 尝试与玩家 ${opponentId} 创建房间...`);

                // 检查对手是否仍然在匹配池中 (可能在迭代过程中被其他人匹配了)
                const currentOpponentInPool = matchingPool[opponentId];
                if (!currentOpponentInPool || currentOpponentInPool.status !== 'waiting') {
                    console.log(`💨 玩家 ${opponentId} 已不再等待或已离开匹配池，跳过。`);
                    continue;
                }

                // 确保不会自己匹配自己 (双重检查)
                if (opponentId === currentUserId) {
                    console.warn('⚠️ 尝试与自己匹配，跳过。');
                    continue;
                }

                // 创建房间ID (可以基于两个用户的ID排序后组合，确保唯一性)
                const ids = [currentUserId, opponentId].sort();
                const roomId = `room_${ids[0]}_${ids[1]}`;
                console.log(`🔑 生成房间ID: ${roomId}`);

                const roomRef = this.database.ref(`rooms/${roomId}`);

                // 使用事务来原子性地创建房间并更新玩家状态
                roomRef.transaction(currentRoomData => {
                    if (currentRoomData === null) {
                        // 房间不存在，创建新房间
                        console.log(`🚪 房间 ${roomId} 不存在，尝试创建...`);
                        const newRoomData = {
                            id: roomId,
                            players: {
                                [currentUserId]: { ...this.currentUser, status: 'joined', ready: false },
                                [opponentId]: { ...opponent, status: 'joined', ready: false }
                            },
                            status: 'waiting', // 房间状态，等待玩家准备
                            createdAt: firebase.database.ServerValue.TIMESTAMP,
                            grade: currentUserGrade // 记录房间的年级
                        };
                        console.log('➕ 新房间数据:', newRoomData);
                        return newRoomData;
                    } else {
                        // 房间已存在，可能是并发创建或者之前遗留的，理论上不应该进入这里，因为我们是主动方
                        console.warn(`⚠️ 房间 ${roomId} 已存在，但我们是主动方。当前房间数据:`, currentRoomData);
                        // 如果房间已存在并且包含当前用户，则认为匹配成功
                        if (currentRoomData.players && currentRoomData.players[currentUserId]) {
                            console.log(`🔗 已在房间 ${roomId} 中，视为匹配成功。`);
                            return currentRoomData; // 返回现有数据，不修改
                        }
                        // 如果房间存在但不包含当前用户，则可能是冲突，返回undefined以取消事务
                        console.error(`💥 房间 ${roomId} 已存在但不由当前用户创建或加入，匹配冲突！`);
                        return undefined; 
                    }
                }, (error, committed, snapshot) => {
                    if (error) {
                        console.error(`❌ 创建房间 ${roomId} 事务失败:`, error);
                    } else if (!committed) {
                        console.warn(`🙅 创建房间 ${roomId} 事务未提交 (可能因为房间已存在且不符合创建条件)`);
                    } else {
                        console.log(`✅ 成功创建/加入房间 ${roomId} 并更新匹配池!`);
                        this.isMatching = false; // 停止本地匹配状态
                        roomCreated = true; //标记房间已创建

                        // 更新双方在匹配池中的状态为 'matched'
                        const updates = {};
updates[`matching/${currentUserGrade}/${currentUserId}/status`] = 'matched';
updates[`matching/${currentUserGrade}/${opponentId}/status`] = 'matched';
                        this.database.ref().update(updates)
                            .then(() => console.log(`🎉 成功更新匹配池中 ${currentUserId} 和 ${opponentId} 的状态为 'matched'`))
                            .catch(err => console.error('🔥 更新匹配池状态失败:', err));
                        
                        this.currentRoomId = roomId;
                        this.roomRef = roomRef;
                        this.listenToRoomUpdates(); // 开始监听房间状态
                        this.triggerEvent('matchSuccess', { roomId, opponentId, roomData: snapshot.val() });
                    }
                }).catch(transactionError => {
                    // 捕获事务本身的Promise拒绝错误 (例如网络问题)
                    console.error(`💥 事务Promise执行出错 (房间 ${roomId}):`, transactionError);
                });
                
                // 如果已经成功创建房间，则跳出循环
                if (roomCreated) {
                    console.log(`🚪 已为玩家 ${currentUserId} 和 ${opponentId} 创建房间 ${roomId}，停止尝试其他对手。`);
                    break;
                }
            } // 结束 for (const opponent of otherPlayers)

            if (!roomCreated) {
                console.log('🤔 未能与任何找到的对手成功创建房间。可能他们已被匹配或离开。将继续等待或超时。');
                // 如果没有成功创建房间，并且匹配超时计时器已停止，需要重新启动它或依赖下一次匹配池更新
                if (!this.matchingTimeout && this.isMatching) {
                    console.log('重新启动匹配超时检测 (如果仍在匹配状态)');
                    // this.startMatchingTimeout(); // 考虑是否需要立即重启，或等待下一次onMatchingPoolChange
                }
            }

        } else {
            console.log('⏳ 匹配池中没有其他等待的同级玩家，继续等待...');
            // 确保如果之前停止了超时，现在重新开始
            if (!this.matchingTimeout && this.isMatching) {
                console.log('重新启动匹配超时检测 (如果仍在匹配状态)');
                this.startMatchingTimeout(); 
            }
        }
    }

    /**
     * 加入房间
     */
    async joinRoom(roomId, opponent, myRole) {
        try {
            console.log('🚪 尝试加入房间:', roomId);
            console.log('👤 对手信息:', opponent);
            console.log('🎭 我的角色:', myRole);

            if (!roomId || !this.database) {
                console.error('❌ 房间ID或数据库连接无效');
                return false;
            }

            this.currentRoom = roomId;
            this.roomRef = this.database.ref(`rooms/${roomId}`);
            this.myRole = myRole; // 保存我的角色
            this.gameStarted = false; // 重置游戏状态

            // 设置断线时自动离开房间
            if (this.currentUser && this.currentUser.id) {
                this.roomRef.child(`players/${this.currentUser.id}`).onDisconnect().remove();
            }

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

            return true;

        } catch (error) {
            console.error('❌ 加入房间失败:', error);
            console.error('❌ 错误详情:', {
                name: error.name,
                message: error.message,
                code: error.code
            });
            return false;
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
            console.log('  - 当前用户ID:', this.currentUser?.id);
            console.log('  - 游戏已开始状态:', this.gameStarted);
            
            // 逐个检查每个玩家的准备状态
            console.log('🔍 逐个检查玩家准备状态:');
            playerIds.forEach(playerId => {
                const readyValue = readyStates[playerId];
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

            console.log('📝 玩家准备状态详情:');
            console.log('  - 房间玩家ID列表:', playerIds);
            console.log('  - 准备状态对象:', readyStates);
            console.log('  - 已准备玩家ID:', readyPlayerIds);
            console.log('  - 未准备玩家ID:', notReadyPlayerIds);
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

        if (!this.currentUser) {
            console.error('❌ 无法提供AI对手：当前用户信息不存在');
            return;
        }

        const aiOpponent = {
            id: 'ai_' + Date.now(),
            nickname: 'AI助手',
            avatar: '🤖',
            grade: this.currentUser.grade,
            status: 'joined'
        };

        const roomId = 'ai_room_' + Date.now();

        // 将 FirebaseBattleManager 类暴露给全局 window 对象
        window.FirebaseBattleManager = FirebaseBattleManager;
        
        // 为AI对战分配角色（玩家总是警察，AI是小偷）
        const roles = {
            [this.currentUser.id]: 'cop',
            [aiOpponent.id]: 'thief'
        };

        // 设置AI房间的基本信息
        this.currentRoom = roomId;
        this.myRole = roles[this.currentUser.id];
        this.gameStarted = false;

        console.log('🤖 提供AI对手:', aiOpponent);
        console.log('🎭 AI对战角色分配:', roles);
        console.log('🏠 AI房间ID:', roomId);

        // 模拟房间状态，用于本地AI对战
        const mockRoomData = {
            id: roomId,
            status: 'waiting_for_players',
            players: {
                [this.currentUser.id]: {
                    ...this.currentUser,
                    status: 'joined'
                },
                [aiOpponent.id]: aiOpponent
            },
            roles: roles,
            playerReady: {
                [this.currentUser.id]: false,
                [aiOpponent.id]: false
            },
            isAIRoom: true,
            createdAt: Date.now(),
            grade: this.currentUser.grade
        };

        // 存储AI房间数据到本地（用于调试和状态管理）
        if (typeof window !== 'undefined') {
            window.currentAIRoom = mockRoomData;
        }

        // 触发匹配成功事件
        this.triggerEvent('matchFound', {
            opponent: aiOpponent,
            roomId: roomId,
            myRole: this.myRole,
            isAIMatch: true
        });

        // 延迟触发房间准备事件，确保UI有时间响应
        setTimeout(() => {
            console.log('🏠 AI房间准备完成，触发roomReady事件');
            this.triggerEvent('roomReady', {
                roomId: roomId,
                myRole: this.myRole,
                isAIMatch: true
            });
        }, 500);
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
