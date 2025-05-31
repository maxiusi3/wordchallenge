// --- Constants ---
const ADMIN_PASSWORD = 'admin321'; // Default admin password (FR08)
const QUESTION_TIME_LIMIT = 15; // Seconds per question (FR06)
const LEVEL_COUNT = 3; // Fixed number of levels (FR04)
const ATTEMPTS_PER_QUESTION_L1_L3 = 3; // Attempts for Level 1 & 3 (FR06)

// --- State Variables ---
// --- Game Session State ---
// This object holds all state related to a single playthrough of the game.
// It is initialized in initializeGame() and reset when the game ends or goes back home.
let gameSession = null;

// --- Global Configuration (Not part of a single game session) ---
let adminConfig = {}; // Holds admin-defined parameters (totalQuestions, targetScore per level)

// --- DOM References (from index.html) ---
const screenFrame = document.getElementById('screenFrame');

// --- Utility Functions ---

// Send message to the currently loaded iframe
function sendMessageToIframe(action, payload) {
    if (screenFrame && screenFrame.contentWindow) {
        console.log(`Sending message to iframe:`, { action, payload }); // Debugging
        screenFrame.contentWindow.postMessage({ action, payload }, '*'); // Use specific origin in production
    } else {
        console.error("Cannot send message: iframe not ready or accessible.");
    }
}

// Load default or saved admin config
function loadAdminConfig() {
    const savedConfig = localStorage.getItem('wordChallengeAdminConfig');
    // Check if savedConfig exists and is not the literal string "undefined"
    if (savedConfig && savedConfig !== 'undefined') {
        try {
            adminConfig = JSON.parse(savedConfig);
            console.log("Loaded admin config from localStorage:", adminConfig);
        } catch (e) {
            console.error("Failed to parse admin config from localStorage: '" + savedConfig + "'", e);
            setDefaultAdminConfig();
        }
    } else {
        if (savedConfig === 'undefined') {
             console.warn("Found 'undefined' string in localStorage for admin config, resetting.");
        }
        setDefaultAdminConfig();
    }
    // Ensure structure is valid
     if (!adminConfig.level1 || !adminConfig.level2 || !adminConfig.level3 ||
         typeof adminConfig.level1.totalQuestions !== 'number' || typeof adminConfig.level1.targetScore !== 'number' ||
         typeof adminConfig.level2.totalQuestions !== 'number' || typeof adminConfig.level2.targetScore !== 'number' ||
         typeof adminConfig.level3.totalQuestions !== 'number' || typeof adminConfig.level3.targetScore !== 'number') {
         console.warn("Invalid or incomplete config found, resetting to defaults.");
         setDefaultAdminConfig();
     }
}

// Set default admin config values
function setDefaultAdminConfig() {
    adminConfig = {
        level1: { totalQuestions: 10, targetScore: 5 },
        level2: { totalQuestions: 10, targetScore: 5 },
        level3: { totalQuestions: 10, targetScore: 5 }
    };
    console.log("Set default admin config:", adminConfig);
    // Save defaults immediately
    saveAdminConfigData(adminConfig, false); // Don't show status message on initial default save
}

// Save admin config to localStorage
function saveAdminConfigData(config, notifyIframe = true) {
    try {
        localStorage.setItem('wordChallengeAdminConfig', JSON.stringify(config));
        adminConfig = config; // Update in-memory config
        console.log("Saved admin config to localStorage:", adminConfig);
        if (notifyIframe) {
            sendMessageToIframe('adminConfigSaved');
        }
        return true;
    } catch (e) {
        console.error("Failed to save admin config to localStorage:", e);
         if (notifyIframe) {
            sendMessageToIframe('adminConfigSaveFailed');
         }
        return false;
    }
}

// Format time (MM:SS)
function formatTime(totalSeconds) {
    if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) return '--:--';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// --- Game Initialization and State Management ---

function initializeGame(initialUserInfo) {
    console.log(`%c🎯 [RANDOM SYSTEM] Initializing new game session for ${initialUserInfo.gradeName} (${initialUserInfo.grade})...`, 'color: #E74C3C; font-size: 16px; font-weight: bold;');
    // Ensure any previous timer potentially associated with an old session is stopped.
    // Note: stopTimer itself will need to be updated to use gameSession.
    // We pass null explicitly as gameSession might not be fully ready or might be from a previous game.
    stopTimer(null);

    gameSession = {
        // User Info (copied from input)
        nickname: initialUserInfo.nickname,
        grade: initialUserInfo.grade,
        gradeName: initialUserInfo.gradeName, // 添加 gradeName

        // Game Progress
        currentLevel: 1,
        questionNumber: 0, // Index for the *next* question to be fetched (0 means first question)
        score: { level1: 0, level2: 0, level3: 0 },
        totalScore: 0,
        isFinished: false,
        challengeSuccess: null, // null, true, or false

        // Current Question State
        currentQuestionData: null, // Holds the data object for the current question
        attemptsLeft: ATTEMPTS_PER_QUESTION_L1_L3, // Initial attempts for L1 (Level 2 logic is handled in getNextQuestion/startTimer)
        timeLeft: QUESTION_TIME_LIMIT,
        questionStartTime: null,
        audioPlayedThisTurn: false, // Track if L3 audio played for the current question. Initialized in initializeGame.

        // Level/Game Timing
        levelStartTime: null, // Timestamp when the current level started
        gameStartTime: Date.now(),
        totalGameTimeSeconds: 0, // Will be calculated at the end

        // Data
        questions: { level1: [], level2: [], level3: [] }, // Holds the selected questions for the session
        uniqueQuestionPool: [], // Will hold all unique questions for the selected grade
        wrongAnswers: [], // Store details of wrong answers

        // Internal State
        timerIntervalId: null, // Holds the ID from setInterval
        questionLoadPromise: null, // Holds the promise returned by loadQuestionsForGrade
        timerWarningPlayedThisQuestion: false // Tracks if warning sound played for current question
    };

    console.log("New gameSession created:", gameSession);

    // Load questions based on the grade stored in the new gameSession
    // This is async, the result needs to be handled before starting the first level.
    // Store the promise to be awaited later (e.g., in the 'navigate' message handler).
    // Pass the current gameSession instance to loadQuestionsForGrade
    gameSession.questionLoadPromise = loadQuestionsForGrade(gameSession.grade, gameSession);


    console.log("Game session initialized, question loading initiated.");
    // Navigation to level 1 is triggered by info_input screen sending 'navigate' message.
    // The handler for that message should await gameSession.questionLoadPromise.
}

// --- Question Loading Simulation ---

// Simulate loading questions from JSON based on grade
// In a real app, this would fetch and parse data/gradeX.json
// Load questions dynamically from JSON based on grade
async function loadQuestionsForGrade(gradeId, session) { // Added session parameter
    if (!session) { // Check the passed session object
        console.error("loadQuestionsForGrade called without a valid session object.");
        throw new Error("Game session not provided to loadQuestionsForGrade.");
    }
    console.log(`🎯 [RANDOM SYSTEM] Loading questions for grade: ${gradeId} into provided session.`);
    console.log(`🎯 [RANDOM SYSTEM] Starting random question allocation process...`);
    session.questions = { level1: [], level2: [], level3: [] }; // Reset questions on the provided session

    let gradeQuestions = [];
    let primaryPath;
    gradeId = String(gradeId).trim(); // Ensure no leading/trailing whitespace and it's a string
    console.log('Exact gradeId entering switch (trimmed): "' + gradeId + '"', 'Type:', typeof gradeId); // Debugging gradeId

    switch (gradeId) {
        case 'g3':
        case 'grade3':
            primaryPath = 'data/renjiaoban/grade3.json';
            break;
        case 'g4':
        case 'grade4':
            primaryPath = 'data/renjiaoban/grade4.json';
            break;
        case 'g5':
        case 'grade5':
            primaryPath = 'data/renjiaoban/grade5.json';
            break;
        case 'g6':
        case 'grade6':
            primaryPath = 'data/renjiaoban/grade6.json';
            break;
        case 'g7':
        case 'grade7':
            primaryPath = 'data/renjiaoban/grade7.json';
            break;
        case 'g8':
        case 'grade8':
            primaryPath = 'data/renjiaoban/grade8.json';
            break;
        case 'g9':
        case 'grade9':
            primaryPath = 'data/renjiaoban/grade9.json';
            break;
        case 'grade10': // Assuming 'grade10' for 高一
        case 'hshf':    // Keep existing 'hshf' for compatibility
            primaryPath = 'data/renjiaoban/highschool_high_freq.json';
            console.log(`Mapping gradeId '${gradeId}' to high_freq path: ${primaryPath}`);
            break;
        case 'grade11': // Assuming 'grade11' for 高二
        case 'grade12': // Assuming 'grade12' for 高三
        case 'hsa':     // Keep existing 'hsa' for compatibility (covers 高二/高三 or general high school)
            primaryPath = 'data/renjiaoban/highschool_all.json';
            console.log(`Mapping gradeId '${gradeId}' to all_highschool path: ${primaryPath}`);
            break;
        default:
            // For any other gradeId, attempt a direct mapping.
            // This could be for future expansion (e.g., grade1, grade2) or if an unexpected ID is passed.
            console.warn(`Unhandled gradeId '${gradeId}' in explicit switch. Attempting direct path: data/${gradeId}.json`);
            primaryPath = `data/${gradeId}.json`;
            break;
    }
    const fallbackPath = 'data/renjiaoban/grade3.json';

    // --- 在线数据加载逻辑 ---
    try {
        console.log(`加载题库数据: ${gradeId}`);

        let response;

        // 尝试加载主路径
        try {
            response = await fetch(primaryPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (primaryError) {
            console.warn(`主路径加载失败 (${primaryError.message})，尝试备用路径: ${fallbackPath}`);
            response = await fetch(fallbackPath);
            if (!response.ok) {
                throw new Error(`主路径和备用路径都加载失败: HTTP ${response.status}`);
            }
        }

        gradeQuestions = await response.json();
        console.log(`成功加载 ${gradeQuestions.length} 道题目`);

    } catch (error) {
        console.error(`加载题库数据失败 (${gradeId}):`, error.message);
        throw new Error(`无法加载题库数据。请检查网络连接并重试。错误: ${error.message}`);
    }
    if (!Array.isArray(gradeQuestions)) {
        console.error("Loaded question data is not an array. Using empty array.", gradeQuestions);
        gradeQuestions = [];
        throw new Error(`Loaded question data from ${gradeId} is not a valid array.`);
    }
    // --- End Fetching Logic ---

    if (!session) { // Check the passed session object again before proceeding
        console.error("loadQuestionsForGrade: The provided session object became null after fetching question data. Aborting.");
        throw new Error("Provided game session was lost during question loading.");
    }

    // --- FR No Repeat Logic with Fixed Question Count but Random Selection ---
    const totalNeededL1 = adminConfig.level1.totalQuestions || 10;
    const totalNeededL2 = adminConfig.level2.totalQuestions || 10;
    const totalNeededL3 = adminConfig.level3.totalQuestions || 10;
    const totalUniqueQuestionsNeeded = totalNeededL1 + totalNeededL2 + totalNeededL3;

    const gameTimestamp = Date.now();
    console.log(`%c🎲 固定题目数量但随机选择 - L1: ${totalNeededL1}, L2: ${totalNeededL2}, L3: ${totalNeededL3}`, 'color: #FF6B35; font-size: 14px; font-weight: bold;');
    console.log(`%c🎯 总计需要 ${totalUniqueQuestionsNeeded} 道题目 (随机选择)`, 'color: #4ECDC4; font-size: 14px; font-weight: bold;');
    console.log(`%c🕰️ 游戏时间戳: ${gameTimestamp} - 每次游戏随机选择不同题目`, 'color: #45B7D1; font-size: 14px; font-weight: bold;');

    // 1. Create a unique pool based on 'word' or 'english'
    const uniqueQuestionsMap = new Map();
    gradeQuestions.forEach(q => {
        const wordKey = q.english || q.word;
        if (wordKey && !uniqueQuestionsMap.has(wordKey)) {
            // Standardize here before adding to map to ensure fields are consistent
             let standardizedQ = { ...q };
             if (typeof standardizedQ.english === 'undefined' && typeof standardizedQ.word === 'string') {
                 standardizedQ.english = standardizedQ.word;
             }
             if (typeof standardizedQ.chinese === 'undefined' && typeof standardizedQ.meaning === 'string') {
                 standardizedQ.chinese = standardizedQ.meaning;
             }
            uniqueQuestionsMap.set(wordKey, standardizedQ);
        }
    });
    // --- Start Debug Logging for uniqueQuestionPool ---
    console.log('[DEBUG] loadQuestionsForGrade: Before Array.from for uniqueQuestionPool. uniqueQuestionsMap size:', uniqueQuestionsMap.size);
    let uniqueQuestionPool; // Declare here
    try {
        uniqueQuestionPool = Array.from(uniqueQuestionsMap.values()); // Assign here
        console.log('[DEBUG] loadQuestionsForGrade: After Array.from. typeof uniqueQuestionPool:', typeof uniqueQuestionPool, '. IsArray:', Array.isArray(uniqueQuestionPool));
        if (uniqueQuestionPool !== null && uniqueQuestionPool !== undefined) {
            console.log('[DEBUG] loadQuestionsForGrade: uniqueQuestionPool.length:', uniqueQuestionPool.length);
            // Avoid stringifying potentially large arrays in every log, only if explicitly needed or if it's small
            if (uniqueQuestionPool.length < 10) {
                 console.log('[DEBUG] loadQuestionsForGrade: uniqueQuestionPool value (small):', JSON.stringify(uniqueQuestionPool));
            }
        } else {
            console.log('[DEBUG] loadQuestionsForGrade: uniqueQuestionPool is null or undefined immediately after Array.from.');
        }

        // 2. Check if enough unique questions exist for the entire session
        // Ensure uniqueQuestionPool is an array before accessing .length
        if (!Array.isArray(uniqueQuestionPool)) {
            console.error('[DEBUG] loadQuestionsForGrade: uniqueQuestionPool is not an array before length check. Forcing to empty array. Value:', uniqueQuestionPool);
            uniqueQuestionPool = []; // Defensive coding
        }

        // 检查题库是否足够，如果不够则调整数量
        if (uniqueQuestionPool.length < totalUniqueQuestionsNeeded) {
            console.warn(`Warning: Not enough unique questions (${uniqueQuestionPool.length}) in Grade ${gradeId} to fulfill the total required for all levels (${totalUniqueQuestionsNeeded}). Adjusting question counts.`);
        }

        // 3. Shuffle the unique pool (ensure it's an array)
        if (Array.isArray(uniqueQuestionPool)) {
            for (let i = uniqueQuestionPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [uniqueQuestionPool[i], uniqueQuestionPool[j]] = [uniqueQuestionPool[j], uniqueQuestionPool[i]];
            }
        } else {
             console.error('[DEBUG] loadQuestionsForGrade: uniqueQuestionPool is not an array before shuffling. Skipping shuffle.');
        }

        console.log('[DEBUG] loadQuestionsForGrade: Before assigning to gameSession.uniqueQuestionPool. typeof uniqueQuestionPool:', typeof uniqueQuestionPool, '. IsArray:', Array.isArray(uniqueQuestionPool));
        if (uniqueQuestionPool === null) {
            console.error('[DEBUG] CRITICAL: uniqueQuestionPool (local variable) is NULL right before spread operator. This is the source of the error.');
            gameSession.uniqueQuestionPool = []; // Fallback to prevent error
        } else if (uniqueQuestionPool === undefined) {
            console.error('[DEBUG] CRITICAL: uniqueQuestionPool (local variable) is UNDEFINED right before spread operator. This would also cause an error.');
            gameSession.uniqueQuestionPool = []; // Fallback to prevent error
        } else if (!Array.isArray(uniqueQuestionPool)) {
            console.error('[DEBUG] CRITICAL: uniqueQuestionPool (local variable) is NOT AN ARRAY right before spread operator. Type:', typeof uniqueQuestionPool, '. Value:', uniqueQuestionPool, '. Fallback to empty array.');
            gameSession.uniqueQuestionPool = []; // Fallback
        }
        else {
            // At this point, uniqueQuestionPool should be a valid array due to preceding checks.
            // Applying proposal: use .slice() and ensure it's an array.
            if (!session) { // Corrected: Use the passed 'session' parameter
                console.error('[DEBUG] CRITICAL: Passed session parameter is NULL right before assigning uniqueQuestionPool via slice.');
                throw new Error("Game session (passed as parameter) lost unexpectedly before processing questions.");
            }
            if (Array.isArray(uniqueQuestionPool)) { // This check should ideally be true here
                session.uniqueQuestionPool = uniqueQuestionPool.slice(); // Use the passed session
            } else {
                // This path indicates a logic flaw if reached, as uniqueQuestionPool should be an array.
                console.error("[DEBUG] Inconsistent state: uniqueQuestionPool not an array or is null/undefined in 'else' block. Forcing to empty on passed session. Value:", uniqueQuestionPool, "Type:", typeof uniqueQuestionPool);
                session.uniqueQuestionPool = []; // Corrected: Use the passed 'session' parameter
            }
        }
        console.log('[DEBUG] loadQuestionsForGrade: After assigning to session.uniqueQuestionPool. Length:', session.uniqueQuestionPool.length);
        console.log('[DEBUG] loadQuestionsForGrade: Successfully completed TRY block for uniqueQuestionPool processing.');

    } catch (error) {
        console.error('[DEBUG] loadQuestionsForGrade: ENTERED CATCH block for uniqueQuestionPool processing.');
        console.error('[DEBUG] loadQuestionsForGrade: Error during uniqueQuestionPool creation, processing, or assignment:', error);
        console.error('[DEBUG] loadQuestionsForGrade: State at error: typeof uniqueQuestionPool:', typeof uniqueQuestionPool, 'uniqueQuestionPool value:', uniqueQuestionPool);
        if (!session) {
            console.error('[DEBUG] CRITICAL: session (passed as parameter) is NULL in catch block when trying to set fallback uniqueQuestionPool.');
            // Not setting session.uniqueQuestionPool as session is null.
            // The original error will be re-thrown.
        } else {
            session.uniqueQuestionPool = []; // Ensure fallback on the passed session
        }
        console.error('[DEBUG] loadQuestionsForGrade: End of CATCH block, about to re-throw error.');
        // It's important to re-throw if the error isn't the one we're trying to catch,
        // or if we want to see the original stack trace.
        // However, for now, let's see if this catch reveals the issue.
        // If the error is "null is not an object", it means uniqueQuestionPool was null before spread.
        // If it's "undefined is not iterable", it means it was undefined.
        // If it's from Array.from itself, this catch block will show it.
        throw error; // Re-throw to ensure the original error isn't masked if it's different
    }
    // --- End Debug Logging for uniqueQuestionPool ---
    console.log('[DEBUG] loadQuestionsForGrade: Successfully EXITED try...catch block for uniqueQuestionPool processing.');

    // 4. 为每个关卡随机分配题目（而不是顺序分配）
    if (!session || !session.questions) { // Use passed session
        console.error("loadQuestionsForGrade: session or session.questions is null before distributing questions to levels. Aborting.");
        throw new Error("Game session state (passed as parameter) corrupted before question distribution.");
    }

    // 计算最终需要的题目数量（考虑题库不足的情况）
    const totalAvailable = session.uniqueQuestionPool.length;
    const finalTotalNeeded = totalNeededL1 + totalNeededL2 + totalNeededL3;

    let finalL1Count = totalNeededL1;
    let finalL2Count = totalNeededL2;
    let finalL3Count = totalNeededL3;

    if (totalAvailable < finalTotalNeeded) {
        // 按比例缩减
        const scaleFactor = totalAvailable / finalTotalNeeded;
        finalL1Count = Math.max(3, Math.floor(totalNeededL1 * scaleFactor));
        finalL2Count = Math.max(3, Math.floor(totalNeededL2 * scaleFactor));
        finalL3Count = Math.max(3, Math.floor(totalNeededL3 * scaleFactor));
        console.log(`%c⚠️ 题库不足，调整后题目数量 - L1: ${finalL1Count}, L2: ${finalL2Count}, L3: ${finalL3Count}`, 'color: #FFA500; font-weight: bold;');
    }

    // 创建题库的副本用于随机抽取
    let availableQuestions = [...session.uniqueQuestionPool];

    // 随机抽取Level 1题目
    session.questions.level1 = [];
    const actualL1Count = Math.min(finalL1Count, availableQuestions.length);
    for (let i = 0; i < actualL1Count; i++) {
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        session.questions.level1.push(availableQuestions.splice(randomIndex, 1)[0]);
    }

    // 随机抽取Level 2题目
    session.questions.level2 = [];
    const actualL2Count = Math.min(finalL2Count, availableQuestions.length);
    for (let i = 0; i < actualL2Count; i++) {
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        session.questions.level2.push(availableQuestions.splice(randomIndex, 1)[0]);
    }

    // 随机抽取Level 3题目
    session.questions.level3 = [];
    const actualL3Count = Math.min(finalL3Count, availableQuestions.length);
    for (let i = 0; i < actualL3Count; i++) {
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        session.questions.level3.push(availableQuestions.splice(randomIndex, 1)[0]);
    }

    if (!session || !session.questions ||
        !session.questions.level1 || !session.questions.level2 || !session.questions.level3) { // Use passed session
         console.error("loadQuestionsForGrade: session or its question levels became null before final log for assigned questions. Aborting log.");
    } else {
        const totalGameQuestions = session.questions.level1.length + session.questions.level2.length + session.questions.level3.length;
        console.log(`%c✅ 最终分配的题目数量: L1=${session.questions.level1.length}, L2=${session.questions.level2.length}, L3=${session.questions.level3.length}`, 'color: #28A745; font-size: 14px; font-weight: bold;');
        console.log(`%c🎮 游戏总题目数: ${totalGameQuestions} (时间戳: ${gameTimestamp})`, 'color: #6F42C1; font-size: 14px; font-weight: bold;');
        console.log(`%c🎆 每次游戏都是不同的随机组合！`, 'color: #FD7E14; font-size: 14px; font-weight: bold;');
    }

    // Final check for Level 1 emptiness (critical)
    if (!session || !session.questions || !session.questions.level1) {  // Use passed session
        console.error(`[DEBUG] State before throwing: session exists: ${!!session}, session.questions exists: ${!!(session && session.questions)}, session.questions.level1 exists: ${!!(session && session.questions && session.questions.level1)}`);
        console.error(`FATAL: session or session.questions.level1 is null when checking Level 1 emptiness. Grade: ${gradeId}. Cannot start game.`);
        throw new Error(`Critical error: Game session state (passed as parameter) corrupted before checking Level 1 questions for grade (${gradeId}).`);
    } else if (session.questions.level1.length === 0) { // Use passed session
        console.error(`[DEBUG] State before throwing: session.questions.level1.length is 0. L1: ${session.questions.level1.length}, L2: ${session.questions.level2 ? session.questions.level2.length : 'N/A'}, L3: ${session.questions.level3 ? session.questions.level3.length : 'N/A'}`);
        console.error(`FATAL: No questions loaded for Level 1 (Grade: ${gradeId}) after attempting unique distribution (using passed session). Cannot start game.`);
        throw new Error(`No questions available for Level 1 for the selected grade (${gradeId}).`);
    }
    // --- End FR No Repeat Logic ---
}

// Get the next question for the current level
function getNextQuestion() {
    if (!gameSession) {
        console.error("getNextQuestion called without an active game session.");
        return null;
    }
    const levelKey = `level${gameSession.currentLevel}`;
    // Ensure the level exists in gameSession.questions
    if (!gameSession.questions || !gameSession.questions[levelKey]) {
        console.error(`Question data for ${levelKey} not loaded in game session.`);
        return null;
    }
    // Use questionNumber as the index for the *next* question
    if (gameSession.questionNumber < gameSession.questions[levelKey].length) {
        // Get the raw question data using the current questionNumber as index
        const rawQuestionData = gameSession.questions[levelKey][gameSession.questionNumber];

        // Standardize the question data format
        let standardizedQuestionData = { ...rawQuestionData }; // Start with a copy of raw data

        // Ensure 'english' is populated from 'word' if 'english' is missing
        if (standardizedQuestionData && typeof standardizedQuestionData.english === 'undefined' && typeof standardizedQuestionData.word === 'string') {
            console.log(`Mapping 'word' (${standardizedQuestionData.word}) to 'english' for Level ${gameSession.currentLevel}`);
            standardizedQuestionData.english = standardizedQuestionData.word;
        }

        // Ensure 'chinese' is populated from 'meaning' if 'chinese' is missing
        if (standardizedQuestionData && typeof standardizedQuestionData.chinese === 'undefined' && typeof standardizedQuestionData.meaning === 'string') {
            console.log(`Mapping 'meaning' (${standardizedQuestionData.meaning}) to 'chinese' for Level ${gameSession.currentLevel}`);
            standardizedQuestionData.chinese = standardizedQuestionData.meaning;
        }

        // Level-specific adjustments after universal mapping
        if (gameSession.currentLevel === 2) {
            // For Level 2, the 'correct' answer is the 'chinese' meaning.
            // This is used by level2.html to determine the correct option among choices.
            if (standardizedQuestionData && typeof standardizedQuestionData.chinese !== 'undefined') {
                standardizedQuestionData.correct = standardizedQuestionData.chinese;
            } else {
                // If 'chinese' is still undefined here, it's an issue with the source data or prior logic.
                console.error(`Level 2 Data Issue: 'chinese' field is undefined. Cannot set 'correct' for question:`, JSON.stringify(standardizedQuestionData));
                // 'correct' will remain undefined, and level2.html is expected to handle or report this error.
            }
            // The error message from the user indicates options are present (`options: Array(4)`).
            // Adding a log for robustness if options were missing.
            // if (!standardizedQuestionData.options || !Array.isArray(standardizedQuestionData.options) || standardizedQuestionData.options.length === 0) {
            //      console.error(`Level 2 Data Issue: 'options' are missing or invalid for question:`, JSON.stringify(standardizedQuestionData));
            // }

            // Generate/overwrite options for Level 2 using the improved logic
            // const currentLevelKey = `level${gameSession.currentLevel}`; // No longer needed for this part
            // const allQuestionsForThisLevel = gameSession.questions[currentLevelKey] || []; // No longer needed for this part
            if (standardizedQuestionData && gameSession.uniqueQuestionPool && gameSession.uniqueQuestionPool.length > 0) { // Check uniqueQuestionPool
                standardizedQuestionData.options = generateOptionsForL2(standardizedQuestionData, gameSession.uniqueQuestionPool); // Pass uniqueQuestionPool
                // gameSession.questionNumber is already incremented, so this log shows the *next* question index
                console.log(`Dynamically generated options for L${gameSession.currentLevel} Q${gameSession.questionNumber} (data for current question):`, standardizedQuestionData.options);
            } else {
                console.warn(`Could not generate L2 options. standardizedQuestionData: ${!!standardizedQuestionData}, uniqueQuestionPool count: ${gameSession.uniqueQuestionPool ? gameSession.uniqueQuestionPool.length : 'undefined'}`);
                // Fallback to empty options or keep existing if any, to avoid errors if generateOptionsForL2 can't run
                standardizedQuestionData.options = standardizedQuestionData.options || [];
            }
        }
        // For other levels, 'correct' might be implicitly defined or handled differently by their respective HTML/JS.
        // The main goal here is to ensure 'english' and 'correct' (derived from 'chinese') are robustly set for Level 2.

        gameSession.currentQuestionData = standardizedQuestionData; // Store the processed data
        gameSession.timeLeft = QUESTION_TIME_LIMIT; // FR06: Reset timer for the new question

        // Increment questionNumber *after* getting the data, ready for the next call
        gameSession.questionNumber++;
        // Reset attempts based on the *new* current level
        gameSession.attemptsLeft = (gameSession.currentLevel === 2) ? 1 : ATTEMPTS_PER_QUESTION_L1_L3;
        console.log(`[MAIN LOG L3_AUDIO] getNextQuestion: Resetting audioPlayedThisTurn for Level ${gameSession.currentLevel}. Previous value: ${gameSession.audioPlayedThisTurn}.`);
    gameSession.audioPlayedThisTurn = false; // Reset audio flag for L3
        console.log(`[MAIN LOG L3_AUDIO] getNextQuestion: audioPlayedThisTurn is now ${gameSession.audioPlayedThisTurn}.`);
        gameSession.timerWarningPlayedThisQuestion = false; // Reset timer warning flag
        console.log(`Next question (L${gameSession.currentLevel} Q${gameSession.questionNumber}):`, gameSession.currentQuestionData); // Log includes the *incremented* number
        return gameSession.currentQuestionData;
    } else {
        console.log(`No more questions for Level ${gameSession.currentLevel}`);
        gameSession.currentQuestionData = null; // Clear current question data
        return null; // No more questions for this level
    }
}

// Generate real options for Level 2, including full meanings
function generateOptionsForL2(correctQuestion, wordBank) {
    if (!correctQuestion || !correctQuestion.chinese || !wordBank || !Array.isArray(wordBank) || wordBank.length === 0) { // Use wordBank and check length
        console.error("generateOptionsForL2: Invalid input or empty wordBank.", { correctQuestion, chinese: correctQuestion?.chinese, wordBankLength: wordBank?.length }); // Use wordBank in log
        // Fallback to simple options if data is bad
        return [
            { display: correctQuestion?.chinese || "错误", value: correctQuestion?.chinese || "错误" },
            { display: "选项 A", value: "选项 A" },
            { display: "选项 B", value: "选项 B" },
            { display: "选项 C", value: "选项 C" }
        ].sort(() => Math.random() - 0.5);
    }

    // Helper to format the display text (e.g., "n. 苹果")
    const formatDisplay = (q) => {
        let text = q.chinese || q.meaning || '';
        // Only add part of speech if there is actual text for the meaning
        if (text && q.pos && !text.startsWith(q.pos + '.')) {
             text = `${q.pos}. ${text}`;
        }
        // If 'text' remains empty here, it means no chinese/meaning was found.
        // .trim() on an empty string is still an empty string.
        return text.trim();
    };

    const correctValue = correctQuestion.chinese; // The value to compare against
    const correctDisplay = formatDisplay(correctQuestion);
    const correctOption = { display: correctDisplay, value: correctValue };

    const options = [correctOption];
    const usedWords = new Set([correctQuestion.english || correctQuestion.word]); // Track used English words to avoid duplicates

    // Filter potential distractors: different word, has Chinese meaning
    const potentialDistractors = wordBank.filter(q => { // Use wordBank
        const qWord = q.english || q.word;
        const qMeaning = q.chinese || q.meaning;

            // Ensure it's a valid meaning, not the correct answer, and not already an option value
            return qWord && qMeaning && qWord !== (correctQuestion.english || correctQuestion.word);
    });

    // Shuffle potential distractors
    for (let i = potentialDistractors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [potentialDistractors[i], potentialDistractors[j]] = [potentialDistractors[j], potentialDistractors[i]];
    }

    // Add 3 unique distractors
    for (const distractor of potentialDistractors) {
        if (options.length >= 4) break;
        const distractorWord = distractor.english || distractor.word;
        if (!usedWords.has(distractorWord)) {
            const distractorValue = distractor.chinese || distractor.meaning;
            const distractorDisplay = formatDisplay(distractor);
            // Ensure the display text is not empty before adding the option
            if (distractorDisplay) {
                options.push({ display: distractorDisplay, value: distractorValue });
                usedWords.add(distractorWord);
            } else {
                // Log if a distractor is skipped due to empty meaning
                console.warn(`L2 Options: Skipped distractor candidate "${distractor.english || distractor.word}" due to empty meaning.`);
            }
        }
    }

    // Fallback if not enough distractors were found from *different words*
    if (options.length < 4) {
        // Gather all possible unique meanings from the current level's questions,
        // excluding the correct answer's meaning and meanings already chosen.
        const alternativeOptions = [];
        const currentOptionValues = new Set(options.map(opt => opt.value));

        for (const q of wordBank) { // Use wordBank instead of allLevelQuestions
            const qMeaning = q.chinese || q.meaning;

            // Ensure it's a valid meaning, not the correct answer, and not already an option value
            if (qMeaning && qMeaning !== correctValue && !currentOptionValues.has(qMeaning)) {
                const altDisplay = formatDisplay(q);
                // Ensure the display text is not empty before adding to alternativeOptions
                if (altDisplay) {
                    alternativeOptions.push({
                        display: altDisplay,
                        value: qMeaning
                    });
                    currentOptionValues.add(qMeaning); // Add to set to prevent duplicates in this pass
                } else {
                    // Log if an alternative option candidate is skipped
                    console.warn(`L2 Options: Skipped alternative candidate "${q.english || q.word}" due to empty meaning.`);
                }
            }
        }

        // Shuffle these alternative options
        for (let i = alternativeOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [alternativeOptions[i], alternativeOptions[j]] = [alternativeOptions[j], alternativeOptions[i]];
        }

        // Add from these alternatives until options array has 4 items or alternatives are exhausted
        for (const altOpt of alternativeOptions) {
            if (options.length >= 4) break;
            options.push(altOpt);
        }
    }

    // Ensure 4 options by adding generic ones if needed
    let genericOptionCounter = 1;
    const existingValuesForGeneric = new Set(options.map(opt => opt.value)); // Use a different name to avoid conflict if existingValues is used elsewhere

    while (options.length < 4) {
        let genericDisplay = `干扰选项 ${genericOptionCounter}`;
        let genericValue = `干扰选项 ${genericOptionCounter}`;

        // Ensure the generic option value is unique and not the correct answer
        // Also ensure it's not one of the already added options
        while (existingValuesForGeneric.has(genericValue) || genericValue === correctValue) {
            genericOptionCounter++;
            genericDisplay = `干扰选项 ${genericOptionCounter}`;
            genericValue = `干扰选项 ${genericOptionCounter}`;
        }

        options.push({ display: genericDisplay, value: genericValue });
        existingValuesForGeneric.add(genericValue); // Add to set to check for next generic option
        // No need to increment genericOptionCounter here as it's done in the while loop if needed
    }

    // Shuffle the final options array
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

    console.log("Generated L2 options:", options);
    return options;
}
// --- Timer Logic ---

function startTimer() {
    if (!gameSession) {
        console.error("startTimer called without an active game session.");
        return;
    }
    stopTimer(gameSession); // Clear any existing timer for this session
    // Only reset timeLeft if it's not a positive value (indicating a continuing timer)
    // or if it was already at QUESTION_TIME_LIMIT (e.g. fresh start after full duration)
    // This ensures that if startTimer is called and timeLeft holds a valid continuing value, it's preserved.
    if (!gameSession.timeLeft || gameSession.timeLeft <= 0 || gameSession.timeLeft === QUESTION_TIME_LIMIT) {
        gameSession.timeLeft = QUESTION_TIME_LIMIT;
    }
    gameSession.questionStartTime = Date.now();
    sendMessageToIframe('updateTimer', { seconds: gameSession.timeLeft }); // Initial display

    // Store interval ID in the session
    gameSession.timerIntervalId = setInterval(() => {
        if (!gameSession) { // Check if session was cleared during interval
             stopTimer(null); // Attempt to clear interval if session is gone
             return;
        }
        gameSession.timeLeft--;
        sendMessageToIframe('updateTimer', { seconds: gameSession.timeLeft });

        // --- Timer Warning Logic ---
        if (gameSession.timeLeft <= 5 && gameSession.timeLeft > 0) {
            sendMessageToIframe('setTimerWarning', { warning: true });
            // Play warning sound only once when timeLeft hits 5 seconds
            if (gameSession.timeLeft === 5 && !gameSession.timerWarningPlayedThisQuestion) {
                playSound('timer_tick_warn');
                gameSession.timerWarningPlayedThisQuestion = true;
            }
        } else {
            sendMessageToIframe('setTimerWarning', { warning: false });
            // No need to reset timerWarningPlayedThisQuestion here,
            // it's reset when a new question loads.
        }
        // --- End Timer Warning Logic ---

        if (gameSession.timeLeft <= 0) {
            handleTimeout(); // handleTimeout will use gameSession
        }
    }, 1000);
}

function stopTimer(session) {
    // Accepts a session object (or null) to clear its specific timer
    if (session && session.timerIntervalId) {
        clearInterval(session.timerIntervalId);
        session.timerIntervalId = null;
        // Ensure warning state is cleared when timer stops explicitly
        sendMessageToIframe('setTimerWarning', { warning: false });
        // console.log("Timer stopped for session.");
    } else if (!session) {
         // If called with null (e.g., during cleanup), log differently or do nothing silently
         // console.log("stopTimer called with null session, no active timer to stop or session invalid.");
    }
}

function handleTimeout() {
    if (!gameSession) {
        console.error("handleTimeout called without an active game session.");
        return;
    }
    console.log("Question timed out!");
    stopTimer(gameSession); // Stop the timer (this will also send warning: false)
    playSound('timeout'); // Play timeout sound

    // Disable input/options in iframe based on session state
    if (gameSession.currentLevel === 1 || gameSession.currentLevel === 3) {
        sendMessageToIframe('disableConfirm');
    } else if (gameSession.currentLevel === 2) {
        sendMessageToIframe('disableOptions');
    }

    // Record wrong answer (TIMEOUT) - recordWrongAnswer will need session access later
    recordWrongAnswer('TIMEOUT');

    // Process timeout as an incorrect answer
    // For L2, timeout immediately fails the question.
    // For L1/L3, timeout uses up all remaining attempts.
    gameSession.attemptsLeft = 0; // Mark all attempts as used on timeout in the session
    // processAnswerResult will need session access later
    processAnswerResult(false); // Treat timeout as incorrect
}


// --- Answer Checking and Game Progression ---

function checkAnswer(level, userAnswer) {
    // Use gameSession for checks and state modification
    if (!gameSession || !gameSession.currentQuestionData) {
        console.error("checkAnswer called without active session or current question data.");
        playSound('error');
        return;
    }

    // Stop the timer. stopTimer now handles sending warning: false
    stopTimer(gameSession);

    const currentQuestion = gameSession.currentQuestionData;
    console.log(`Entering checkAnswer for Level ${level}. Received userAnswer:`, userAnswer, typeof userAnswer);
    console.log('Current Question Data before check:', currentQuestion);

    // Validate correct answer format from currentQuestionData within gameSession
    const correctAnswerL1L3 = currentQuestion.english;
    const correctAnswerL2 = currentQuestion.chinese;

    if (level === 1 || level === 3) {
        if (correctAnswerL1L3 === null || correctAnswerL1L3 === undefined || typeof correctAnswerL1L3 !== 'string') {
            console.error(`checkAnswer L${level}: Correct answer (english) is invalid in currentQuestionData:`, currentQuestion);
            playSound('error');
            return;
        }
    }
    if (level === 2) {
         if (correctAnswerL2 === null || correctAnswerL2 === undefined || typeof correctAnswerL2 !== 'string') {
             console.error(`checkAnswer L2: Correct answer (chinese) is invalid in currentQuestionData:`, currentQuestion);
             playSound('error');
             return;
         }
    }

    // Ensure userAnswer is a string
    const safeUserAnswer = (typeof userAnswer === 'string') ? userAnswer : '';

    let isCorrect = false;
    console.log(`Checking L${level} Answer: User='${safeUserAnswer}', Correct='${level === 2 ? correctAnswerL2 : correctAnswerL1L3}'`);

    if (level === 1 || level === 3) {
        isCorrect = safeUserAnswer.trim().toLowerCase() === correctAnswerL1L3.trim().toLowerCase();
    } else if (level === 2) {
        isCorrect = safeUserAnswer === correctAnswerL2;
        console.log(`[L2 Check] userAnswer: "${safeUserAnswer}", correctAnswerL2: "${correctAnswerL2}", isCorrect: ${isCorrect}`); // DEBUG
    }

    // Store user answer in session's current question data
    gameSession.currentQuestionData.lastUserAnswer = userAnswer;

    // Handle attempts for L1/L3 using gameSession
    if (level === 1 || level === 3) {
        if (!isCorrect) {
            gameSession.attemptsLeft--; // Modify session state
            if (gameSession.attemptsLeft > 0) {
                // Incorrect, but has more attempts
                playSound('incorrect');
                sendMessageToIframe('showFeedback', {
                    isCorrect: false,
                    title: "❌ 回答错误",
                    message: `剩余 ${gameSession.attemptsLeft} 次机会`,
                    attemptsLeft: gameSession.attemptsLeft,
                    clearInput: true
                });
                sendMessageToIframe('enableConfirm');
                if (level === 3) {
                    sendMessageToIframe('enablePlayButton');
                    console.log(`[MainJS] processAnswerResult: Resetting audioPlayedThisTurn to false. Current level: ${gameSession.currentLevel}. Previous value: ${gameSession.audioPlayedThisTurn}`);
    gameSession.audioPlayedThisTurn = false; // Modify session state
                }
                startTimer(); // Restart timer if attempts are left
                return; // Wait for next attempt
            } else {
                // Incorrect, and no attempts left
                recordWrongAnswer(userAnswer); // Record final wrong answer (uses session)
            }
        }
        // If correct, fall through to processAnswerResult
    } else { // Level 2
         if (!isCorrect) {
              recordWrongAnswer(userAnswer); // Record wrong answer for L2 (uses session)
         }
    }


    // If code reaches here, the question attempt is final (correct, or incorrect with no attempts left)
    processAnswerResult(isCorrect); // processAnswerResult will use session
}

function processAnswerResult(isCorrect) {
    // Use gameSession for checks and state modification
    if (!gameSession || !gameSession.currentQuestionData) {
        console.error("processAnswerResult called without active session or current question data.");
        return;
    }
    console.log(`Processing final answer result: ${isCorrect ? 'Correct' : 'Incorrect'}`);
    playSound(isCorrect ? 'correct' : 'incorrect_final');

    const currentQuestion = gameSession.currentQuestionData;
    const levelKey = `level${gameSession.currentLevel}`;

    // Send final feedback for the question using session data
    const feedbackPayload = {
        isCorrect: isCorrect,
        message: isCorrect ? "回答正确！" : "回答错误！",
        // attemptsLeft will be added conditionally below
        // For L2, ONLY send correct answer if user WAS correct (FR Feedback Adjustment)
        ...(gameSession.currentLevel === 2 && {
            correctAnswer: isCorrect ? currentQuestion.chinese : null, // Only send if correct
            selectedAnswer: currentQuestion.lastUserAnswer
        })
    };
    console.log('[ProcessAnswerResult] FeedbackPayload to be sent:', JSON.stringify(feedbackPayload)); // DEBUG

    // Add attemptsLeft ONLY for incorrect answers in L1/L3 when attempts remain
    if (!isCorrect && (gameSession.currentLevel === 1 || gameSession.currentLevel === 3) && gameSession.attemptsLeft > 0) {
        feedbackPayload.attemptsLeft = gameSession.attemptsLeft;
        feedbackPayload.title = "❌ 回答错误"; // Set title for L1/L3 incorrect
        feedbackPayload.message = `剩余 ${gameSession.attemptsLeft} 次机会`; // Set message for L1/L3 incorrect
    }

    sendMessageToIframe('showFeedback', feedbackPayload);


    if (isCorrect) {
        gameSession.score[levelKey]++; // Modify session state
        gameSession.totalScore++; // Modify session state
    }

    // Check for immediate level pass/fail conditions using session data
    const config = adminConfig[levelKey]; // Global config is okay
    const targetScoreNeeded = (config && typeof config.targetScore === 'number' && config.targetScore > 0) ? config.targetScore : 1;
    // Safely access questions length from session
    const questionsInLevel = (gameSession.questions && gameSession.questions[levelKey]) ? gameSession.questions[levelKey].length : 0;
    const questionsAnswered = gameSession.questionNumber; // Use session state (already incremented)
    const questionsRemaining = questionsInLevel - questionsAnswered;

    console.log(`Level ${gameSession.currentLevel} Status: Score=${gameSession.score[levelKey]}, Target=${targetScoreNeeded}, Answered=${questionsAnswered}, Total=${questionsInLevel}, Remaining=${questionsRemaining}`);


    // Condition 1: Already met target score? (FR07)
    if (gameSession.score[levelKey] >= targetScoreNeeded) {
        console.log(`Level ${gameSession.currentLevel} passed! (Target reached)`);
        playSound('level_win');
        // Delay slightly after feedback, then advance (advanceLevel will use session)
        setTimeout(advanceLevel, 1800);
        return;
    }

    // Condition 2: Have all questions been answered? (If so, and target not met, level failed)
    if (questionsAnswered >= questionsInLevel) {
         console.log(`Level ${gameSession.currentLevel} failed! (All questions answered, target not reached)`);
         playSound('level_lose');
         // showGameResults will use session
         setTimeout(() => showGameResults(false), 1800);
         return;
    }


    // Condition 3: Impossible to meet target score even if all remaining are correct? (FR07)
    const maxPossibleScore = gameSession.score[levelKey] + questionsRemaining;
    if (maxPossibleScore < targetScoreNeeded) {
        console.log(`Level ${gameSession.currentLevel} failed! (Impossible to reach target)`);
        playSound('level_lose');
        // Delay slightly, then end the challenge as failed (showGameResults will use session)
        setTimeout(() => showGameResults(false), 1800);
        return;
    }

    // If neither pass nor fail condition met yet, load the next question (loadNextQuestion will use session)
    setTimeout(loadNextQuestion, 1800);
}

function loadNextQuestion() {
    if (typeof stopSound === 'function') {
        stopSound('timer_tick_warn'); // Stop warning sound when moving to next question
    } else {
        console.warn('stopSound function not found, cannot stop timer_tick_warn.');
    }
    // Uses gameSession implicitly via getNextQuestion, startTimer, sendDisplayUpdate
    if (!gameSession) {
        console.error("loadNextQuestion called without an active game session.");
        return;
    }
    // getNextQuestion already updates gameSession.currentQuestionData and increments questionNumber
    const question = getNextQuestion();

    if (question) {
        // Prepare payload based on session level and question data
        let payload = {};
        if (gameSession.currentLevel === 1) {
            // Level 1 expects { word, meaning } based on typical JSON structure
            payload = { english: question.word, chinese: question.meaning };
        } else if (gameSession.currentLevel === 2) {
            // Level 2 expects { english, options, correct }
            // Pass the current question object and all questions for the level to generate options
            const levelKey = `level${gameSession.currentLevel}`;
            const allQuestionsForLevel = gameSession.questions[levelKey] || [];
            payload = {
                english: question.english,
                options: generateOptionsForL2(question, gameSession.uniqueQuestionPool), // Pass uniqueQuestionPool for L2 options
                correct: question.chinese // Keep correct as the string for comparison
            };
        } else if (gameSession.currentLevel === 3) {
            // Level 3 expects { english }
             payload = { english: question.english }; // Ensure 'english' is correctly mapped if source uses 'word'
        }

        // Send display update (will need refactoring for session) and the new question
        sendDisplayUpdate();
        sendMessageToIframe('showQuestion', payload);
        startTimer(); // Uses gameSession

    } else {
        // This fallback logic should ideally not be reached if processAnswerResult is correct.
        console.warn(`loadNextQuestion called but no more questions available or level already decided.`);
        const levelKey = `level${gameSession.currentLevel}`;
        const config = adminConfig[levelKey];
        const targetScoreNeeded = (config && typeof config.targetScore === 'number' && config.targetScore > 0) ? config.targetScore : 1;
        if (gameSession.score[levelKey] >= targetScoreNeeded) {
             console.log(`Level ${gameSession.currentLevel} ended (fallback - passed).`);
             advanceLevel(); // Uses gameSession
        } else {
             console.log(`Level ${gameSession.currentLevel} ended (fallback - failed).`);
             showGameResults(false); // Uses gameSession
        }
    }
}

function advanceLevel() {
    if (!gameSession) {
        console.error("advanceLevel called without an active game session.");
        return;
    }
    stopTimer(gameSession); // Stop timer for the current session
    gameSession.currentLevel++; // Modify session state
    if (gameSession.currentLevel <= LEVEL_COUNT) {
        console.log(`Advancing to Level ${gameSession.currentLevel}`);
        gameSession.questionNumber = 0; // Reset question number in session
        gameSession.levelStartTime = Date.now(); // Optionally track level start time
        // Navigate to the next level's screen
        if (typeof navigateTo === 'function') {
             navigateTo(`level${gameSession.currentLevel}`);
        } else {
             console.error("navigateTo function not found in index.html scope!");
        }
        // Data request ('requestLevelData') will be handled by the message listener,
        // which will then call loadLevelData (needs refactoring for session).
    } else {
        // All levels completed successfully
        console.log("Challenge complete!");
        showGameResults(true); // Uses gameSession
    }
}

function showGameResults(success) {
    if (!gameSession) {
        console.error("showGameResults called without an active game session.");
        // Maybe navigate home or show an error?
        if (window.parent && typeof window.parent.navigateTo === 'function') {
             window.parent.navigateTo('welcome');
        } else if (typeof navigateTo === 'function') { // Fallback for direct testing
             navigateTo('welcome');
        }
        return;
    }
    stopTimer(gameSession); // Stop timer for the session
    gameSession.isFinished = true; // Modify session state
    gameSession.challengeSuccess = success; // Modify session state
    // Calculate total time based on session start time
    gameSession.totalGameTimeSeconds = Math.floor((Date.now() - gameSession.gameStartTime) / 1000);

    console.log(`Game ended. Success: ${success}, Time: ${gameSession.totalGameTimeSeconds}s`);
    playSound(success ? 'challenge_win' : 'challenge_lose');

    // Calculate total questions presented based on adminConfig
    let totalQuestionsConfigured = 0;
    if (adminConfig && adminConfig.level1 && adminConfig.level2 && adminConfig.level3) {
        totalQuestionsConfigured = (adminConfig.level1.totalQuestions || 0) +
                                   (adminConfig.level2.totalQuestions || 0) +
                                   (adminConfig.level3.totalQuestions || 0);
    } else {
        console.warn("Admin config not fully loaded for showGameResults, total questions might be based on defaults or session actuals.");
        // Fallback to sum of questions actually loaded if adminConfig is problematic
        totalQuestionsConfigured = (gameSession.questions.level1?.length || 0) +
                                   (gameSession.questions.level2?.length || 0) +
                                   (gameSession.questions.level3?.length || 0);
        if (totalQuestionsConfigured === 0) totalQuestionsConfigured = 30; // Absolute fallback
    }

    // Prepare results payload for the new result screens
    const totalIncorrectAnswers = gameSession.wrongAnswers.length;
    const totalAnsweredQuestions = gameSession.totalScore + totalIncorrectAnswers;

    const resultsPayloadForStorage = {
        // success: gameSession.challengeSuccess, // This is implicit in which page is loaded
        nickname: gameSession.nickname,
        grade: gameSession.grade,
        gradeName: gameSession.gradeName, // 添加 gradeName
        correctAnswers: gameSession.totalScore,
        totalQuestions: totalAnsweredQuestions, // Total questions actually answered
        timeTaken: formatTime(gameSession.totalGameTimeSeconds),
        wrongAnswers: gameSession.wrongAnswers.map(wa => ({ // Ensure consistent naming with new HTML
            level: wa.level,
            question: wa.questionPrompt, // Changed from questionText to questionPrompt based on recordWrongAnswer
            correctAnswer: wa.correctAnswer,
            userAnswer: wa.userAnswer
        }))
    };

    // Store results in localStorage to be picked up by the new result screens
    try {
        localStorage.setItem('challengeResults', JSON.stringify(resultsPayloadForStorage));
        console.log("Challenge results saved to localStorage for new result pages:", resultsPayloadForStorage);
    } catch (e) {
        console.error("Failed to save challenge results to localStorage:", e);
    }

    // Navigate to the new success or failure screen using parent's navigation
    const targetScreen = success ? 'result_success' : 'result_failure';

    if (window.parent && typeof window.parent.navigateTo === 'function') {
        window.parent.navigateTo(targetScreen);
    } else if (typeof navigateTo === 'function') { // Fallback for direct testing
         console.warn("Navigating directly within main.js context (likely testing).");
         navigateTo(targetScreen);
    } else {
        console.error("navigateTo function not found in parent or current scope!");
    }

    // Sounds are now played by the result_success/failure.html pages upon loading. // Roo: This comment might be outdated after adding sounds here.
    // gameSession = null; // Consider resetting gameSession after results are shown or on navigating back to welcome
}

// Record wrong answer details
function recordWrongAnswer(userAnswer) {
    // Use gameSession for checks and state modification
    if (!gameSession || !gameSession.currentQuestionData) {
        console.error("recordWrongAnswer called without active session or current question data.");
        return;
    }
    const currentQuestion = gameSession.currentQuestionData;

     let prompt = '';
     let correctAnswer = '';
     // Determine prompt/answer based on session level and question data
     if (gameSession.currentLevel === 1) {
         prompt = currentQuestion.chinese;
         correctAnswer = currentQuestion.english;
     } else if (gameSession.currentLevel === 2) {
         prompt = currentQuestion.english;
         correctAnswer = currentQuestion.chinese;
     } else if (gameSession.currentLevel === 3) {
         prompt = "听写"; // Keep existing logic for L3 prompt
         correctAnswer = currentQuestion.english;
     }

     // Push to session's wrongAnswers array
     gameSession.wrongAnswers.push({
         level: gameSession.currentLevel,
         questionPrompt: prompt,
         correctAnswer: correctAnswer,
         userAnswer: userAnswer // Could be 'TIMEOUT' or the actual wrong input
     });
     // Log using session data
     console.log("Recorded wrong answer:", gameSession.wrongAnswers[gameSession.wrongAnswers.length - 1]);
}


// --- Message Handling from Iframes ---

// Temporary storage for user info before game starts
let tempUserInfo = { nickname: null, grade: null, gradeName: null };

window.addEventListener('message', (event) => {
    // Basic security check (use specific origin in production)
    // if (event.origin !== window.location.origin) {
    //     console.warn(`Message received from unexpected origin: ${event.origin}`);
    //     return;
    // }

    const messageData = event.data;

    console.log("Main received message:", messageData); // Debugging

    // Resume audio context on first user interaction potentially
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }

    // Ensure messageData and action exist
    if (!messageData || !messageData.action) {
        console.warn("Received message without action:", messageData);
        return;
    }

    switch (messageData.action) {
        // User Info & Game Start
        case 'setUserInfo':
            // Store user info temporarily. Initialization happens on 'navigate' to level1.
            if (messageData.nickname !== undefined && messageData.grade !== undefined && messageData.gradeName !== undefined) {
                tempUserInfo = { nickname: messageData.nickname, grade: messageData.grade, gradeName: messageData.gradeName };
                console.log("Temp user info set (with gradeName):", tempUserInfo);
            } else {
                console.warn("Received setUserInfo message with missing data:", messageData);
            }
            break;
        case 'navigate': // Handle navigation requests
            console.log(`Navigation requested by iframe to: ${messageData.screen}`);
            // Check if starting Level 1 and game session doesn't exist or is finished
            if (messageData.screen === 'level1' && (!gameSession || gameSession.isFinished)) {
                 // Ensure temporary user info is set before starting
                 if (tempUserInfo.nickname && tempUserInfo.grade) {
                    // Use an async IIFE to handle async operations
                    (async () => {
                        try {
                            // Initialize audio context first
                            if (typeof initAudioContext === 'function' && typeof preloadSounds === 'function') {
                                try {
                                    await initAudioContext();
                                    console.log('Audio context initialized successfully on level 1 navigation.');
                                    await preloadSounds();
                                    console.log('Sounds preloading initiated/completed.');
                                } catch (audioError) {
                                    console.error('Audio initialization or preloading failed:', audioError);
                                }
                            } else {
                                console.warn('Audio functions not found.');
                            }

                            // Initialize game session using tempUserInfo
                            console.log(`%c🚀 [RANDOM SYSTEM] About to initialize game with user info:`, 'color: #9C27B0; font-size: 14px; font-weight: bold;', tempUserInfo);
                            initializeGame(tempUserInfo); // Creates gameSession and starts question loading

                            // Wait for questions to load (promise is stored in gameSession)
                            console.log(`%c⏳ [RANDOM SYSTEM] Waiting for questions to load before navigating...`, 'color: #FF5722; font-size: 14px; font-weight: bold;');
                            if (gameSession && gameSession.questionLoadPromise) {
                                await gameSession.questionLoadPromise;
                                console.log("Questions loaded successfully. Proceeding with navigation.");
                                // 清除 promise 以避免重复等待
                                gameSession.questionLoadPromise = null;
                            } else {
                                throw new Error("Question loading promise not found in game session.");
                            }

                            playSound('confirm'); // Play confirm sound after successful init and load

                            // Trigger navigation
                            if (window.self !== window.top && typeof window.parent.navigateTo === 'function') {
                                window.parent.navigateTo('level1');
                            } else if (typeof navigateTo === 'function') {
                                 navigateTo('level1');
                            } else {
                                console.error("Cannot navigate: navigateTo function not found.");
                            }
                             // playSound('confirm'); // Moved up

                        } catch (error) {
                            console.error("Error during game initialization or question loading:", error);

                            // 特殊处理离线错误
                            let errorMessage = error.message || '加载题目失败';
                            if (error.message && error.message.includes('当前处于离线状态')) {
                                errorMessage = '您当前处于离线状态，无法加载新的题库数据。\n\n请检查网络连接后重试，或者在有网络时先访问一次游戏以缓存数据。';
                            }

                            // Handle error - show message on info_input screen
                            if (screenFrame.contentWindow && screenFrame.src.includes('info_input.html')) {
                                sendMessageToIframe('showError', { message: `无法开始游戏：${errorMessage}` });
                            } else {
                                alert(`无法开始游戏：${errorMessage}`);
                                if (typeof navigateTo === 'function') navigateTo('welcome');
                            }
                            playSound('error'); // Play error sound on failure
                            // Reset gameSession if initialization failed partially
                            gameSession = null;
                        }
                    })();
                 } else {
                     console.error("Cannot start game: User info not set (tempUserInfo empty).");
                     if (typeof navigateTo === 'function') navigateTo('info_input');
                 }
            } else if (messageData.screen) {
                 // Handle other navigation requests
                 if (window.self !== window.top && typeof window.parent.navigateTo === 'function') {
                     window.parent.navigateTo(messageData.screen);
                     playSound('click'); // Play click for general navigation
                 } else if (typeof navigateTo === 'function') {
                     navigateTo(messageData.screen);
                     playSound('click'); // Play click for general navigation
                 } else {
                      console.error(`Cannot navigate to ${messageData.screen}: navigateTo function not found.`);
                 }
            } else {
                 console.warn("Received navigate message without screen:", messageData);
            }
            break; // End navigate case

        // In-Game Actions
        case 'requestLevelData':
             // Ensure game session exists and has a current level
            if (!gameSession || !gameSession.currentLevel) {
                 console.warn("Game session not initialized, cannot load level data yet.");
                 return;
            }
            // Check if level data exists in message
            if (messageData.level !== undefined) {
                // Pass the session to loadLevelData
                loadLevelData(messageData.level);
            } else {
                console.error("Received requestLevelData message without level:", messageData);
            }
            break;
        case 'checkAnswerL1':
        case 'checkAnswerL2':
        case 'checkAnswerL3':
            // Centralized answer checking logic
            // Try to get answer from payload first (for L3 and future consistency),
            // then fallback to direct answer (for L1/L2 or older L3 implementations)
            const userAnswer = (messageData.payload && messageData.payload.answer !== undefined)
                               ? messageData.payload.answer
                               : messageData.answer;

            if (userAnswer !== undefined) {
                const levelMap = { 'checkAnswerL1': 1, 'checkAnswerL2': 2, 'checkAnswerL3': 3 };
                const level = levelMap[messageData.action];
                // userAnswer is already defined above

                // **Strict Validation using gameSession:**
                if (gameSession && gameSession.currentQuestionData) {
                    const currentQuestion = gameSession.currentQuestionData;
                    let isValid = false;
                    if (level === 1 || level === 3) {
                        isValid = typeof currentQuestion.english === 'string' && currentQuestion.english.trim();
                    } else if (level === 2) {
                        isValid = typeof currentQuestion.chinese === 'string' && currentQuestion.chinese.trim();
                    }

                    if (isValid) {
                        console.log(`[L${level}] Data valid, proceeding to check answer:`, userAnswer);
                        checkAnswer(level, userAnswer); // Uses gameSession internally now
                    } else {
                        console.error(`[L${level}] PREVENTED checkAnswer call: currentQuestionData in session is invalid or missing required field. Data:`, currentQuestion);
                        playSound('error');
                    }
                } else {
                     console.error(`[L${level}] PREVENTED checkAnswer call: gameSession or currentQuestionData is missing.`);
                     playSound('error');
                }
            } else {
                 console.error(`Received ${messageData.action} message without answer in payload or directly:`, messageData);
            }
            break;
         case 'playQuestionAudioL3':
            console.log(`[MainJS_L3_AUDIO_DEBUG] Message received: playQuestionAudioL3. Current level: ${gameSession ? gameSession.currentLevel : 'N/A'}, audioPlayedThisTurn (before): ${gameSession ? gameSession.audioPlayedThisTurn : 'N/A'}`);
            if (!gameSession) {
                console.error("[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: No active game session. Ignoring.");
                sendMessageToIframe('setPlayButtonState', { disabled: false, isPlaying: false }); // Try to re-enable button
                sendMessageToIframe('audioPlayError', { message: 'No game session for audio.'});
                break;
            }
            if (gameSession.currentLevel !== 3) {
                console.warn("[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3 message received but not in Level 3. Ignoring.");
                sendMessageToIframe('setPlayButtonState', { disabled: false, isPlaying: false }); // Try to re-enable button
                break;
            }

            // Indicate that audio is about to play or is playing
            sendMessageToIframe('setPlayButtonState', { disabled: true, isPlaying: true });
            console.log('[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: Sent setPlayButtonState (disabled: true, isPlaying: true) to iframe.');

            // 检查是否为自动播放，只在自动播放时设置 audioPlayedThisTurn
            const isAutoPlay = messageData.payload && messageData.payload.isAutoPlay;
            console.log(`[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: isAutoPlay: ${isAutoPlay}, audioPlayedThisTurn: ${gameSession.audioPlayedThisTurn}`);

            // 如果是自动播放且已经播放过，则跳过
            if (isAutoPlay && gameSession.audioPlayedThisTurn) {
                console.log("[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: Auto-play skipped - audio already played this turn.");
                sendMessageToIframe('setPlayButtonState', { disabled: false, isPlaying: false });
                return;
            }

            // 如果是自动播放，设置 audioPlayedThisTurn 为 true
            if (isAutoPlay) {
                gameSession.audioPlayedThisTurn = true;
                console.log(`[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: Set audioPlayedThisTurn to true for auto-play.`);
            }

            if (gameSession.currentQuestionData && (gameSession.currentQuestionData.word || gameSession.currentQuestionData.english)) {
                const wordToSpeak = gameSession.currentQuestionData.word || gameSession.currentQuestionData.english;
                console.log(`[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: Word to speak: '${wordToSpeak}'.`);

                if (typeof window.playWordWithTTS === 'function') {
                    console.log(`[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: Calling window.playWordWithTTS for '${wordToSpeak}'.`);

                    let ttsWatchdogTimerId = null;
                    const TTS_TIMEOUT_MS = 7000; // 7 seconds

                    const handleTtsEnd = () => {
                        console.log(`[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: TTS finished for '${wordToSpeak}'.`);
                        console.log(`[MainJS_L3_AUDIO_DEBUG] handleTtsEnd: Checking screenFrame before sending message. screenFrame: ${screenFrame ? 'exists' : 'null'}, contentWindow: ${screenFrame && screenFrame.contentWindow ? 'exists' : 'null'}`);
                        sendMessageToIframe('setPlayButtonState', { disabled: false, isPlaying: false });
                        console.log('[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: Sent setPlayButtonState (disabled: false, isPlaying: false) after TTS ended.');
                    };

                    const handleTtsError = (error) => {
                        console.error(`[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: TTS error for '${wordToSpeak}':`, error);
                        let errorDetails = (typeof error === 'string') ? error : (error ? (error.error || error.message || JSON.stringify(error)) : 'Unknown TTS error');
                        console.log(`[MainJS_L3_AUDIO_DEBUG] handleTtsError: Checking screenFrame before sending message. screenFrame: ${screenFrame ? 'exists' : 'null'}, contentWindow: ${screenFrame && screenFrame.contentWindow ? 'exists' : 'null'}`);
                        const playButtonStatePayload = { disabled: false, isPlaying: false };
                        const audioErrorPayload = { message: `TTS error: ${errorDetails}`, details: error };
                        console.log('[MainJS_L3_AUDIO_DEBUG] handleTtsError: Attempting to send setPlayButtonState with payload:', JSON.stringify(playButtonStatePayload));
                        sendMessageToIframe('setPlayButtonState', playButtonStatePayload);
                        console.log('[MainJS_L3_AUDIO_DEBUG] handleTtsError: Attempting to send audioPlayError with payload:', JSON.stringify(audioErrorPayload));
                        sendMessageToIframe('audioPlayError', audioErrorPayload);
                        console.log('[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: Finished sending setPlayButtonState and audioPlayError after TTS error.');
                    };

                    const wrappedTtsOnEnd = () => {
                        console.log(`[MainJS_L3_AUDIO_DEBUG] wrappedTtsOnEnd: Attempting to clear watchdog. Current ttsWatchdogTimerId: ${ttsWatchdogTimerId}`);
                        if (ttsWatchdogTimerId) {
                            clearTimeout(ttsWatchdogTimerId);
                            console.log(`[MainJS_L3_AUDIO_DEBUG] wrappedTtsOnEnd: Cleared ttsWatchdogTimerId: ${ttsWatchdogTimerId}`);
                        }
                        ttsWatchdogTimerId = null;
                        console.log(`[MainJS_L3_AUDIO_DEBUG] wrappedTtsOnEnd: ttsWatchdogTimerId set to null.`);
                        console.log(`[MainJS_L3_AUDIO_DEBUG] Wrapped ttsOnEnd called for '${wordToSpeak}'.`);
                        handleTtsEnd();
                    };

                    const wrappedTtsOnError = (error) => {
                        console.log(`[MainJS_L3_AUDIO_DEBUG] wrappedTtsOnError: Attempting to clear watchdog. Current ttsWatchdogTimerId: ${ttsWatchdogTimerId}`);
                        if (ttsWatchdogTimerId) {
                            clearTimeout(ttsWatchdogTimerId);
                            console.log(`[MainJS_L3_AUDIO_DEBUG] wrappedTtsOnError: Cleared ttsWatchdogTimerId: ${ttsWatchdogTimerId}`);
                        }
                        ttsWatchdogTimerId = null;
                        console.log(`[MainJS_L3_AUDIO_DEBUG] wrappedTtsOnError: ttsWatchdogTimerId set to null.`);
                        console.log(`[MainJS_L3_AUDIO_DEBUG] Wrapped ttsOnError called for '${wordToSpeak}'.`);
                        handleTtsError(error);
                    };

                    // Clear any previous watchdog timer if one was somehow set and not cleared
                    if (ttsWatchdogTimerId) clearTimeout(ttsWatchdogTimerId);
                    ttsWatchdogTimerId = null; // Ensure it's null before setting a new one

                    ttsWatchdogTimerId = setTimeout(() => {
                        console.warn(`[MainJS_L3_AUDIO_DEBUG] TTS watchdog timed out for '${wordToSpeak}' after ${TTS_TIMEOUT_MS}ms. Forcing button re-enable and error reporting.`);
                        ttsWatchdogTimerId = null; // Mark as fired
                        handleTtsError({ error: 'tts_watchdog_timeout', message: `TTS for '${wordToSpeak}' did not respond (onEnd/onError) within ${TTS_TIMEOUT_MS}ms.` });
                    }, TTS_TIMEOUT_MS);

                    // 使用立即执行的异步函数来处理TTS调用
                    (async () => {
                        try {
                            // 如果是自动播放，先尝试触发用户交互
                            if (isAutoPlay) {
                                console.log('[MainJS_L3_AUDIO_DEBUG] Auto-play detected, attempting to trigger user interaction.');
                                // 尝试触发一个静音音频来启动音频上下文
                                try {
                                    if (window.initAudioContext) {
                                        await window.initAudioContext();
                                        console.log('[MainJS_L3_AUDIO_DEBUG] AudioContext initialized for auto-play.');
                                    }

                                    // 尝试播放一个短暂的静音来触发用户交互
                                    const silentUtterance = new SpeechSynthesisUtterance('');
                                    silentUtterance.volume = 0;
                                    window.speechSynthesis.speak(silentUtterance);

                                    // 等待一小段时间让静音播放完成
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                } catch (interactionError) {
                                    console.warn('[MainJS_L3_AUDIO_DEBUG] Failed to trigger user interaction:', interactionError);
                                }
                            }

                            if (window.initAudioContext) {
                                console.log('[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: Ensuring AudioContext is active for TTS.');
                                try {
                                    await window.initAudioContext();
                                    console.log('[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: AudioContext ready/resumed for TTS.');
                                } catch (audioContextError) {
                                    console.error('[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: Error ensuring AudioContext for TTS:', audioContextError);
                                    console.log('[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: Attempting TTS anyway after AudioContext init error.');
                                }
                            } else {
                                console.warn('[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: initAudioContext not found. Calling TTS directly.');
                            }

                            // 调用TTS函数，传递isAutoPlay参数
                            await window.playWordWithTTS(wordToSpeak, wrappedTtsOnEnd, wrappedTtsOnError, false);
                        } catch (error) {
                            console.error('[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: Error in async TTS call:', error);
                            wrappedTtsOnError(error);
                        }
                    })();
                } else { // TTS function not available
                    console.error("[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: playWordWithTTS function is not defined. Cannot play audio.");
                    sendMessageToIframe('setPlayButtonState', { disabled: false, isPlaying: false });
                    sendMessageToIframe('audioPlayError', { message: 'TTS function not available.'});
                }
            } else {
                console.error("[MainJS_L3_AUDIO_DEBUG] playQuestionAudioL3: No word found for current L3 question.");
                sendMessageToIframe('setPlayButtonState', { disabled: false, isPlaying: false });
                sendMessageToIframe('audioPlayError', { message: 'No word to speak.'});
            }
            break;


        // Admin Actions (Assuming these don't need gameSession)
        case 'loginAdmin':
            // Assuming 'data' was a typo and should be messageData
            if (messageData.password === ADMIN_PASSWORD) {
                console.log("Admin login successful");
                playSound('login');
                if (typeof navigateTo === 'function') navigateTo('admin_config');
            } else {
                console.log("Admin login failed");
                playSound('error');
                sendMessageToIframe('loginFailed', { message: "密码错误！" });
            }
            break;
        case 'requestAdminConfig':
             // Send current config to admin screen when it loads
            loadAdminConfig(); // Ensure latest is loaded before sending
            sendMessageToIframe('loadAdminConfig', adminConfig);
            break;
        case 'saveAdminConfig':
             // Assuming 'data' was a typo and should be messageData
            if (messageData.payload) {
                if (saveAdminConfigData(messageData.payload)) {
                    playSound('success'); // Played if saveAdminConfigData returns true
                } else {
                    playSound('error'); // Played if saveAdminConfigData returns false (error during save)
                }
            } else {
                 console.error("Received saveAdminConfig request with no payload.");
                 sendMessageToIframe('adminConfigSaveFailed');
                 playSound('error');
            }
            break;

        // --- ADDED/MODIFIED CASES START ---
        case 'checkAnswerL1': // FR05 (Level 1 specific answer check)
            console.log(`[MainJS] Received 'checkAnswerL1' with payload:`, messageData.payload);
            if (gameSession && gameSession.currentLevel === 1 && messageData.payload && typeof messageData.payload.answer === 'string') {
                handleAnswerL1(messageData.payload.answer);
            } else {
                console.warn("[MainJS] 'checkAnswerL1' received but not in Level 1, gameSession not active, or payload invalid.", gameSession, messageData.payload);
            }
            break;
        case 'checkAnswerL3': // Handling for Level 3 answers
            console.log(`[MainJS] Received 'checkAnswerL3' with payload:`, messageData.payload);
            if (gameSession && gameSession.currentLevel === 3 && messageData.payload && typeof messageData.payload.answer === 'string') {
                handleAnswerL3(messageData.payload.answer);
            } else {
                console.warn("[MainJS] 'checkAnswerL3' received but not in Level 3, gameSession not active, or payload invalid.", gameSession, messageData.payload);
            }
            break;
        case 'requestNextQuestion': // Common for L1, L2, L3 to request next question data
            console.log(`[MainJS] Received 'requestNextQuestion' from iframe for level ${gameSession ? gameSession.currentLevel : 'N/A'}`);
            if (gameSession) {
                // Ensure timer from previous question is stopped before loading next
                stopTimer(gameSession);
                getNextQuestion(); // This function should handle fetching and sending new question data
            } else {
                console.warn("[MainJS] 'requestNextQuestion' received but no active game session.");
            }
            break;
        // --- ADDED/MODIFIED CASES END ---

        default:
             // Use messageData.action for logging unknown actions
            console.warn(`Main received unknown action: ${messageData.action}`);
    }
});

// --- Helper to send initial data when a level loads ---
// --- Helper to send initial data when a level loads ---
// Called by level iframe when it's ready (via 'requestLevelData' message)
// Now includes waiting for questions to load if they're still loading
async function loadLevelData(level) {
    console.log(`Request received for Level ${level} data.`);

    // Ensure game session exists
    if (!gameSession) {
        console.error("loadLevelData called without an active game session.");
        // Potentially navigate back or show error
        if (typeof navigateTo === 'function') navigateTo('welcome');
        return;
    }

    // Check: Is the requested level the current game level in the session?
    if (level !== gameSession.currentLevel) {
        console.warn(`Requested data for level ${level}, but current game level is ${gameSession.currentLevel}. Ignoring request.`);
        // If the game is in progress and the request is for a different level, ignore it.
        if (gameSession.currentLevel && gameSession.currentLevel <= LEVEL_COUNT && !gameSession.isFinished) {
             return;
        }
        // If the game is finished, also ignore.
        if (gameSession.isFinished) {
             return;
        }
        // If levels mismatch in another state, it might indicate an error.
        console.error(`Level mismatch in loadLevelData. Requested: ${level}, Session: ${gameSession.currentLevel}`);
        return;
    }

    // Wait for questions to load if they're still loading
    if (gameSession.questionLoadPromise) {
        console.log(`Questions are still loading for level ${level}. Waiting...`);
        try {
            await gameSession.questionLoadPromise;
            console.log(`Questions loaded successfully for level ${level}.`);
            // 清除 promise 以避免重复等待
            gameSession.questionLoadPromise = null;
        } catch (error) {
            console.error(`Failed to load questions for level ${level}:`, error);
            sendMessageToIframe('levelLoadError', { message: `无法加载关卡 ${level} 的题目：${error.message || '加载失败'}` });
            playSound('error');
            // 清除 promise
            gameSession.questionLoadPromise = null;
            return;
        }
    }

    // Ensure questions are loaded in the session
    const levelKey = `level${level}`;
    if (!gameSession.questions || !gameSession.questions[levelKey] || gameSession.questions[levelKey].length === 0) {
         console.error(`FATAL: Questions for level ${level} are not loaded in session when requested by iframe after waiting.`);
         sendMessageToIframe('levelLoadError', { message: `无法加载关卡 ${level} 的题目。请返回重试。` });
         playSound('error');
         return;
    }

    console.log(`Questions verified for level ${level}. Count: ${gameSession.questions[levelKey].length}`);

    // Reset state for the start of the level within the session
    gameSession.questionNumber = 0; // Reset question index for the level start
    gameSession.levelStartTime = Date.now();
    console.log(`Starting Level ${level} at ${new Date(gameSession.levelStartTime).toLocaleTimeString()}`);

    // Load and display the first question (uses session)
    loadNextQuestion();
}

// --- Helper to send current display status ---
function sendDisplayUpdate() {
    // Ensure game session exists
    if (!gameSession) {
        console.warn("sendDisplayUpdate called without active game session.");
        return;
    }

    // Ensure config is loaded (global config is fine)
    if (!adminConfig || !adminConfig.level1) {
        console.warn("Admin config not loaded, cannot send display update accurately.");
        loadAdminConfig();
        if (!adminConfig || !adminConfig.level1) return;
    }

    const levelKey = `level${gameSession.currentLevel}`;
     // Check config validity for the current level in session
    if (!adminConfig[levelKey]) {
        console.warn("Cannot send display update: adminConfig invalid for level", gameSession.currentLevel);
        return;
    }

    const config = adminConfig[levelKey];
    // Build display data using gameSession
    const displayData = {
        currentLevel: gameSession.currentLevel,
        // Display question number as 1-based for UI, session stores 0-based index for next question
        questionNumber: gameSession.questionNumber, // Current question number (1-based)
        totalQuestions: gameSession.questions[levelKey] ? gameSession.questions[levelKey].length : 0, // Total questions in this specific level
        score: gameSession.score[levelKey], // From session
        targetScore: config.targetScore, // From global config
        // attemptsLeft: gameSession.attemptsLeft, // From session - conditionally added below
        timerValue: gameSession.timeLeft, // From session
        playButtonDisabled: (gameSession.currentLevel === 3 && gameSession.audioPlayedThisTurn), // From session
    };

    // Conditionally add attemptsLeft only for Level 2
    if (gameSession.currentLevel === 2) {
        displayData.attemptsLeft = gameSession.attemptsLeft;
    }

    // Add L3 logging
    if (gameSession.currentLevel === 3) {
        console.log(`[MainJS] sendDisplayUpdate for Level 3: audioPlayedThisTurn is ${gameSession.audioPlayedThisTurn}, so playButtonDisabled will be ${displayData.playButtonDisabled}.`);
    }
    sendMessageToIframe('updateDisplay', displayData);
}


// Function to handle answer submission for Level 1 (Multiple Choice or Fill-in-the-blank)
// This function needs to be adapted based on L1's specific logic if it's different from L3.
// For now, let's assume a similar structure to L3 for demonstration, but it will need review.
async function handleAnswerL1(submittedAnswer) {
    if (!gameSession || !gameSession.currentQuestionData) {
        console.error("[MainJS] handleAnswerL1: gameSession or currentQuestionData is not available.");
        return;
    }
    console.log(`[MainJS] handleAnswerL1: Submitted: '${submittedAnswer}', Correct: '${gameSession.currentQuestionData.english}'`);

    const correctAnswer = gameSession.currentQuestionData.english.toLowerCase().trim();
    const isCorrect = submittedAnswer.toLowerCase().trim() === correctAnswer;

    if (isCorrect) {
        console.log("[MainJS] handleAnswerL1: Answer CORRECT");
        gameSession.score.level1++;
        gameSession.totalScore++;
        updateScoreDisplay();
        stopTimer(gameSession); // Stop timer on correct answer
        playSound('correct');

        sendMessageToIframe('showFeedback', {
            correct: true,
            message: '回答正确！',
            correctAnswer: gameSession.currentQuestionData.english,
            chinese: gameSession.currentQuestionData.chinese
        });

        setTimeout(() => {
            gameSession.questionNumber++;
            if (gameSession.questionNumber < gameSession.questions.level1.length) {
                console.log("[MainJS] handleAnswerL1: Proceeding to next question in L1.");
                getNextQuestion();
            } else {
                console.log("[MainJS] handleAnswerL1: Level 1 completed.");
                endLevel();
            }
        }, 2000); // Delay for feedback visibility

    } else {
        console.log("[MainJS] handleAnswerL1: Answer INCORRECT");
        gameSession.attemptsLeft--;
        addWrongAnswerDetail(1, gameSession.questionNumber + 1, submittedAnswer, correctAnswer, gameSession.currentQuestionData.chinese);
        playSound('incorrect');

        sendMessageToIframe('showFeedback', {
            correct: false,
            message: `回答错误。剩余尝试: ${gameSession.attemptsLeft}`,
            correctAnswer: gameSession.currentQuestionData.english,
            chinese: gameSession.currentQuestionData.chinese,
            attemptsLeft: gameSession.attemptsLeft
        });
        sendMessageToIframe('updateAttempts', { attempts: gameSession.attemptsLeft });

        if (gameSession.attemptsLeft <= 0) {
            console.log("[MainJS] handleAnswerL1: No attempts left for this question.");
            stopTimer(gameSession);
            setTimeout(() => {
                gameSession.questionNumber++;
                if (gameSession.questionNumber < gameSession.questions.level1.length) {
                    console.log("[MainJS] handleAnswerL1: Moving to next question after exhausting attempts.");
                    getNextQuestion();
                } else {
                    console.log("[MainJS] handleAnswerL1: Level 1 completed (last question wrong, no attempts left).");
                    endLevel();
                }
            }, 2000);
        } else {
            console.log(`[MainJS] handleAnswerL1: Attempts left: ${gameSession.attemptsLeft}. User can try again.`);
        }
    }
}

// Function to handle answer submission for Level 3 (Listen and Write)
async function handleAnswerL3(submittedAnswer) {
    if (!gameSession || !gameSession.currentQuestionData) {
        console.error("[MainJS] handleAnswerL3: gameSession or currentQuestionData is not available.");
        return;
    }
    console.log(`[MainJS] handleAnswerL3: Submitted: '${submittedAnswer}', Correct: '${gameSession.currentQuestionData.english}'`);

    const correctAnswer = gameSession.currentQuestionData.english.toLowerCase().trim();
    const isCorrect = submittedAnswer.toLowerCase().trim() === correctAnswer;

    if (isCorrect) {
        console.log("[MainJS] handleAnswerL3: Answer CORRECT");
        gameSession.score.level3++;
        gameSession.totalScore++;
        updateScoreDisplay();
        stopTimer(gameSession);
        playSound('correct');

        sendMessageToIframe('showFeedback', {
            correct: true,
            message: '回答正确！',
            correctAnswer: gameSession.currentQuestionData.english,
            chinese: gameSession.currentQuestionData.chinese
        });

        setTimeout(() => {
            gameSession.questionNumber++;
            if (gameSession.questionNumber < gameSession.questions.level3.length) {
                console.log("[MainJS] handleAnswerL3: Proceeding to next question in L3.");
                getNextQuestion();
            } else {
                console.log("[MainJS] handleAnswerL3: Level 3 completed.");
                endLevel();
            }
        }, 2000);

    } else {
        console.log("[MainJS] handleAnswerL3: Answer INCORRECT");
        gameSession.attemptsLeft--;
        addWrongAnswerDetail(3, gameSession.questionNumber + 1, submittedAnswer, correctAnswer, gameSession.currentQuestionData.chinese);
        playSound('incorrect');

        sendMessageToIframe('showFeedback', {
            correct: false,
            message: `回答错误。剩余尝试: ${gameSession.attemptsLeft}`,
            correctAnswer: gameSession.currentQuestionData.english,
            chinese: gameSession.currentQuestionData.chinese,
            attemptsLeft: gameSession.attemptsLeft
        });
        sendMessageToIframe('updateAttempts', { attempts: gameSession.attemptsLeft });

        if (gameSession.attemptsLeft <= 0) {
            console.log("[MainJS] handleAnswerL3: No attempts left for this question.");
            stopTimer(gameSession);
            setTimeout(() => {
                gameSession.questionNumber++;
                if (gameSession.questionNumber < gameSession.questions.level3.length) {
                    console.log("[MainJS] handleAnswerL3: Moving to next question after exhausting attempts.");
                    getNextQuestion();
                } else {
                    console.log("[MainJS] handleAnswerL3: Level 3 completed (last question wrong, no attempts left).");
                    endLevel();
                }
            }, 2000);
        } else {
            console.log(`[MainJS] handleAnswerL3: Attempts left: ${gameSession.attemptsLeft}. User can try again.`);
        }
    }
}

// --- Initialization ---
loadAdminConfig(); // Load config when main script loads
console.log("main.js loaded. Initial admin config:", adminConfig);
// Game flow starts via user interaction -> welcome -> info_input -> navigate(level1) -> initializeGame -> requestLevelData -> loadLevelData...
// Audio initialization (initAudioContext and preloadSounds) is triggered by user interaction via the 'navigate' message handler.