from flask import Flask, request, jsonify
import whisper
import os

app = Flask(__name__)

# Load the model (base model by default)
model = whisper.load_model("base")

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    audio_file = request.files['audio']
    audio_path = '/tmp/audio.mp3'
    audio_file.save(audio_path)
    
    try:
        result = model.transcribe(audio_path)
        return jsonify({'text': result['text']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
