// ルミナ・パルス: 点を主役にし、毎回新しいランダム出題・コンボ・状態遷移を明快に保つゲームロジック。
import type { EffectSound } from "./EffectSounds";

export type GamePhase = "intro" | "reveal" | "answer" | "result" | "paused" | "levelup";
type PlayPhase = "reveal" | "answer" | "result";

export type DotPoint = {
  x: number;
  y: number;
  accent: "lime" | "coral" | "sky";
};

export type GameSnapshot = {
  phase: GamePhase;
  round: number;
  tier: number;
  revealDuration: number;
  revealProgress: number;
  score: number;
  scoreGain: number;
  bestScore: number;
  streak: number;
  comboMultiplier: number;
  bestStreak: number;
  correctAnswers: number;
  targetCount: number;
  answer: number | null;
  difference: number | null;
  correct: boolean | null;
  dots: DotPoint[];
  dotsVisible: boolean;
};

type DotSnapOptions = {
  onChange: (snapshot: GameSnapshot) => void;
  onEffect?: (effect: EffectSound) => void;
  demo?: boolean;
};

const BEST_SCORE_KEY = "dot-snap-best-score";

export class DotSnapGame {
  private readonly options: DotSnapOptions;
  private timers = new Set<number>();
  private progressTimer: number | null = null;
  private phase: GamePhase = "intro";
  private phaseBeforePause: PlayPhase | null = null;
  private revealDeadline = 0;
  private remainingRevealDuration = 0;
  private revealProgress = 0;
  private round = 0;
  private score = 0;
  private scoreGain = 0;
  private bestScore = 0;
  private streak = 0;
  private comboMultiplier = 1;
  private bestStreak = 0;
  private correctAnswers = 0;
  private targetCount = 0;
  private answer: number | null = null;
  private difference: number | null = null;
  private correct: boolean | null = null;
  private dots: DotPoint[] = [];
  private dotsVisible = false;
  private tier = 1;
  private revealDuration = 1150;

  constructor(options: DotSnapOptions) {
    this.options = options;
    this.bestScore = this.readBestScore();
    this.emit();
  }

  start() {
    if (this.phase !== "intro") return;
    this.clearTimers();
    this.round = 0;
    this.score = 0;
    this.scoreGain = 0;
    this.streak = 0;
    this.comboMultiplier = 1;
    this.bestStreak = 0;
    this.correctAnswers = 0;
    this.tier = 1;
    this.revealDuration = 1150;
    this.revealProgress = 0;
    this.beginRound();
  }

  reset() {
    this.clearTimers();
    this.phase = "intro";
    this.phaseBeforePause = null;
    this.revealDeadline = 0;
    this.remainingRevealDuration = 0;
    this.revealProgress = 0;
    this.round = 0;
    this.score = 0;
    this.scoreGain = 0;
    this.streak = 0;
    this.comboMultiplier = 1;
    this.bestStreak = 0;
    this.correctAnswers = 0;
    this.targetCount = 0;
    this.answer = null;
    this.difference = null;
    this.correct = null;
    this.dots = [];
    this.dotsVisible = false;
    this.tier = 1;
    this.revealDuration = 1150;
    this.emit();
  }

  togglePause() {
    if (this.phase === "paused") {
      this.resume();
      return;
    }
    if (this.phase !== "reveal" && this.phase !== "answer" && this.phase !== "result") return;
    this.phaseBeforePause = this.phase;
    if (this.phase === "reveal") {
      this.remainingRevealDuration = Math.max(50, this.revealDeadline - Date.now());
      this.revealProgress = Math.max(0, this.remainingRevealDuration / this.revealDuration);
    }
    this.clearTimers();
    this.phase = "paused";
    this.emit();
  }

  submit(value: number) {
    if (this.phase !== "answer" || !Number.isInteger(value) || value < 1) return;
    this.answer = value;
    this.difference = Math.abs(value - this.targetCount);
    this.correct = this.difference === 0;
    this.dotsVisible = false;
    this.revealProgress = 0;

    if (this.correct) {
      const nextStreak = this.streak + 1;
      this.comboMultiplier = 1 + Math.floor((nextStreak - 1) / 3) * 0.5;
      this.scoreGain = Math.round(100 * this.comboMultiplier + (nextStreak - 1) * 15);
      this.correctAnswers += 1;
      this.score += this.scoreGain;
      this.streak = nextStreak;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        this.writeBestScore();
      }
      this.options.onEffect?.("correct");
    } else {
      this.scoreGain = 0;
      this.streak = 0;
      this.comboMultiplier = 1;
      this.options.onEffect?.("incorrect");
    }

    this.phase = "result";
    this.emit();
    if (this.options.demo) this.queue(() => this.nextRound(), 820);
  }

  nextRound() {
    if (this.phase !== "result") return;
    this.clearTimers();
    this.beginRound();
  }

  dispose() {
    this.clearTimers();
  }

  private resume() {
    const phase = this.phaseBeforePause;
    if (!phase) return;
    this.phaseBeforePause = null;
    this.phase = phase;
    this.emit();
    if (phase === "reveal") this.startRevealCountdown(this.remainingRevealDuration || this.revealDuration);
    if (phase === "result" && this.options.demo) this.queue(() => this.nextRound(), 820);
  }

  private beginRound() {
    this.round += 1;
    this.answer = null;
    this.difference = null;
    this.correct = null;
    this.scoreGain = 0;
    this.revealProgress = 0;
    this.tier = 1 + Math.floor((this.round - 1) / 5);
    this.targetCount = this.getRoundCount(this.round);
    this.dots = this.createDots(this.targetCount);
    this.revealDuration = this.options.demo ? 5000 : Math.max(180, 1150 - (this.tier - 1) * 118 - ((this.round - 1) % 5) * 32);

    if (this.round > 1 && (this.round - 1) % 5 === 0) {
      this.dotsVisible = false;
      this.phase = "levelup";
      this.options.onEffect?.("levelup");
      this.emit();
      this.queue(() => this.showSignal(), 820);
      return;
    }
    this.showSignal();
  }

  private showSignal() {
    this.dotsVisible = true;
    this.phase = "reveal";
    this.emit();
    this.startRevealCountdown(this.revealDuration);
  }

  private startRevealCountdown(milliseconds: number) {
    this.stopProgressTimer();
    this.remainingRevealDuration = milliseconds;
    this.revealDeadline = Date.now() + milliseconds;
    this.revealProgress = Math.min(1, milliseconds / this.revealDuration);
    this.progressTimer = window.setInterval(() => {
      if (this.phase !== "reveal") return;
      this.remainingRevealDuration = Math.max(0, this.revealDeadline - Date.now());
      this.revealProgress = Math.max(0, this.remainingRevealDuration / this.revealDuration);
      this.emit();
    }, 42);
    this.queue(() => {
      if (this.phase !== "reveal") return;
      this.stopProgressTimer();
      this.phase = "answer";
      this.dotsVisible = false;
      this.revealProgress = 0;
      this.emit();
      if (this.options.demo) this.queue(() => this.submit(this.targetCount), 520);
    }, milliseconds);
  }

  private getRoundCount(round: number) {
    const tier = 1 + Math.floor((round - 1) / 5);
    const floor = 2 + tier * 2;
    const ceiling = floor + 3 + Math.ceil(tier * 0.75);
    return floor + Math.floor(this.nextRandom() * (ceiling - floor + 1));
  }

  private createDots(count: number) {
    const points: DotPoint[] = [];
    const minimumDistance = Math.max(0.022, Math.min(0.14, 0.29 / Math.sqrt(count)));
    let attempts = 0;
    while (points.length < count && attempts < Math.min(Math.max(1600, count * 80), 20000)) {
      attempts += 1;
      const candidate: DotPoint = { x: 0.12 + this.nextRandom() * 0.76, y: 0.14 + this.nextRandom() * 0.72, accent: this.pickAccent(points.length) };
      const safe = points.every((point) => Math.hypot(point.x - candidate.x, point.y - candidate.y) > minimumDistance);
      if (safe) points.push(candidate);
    }
    while (points.length < count) points.push({ x: 0.12 + this.nextRandom() * 0.76, y: 0.14 + this.nextRandom() * 0.72, accent: this.pickAccent(points.length) });
    return points;
  }

  private pickAccent(index: number): DotPoint["accent"] {
    if (index % 7 === 5) return "coral";
    if (index % 9 === 7) return "sky";
    return "lime";
  }

  private nextRandom() {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] / 4294967296;
    }
    return Math.random();
  }

  private queue(callback: () => void, milliseconds: number) {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, milliseconds);
    this.timers.add(timer);
  }

  private clearTimers() {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.clear();
    this.stopProgressTimer();
  }

  private stopProgressTimer() {
    if (this.progressTimer) window.clearInterval(this.progressTimer);
    this.progressTimer = null;
  }

  private readBestScore() {
    try {
      const value = Number(window.localStorage.getItem(BEST_SCORE_KEY));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch { return 0; }
  }

  private writeBestScore() {
    try { window.localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore)); } catch { /* 保存領域がなくてもゲームは継続する。 */ }
  }

  private emit() {
    this.options.onChange({
      phase: this.phase, round: this.round, tier: this.tier, revealDuration: this.revealDuration, revealProgress: this.revealProgress,
      score: this.score, scoreGain: this.scoreGain, bestScore: this.bestScore, streak: this.streak, comboMultiplier: this.comboMultiplier,
      bestStreak: this.bestStreak, correctAnswers: this.correctAnswers, targetCount: this.targetCount, answer: this.answer,
      difference: this.difference, correct: this.correct, dots: this.dots, dotsVisible: this.dotsVisible,
    });
  }
}
