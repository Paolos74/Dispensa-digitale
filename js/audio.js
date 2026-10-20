// Audio Feedback synthesized with Web Audio API for Cashier experience
class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('dispensa_muted') === 'true';
    this.volume = parseFloat(localStorage.getItem('dispensa_volume') || '0.7');
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('dispensa_muted', muted ? 'true' : 'false');
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('dispensa_volume', this.volume.toString());
  }

  vibrate(pattern = [60]) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Ignored if not permitted by user gesture
      }
    }
  }

  // Classic supermarket barcode scanner beep (crisp high tone ~2050Hz)
  playBeep() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2093, now); // C7 supermarket beep tone

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3 * this.volume, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
      this.vibrate([70]);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  // Double beep when quantity increments (+1 on duplicate scan)
  playDoubleBeep() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // Beep 1 (2093Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2093, now);
      gain1.gain.setValueAtTime(0.25 * this.volume, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.05);

      // Beep 2 (2637Hz - E7 higher cheer)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2637, now + 0.07);
      gain2.gain.setValueAtTime(0.25 * this.volume, now + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.14);

      this.vibrate([40, 30, 40]);
    } catch (e) {
      console.warn('Double beep failed', e);
    }
  }

  // Success / Checkout Chime when ticket or grocery cart is finalized
  playCheckoutChime() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio
      notes.forEach((freq, idx) => {
        const now = this.ctx.currentTime + idx * 0.07;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.25 * this.volume, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
      });
      this.vibrate([50, 50, 100]);
    } catch (e) {
      console.warn('Chime failed', e);
    }
  }

  // Error buzz (e.g. invalid code or removed item)
  playErrorBuzz() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.18);

      gain.gain.setValueAtTime(0.2 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.21);
      this.vibrate([120, 60, 120]);
    } catch (e) {
      console.warn('Buzz failed', e);
    }
  }
}

window.soundEngine = new AudioManager();
