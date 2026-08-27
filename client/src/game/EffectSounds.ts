// ルミナ・パルス: 追加ファイルなしで、正誤とレベルアップを聞き分けられる短い効果音を合成する。
export type EffectSound = "correct" | "incorrect" | "levelup";

export class EffectSounds {
  private context: AudioContext | null = null;

  unlock() {
    const context = this.getContext();
    if (context?.state === "suspended") void context.resume();
  }

  play(effect: EffectSound) {
    const context = this.getContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime + 0.01;
    if (effect === "correct") {
      this.tone(context, now, 523.25, 0.11, "sine", 0.055, 659.25);
      this.tone(context, now + 0.075, 783.99, 0.16, "triangle", 0.045, 1046.5);
      return;
    }
    if (effect === "incorrect") {
      this.tone(context, now, 196, 0.18, "sawtooth", 0.045, 118);
      this.tone(context, now + 0.09, 155, 0.2, "triangle", 0.035, 92);
      return;
    }
    this.tone(context, now, 392, 0.12, "triangle", 0.05, 493.88);
    this.tone(context, now + 0.1, 587.33, 0.14, "triangle", 0.052, 739.99);
    this.tone(context, now + 0.21, 783.99, 0.22, "sine", 0.06, 1046.5);
  }

  dispose() {
    if (this.context && this.context.state !== "closed") void this.context.close();
    this.context = null;
  }

  private getContext() {
    if (typeof window === "undefined") return null;
    if (!this.context) {
      const AudioConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioConstructor) return null;
      this.context = new AudioConstructor();
    }
    return this.context;
  }

  private tone(context: AudioContext, start: number, frequency: number, duration: number, type: OscillatorType, gainAmount: number, endFrequency: number) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainAmount, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

