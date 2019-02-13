import encodeWAV from './waveEncoder';
import getAudioContext from './getAudioContext';
import getUserMedia from 'get-user-media-promise';

var recGainNode, recSourceNode, recProcessingNode;

export default class WAVEInterface {
  static audioContext = getAudioContext;
  static bufferSize = 2048;

  playbackNode: AudioBufferSourceNode;
  recordingNodes: AudioNode[] = [];
  recordingStream: MediaStream;
  buffers: Float32Array[][]; // one buffer for each channel L,R
  encodingCache?: Blob;

  get bufferLength() { return this.buffers[0].length * WAVEInterface.bufferSize; }
  get audioDuration() { return this.bufferLength / WAVEInterface.audioContext.sampleRate; }
  get audioData() {
    return this.encodingCache || encodeWAV(this.buffers, this.bufferLength, WAVEInterface.audioContext.sampleRate);
  }

  startRecording() {
    return new Promise((resolve, reject) => {
      getUserMedia({ audio: true })
        .then((stream) => {
          var { audioContext } = WAVEInterface;
          recGainNode = audioContext.createGain();
          recSourceNode = audioContext.createMediaStreamSource(stream);
          recProcessingNode = audioContext.createScriptProcessor(WAVEInterface.bufferSize, 2, 2);
          if (this.encodingCache) this.encodingCache = null;
  
          recProcessingNode.onaudioprocess = (event) => {
            if (this.encodingCache) this.encodingCache = null;
            // save left and right buffers
            for (let i = 0; i < 2; i++) {
              const channel = event.inputBuffer.getChannelData(i);
              this.buffers[i].push(new Float32Array(channel));
            }
          };
  
          recSourceNode.connect(recGainNode);
          recGainNode.connect(recProcessingNode);
          recProcessingNode.connect(audioContext.destination);
  
          this.recordingStream = stream;
          this.recordingNodes.push(recSourceNode, recGainNode, recProcessingNode);
          resolve(stream);
        })
        .catch((err) => {
          reject(err);  
        });
    });
  }

  stopRecording() {
    if (this.recordingStream) {
      this.recordingStream.getTracks()[0].stop();
      delete this.recordingStream;
    }
    for (let i in this.recordingNodes) {
      this.recordingNodes[i].disconnect();
      delete this.recordingNodes[i];
    }
  }

  startPlayback(loop: boolean = false, onended: () => void) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(this.audioData);
      reader.onloadend = () => {
        WAVEInterface.audioContext.decodeAudioData(reader.result, (buffer) => {
          const source = WAVEInterface.audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(WAVEInterface.audioContext.destination);
          source.loop = loop;
          source.start(0);
          source.onended = onended;
          this.playbackNode = source;
          resolve(source);
        });
      };
    });
  }

  stopPlayback() {
    this.playbackNode.stop();
  }

  reset() {
    if (this.playbackNode) {
      this.playbackNode.stop();
      this.playbackNode.disconnect(0);
      delete this.playbackNode;
    }
    this.stopRecording();
    this.buffers = [[], []];
  }
}
