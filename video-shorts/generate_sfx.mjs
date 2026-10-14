import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

function writeWavFile(filename, sampleRate, samples) {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    buffer.writeInt16LE(Math.round(val), 44 + i * 2);
  }

  fs.writeFileSync(path.join(publicDir, filename), buffer);
  console.log(`Generated SFX: ${filename} (${buffer.length} bytes)`);
}

const sampleRate = 44100;

// 1. Countdown beep: short high-tech sin blip (880Hz to 1200Hz, 0.12s)
function generateBeep() {
  const duration = 0.14;
  const total = Math.floor(sampleRate * duration);
  const samples = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 28);
    const freq = 950 + Math.sin(t * 120) * 150;
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.7;
  }
  writeWavFile('countdown_beep.wav', sampleRate, samples);
}

// 2. Impact boom: low sub drop with fast decay (120Hz down to 40Hz, 0.8s)
function generateImpact() {
  const duration = 0.85;
  const total = Math.floor(sampleRate * duration);
  const samples = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 4.5);
    const freq = 120 * Math.exp(-t * 6) + 45;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 18) * 0.4;
    samples[i] = (Math.sin(2 * Math.PI * freq * t) + noise) * env * 0.85;
  }
  writeWavFile('impact.wav', sampleRate, samples);
}

// 3. Whoosh transition: white noise band sweep (0.45s)
function generateWhoosh() {
  const duration = 0.45;
  const total = Math.floor(sampleRate * duration);
  const samples = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    const env = Math.sin((t / duration) * Math.PI);
    const noise = Math.random() * 2 - 1;
    // modulated noise
    samples[i] = noise * env * 0.4;
  }
  writeWavFile('whoosh.wav', sampleRate, samples);
}

// 4. Background cyber beat / pulse loop (14 seconds, 125 BPM)
function generateBgLoop() {
  const duration = 14.2;
  const total = Math.floor(sampleRate * duration);
  const samples = new Float32Array(total);
  const bpm = 125;
  const beatSec = 60 / bpm;

  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    const beatPos = t % beatSec;
    const beatIndex = Math.floor(t / beatSec);

    // Kick drum on every beat
    const kickEnv = Math.exp(-beatPos * 14);
    const kickFreq = 110 * Math.exp(-beatPos * 20) + 40;
    const kick = Math.sin(2 * Math.PI * kickFreq * beatPos) * kickEnv * 0.55;

    // Hi-hat on offbeats
    const offbeatPos = (t + beatSec / 2) % beatSec;
    const hatEnv = Math.exp(-offbeatPos * 45);
    const hat = (Math.random() * 2 - 1) * hatEnv * 0.18;

    // Subtle bass synth pulse (cyber progression)
    const bassFreq = beatIndex % 4 === 3 ? 55 : 65; // G / A
    const bassEnv = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t);
    const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.18 * bassEnv;

    samples[i] = (kick + hat + bass) * 0.5;
  }
  writeWavFile('bg_beat.wav', sampleRate, samples);
}

generateBeep();
generateImpact();
generateWhoosh();
generateBgLoop();
console.log('All SFX generated successfully!');
