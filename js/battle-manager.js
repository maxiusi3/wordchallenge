/**
 * 智能题库管理器
 * 实现动态题库管理、去重、智能补充等功能
 */
class BattleWordPool {
    constructor() {
        this.currentPool = [];        // 当前题库池
        this.usedQuestions = new Set(); // 已使用题目ID
        this.poolSize = 50;           // 题库池大小
        this.refillThreshold = 0.8;   // 80%时补充
        this.grade = null;            // 当前年级
        this.allQuestions = [];       // 全部题目
        this.isRefilling = false;     // 是否正在补充
    }

    /**
     * 初始化题库
     */
    async initialize(grade) {
        this.grade = grade;
        this.usedQuestions.clear();

        console.log(`初始化智能题库: ${grade}`);

        // 加载全部题目
        await this.loadAllQuestions(grade);

        // 初始化题库池
        this.refillPool();

        console.log(`题库初始化完成: 总题数 ${this.allQuestions.length}, 池大小 ${this.currentPool.length}`);
    }

    /**
     * 加载全部题目
     */
    async loadAllQuestions(grade) {
        try {
            // 标准化年级格式并映射到正确的文件路径
            let questionPath;

            switch (grade) {
                case 'g3':
                case 'grade3':
                    questionPath = 'data/renjiaoban/grade3.json';
                    break;
                case 'g4':
                case 'grade4':
                    questionPath = 'data/renjiaoban/grade4.json';
                    break;
                case 'g5':
                case 'grade5':
                    questionPath = 'data/renjiaoban/grade5.json';
                    break;
                case 'g6':
                case 'grade6':
                    questionPath = 'data/renjiaoban/grade6.json';
                    break;
                case 'g7':
                case 'grade7':
                    questionPath = 'data/renjiaoban/grade7.json';
                    break;
                case 'g8':
                case 'grade8':
                    questionPath = 'data/renjiaoban/grade8.json';
                    break;
                case 'g9':
                case 'grade9':
                    questionPath = 'data/renjiaoban/grade9.json';
                    break;
                case 'grade10':
                case 'hshf':
                    questionPath = 'data/renjiaoban/highschool_high_freq.json';
                    break;
                case 'grade11':
                case 'grade12':
                case 'hsa':
                    questionPath = 'data/renjiaoban/highschool_all.json';
                    break;
                default:
                    // 对于其他年级，尝试直接映射
                    if (grade && grade.startsWith('g') && /^g\d+$/.test(grade)) {
                        questionPath = `data/renjiaoban/grade${grade.substring(1)}.json`;
                    } else {
                        questionPath = `data/renjiaoban/${grade}.json`;
                    }
                    break;
            }

            console.log(`加载题库文件: ${questionPath}`);
            const response = await fetch(questionPath);

            if (!response.ok) {
                throw new Error(`无法加载题库文件: ${questionPath}`);
            }

            this.allQuestions = await response.json();

            // 为每个题目添加唯一ID
            this.allQuestions.forEach((question, index) => {
                if (!question.id) {
                    question.id = `${grade}_${index}`;
                }
            });

        } catch (error) {
            console.error('加载题库失败:', error);
            this.allQuestions = [];
            throw error;
        }
    }

    /**
     * 补充题库池
     */
    refillPool() {
        if (this.isRefilling) {
            console.log('题库正在补充中，跳过...');
            return;
        }

        this.isRefilling = true;

        try {
            // 获取未使用的题目
            const unusedQuestions = this.allQuestions.filter(q => !this.usedQuestions.has(q.id));

            if (unusedQuestions.length === 0) {
                console.warn('所有题目已用完，重置使用记录');
                this.usedQuestions.clear();
                this.refillPool();
                return;
            }

            // 随机打乱未使用的题目
            for (let i = unusedQuestions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [unusedQuestions[i], unusedQuestions[j]] = [unusedQuestions[j], unusedQuestions[i]];
            }

            // 补充到目标大小
            const needCount = this.poolSize - this.currentPool.length;
            const addCount = Math.min(needCount, unusedQuestions.length);

            for (let i = 0; i < addCount; i++) {
                this.currentPool.push(unusedQuestions[i]);
            }

            console.log(`题库补充完成: 添加 ${addCount} 道题，当前池大小 ${this.currentPool.length}`);

        } finally {
            this.isRefilling = false;
        }
    }

    /**
     * 获取下一个题目
     */
    getNextQuestion() {
        // 检查是否需要补充
        const usageRate = (this.poolSize - this.currentPool.length) / this.poolSize;
        if (usageRate >= this.refillThreshold) {
            console.log(`题库使用率达到 ${Math.round(usageRate * 100)}%，异步补充中...`);
            setTimeout(() => this.refillPool(), 0); // 异步补充
        }

        if (this.currentPool.length === 0) {
            console.error('题库池为空，立即补充');
            this.refillPool();

            if (this.currentPool.length === 0) {
                console.error('补充后仍无题目可用');
                return null;
            }
        }

        // 从池中取出一个题目
        const question = this.currentPool.shift();

        // 标记为已使用
        this.usedQuestions.add(question.id);

        console.log(`获取题目: ${question.word}, 剩余池大小: ${this.currentPool.length}`);

        return question;
    }

    /**
     * 获取使用统计
     */
    getUsageStats() {
        const totalQuestions = this.allQuestions.length;
        const usedCount = this.usedQuestions.size;
        const poolSize = this.currentPool.length;
        const usageRate = totalQuestions > 0 ? (usedCount / totalQuestions) : 0;

        return {
            totalQuestions,
            usedCount,
            poolSize,
            usageRate: Math.round(usageRate * 100),
            canContinue: poolSize > 0 || usedCount < totalQuestions
        };
    }
}

/**
 * 双人对战游戏管理器
 * 处理双人对战的游戏逻辑、状态管理和通信
 */
class BattleManager {
    constructor() {
        this.gameState = {
            isActive: false,
            currentLevel: 1,
            currentQuestion: null,
            myScore: 0,
            opponentScore: 0,
            levelWins: { my: 0, opponent: 0 },
            levelResults: [], // 记录每个关卡的具体胜负结果
            wrongAnswers: [],
            startTime: null,
            levelStartTime: null,
            gameTimeLimit: 15 * 60 * 1000, // 15分钟游戏时间限制
            gameTimer: null,
            levelEnding: false // 防止关卡结束重复触发
        };

        this.playerInfo = null;
        this.opponentInfo = null;
        this.wsClient = null;

        // 初始化智能题库管理器
        this.wordPool = new BattleWordPool();

        // 绑定方法
        this.initializeBattle = this.initializeBattle.bind(this);
        this.startLevel = this.startLevel.bind(this);
        this.handleAnswer = this.handleAnswer.bind(this);
        this.endLevel = this.endLevel.bind(this);
        this.endGame = this.endGame.bind(this);
    }

    /**
     * 初始化双人对战
     */
    async initializeBattle(playerInfo, opponentInfo) {
        // 完全重置游戏状态，避免上一局数据累积
        this.gameState = {
            isActive: true,
            currentLevel: 1,
            currentQuestion: null,
            myScore: 0,
            opponentScore: 0,
            levelWins: { my: 0, opponent: 0 },
            levelResults: [], // 记录每个关卡的具体胜负结果
            wrongAnswers: [],
            startTime: Date.now(),
            levelStartTime: null,
            gameTimeLimit: 15 * 60 * 1000, // 15分钟游戏时间限制
            gameTimer: null,
            levelEnding: false // 防止关卡结束重复触发
        };

        this.playerInfo = playerInfo;
        this.opponentInfo = opponentInfo;

        console.log('双人对战初始化 - 游戏状态已重置:', { playerInfo, opponentInfo });

        // 播放游戏开始音效
        this.playBattleSound('confirm');

        // 获取WebSocket客户端
        if (window.wsClient) {
            this.wsClient = window.wsClient;
        }

        // 初始化智能题库
        try {
            await this.wordPool.initialize(playerInfo.grade);
            console.log('智能题库初始化成功');
        } catch (error) {
            console.error('智能题库初始化失败:', error);
            // 如果智能题库初始化失败，使用传统方式
        }

        // 开始15分钟游戏计时器
        this.startGameTimer();

        // 设置全局游戏数据（确保关卡页面可以访问）
        this.setupGlobalGameData();

        // 开始第一关
        this.startLevel(1);
    }

    /**
     * 设置全局游戏数据（确保关卡页面可以访问）
     */
    setupGlobalGameData() {
        // 生成确定性的房间ID
        const playerId = this.playerInfo.id || this.playerInfo.nickname || 'player1';
        const opponentId = this.opponentInfo.id || this.opponentInfo.nickname || 'opponent1';
        const sortedIds = [playerId, opponentId].sort();
        const roomId = `room_${sortedIds[0]}_${sortedIds[1]}_${Date.now()}`;

        // 设置全局游戏数据
        window.battleGameData = {
            player: {
                ...this.playerInfo,
                id: playerId
            },
            opponent: {
                ...this.opponentInfo,
                id: opponentId
            },
            roomId: roomId,
            currentLevel: this.gameState.currentLevel,
            gameMode: 'battle'
        };

        console.log('🎮 设置全局游戏数据:', window.battleGameData);
    }

    /**
     * 开始15分钟游戏计时器
     */
    startGameTimer() {
        console.log('开始15分钟游戏计时器');

        this.gameState.gameTimer = setTimeout(() => {
            console.log('15分钟时间到，游戏结束');
            this.endGameByTimeout();
        }, this.gameState.gameTimeLimit);
    }

    /**
     * 清除游戏计时器
     */
    clearGameTimer() {
        if (this.gameState.gameTimer) {
            clearTimeout(this.gameState.gameTimer);
            this.gameState.gameTimer = null;
            console.log('游戏计时器已清除');
        }
    }

    /**
     * 因超时结束游戏
     */
    endGameByTimeout() {
        console.log('游戏因超时15分钟而结束');

        // 清除计时器
        this.clearGameTimer();

        // 根据当前分数决定胜负
        const myTotalScore = this.gameState.levelWins.my;
        const opponentTotalScore = this.gameState.levelWins.opponent;

        if (myTotalScore === opponentTotalScore) {
            // 平局时，根据当前关卡分数决定
            if (this.gameState.myScore > this.gameState.opponentScore) {
                this.gameState.levelWins.my++;
            } else if (this.gameState.opponentScore > this.gameState.myScore) {
                this.gameState.levelWins.opponent++;
            }
            // 如果当前关卡也平局，则随机决定胜负
            else {
                if (Math.random() < 0.5) {
                    this.gameState.levelWins.my++;
                } else {
                    this.gameState.levelWins.opponent++;
                }
            }
        }

        // 结束游戏
        this.endGame();
    }

    /**
     * 开始指定关卡
     */
    async startLevel(level) {
        this.gameState.currentLevel = level;
        this.gameState.levelStartTime = Date.now();
        this.gameState.levelEnding = false; // 重置关卡结束标志

        console.log(`开始关卡 ${level}`);

        // 播放关卡开始音效
        this.playBattleSound('select');

        // 导航到对应的关卡页面
        const levelScreen = `battle_level${level}`;
        if (window.navigateTo) {
            window.navigateTo(levelScreen);
        }

        // 等待页面加载后开始游戏逻辑
        setTimeout(() => {
            this.loadLevelData(level);
        }, 1000);
    }

    /**
     * 加载关卡数据
     */
    async loadLevelData(level) {
        try {
            // 获取题库数据
            const grade = this.playerInfo.grade;
            const questionData = await this.getRandomQuestion(grade, level);

            if (questionData) {
                this.gameState.currentQuestion = questionData;

                // 发送题目数据到关卡页面
                this.sendToCurrentLevel('showQuestion', questionData);

                // 更新显示信息
                this.updateLevelDisplay();

                // 开始计时器
                this.startTimer();
            } else {
                console.error('无法加载题目数据');
            }
        } catch (error) {
            console.error('加载关卡数据失败:', error);
        }
    }

    /**
     * 加载题库数据
     */
    async loadQuestionData(grade) {
        try {
            console.log('开始加载题库:', grade);

            // 使用与 loadAllQuestions 相同的映射逻辑
            let questionPath;

            switch (grade) {
                case 'g3':
                case 'grade3':
                    questionPath = 'data/renjiaoban/grade3.json';
                    break;
                case 'g4':
                case 'grade4':
                    questionPath = 'data/renjiaoban/grade4.json';
                    break;
                case 'g5':
                case 'grade5':
                    questionPath = 'data/renjiaoban/grade5.json';
                    break;
                case 'g6':
                case 'grade6':
                    questionPath = 'data/renjiaoban/grade6.json';
                    break;
                case 'g7':
                case 'grade7':
                    questionPath = 'data/renjiaoban/grade7.json';
                    break;
                case 'g8':
                case 'grade8':
                    questionPath = 'data/renjiaoban/grade8.json';
                    break;
                case 'g9':
                case 'grade9':
                    questionPath = 'data/renjiaoban/grade9.json';
                    break;
                case 'grade10':
                case 'hshf':
                    questionPath = 'data/renjiaoban/highschool_high_freq.json';
                    break;
                case 'grade11':
                case 'grade12':
                case 'hsa':
                    questionPath = 'data/renjiaoban/highschool_all.json';
                    break;
                default:
                    // 对于其他年级，尝试直接映射
                    if (grade && grade.startsWith('g') && /^g\d+$/.test(grade)) {
                        questionPath = `data/renjiaoban/grade${grade.substring(1)}.json`;
                    } else {
                        questionPath = `data/renjiaoban/${grade}.json`;
                    }
                    break;
            }

            console.log('题库文件路径:', questionPath);

            // 加载题库文件
            const response = await fetch(questionPath);
            if (!response.ok) {
                throw new Error(`无法加载题库文件: ${questionPath}`);
            }

            const questionData = await response.json();

            // 将题库数据存储到全局变量
            window.gradeQuestions = questionData;

            console.log(`题库加载成功: ${grade}，共 ${questionData.length} 道题`);

        } catch (error) {
            console.error('加载题库失败:', error);
            // 如果加载失败，使用空数组避免错误
            window.gradeQuestions = [];
            throw error;
        }
    }

    /**
     * 获取随机题目（使用智能题库管理器）
     */
    async getRandomQuestion(grade, level) {
        try {
            // 优先使用智能题库管理器
            let baseQuestion = this.wordPool.getNextQuestion();

            // 如果智能题库无法提供题目，使用传统方式
            if (!baseQuestion) {
                console.warn('智能题库无法提供题目，使用传统方式');
                baseQuestion = await this.getQuestionTraditionalWay(grade);
            }

            if (!baseQuestion) {
                throw new Error('无法获取题目数据');
            }

            // 根据关卡类型处理题目
            let questionData;

            if (level === 1) {
                // 第一关：中译英
                questionData = {
                    chinese: this.extractChineseMeaning(baseQuestion.meaning),
                    english: baseQuestion.word,
                    level: 1
                };
            } else if (level === 2) {
                // 第二关：英译中选择题
                const options = await this.generateOptionsForQuestion(baseQuestion);
                questionData = {
                    english: baseQuestion.word,
                    chinese: this.extractChineseMeaning(baseQuestion.meaning),
                    options: options,
                    level: 2
                };
            } else if (level === 3) {
                // 第三关：听音辨词
                questionData = {
                    english: baseQuestion.word,
                    chinese: this.extractChineseMeaning(baseQuestion.meaning),
                    audioUrl: this.generateAudioUrl(baseQuestion.word),
                    level: 3
                };
            }

            // 输出题库使用统计
            const stats = this.wordPool.getUsageStats();
            console.log('题库统计:', stats);
            console.log('生成题目:', questionData);

            return questionData;

        } catch (error) {
            console.error('获取题目失败:', error);
            return null;
        }
    }

    /**
     * 传统方式获取题目（备用）
     */
    async getQuestionTraditionalWay(grade) {
        try {
            // 使用主游戏的题库加载逻辑
            if (!window.gradeQuestions || window.gradeQuestions.length === 0) {
                console.log('加载题库数据:', grade);
                await this.loadQuestionData(grade);
            }

            if (!window.gradeQuestions || window.gradeQuestions.length === 0) {
                throw new Error('无法加载题库数据');
            }

            // 随机选择一个题目
            const randomIndex = Math.floor(Math.random() * window.gradeQuestions.length);
            return window.gradeQuestions[randomIndex];

        } catch (error) {
            console.error('传统方式获取题目失败:', error);
            return null;
        }
    }

    /**
     * 处理答题
     */
    handleAnswer(answer, level) {
        if (!this.gameState.isActive || !this.gameState.currentQuestion) {
            return;
        }

        const question = this.gameState.currentQuestion;
        const isCorrect = this.checkAnswer(answer, question);

        console.log('答题结果:', { answer, isCorrect, question });

        // 播放答题音效
        this.playBattleSound(isCorrect ? 'correct' : 'error');

        // 更新分数
        if (isCorrect) {
            this.gameState.myScore++;
        } else {
            // 记录错题
            this.gameState.wrongAnswers.push({
                level: level,
                question: question.chinese || question.english,
                correctAnswer: question.english || question.chinese,
                userAnswer: answer
            });
        }

        // 立即更新显示信息（包括分数）
        this.updateLevelDisplay();

        // 发送反馈到关卡页面
        this.sendToCurrentLevel('showFeedback', {
            isCorrect: isCorrect,
            message: isCorrect ? '正确！' : '错误！',
            correctAnswer: question.english || question.chinese,
            userAnswer: answer
        });

        // 新的数据同步机制：优先使用本地模拟，再尝试WebSocket
        const gameActionData = {
            level: level,
            isCorrect: isCorrect,
            answer: answer,
            timestamp: Date.now(),
            playerId: this.playerInfo?.id || this.playerInfo?.nickname || 'player1'
        };

        console.log('📤 发送答题结果给对手:', gameActionData);

        // 判断是否为AI对手模式
        const isAIOpponent = this.opponentInfo && this.opponentInfo.nickname === 'AI助手';
        
        if (isAIOpponent) {
            // AI对手模式：使用本地模拟
            console.log('🤖 AI对手模式，启用模拟对手响应');
            this.simulateOpponentResponse(gameActionData);
        } else {
            // 真人对战模式：只使用WebSocket同步
            console.log('👥 真人对战模式，禁用模拟对手');
            if (this.wsClient && this.wsClient.isConnected) {
                try {
                    const sendResult = this.wsClient.sendGameAction('playerAnswer', gameActionData);
                    console.log('📝 WebSocket发送结果:', sendResult);
                } catch (error) {
                    console.warn('⚠️ WebSocket发送失败:', error);
                }
            } else {
                console.warn('⚠️ 真人对战模式但WebSocket未连接');
            }
        }

        // 立即生成下一道题（实时竞速模式）
        setTimeout(() => {
            this.loadNextQuestion();
        }, 1500); // 缩短等待时间，提高竞速性
    }

    /**
     * 加载下一道题（实时竞速模式）
     */
    async loadNextQuestion() {
        if (!this.gameState.isActive) {
            return;
        }

        console.log('🏃‍♂️ 加载下一道题（竞速模式）');

        try {
            // 获取新题目
            const grade = this.playerInfo.grade;
            const questionData = await this.getRandomQuestion(grade, this.gameState.currentLevel);

            if (questionData) {
                this.gameState.currentQuestion = questionData;

                // 发送题目数据到关卡页面
                this.sendToCurrentLevel('showQuestion', questionData);

                // 更新显示信息
                this.updateLevelDisplay();

                console.log('📝 新题目已加载:', questionData.chinese || questionData.english);
            } else {
                console.error('无法加载新题目');
            }
        } catch (error) {
            console.error('加载下一道题失败:', error);
        }
    }

    /**
     * 模拟对手响应（本地同步机制）
     */
    simulateOpponentResponse(myActionData) {
        // 模拟对手的响应时间（竞速模式：2-8秒）
        const responseDelay = 2000 + Math.random() * 6000;

        setTimeout(() => {
            // 模拟对手答题结果（55%正确率，让游戏更有挑战性）
            const opponentIsCorrect = Math.random() > 0.45;

            const opponentActionData = {
                level: myActionData.level,
                isCorrect: opponentIsCorrect,
                answer: 'simulated_answer_' + Date.now(),
                timestamp: Date.now(),
                playerId: this.opponentInfo?.id || this.opponentInfo?.nickname || 'opponent1'
            };

            console.log('🤖 模拟对手响应:', opponentActionData);

            // 直接调用对手答题处理方法
            this.handleOpponentAnswer(opponentActionData);

        }, responseDelay);

        // 模拟对手也会继续答题（竞速模式）
        const nextQuestionDelay = 3000 + Math.random() * 5000;
        setTimeout(() => {
            if (this.gameState.isActive) {
                // 模拟对手答下一道题
                this.simulateOpponentNextAnswer();
            }
        }, nextQuestionDelay);
    }

    /**
     * 模拟对手答下一道题（竞速模式）
     */
    simulateOpponentNextAnswer() {
        if (!this.gameState.isActive) {
            return;
        }

        // 模拟对手答题结果（55%正确率）
        const opponentIsCorrect = Math.random() > 0.45;

        const opponentActionData = {
            level: this.gameState.currentLevel,
            isCorrect: opponentIsCorrect,
            answer: 'simulated_next_answer_' + Date.now(),
            timestamp: Date.now(),
            playerId: this.opponentInfo?.id || this.opponentInfo?.nickname || 'opponent1'
        };

        console.log('🤖 模拟对手答下一道题:', opponentActionData);

        // 处理对手答题
        this.handleOpponentAnswer(opponentActionData);

        // 继续模拟下一次答题
        const nextDelay = 4000 + Math.random() * 6000;
        setTimeout(() => {
            if (this.gameState.isActive) {
                this.simulateOpponentNextAnswer();
            }
        }, nextDelay);
    }

    /**
     * 为选择题生成选项
     */
    async generateOptionsForQuestion(correctQuestion) {
        try {
            console.log('生成选项，题目:', correctQuestion);

            // 确保题库数据可用
            await this.ensureQuestionDataAvailable();

            console.log('题库状态:', {
                allQuestions: this.wordPool.allQuestions.length,
                gradeQuestions: window.gradeQuestions ? window.gradeQuestions.length : 'undefined',
                generateOptionsForL2: typeof window.generateOptionsForL2
            });

            // 使用主游戏的选项生成逻辑
            if (window.generateOptionsForL2 && window.gradeQuestions && window.gradeQuestions.length > 0) {
                // 标准化题目格式
                const standardizedQuestion = {
                    english: correctQuestion.word,
                    chinese: this.extractChineseMeaning(correctQuestion.meaning),
                    word: correctQuestion.word,
                    meaning: this.extractChineseMeaning(correctQuestion.meaning)
                };
                console.log('标准化题目:', standardizedQuestion);
                const options = window.generateOptionsForL2(standardizedQuestion, window.gradeQuestions);
                console.log('生成的选项:', options);
                return options;
            }

            console.log('使用备用选项生成逻辑');

            // 备用逻辑：使用智能题库的数据
            const correctAnswer = this.extractChineseMeaning(correctQuestion.meaning);
            console.log('正确答案:', correctAnswer);

            if (!correctAnswer) {
                console.error('无法提取正确答案:', correctQuestion);
                return [{ value: '加载失败', display: '加载失败' }];
            }

            const options = [{ value: correctAnswer, display: correctAnswer }];

            // 从智能题库中随机选择其他选项
            const availableQuestions = this.wordPool.allQuestions.length > 0 ?
                this.wordPool.allQuestions : (window.gradeQuestions || []);

            if (availableQuestions.length > 0) {
                const otherQuestions = availableQuestions.filter(q => {
                    const meaning = this.extractChineseMeaning(q.meaning);
                    return meaning && meaning !== correctAnswer && meaning.length > 0;
                });

                console.log('可用的干扰项:', otherQuestions.length);

                // 随机打乱干扰项
                for (let i = otherQuestions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [otherQuestions[i], otherQuestions[j]] = [otherQuestions[j], otherQuestions[i]];
                }

                // 添加3个干扰项
                let addedCount = 0;
                for (const q of otherQuestions) {
                    if (options.length >= 4 || addedCount >= 3) break;

                    const wrongAnswer = this.extractChineseMeaning(q.meaning);
                    if (wrongAnswer && !options.some(opt => opt.value === wrongAnswer)) {
                        options.push({ value: wrongAnswer, display: wrongAnswer });
                        addedCount++;
                    }
                }
            }

            // 如果仍然不够4个选项，添加通用干扰项
            const genericOptions = ['其他选项', '错误答案', '干扰项', '无关选项'];
            let genericIndex = 0;
            while (options.length < 4 && genericIndex < genericOptions.length) {
                const genericOption = genericOptions[genericIndex];
                if (!options.some(opt => opt.value === genericOption)) {
                    options.push({ value: genericOption, display: genericOption });
                }
                genericIndex++;
            }

            // 打乱选项顺序
            for (let i = options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [options[i], options[j]] = [options[j], options[i]];
            }

            console.log('最终生成的选项:', options);
            return options;
        } catch (error) {
            console.error('生成选项失败:', error);
            return [{ value: '加载失败', display: '加载失败' }];
        }
    }

    /**
     * 确保题库数据可用
     */
    async ensureQuestionDataAvailable() {
        // 如果全局题库数据不存在，从智能题库复制
        if (!window.gradeQuestions || window.gradeQuestions.length === 0) {
            if (this.wordPool.allQuestions.length > 0) {
                window.gradeQuestions = [...this.wordPool.allQuestions];
                console.log('从智能题库复制数据到全局变量:', window.gradeQuestions.length);
            } else {
                // 如果智能题库也没有数据，尝试加载
                try {
                    await this.loadQuestionData(this.playerInfo.grade);
                } catch (error) {
                    console.error('加载题库数据失败:', error);
                }
            }
        }
    }

    /**
     * 提取中文含义（去除词性和复杂解释）
     */
    extractChineseMeaning(meaning) {
        if (!meaning) return '';

        // 分割成多个部分（按分号、换行等分割）
        const parts = meaning.split(/[;\n]/);

        // 取第一个部分
        let firstPart = parts[0].trim();

        // 去除词性标记（n. adj. v. 等）
        firstPart = firstPart.replace(/^[a-zA-Z]+\.\s*/, '');

        // 去除括号内容
        firstPart = firstPart.replace(/\([^)]*\)/g, '');

        // 去除多余空格
        firstPart = firstPart.replace(/\s+/g, ' ').trim();

        // 如果太长，只取前面的部分
        if (firstPart.length > 20) {
            const shortParts = firstPart.split(/[,，]/);
            firstPart = shortParts[0].trim();
        }

        return firstPart || meaning; // 如果处理后为空，返回原文
    }

    /**
     * 生成音频URL
     */
    generateAudioUrl(word) {
        // 在线版本使用免费的TTS服务
        // 使用ResponsiveVoice作为主要TTS服务

        // 创建一个特殊的URL标识符，实际播放时会使用ResponsiveVoice
        return `tts://responsivevoice/${encodeURIComponent(word)}`;
    }

    /**
     * 检查答案是否正确
     */
    checkAnswer(userAnswer, question) {
        let correctAnswer;

        // 根据关卡类型确定正确答案
        if (this.gameState.currentLevel === 1) {
            // 第一关：中译英
            correctAnswer = question.english;
        } else if (this.gameState.currentLevel === 2) {
            // 第二关：英译中（选择题）
            correctAnswer = question.chinese;
        } else if (this.gameState.currentLevel === 3) {
            // 第三关：听写英文
            correctAnswer = question.english;
        } else {
            // 备用逻辑
            correctAnswer = question.english || question.chinese || question.correctAnswer;
        }

        if (!correctAnswer) {
            console.error('无法找到正确答案:', question);
            return false;
        }

        // 标准化答案进行比较
        const normalizedUser = userAnswer.toLowerCase().trim();
        const normalizedCorrect = correctAnswer.toLowerCase().trim();

        console.log('答案检查:', {
            level: this.gameState.currentLevel,
            userAnswer: normalizedUser,
            correctAnswer: normalizedCorrect,
            isCorrect: normalizedUser === normalizedCorrect
        });

        return normalizedUser === normalizedCorrect;
    }

    /**
     * 检查关卡是否结束
     */
    checkLevelEnd() {
        // 关卡结束由小游戏自身决定，这里只做备用检查
        let levelEnded = false;
        let winner = null;

        // 备用结束条件：防止无限竞争，设置最大答题数
        const maxQuestionsPerLevel = 50; // 增加最大题目数，支持更长时间的竞速
        const totalAnswered = this.gameState.myScore + this.gameState.opponentScore;

        if (totalAnswered >= maxQuestionsPerLevel) {
            levelEnded = true;
            winner = this.gameState.myScore > this.gameState.opponentScore ? 'my' : 'opponent';
            console.log(`⏰ 达到最大题目数 ${maxQuestionsPerLevel}，按分数决定胜负: ${winner}`);
        }

        if (levelEnded) {
            this.endLevel(winner);
        }
        // 移除自动加载下一题的逻辑，由 loadNextQuestion 方法处理
    }

    /**
     * 结束当前关卡
     */
    endLevel(winner = null) {
        // 防止重复触发
        if (this.gameState.levelEnding) {
            console.log('⚠️ 关卡已在结束中，忽略重复调用');
            return;
        }

        this.gameState.levelEnding = true;
        const level = this.gameState.currentLevel;
        let myWin;

        console.log(`endLevel 被调用 - 关卡: ${level}, winner: ${winner}`);

        if (winner) {
            myWin = winner === 'my';
        } else {
            myWin = this.gameState.myScore > this.gameState.opponentScore;
        }

        console.log(`关卡 ${level} 结果判定: myWin = ${myWin}`);

        // 发送关卡结束消息给对手
        if (this.wsClient) {
            console.log('📤 发送关卡结束消息给对手:', {
                level: level,
                winner: winner,
                myWin: myWin
            });

            this.wsClient.sendGameAction('levelEnd', {
                level: level,
                winner: winner,
                myWin: myWin
            });
        }

        if (myWin) {
            this.gameState.levelWins.my++;
        } else {
            this.gameState.levelWins.opponent++;
        }

        // 记录当前关卡的具体结果
        this.gameState.levelResults.push({
            level: level,
            result: myWin ? 'victory' : 'defeat',
            description: myWin ? '成功获胜' : '遗憾失败'
        });

        console.log(`关卡 ${level} 结束，我方${myWin ? '获胜' : '失败'}`);
        console.log('当前 levelWins 状态:', this.gameState.levelWins);
        console.log('当前 levelResults 状态:', this.gameState.levelResults);

        // 播放关卡结束音效
        this.playBattleSound(myWin ? 'level_win' : 'level_lose');

        // 重置关卡分数
        this.gameState.myScore = 0;
        this.gameState.opponentScore = 0;

        // 检查游戏是否结束
        if (this.gameState.currentLevel >= 3) {
            this.endGame();
        } else {
            // 进入下一关
            setTimeout(() => {
                this.startLevel(this.gameState.currentLevel + 1);
            }, 3000);
        }
    }

    /**
     * 结束游戏
     */
    endGame() {
        this.gameState.isActive = false;

        // 清除游戏计时器
        this.clearGameTimer();

        const totalTime = Math.floor((Date.now() - this.gameState.startTime) / 1000);

        const isVictory = this.gameState.levelWins.my > this.gameState.levelWins.opponent;

        console.log('游戏结束:', {
            isVictory,
            levelWins: this.gameState.levelWins,
            wrongAnswers: this.gameState.wrongAnswers,
            totalTime,
            wordPoolStats: this.wordPool.getUsageStats()
        });

        // 注释掉这里的音效播放，由结果页面负责播放以避免重复
        // this.playBattleSound(isVictory ? 'challenge_win' : 'challenge_lose');

        // 准备结果数据
        const resultData = {
            isVictory: isVictory,
            player: {
                nickname: this.playerInfo.nickname,
                totalScore: this.gameState.levelWins.my,
                totalTime: totalTime,
                correctAnswers: this.calculateCorrectAnswers()
            },
            opponent: {
                nickname: this.opponentInfo.nickname,
                totalScore: this.gameState.levelWins.opponent,
                totalTime: totalTime + 30, // 模拟对手用时
                correctAnswers: this.gameState.levelWins.opponent * 3
            },
            levelResults: this.generateLevelResults(),
            wrongAnswers: this.gameState.wrongAnswers
        };

        // 存储结果数据
        window.battleResultData = resultData;

        // 导航到结果页面
        if (window.navigateTo) {
            window.navigateTo('battle_result');
        }
    }

    /**
     * 计算正确答案数量
     */
    calculateCorrectAnswers() {
        // 简化计算，实际应该根据具体答题记录
        return this.gameState.levelWins.my * 3;
    }

    /**
     * 生成关卡结果
     */
    generateLevelResults() {
        // 直接返回实际记录的关卡结果
        return this.gameState.levelResults;
    }

    /**
     * 发送消息到当前关卡页面
     */
    sendToCurrentLevel(action, payload) {
        const screenFrame = document.getElementById('screenFrame');
        if (screenFrame && screenFrame.contentWindow) {
            screenFrame.contentWindow.postMessage({
                action: action,
                payload: payload
            }, '*');
        }
    }

    /**
     * 更新关卡显示信息
     */
    updateLevelDisplay() {
        this.sendToCurrentLevel('updateDisplay', {
            currentLevel: this.gameState.currentLevel,
            questionNumber: 1,
            totalQuestions: 5,
            score: this.gameState.myScore,
            targetScore: 3,
            myScore: this.gameState.myScore,
            opponentScore: this.gameState.opponentScore
            // 移除 timerValue，双人对战模式不使用计时器
        });
    }

    /**
     * 开始计时器 - 双人对战模式不使用计时器
     */
    startTimer() {
        // 双人对战模式不需要计时器，由对手竞争提供紧迫感
        console.log('双人对战模式：不使用计时器');
    }

    /**
     * 处理对手的答题结果
     */
    handleOpponentAnswer(data) {
        console.log('🎯 处理对手答题结果:', data);

        if (data.isCorrect) {
            this.gameState.opponentScore++;
            console.log('✅ 对手答对了！对手分数:', this.gameState.opponentScore);
        } else {
            console.log('❌ 对手答错了');
        }

        // 立即更新显示信息
        this.updateLevelDisplay();

        // 通知当前关卡页面
        this.sendToCurrentLevel('opponentAnswer', {
            isCorrect: data.isCorrect,
            level: data.level,
            opponentScore: this.gameState.opponentScore
        });

        // 检查关卡是否结束
        setTimeout(() => {
            this.checkLevelEnd();
        }, 1000);
    }

    /**
     * 处理对手的关卡结束消息
     */
    handleOpponentLevelEnd(data) {
        console.log('🏁 收到对手关卡结束消息:', data);

        // 检查是否在同一关卡
        if (data.level === this.gameState.currentLevel) {
            console.log('🔄 同步关卡结束，对手先结束了关卡', data.level);

            // 如果对手先结束关卡，我们也结束当前关卡
            // 但不再发送消息给对手（避免循环）
            this.endLevelSilently(data.winner);
        } else {
            console.log('⚠️ 关卡不同步！我在关卡', this.gameState.currentLevel, '，对手在关卡', data.level);
        }
    }

    /**
     * 静默结束关卡（不发送消息给对手）
     */
    endLevelSilently(winner = null) {
        // 防止重复触发
        if (this.gameState.levelEnding) {
            console.log('⚠️ 关卡已在结束中，忽略重复调用');
            return;
        }

        this.gameState.levelEnding = true;
        const level = this.gameState.currentLevel;
        let myWin;

        console.log(`endLevelSilently 被调用 - 关卡: ${level}, winner: ${winner}`);

        if (winner) {
            myWin = winner === 'my';
        } else {
            myWin = this.gameState.myScore > this.gameState.opponentScore;
        }

        console.log(`关卡 ${level} 结果判定: myWin = ${myWin}`);

        if (myWin) {
            this.gameState.levelWins.my++;
        } else {
            this.gameState.levelWins.opponent++;
        }

        // 记录当前关卡的具体结果
        this.gameState.levelResults.push({
            level: level,
            result: myWin ? 'victory' : 'defeat',
            description: myWin ? '成功获胜' : '遗憾失败'
        });

        console.log(`关卡 ${level} 结束，我方${myWin ? '获胜' : '失败'}`);
        console.log('当前 levelWins 状态:', this.gameState.levelWins);
        console.log('当前 levelResults 状态:', this.gameState.levelResults);

        // 播放关卡结束音效
        this.playBattleSound(myWin ? 'level_win' : 'level_lose');

        // 重置关卡分数
        this.gameState.myScore = 0;
        this.gameState.opponentScore = 0;

        // 检查游戏是否结束
        if (this.gameState.currentLevel >= 3) {
            this.endGame();
        } else {
            // 进入下一关
            setTimeout(() => {
                this.startLevel(this.gameState.currentLevel + 1);
            }, 3000);
        }
    }

    /**
     * 播放双人模式音效
     */
    playBattleSound(soundName) {
        try {
            // 检查是否关闭音效
            const soundEnabled = localStorage.getItem('soundEnabled');
            if (soundEnabled === 'false') {
                return;
            }

            // 播放音效
            const audio = new Audio(`audio/${soundName}.wav`);
            audio.volume = 0.5; // 设置音量为50%
            audio.play().catch(error => {
                console.warn(`播放音效 ${soundName} 失败:`, error);
            });
        } catch (error) {
            console.warn(`加载音效 ${soundName} 失败:`, error);
        }
    }
}

// 创建全局实例
window.battleManager = new BattleManager();

// 监听来自关卡页面的消息
window.addEventListener('message', (event) => {
    if (event.data && event.data.action) {
        const battleManager = window.battleManager;

        switch (event.data.action) {
            case 'requestBattleLevelData':
                // 关卡页面请求数据
                if (battleManager.gameState.isActive) {
                    battleManager.loadLevelData(event.data.level);
                }
                break;

            case 'checkBattleAnswer':
                // 检查答案
                const { answer, level } = event.data.payload;
                battleManager.handleAnswer(answer, level);
                break;

            case 'levelEnded':
                // 关卡结束
                const { level: endedLevel, winner } = event.data.payload;
                console.log(`关卡 ${endedLevel} 结束，获胜者: ${winner}`);
                console.log('关卡结束消息详情:', event.data);
                battleManager.endLevel(winner);
                break;
        }
    }
});

// 设置消息处理器连接函数
function setupBattleMessageHandlers() {
    console.log('🔗 设置双人对战消息处理器');

    // 确保WebSocket客户端存在
    if (window.wsClient) {
        // 添加游戏动作处理器
        window.wsClient.addMessageHandler('gameAction', (message) => {
            console.log('📨 收到对手游戏动作:', message);

            // 处理Firebase和WebSocket两种不同的数据结构
            let action, data;

            if (message.action && message.data) {
                // WebSocket格式: {action: 'playerAnswer', data: {...}}
                action = message.action;
                data = message.data;
            } else if (message.playerId && message.action) {
                // Firebase格式: {playerId: 'xxx', action: 'playerAnswer', data: {...}}
                action = message.action;
                data = message.data || message;
            } else {
                console.warn('⚠️ 未知的游戏动作格式:', message);
                return;
            }

            console.log('🔄 解析后的动作:', { action, data });

            if (action === 'playerAnswer') {
                console.log('🎯 处理对手答题:', data);
                window.battleManager.handleOpponentAnswer(data);
            } else if (action === 'levelEnd') {
                console.log('🏁 处理对手关卡结束:', data);
                window.battleManager.handleOpponentLevelEnd(data);
            }
        });

        console.log('✅ 双人对战消息处理器设置完成');
    } else {
        console.warn('⚠️ WebSocket客户端未就绪，稍后重试');
        // 延迟重试
        setTimeout(setupBattleMessageHandlers, 1000);
    }
}

// 立即尝试设置，如果失败会自动重试
setupBattleMessageHandlers();

// 也在window加载完成后再次尝试
window.addEventListener('load', setupBattleMessageHandlers);

// 添加全局调试工具
window.debugBattleSync = function() {
    console.log('%c🔍 双人对战同步调试工具', 'color: #e74c3c; font-size: 16px; font-weight: bold;');

    // 1. 检查基本组件
    console.log('💻 组件状态:');
    console.log('- WebSocket客户端:', !!window.wsClient);
    console.log('- 对战管理器:', !!window.battleManager);
    console.log('- Firebase对战:', !!window.firebaseBattle);
    console.log('- Firebase管理器:', !!window.firebaseManager);

    if (window.wsClient) {
        console.log('🌐 WebSocket状态:');
        console.log('- 使用Firebase:', window.wsClient.useFirebase);
        console.log('- 已连接:', window.wsClient.isConnected);
        console.log('- 当前房间:', window.wsClient.currentRoom);
        console.log('- 消息处理器数量:', window.wsClient.messageHandlers.size);
    }

    // 2. 检查游戏数据
    if (window.battleGameData) {
        console.log('🎮 游戏数据:');
        console.log('- 玩家ID:', window.battleGameData.player?.id);
        console.log('- 对手ID:', window.battleGameData.opponent?.id);
        console.log('- 房间ID:', window.battleGameData.roomId);
        console.log('- 完整数据:', window.battleGameData);
    }

    // 3. 检查对战管理器状态
    if (window.battleManager) {
        console.log('⚔️ 对战管理器状态:');
        console.log('- 游戏激活:', window.battleManager.gameState?.isActive);
        console.log('- 当前关卡:', window.battleManager.gameState?.currentLevel);
        console.log('- 我的分数:', window.battleManager.gameState?.myScore);
        console.log('- 对手分数:', window.battleManager.gameState?.opponentScore);
        console.log('- WebSocket客户端:', !!window.battleManager.wsClient);
    }

    if (window.firebaseBattle) {
        console.log('🔥 Firebase对战状态:');
        console.log('- 数据库:', !!window.firebaseBattle.database);
        console.log('- 当前用户:', window.firebaseBattle.currentUser);
        console.log('- 当前房间:', window.firebaseBattle.currentRoom);
        console.log('- 最后处理动作:', window.firebaseBattle.lastProcessedActionId);
    }

    // 4. 检查关卡页面状态
    const screenFrame = document.getElementById('screenFrame');
    if (screenFrame && screenFrame.contentWindow) {
        console.log('📺 关卡页面状态:');
        console.log('- 页面已加载:', !!screenFrame.contentWindow.document);
        console.log('- 页面URL:', screenFrame.src);

        // 尝试获取关卡页面的游戏状态
        try {
            const levelGameState = screenFrame.contentWindow.gameState;
            if (levelGameState) {
                console.log('- 关卡游戏状态:', levelGameState);
            }
        } catch (error) {
            console.log('- 无法访问关卡页面状态:', error.message);
        }
    }

    console.log('%c🛠️ 调试建议:', 'color: #3498db; font-weight: bold;');
    console.log('1. 检查角色分配是否正确');
    console.log('2. 检查答题数据是否发送成功');
    console.log('3. 检查对手数据是否正确接收');
    console.log('4. 在控制台中输入 debugBattleSync() 查看实时状态');
};

// 添加快捷调试命令
console.log('%c🔧 双人对战调试工具已加载', 'color: #9b59b6; font-size: 14px; font-weight: bold;');
console.log('可用命令:');
console.log('- debugBattleSync() - 调试数据同步问题');
