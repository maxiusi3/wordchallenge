#!/usr/bin/env python3
"""
简化的 TTS 服务器
使用在线 TTS API 作为代理
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests
import logging
import urllib.parse

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

@app.route('/tts', methods=['GET', 'POST'])
def text_to_speech():
    """文本转语音接口"""
    try:
        # 获取文本参数
        if request.method == 'POST':
            data = request.get_json()
            text = data.get('text', '') if data else ''
        else:
            text = request.args.get('text', '')
        
        if not text:
            return jsonify({'error': '缺少文本参数'}), 400
        
        logger.info(f"TTS请求: {text}")
        
        # 使用多个在线 TTS 服务作为备选
        tts_services = [
            # 微软 Edge TTS (通过第三方代理)
            f"https://api.streamelements.com/kappa/v2/speech?voice=Brian&text={urllib.parse.quote(text)}",
            # Google TTS (备用)
            f"https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q={urllib.parse.quote(text)}",
            # ResponsiveVoice (备用)
            f"https://responsivevoice.org/responsivevoice/getvoice.php?t={urllib.parse.quote(text)}&tl=en&sv=g1&vn=&pitch=0.5&rate=0.5&vol=1"
        ]
        
        # 尝试每个服务
        for i, service_url in enumerate(tts_services):
            try:
                logger.info(f"尝试 TTS 服务 {i+1}: {service_url}")
                
                # 设置请求头模拟浏览器
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'audio/mpeg, audio/*, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://translate.google.com/'
                }
                
                # 发送请求
                response = requests.get(service_url, headers=headers, timeout=10)
                
                if response.status_code == 200 and len(response.content) > 100:  # 确保有音频内容
                    logger.info(f"TTS服务 {i+1} 成功，返回音频数据")
                    
                    # 返回音频数据
                    return Response(
                        response.content,
                        mimetype='audio/mpeg',
                        headers={
                            'Content-Disposition': f'inline; filename="tts_{hash(text)}.mp3"',
                            'Cache-Control': 'public, max-age=3600'  # 缓存1小时
                        }
                    )
                else:
                    logger.warning(f"TTS服务 {i+1} 返回状态码: {response.status_code}, 内容长度: {len(response.content)}")
                    
            except Exception as e:
                logger.warning(f"TTS服务 {i+1} 失败: {e}")
                continue
        
        # 所有服务都失败
        logger.error("所有 TTS 服务都失败")
        return jsonify({'error': '所有 TTS 服务都不可用'}), 503
        
    except Exception as e:
        logger.error(f"TTS服务错误: {e}")
        return jsonify({'error': f'服务错误: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({'status': 'ok', 'service': 'simple-tts'})

@app.route('/test', methods=['GET'])
def test_tts():
    """测试 TTS 功能"""
    test_word = request.args.get('word', 'hello')
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>TTS 测试</title>
    </head>
    <body>
        <h1>TTS 服务测试</h1>
        <p>测试单词: {test_word}</p>
        <audio controls>
            <source src="/tts?text={test_word}" type="audio/mpeg">
            您的浏览器不支持音频播放。
        </audio>
        <br><br>
        <button onclick="playAudio()">播放音频</button>
        
        <script>
            function playAudio() {{
                const audio = new Audio('/tts?text={test_word}');
                audio.play().catch(e => console.error('播放失败:', e));
            }}
        </script>
    </body>
    </html>
    """

if __name__ == '__main__':
    print("启动简化 TTS 服务器...")
    print("访问 http://localhost:5000/health 检查服务状态")
    print("访问 http://localhost:5000/test 测试 TTS 功能")
    print("使用方法: GET /tts?text=hello")
    
    app.run(host='0.0.0.0', port=5000, debug=False)
