// js/audio.js - 遊戲音效與語音朗讀合成器 (Web Audio API + SpeechSynthesis)
(function () {
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  window.AudioManager = {
    isSoundEnabled() {
      return window.GameStorage.get().soundEnabled;
    },

    playTone(freq, type, duration, startTime = 0, gainLevel = 0.15) {
      if (!this.isSoundEnabled()) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime + startTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(gainLevel, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {
        // Audio error ignore
      }
    },

    playClick() {
      this.playTone(600, 'sine', 0.08, 0, 0.1);
    },

    playClue() {
      // Sparkle arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'triangle', 0.25, idx * 0.07, 0.15);
      });
    },

    playCorrect() {
      // Joyful high arpeggio
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'sine', 0.35, idx * 0.08, 0.18);
      });
    },

    playWrong() {
      // Gentle friendly bonk
      this.playTone(260, 'sawtooth', 0.22, 0, 0.12);
      this.playTone(200, 'sawtooth', 0.3, 0.12, 0.12);
    },

    playWin() {
      // Grand celebratory fanfare
      const melody = [
        { f: 523.25, d: 0.18, t: 0 },
        { f: 659.25, d: 0.18, t: 0.16 },
        { f: 783.99, d: 0.18, t: 0.32 },
        { f: 1046.5, d: 0.45, t: 0.48 },
        { f: 880, d: 0.2, t: 0.8 },
        { f: 1046.5, d: 0.6, t: 1.0 }
      ];
      melody.forEach(item => {
        this.playTone(item.f, 'triangle', item.d, item.t, 0.22);
      });
    },

    // 語音朗讀功能 (Web SpeechSynthesis API)
    speak(text) {
      if (!('speechSynthesis' in window)) {
        alert('您的瀏覽器不支援語音朗讀功能');
        return;
      }

      window.speechSynthesis.cancel(); // 停止先前的朗讀
      const cleanText = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, ''); // 過濾 emoji
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'zh-TW';
      utterance.rate = 0.95; // 稍慢節奏適合國小五年級學生
      utterance.pitch = 1.05;

      window.speechSynthesis.speak(utterance);
    },

    stopSpeaking() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  };
})();
