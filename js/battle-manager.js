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
            // 标准化年级格式
            let normalizedGrade = grade;
            if (grade && grade.startsWith('g') && /^g\d+$/.test(grade)) {
                normalizedGrade = 'grade' + grade.substring(1);
            }

            const questionPath = `data/renjiaoban/${normalizedGrade}.json`;
            const response = await fetch(questionPath);

            if (!response.ok) {
                throw new Error(`无法加载题库文件: ${questionPath}`);
            }

            this.allQuestions = await response.json();

            // 为每个题目添加唯一ID
            this.allQuestions.forEach((question, index) => {
                if (!question.id) {
                    question.id = `${normalizedGrade}_${index}`;
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
            wrongAnswers: [],
            startTime: null,
            levelStartTime: null,
            gameTimeLimit: 15 * 60 * 1000, // 15分钟游戏时间限制
            gameTimer: null
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
        this.playerInfo = playerInfo;
        this.opponentInfo = opponentInfo;
        this.gameState.isActive = true;
        this.gameState.startTime = Date.now();

        console.log('双人对战初始化:', { playerInfo, opponentInfo });

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

        // 开始第一关
        this.startLevel(1);
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

            // 标准化年级格式（将 g3, g4, g5 等转换为 grade3, grade4, grade5）
            let normalizedGrade = grade;
            if (grade && grade.startsWith('g') && /^g\d+$/.test(grade)) {
                normalizedGrade = 'grade' + grade.substring(1);
            }

            // 构建题库文件路径
            const questionPath = `data/renjiaoban/${normalizedGrade}.json`;

            console.log('题库文件路径:', questionPath);

            // 加载题库文件
            const response = await fetch(questionPath);
            if (!response.ok) {
                throw new Error(`无法加载题库文件: ${questionPath}`);
            }

            const questionData = await response.json();

            // 将题库数据存储到全局变量
            window.gradeQuestions = questionData;

            console.log(`题库加载成功: ${normalizedGrade}，共 ${questionData.length} 道题`);

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

        // 通过WebSocket发送答题结果给对手
        if (this.wsClient) {
            this.wsClient.sendGameAction('playerAnswer', {
                level: level,
                isCorrect: isCorrect,
                answer: answer
            });
        }

        // 检查关卡是否结束
        setTimeout(() => {
            this.checkLevelEnd();
        }, 2000);
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
        // 根据小游戏的胜负条件来判断，而不是固定题目数量
        let levelEnded = false;
        let winner = null;

        if (this.gameState.currentLevel === 1) {
            // 第一关：警察抓小偷
            // 检查小游戏状态，而不是答题数量
            // 这里暂时不结束，让小游戏自己判断胜负
            levelEnded = false;
        } else if (this.gameState.currentLevel === 2) {
            // 第二关：天梯攀爬
            // 检查是否有人到达顶端
            levelEnded = false;
        } else if (this.gameState.currentLevel === 3) {
            // 第三关：拔河
            // 检查绳子位置
            levelEnded = false;
        }

        // 备用结束条件：如果答题数量过多，强制结束
        const maxQuestionsPerLevel = 20;
        if (this.gameState.myScore + this.gameState.opponentScore >= maxQuestionsPerLevel) {
            levelEnded = true;
            winner = this.gameState.myScore > this.gameState.opponentScore ? 'my' : 'opponent';
        }

        if (levelEnded) {
            this.endLevel(winner);
        } else {
            // 继续下一题
            setTimeout(() => {
                this.loadLevelData(this.gameState.currentLevel);
            }, 1000);
        }
    }

    /**
     * 结束当前关卡
     */
    endLevel(winner = null) {
        const level = this.gameState.currentLevel;
        let myWin;

        if (winner) {
            myWin = winner === 'my';
        } else {
            myWin = this.gameState.myScore > this.gameState.opponentScore;
        }

        if (myWin) {
            this.gameState.levelWins.my++;
        } else {
            this.gameState.levelWins.opponent++;
        }

        console.log(`关卡 ${level} 结束，我方${myWin ? '获胜' : '失败'}`);

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
        const results = [];
        for (let i = 1; i <= 3; i++) {
            const myWin = i <= this.gameState.levelWins.my;
            results.push({
                result: myWin ? 'victory' : 'defeat',
                description: myWin ? '成功获胜' : '遗憾失败'
            });
        }
        return results;
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
        if (data.isCorrect) {
            this.gameState.opponentScore++;
        }

        // 通知当前关卡页面
        this.sendToCurrentLevel('opponentAnswer', {
            isCorrect: data.isCorrect,
            level: data.level
        });
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
                battleManager.endLevel(winner);
                break;
        }
    }
});

// 监听WebSocket消息
if (window.wsClient) {
    window.wsClient.addMessageHandler('gameAction', (message) => {
        if (message.action === 'playerAnswer') {
            window.battleManager.handleOpponentAnswer(message.data);
        }
    });
}
