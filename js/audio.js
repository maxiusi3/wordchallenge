var audioContext = window.audioContext || null;
var soundBuffers = window.soundBuffers || {}; // 用于缓存加载的音频文件
var activeSoundSources = window.activeSoundSources || {}; // 用于跟踪当前播放的音效源
window.audioContext = audioContext; // Ensure global access
window.soundBuffers = soundBuffers; // Ensure global access
window.activeSoundSources = activeSoundSources; // Ensure global access

// 初始化或恢复 AudioContext（必须在用户交互后调用）
// 返回一个 Promise，在 AudioContext 变为 'running' 状态时解析
function initAudioContext() {
    console.log('[AudioJS] initAudioContext called. Current context:', audioContext ? audioContext.state : 'null');
    return new Promise((resolve, reject) => {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('[AudioJS] AudioContext newly created. Initial state:', audioContext.state);
                // 新创建的 context 通常直接是 running 或 suspended
                if (audioContext.state === 'running') {
                    resolve(audioContext);
                } else {
                    // 如果是 suspended，需要 resume
                    console.log('[AudioJS] Attempting to resume suspended AudioContext...');
            audioContext.resume().then(() => {
                        console.log('AudioContext resumed after creation.');
                        resolve(audioContext);
                    }).catch(e => {
                console.error('[AudioJS] Error resuming existing AudioContext:', e);
                        console.error('[AudioJS] Error resuming AudioContext after creation:', e);
                        console.error('Error resuming AudioContext after creation:', e);
                        reject(e);
                    });
                }
            } catch (e) {
                console.error('[AudioJS] Web Audio API is not supported in this browser', e);
                reject(e);
            }
        } else if (audioContext.state === 'suspended') {
            console.log('[AudioJS] Attempting to resume suspended AudioContext...');
            audioContext.resume().then(() => {
                console.log('[AudioJS] AudioContext successfully resumed. State:', audioContext.state);
                resolve(audioContext);
            }).catch(e => {
                console.error('[AudioJS] Error resuming existing AudioContext:', e);
                console.error('Error resuming AudioContext:', e);
                reject(e);
            });
        } else if (audioContext.state === 'running') {
            // 已经是 running 状态
            resolve(audioContext);
        } else {
            // 其他状态 (e.g., 'closed')
            console.error('[AudioJS] AudioContext is in an unexpected state:', audioContext.state);
            reject(new Error(`AudioContext in state: ${audioContext.state}`));
        }
    });
}

// 加载音效文件 (示例，需要根据实际音效文件调整路径和名称)
async function loadSound(name, url) {
    console.log(`[AudioJS] loadSound called for name: ${name}, url: ${url}`);
    // 确保 AudioContext 已初始化并运行
    try {
        await initAudioContext(); // 等待 context 准备好
    } catch (error) {
        console.error(`[AudioJS] Cannot load sound ${name}, AudioContext initialization failed during loadSound:`, error);
        return; // 无法加载
    }

    if (soundBuffers[name]) {
        console.log(`[AudioJS] Sound ${name} already in buffer, returning cached.`);
        return soundBuffers[name]; // 返回缓存
    }
    try {
        console.log(`[AudioJS] Fetching sound ${name} from ${url}`);
        const response = await fetch(url);
        console.log(`[AudioJS] Fetch response for ${url}: Status ${response.status}, OK: ${response.ok}`);
        if (!response.ok) {
            console.error(`[AudioJS] Fetch failed for ${url}: ${response.statusText}`);
            throw new Error(`Fetch failed for ${url}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        console.log(`[AudioJS] Decoding audio data for ${name}`);
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log(`[AudioJS] Successfully decoded audio data for ${name}`);
        soundBuffers[name] = audioBuffer;
        console.log(`[AudioJS] Sound loaded and buffered: ${name}`);
        return audioBuffer;
    } catch (error) {
        console.error(`[AudioJS] Error loading sound ${name} from ${url}:`, error);
        // Propagate the error so callers can handle it
        throw error;
    }
}

// 播放音效
async function playSound(name) {
    console.log(`[AudioJS_DEBUG] playSound called for: ${name}. Current AudioContext state: ${audioContext ? audioContext.state : 'null'}`);
    let localAudioContext;
    try {
        console.log(`[AudioJS_DEBUG] playSound: Attempting to init/get AudioContext for ${name}`);
        localAudioContext = await initAudioContext(); // 等待 context 准备好
        console.log(`[AudioJS_DEBUG] playSound: AudioContext state for ${name} after init: ${localAudioContext ? localAudioContext.state : 'null'}`);
    } catch (error) {
        console.error(`[AudioJS_DEBUG] Cannot play sound ${name}, AudioContext initialization failed during playSound:`, error);
        return; // 无法播放
    }

    // 再次检查状态以防万一
    if (!localAudioContext || localAudioContext.state !== 'running') {
        console.warn(`[AudioJS_DEBUG] AudioContext not running after init attempt for ${name}. State: ${localAudioContext ? localAudioContext.state : 'null'}. Cannot play sound.`);
        return;
    }

    const buffer = soundBuffers[name];
    console.log(`[AudioJS_DEBUG] playSound: Buffer for ${name} exists: ${!!buffer}`);
    if (buffer) {
        try {
            console.log(`[AudioJS_DEBUG] playSound: Buffer found for ${name}.`);
            if (activeSoundSources[name]) {
                try {
                    console.log(`[AudioJS_DEBUG] playSound: Attempting to stop previous instance of sound: ${name}`);
                    activeSoundSources[name].stop(0);
                    console.log(`[AudioJS_DEBUG] Successfully stopped previous instance of sound: ${name}`);
                } catch (e) {
                    console.warn(`[AudioJS_DEBUG] Error stopping previous sound ${name}:`, e.message);
                }
                delete activeSoundSources[name];
                console.log(`[AudioJS_DEBUG] playSound: Deleted old activeSoundSources[${name}].`);
            }

            const source = localAudioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(localAudioContext.destination);
            console.log(`[AudioJS_DEBUG] playSound: BufferSource created and connected for ${name}. Attempting to start.`);
            source.start(0);
            activeSoundSources[name] = source;
            console.log(`[AudioJS_DEBUG] playSound: Started playing sound: ${name}. Stored new source.`);

            source.onended = () => {
                console.log(`[AudioJS_DEBUG] Sound ${name} finished playing (onended event).`);
                if (activeSoundSources[name] === source) {
                    delete activeSoundSources[name];
                    console.log(`[AudioJS_DEBUG] playSound: Deleted activeSoundSources[${name}] after onended.`);
                } else {
                    console.log(`[AudioJS_DEBUG] playSound: onended for ${name}, but activeSoundSources[${name}] was different or undefined.`);
                }
            };
        } catch (error) {
            console.error(`[AudioJS_DEBUG] Error playing sound ${name} during source.start or setup:`, error);
            if (activeSoundSources[name]) {
                delete activeSoundSources[name];
                 console.log(`[AudioJS_DEBUG] playSound: Deleted activeSoundSources[${name}] due to error in try block.`);
            }
        }
    } else {
        console.warn(`[AudioJS_DEBUG] No buffer found for sound: ${name}. Cannot play.`);
    }
    console.log(`[AudioJS_DEBUG] playSound finished for: ${name}.`);
}

// --- 预加载常用音效 (可选) ---
// 可以在应用初始化或特定屏幕加载时调用
async function preloadSounds() {
    try {
        await initAudioContext(); // Ensure context is ready
        console.log('Preloading sounds...');
        // Preload all necessary sounds based on user-provided list
        await Promise.all([
            loadSound('cancel', 'audio/cancel.wav'),
            loadSound('challenge_lose', 'audio/challenge_lose.wav'),
            loadSound('challenge_win', 'audio/challenge_win.wav'),
            loadSound('click', 'audio/click.wav'),
            loadSound('confirm', 'audio/confirm.wav'),
            loadSound('correct', 'audio/correct.wav'),
            loadSound('error', 'audio/error.wav'),
            loadSound('incorrect', 'audio/incorrect.wav'),
            loadSound('incorrect_final', 'audio/incorrect_final.wav'),
            loadSound('level_lose', 'audio/level_lose.wav'),
            loadSound('level_win', 'audio/level_win.wav'),
            loadSound('login', 'audio/login.wav'),
            loadSound('select', 'audio/select.wav'),
            loadSound('success', 'audio/success.wav'),
            loadSound('timeout', 'audio/timeout.wav'),
            loadSound('timer_end', 'audio/timer_end.wav'),
            loadSound('timer_tick_warn', 'audio/timer_tick_warn.wav'),
            loadSound('typing', 'audio/typing.wav')
        ]);
        console.log('All essential sounds preloaded or loading initiated.');
    } catch (error) {
        console.error('Cannot preload sounds, AudioContext initialization or loading failed:', error);
    }
}

// 注意：initAudioContext() 需要由用户交互触发，例如按钮点击。
// 例如，在主页面或第一个交互屏幕的按钮点击事件中调用 initAudioContext();
// 并且在调用 playSound 之前，确保相关的音效已通过 loadSound 加载。

// 示例：在某个按钮点击时初始化并预加载
/*
document.getElementById('someButton').addEventListener('click', async () => { // 注意 async
    try {
        await initAudioContext();
        await preloadSounds(); // 现在可以安全地调用 preload
    } catch (error) {
        console.error("Audio initialization/preload failed on button click:", error);
    }
    // ... 其他按钮逻辑 ...
});
*/
// Make playSound globally accessible
window.playSound = playSound;

// 停止音效
function stopSound(name) {
    if (activeSoundSources[name]) {
        try {
            activeSoundSources[name].stop(0);
            console.log(`Sound stopped: ${name}`);
        } catch (e) {
            console.error(`Error stopping sound ${name}:`, e);
        }
        delete activeSoundSources[name]; // 从活动源中移除
    } else {
        // console.log(`Sound not playing or already stopped: ${name}`);
    }
}
window.stopSound = stopSound; // Make stopSound globally accessible
let availableVoices = [];
let voicesLoaded = false;
let ttsInitializationAttempted = false;
let ttsInitializationPromise = null; // Singleton promise for TTS initialization

function initializeTTS(forceRetry = false) {
    console.log(`[AudioJS_TTS_DEBUG] initializeTTS called. forceRetry: ${forceRetry}, current voicesLoaded: ${voicesLoaded}, promise exists: ${!!ttsInitializationPromise}`);

    if (!forceRetry && ttsInitializationPromise) {
        console.log('[AudioJS_TTS_DEBUG] initializeTTS: Returning existing initialization promise.');
        return ttsInitializationPromise;
    }

    console.log(`[AudioJS_TTS_DEBUG] initializeTTS: Creating new initialization promise. forceRetry was ${forceRetry}.`);

ttsInitializationPromise = new Promise((resolve, reject) => {
        ttsInitializationAttempted = true;

        if (!('speechSynthesis' in window)) {
            console.error('[AudioJS_TTS_DEBUG] initializeTTS: Speech Synthesis not supported.');
            voicesLoaded = false;
            reject({ error: 'notsupported', message: 'Speech Synthesis API is not available.' });
            return;
        }

        voicesLoaded = false;
        console.log('[AudioJS_TTS_DEBUG] initializeTTS: voicesLoaded reset to false for fresh evaluation within new promise.');

        const TIMEOUT_MS = 5000;
        let timeoutId = null;
        let listenerAttached = false;

        const cleanupAndResolve = (loadedSuccessfully) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = null;
            if (listenerAttached && window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = null;
                listenerAttached = false;
            }

            voicesLoaded = loadedSuccessfully;
            if (loadedSuccessfully) {
                console.log(`[AudioJS_TTS_DEBUG] initializeTTS: Voices loaded successfully. Available voices count: ${availableVoices.length}`);
                resolve();
            } else {
                console.warn('[AudioJS_TTS_DEBUG] initializeTTS: Failed to load voices (cleanupAndResolve).');
                reject({ error: 'voices_load_failed', message: 'TTS voices did not load.' });
            }
        };

timeoutId = setTimeout(() => {
            timeoutId = null; // Mark timeout as handled
            console.warn(`[AudioJS_TTS_DEBUG] initializeTTS: Voice loading timeout of ${TIMEOUT_MS}ms reached.`);
            if (listenerAttached && window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = null;
                listenerAttached = false;
            }

            availableVoices = window.speechSynthesis.getVoices() || [];
            console.log(`[AudioJS_TTS_DEBUG] initializeTTS: Final voice check after timeout. Count: ${availableVoices.length}`);
            cleanupAndResolve(availableVoices.length > 0);
        }, TIMEOUT_MS);

        const initialVoices = window.speechSynthesis.getVoices() || [];
        if (initialVoices.length > 0) {
            console.log('[AudioJS_TTS_DEBUG] initializeTTS: Voices found on initial synchronous check.');
            availableVoices = initialVoices;
            cleanupAndResolve(true);
            return;
        }

        console.log('[AudioJS_TTS_DEBUG] initializeTTS: No voices on initial check. Setting onvoiceschanged listener.');
        window.speechSynthesis.onvoiceschanged = () => {
            console.log('[AudioJS_TTS_DEBUG] initializeTTS: onvoiceschanged event fired.');
            availableVoices = window.speechSynthesis.getVoices() || [];
            if (availableVoices.length > 0) {
                cleanupAndResolve(true);
            }
            // If still no voices, the main timeout will eventually trigger.
        };
        listenerAttached = true;
    });

    return ttsInitializationPromise;
}

// Ensure initializeTTS is called at a point where window.speechSynthesis is available.
// Typically, this is safe to do when the script is parsed.
if ('speechSynthesis' in window) {
    initializeTTS().catch(err => {
        console.warn('[AudioJS_TTS_DEBUG] Initial TTS initialization failed on script load:', err.message ? err.message : err);
        // voicesLoaded remains false, playWordWithTTS will handle this by calling onErrorCallback
    });
}

// Add a blank line for separation before the next comment block
// --- TTS Function for Speaking Words ---
// Enhanced version with better error handling and retry mechanism for iPad
let ttsRetryCount = 0;
const MAX_TTS_RETRIES = 2;
let userHasInteracted = false; // 记录用户是否已经交互过

// 监听用户交互事件
if (typeof document !== 'undefined') {
  const markUserInteraction = () => {
    userHasInteracted = true;
    console.log('[AudioJS_TTS_ENHANCED] User interaction detected, TTS should work now.');
    // 移除监听器以避免内存泄漏
    document.removeEventListener('touchstart', markUserInteraction);
    document.removeEventListener('click', markUserInteraction);
    document.removeEventListener('keydown', markUserInteraction);
  };

  document.addEventListener('touchstart', markUserInteraction, { once: true });
  document.addEventListener('click', markUserInteraction, { once: true });
  document.addEventListener('keydown', markUserInteraction, { once: true });
}

async function playWordWithTTS(wordToSpeak, onEndCallback, onErrorCallback, isRetry = false) {
  const callStartTime = Date.now();
  console.log(`[AudioJS_TTS_ENHANCED] playWordWithTTS ENTERED for "${wordToSpeak}" at ${callStartTime}, isRetry: ${isRetry}`);

  if (!('speechSynthesis' in window)) {
    console.error('[AudioJS_TTS_ENHANCED] Speech Synthesis not supported.');
    if (typeof onErrorCallback === 'function') {
      onErrorCallback({ error: 'notsupported', message: 'Speech Synthesis API is not available.' });
    }
    return;
  }

  // 检查是否需要用户交互来启用音频
  if (!isRetry) {
    try {
      // 尝试初始化音频上下文
      if (window.initAudioContext) {
        await window.initAudioContext();
        console.log('[AudioJS_TTS_ENHANCED] AudioContext initialized successfully.');
      }

      // 检查是否需要用户交互来解锁音频
      if (audioContext && audioContext.state === 'suspended') {
        console.log('[AudioJS_TTS_ENHANCED] AudioContext is suspended, attempting to resume.');
        try {
          await audioContext.resume();
          console.log('[AudioJS_TTS_ENHANCED] AudioContext resumed successfully.');
        } catch (resumeError) {
          console.warn('[AudioJS_TTS_ENHANCED] Failed to resume AudioContext:', resumeError);
        }
      }
    } catch (error) {
      console.warn('[AudioJS_TTS_ENHANCED] AudioContext initialization failed:', error);
    }
  }

  console.log(`[AudioJS_TTS_ENHANCED] Checking TTS readiness. voicesLoaded: ${voicesLoaded}`);
  if (!voicesLoaded) {
    // 尝试重新初始化TTS
    try {
      await initializeTTS(true);
      console.log('[AudioJS_TTS_ENHANCED] TTS re-initialized successfully.');
    } catch (error) {
      console.error('[AudioJS_TTS_ENHANCED] TTS re-initialization failed:', error);
      if (typeof onErrorCallback === 'function') {
        onErrorCallback({ error: 'tts_voices_not_ready', message: 'TTS voices not available after re-initialization.' });
      }
      return;
    }
  }
  console.log('[AudioJS_TTS_ENHANCED] TTS voices ready. Proceeding to create utterance.');

  // 强制取消任何现有的语音
  console.log(`[AudioJS_TTS_ENHANCED] Cancelling existing speech. State - Speaking: ${window.speechSynthesis.speaking}, Pending: ${window.speechSynthesis.pending}`);
  window.speechSynthesis.cancel();

  // 等待取消操作完成
  await new Promise(resolve => setTimeout(resolve, isRetry ? 200 : 100));

  const utterance = new SpeechSynthesisUtterance(wordToSpeak);
  utterance.lang = 'en-US';
  utterance.volume = 1.0;
  utterance.rate = 0.8;
  utterance.pitch = 1.0;

  console.log(`[AudioJS_TTS_ENHANCED] Created utterance. Word: "${utterance.text}", Lang: "${utterance.lang}"`);

  let safetyTimeoutId = null;
  const safetyTimeoutDuration = isRetry ? 8000 : 6000; // 重试时给更多时间

  // 防止重复回调
  let callbackFired = false;

  const cleanupAndCall = (callbackType, data) => {
    if (callbackFired) {
      console.log(`[AudioJS_TTS_ENHANCED] Callback already fired for "${wordToSpeak}". Suppressing duplicate.`);
      return;
    }
    callbackFired = true;

    if (safetyTimeoutId) {
      clearTimeout(safetyTimeoutId);
      safetyTimeoutId = null;
      console.log(`[AudioJS_TTS_ENHANCED] Cleared safety timeout for "${wordToSpeak}".`);
    }

    // 错误或超时时取消语音
    if (callbackType === 'error' || callbackType === 'timeout') {
        console.log(`[AudioJS_TTS_ENHANCED] Cancelling speech due to ${callbackType} for "${wordToSpeak}".`);
        window.speechSynthesis.cancel();

        // 如果是超时错误且还有重试机会，尝试重试
        if (callbackType === 'timeout' && !isRetry && ttsRetryCount < MAX_TTS_RETRIES) {
          ttsRetryCount++;
          console.log(`[AudioJS_TTS_ENHANCED] Attempting retry ${ttsRetryCount}/${MAX_TTS_RETRIES} for "${wordToSpeak}"`);
          setTimeout(() => {
            playWordWithTTS(wordToSpeak, onEndCallback, onErrorCallback, true);
          }, 500);
          return;
        }

        // 如果是自动播放失败且用户还没有交互，提示用户手动点击
        if (!userHasInteracted && (callbackType === 'timeout' || (callbackType === 'error' && data && data.error === 'tts_internal_safety_timeout'))) {
          console.log('[AudioJS_TTS_ENHANCED] Auto-play failed, likely due to browser autoplay policy. User needs to interact first.');
          // 这里不调用错误回调，而是调用成功回调以继续游戏流程
          if (typeof onEndCallback === 'function') {
            console.log('[AudioJS_TTS_ENHANCED] Calling onEndCallback despite TTS failure to continue game flow.');
            onEndCallback();
          }
          return;
        }
    }

    // 重置重试计数器
    if (callbackType === 'end') {
      ttsRetryCount = 0;
    }

    const callEndTime = Date.now();
    const duration = callEndTime - callStartTime;
    console.log(`[AudioJS_TTS_ENHANCED] cleanupAndCall for "${wordToSpeak}", type: ${callbackType}, duration: ${duration}ms. Data:`, data);

    // 调用相应的回调函数
    if (callbackType === 'end' && typeof onEndCallback === 'function') {
      console.log('[AudioJS_TTS_ENHANCED] Calling onEndCallback.');
      onEndCallback();
    } else if ((callbackType === 'error' || callbackType === 'timeout') && typeof onErrorCallback === 'function') {
      console.log(`[AudioJS_TTS_ENHANCED] Calling onErrorCallback due to ${callbackType}.`);
      onErrorCallback(data);
    } else {
      console.log(`[AudioJS_TTS_ENHANCED] No appropriate callback to call for type ${callbackType}, or callback not a function.`);
    }
  };

  // 设置事件监听器
  utterance.onstart = (event) => {
    console.log(`[AudioJS_TTS_ENHANCED] Utterance STARTED for "${wordToSpeak}". Event:`, event);
  };

  utterance.onend = (event) => {
    console.log(`[AudioJS_TTS_ENHANCED] Utterance ENDED for "${wordToSpeak}". Event:`, event);
    cleanupAndCall('end');
  };

  utterance.onerror = (event) => {
    const errorType = event.error || 'internal_tts_event_error';
    const errorMessage = event.message || (event.error ? `Error type: ${event.error}` : 'No additional message provided for TTS error.');
    console.error(`[AudioJS_TTS_ENHANCED] Utterance ERROR for "${wordToSpeak}". ErrorType: ${errorType}, Message: "${errorMessage}", Event:`, event);
    cleanupAndCall('error', { error: errorType, message: errorMessage, details: event });
  };

  // 安全超时机制
  console.log(`[AudioJS_TTS_ENHANCED] Setting safety timeout for "${wordToSpeak}". Duration: ${safetyTimeoutDuration}ms`);
  safetyTimeoutId = setTimeout(() => {
    console.log(`[AudioJS_TTS_ENHANCED] Safety timeout triggered for "${wordToSpeak}". callbackFired: ${callbackFired}`);
    if (callbackFired) {
        console.log(`[AudioJS_TTS_ENHANCED] Safety timeout for "${wordToSpeak}" triggered, but callback already fired. No action.`);
        return;
    }
    console.warn(`[AudioJS_TTS_ENHANCED] Safety timeout of ${safetyTimeoutDuration}ms reached for "${wordToSpeak}". Forcing timeout callback.`);
    cleanupAndCall('timeout', { error: 'tts_internal_safety_timeout', message: `TTS for "${wordToSpeak}" did not fire onEnd/onError within ${safetyTimeoutDuration}ms.` });
  }, safetyTimeoutDuration);
  console.log(`[AudioJS_TTS_ENHANCED] Safety timeout ID ${safetyTimeoutId} set for "${wordToSpeak}".`);

  // 开始播放语音
  try {
    console.log(`[AudioJS_TTS_ENHANCED] Attempting to speak "${wordToSpeak}". State before speak: Speaking=${window.speechSynthesis.speaking}, Pending=${window.speechSynthesis.pending}`);
    window.speechSynthesis.speak(utterance);
    console.log(`[AudioJS_TTS_ENHANCED] Called speak for "${wordToSpeak}". State after speak: Speaking=${window.speechSynthesis.speaking}, Pending=${window.speechSynthesis.pending}`);

  } catch (e) {
    console.error(`[AudioJS_TTS_ENHANCED] Error during call to window.speechSynthesis.speak for "${wordToSpeak}":`, e);
    cleanupAndCall('error', { error: e.name || 'speak_call_exception', message: e.message, details: e });
  }

  console.log(`[AudioJS_TTS_ENHANCED] playWordWithTTS finished setup for "${wordToSpeak}". Waiting for speech events or safety timeout.`);
}
window.playWordWithTTS = playWordWithTTS; // Make playWordWithTTS globally accessible