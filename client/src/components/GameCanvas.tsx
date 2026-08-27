// ルミナ・パルス: 非対称の計測レールと観測フィールドで、一瞬の判断を主役にする画面。
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Pause, Play, RotateCcw, Sparkles, Zap } from "lucide-react";
import { DotSnapGame, type GameSnapshot } from "@/game/DotSnapGame";
import { EffectSounds } from "@/game/EffectSounds";
import { createGameScene, type GameHandle } from "@/game/scene";

const ASSET_BASE = import.meta.env.BASE_URL;
const LOGO_URL = `${ASSET_BASE}lumina-pulse-logo.png`;
const SPARK_URL = `${ASSET_BASE}lumina-pulse-spark.png`;
const BACKGROUND_URL = `${ASSET_BASE}lumina-pulse-background.jpg`;

const initialState: GameSnapshot = {
  phase: "intro",
  round: 0,
  tier: 1,
  revealDuration: 1150,
  revealProgress: 0,
  score: 0,
  scoreGain: 0,
  bestScore: 0,
  streak: 0,
  comboMultiplier: 1,
  bestStreak: 0,
  correctAnswers: 0,
  targetCount: 0,
  answer: null,
  difference: null,
  correct: null,
  dots: [],
  dotsVisible: false,
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const handleRef = useRef<GameHandle | null>(null);
  const gameRef = useRef<DotSnapGame | null>(null);
  const snapshotRef = useRef<GameSnapshot>(initialState);
  const keyboardTimerRef = useRef<number | null>(null);
  const keyboardBufferRef = useRef("");
  const soundRef = useRef<EffectSounds | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(initialState);
  const [manualAnswer, setManualAnswer] = useState("");
  const isDemo = new URLSearchParams(window.location.search).has("demo");
  const roundProgress = snapshot.round ? (((snapshot.round - 1) % 5) + 1) * 20 : 0;
  const streakProgress = Math.min(snapshot.streak * 20, 100);
  if (!soundRef.current) soundRef.current = new EffectSounds();

  const updateSnapshot = (next: GameSnapshot) => {
    const previous = snapshotRef.current;
    snapshotRef.current = next;
    setSnapshot(next);
    if (next.dots !== previous.dots || next.dotsVisible !== previous.dotsVisible) {
      handleRef.current?.setDots(next.dots, next.dotsVisible);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    let disposed = false;
    let game: DotSnapGame | null = null;
    let handle: GameHandle | null = null;

    const syncFieldBounds = () => {
      const rect = fieldRef.current?.getBoundingClientRect();
      if (!rect) return;
      handleRef.current?.setFieldBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };

    createGameScene(engine, canvas).then((createdHandle) => {
      if (disposed) {
        createdHandle.dispose();
        return;
      }
      handle = createdHandle;
      handleRef.current = handle;
      game = new DotSnapGame({ onChange: updateSnapshot, onEffect: (effect) => soundRef.current?.play(effect), demo: isDemo });
      gameRef.current = game;
      engine.runRenderLoop(() => createdHandle.scene.render());
      if (isDemo) game.start();
      window.setTimeout(syncFieldBounds, 0);
    });

    const onResize = () => {
      engine.resize();
      syncFieldBounds();
    };
    const observer = new ResizeObserver(syncFieldBounds);
    if (fieldRef.current) observer.observe(fieldRef.current);
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      if (keyboardTimerRef.current) window.clearTimeout(keyboardTimerRef.current);
      game?.dispose();
      soundRef.current?.dispose();
      handle?.dispose();
      handleRef.current = null;
      gameRef.current = null;
      engine.dispose();
      startedRef.current = false;
    };
  }, [isDemo]);

  useEffect(() => {
    if (snapshot.phase !== "answer") setManualAnswer("");
  }, [snapshot.phase, snapshot.round]);

  useEffect(() => {
    const clearKeyboardBuffer = () => {
      keyboardBufferRef.current = "";
      if (keyboardTimerRef.current) window.clearTimeout(keyboardTimerRef.current);
      keyboardTimerRef.current = null;
    };
    const submitBuffered = () => {
      const value = Number(keyboardBufferRef.current);
      clearKeyboardBuffer();
      if (value >= 1 && value <= 20) gameRef.current?.submit(value);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        gameRef.current?.togglePause();
        return;
      }
      if (event.target instanceof HTMLInputElement || snapshotRef.current.phase !== "answer" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Backspace") {
        clearKeyboardBuffer();
        return;
      }
      if (!/^\d$/.test(event.key) || event.key === "0") return;
      event.preventDefault();
      const next = `${keyboardBufferRef.current}${event.key}`;
      if (Number(next) > 20) {
        clearKeyboardBuffer();
        keyboardBufferRef.current = event.key;
      } else {
        keyboardBufferRef.current = next;
      }
      if (keyboardBufferRef.current.length === 2) submitBuffered();
      else {
        if (keyboardTimerRef.current) window.clearTimeout(keyboardTimerRef.current);
        keyboardTimerRef.current = window.setTimeout(submitBuffered, 360);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const start = () => { soundRef.current?.unlock(); gameRef.current?.start(); };
  const submit = (value: number) => { soundRef.current?.unlock(); gameRef.current?.submit(value); };
  const submitManualAnswer = () => {
    const value = Number(manualAnswer);
    if (Number.isInteger(value) && value > 0) submit(value);
  };
  const nextRound = () => gameRef.current?.nextRound();
  const togglePause = () => gameRef.current?.togglePause();
  const reset = () => gameRef.current?.reset();
  const canPause = snapshot.phase !== "intro" && snapshot.phase !== "levelup";

  return (
    <main className="game-root" style={{ "--game-background": `url(${BACKGROUND_URL})` } as CSSProperties}>
      <canvas ref={canvasRef} className="game-canvas" aria-hidden="true" />
      <div className="ambient-line ambient-line-a" />
      <div className="ambient-line ambient-line-b" />
      <div className="game-shell">
        <aside className="measurement-rail" aria-label="ゲーム情報">
          <div className="brand-lockup">
            <img className="brand-mark" src={LOGO_URL} alt="DOT SNAP" />
            <div><p className="eyebrow">VISUAL REACTION / 01</p><h1>DOT <span>/</span> SNAP</h1></div>
          </div>
          <div className="rail-statement"><p>光った数を、</p><strong>直感で。</strong></div>
          <dl className="metrics">
            <div><dt>ROUND</dt><dd>{String(snapshot.round).padStart(2, "0")}<small> / ∞</small></dd></div>
            <div><dt>SCORE</dt><dd>{String(snapshot.score).padStart(3, "0")}</dd></div>
            <div><dt>STREAK</dt><dd>{String(snapshot.streak).padStart(2, "0")}</dd></div>
            <div><dt>BEST</dt><dd>{String(snapshot.bestScore).padStart(3, "0")}</dd></div>
          </dl>
          <div className="pulse-meter" aria-label="ラウンドと連続正解の進行状況">
            <div className="meter-copy"><span>ROUND PULSE</span><b>LV {snapshot.tier}</b></div>
            <div className="meter-track"><i style={{ width: `${roundProgress}%` }} /></div>
            <div className="meter-copy"><span>COMBO MULTIPLIER</span><b>× {snapshot.comboMultiplier.toFixed(1)}</b></div>
            <div className="meter-track streak-track"><i style={{ width: `${streakProgress}%` }} /></div>
          </div>
          <div className="rail-footer">
            <span className={`signal-dot ${snapshot.phase === "reveal" ? "is-live" : ""}`} />
            <p>{snapshot.phase === "paused" ? "SIGNAL ON HOLD" : snapshot.phase === "levelup" ? "PACE INCREASED" : snapshot.phase === "reveal" ? "SIGNAL DETECTED" : snapshot.phase === "answer" ? "AWAITING INPUT" : "READY FOR TEST"}</p>
          </div>
        </aside>

        <section className="play-column" aria-label="DOT SNAP プレイフィールド">
          <div className="topline">
            <p>PERCEPTION DRILL</p>
            <div className="session-controls">
              <button onClick={togglePause} disabled={!canPause} aria-label={snapshot.phase === "paused" ? "ゲームを再開" : "ゲームを一時停止"}>
                {snapshot.phase === "paused" ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}<span>{snapshot.phase === "paused" ? "RESUME" : "PAUSE"}</span>
              </button>
              <button onClick={reset} disabled={snapshot.phase === "intro"} aria-label="ゲームをリセット"><RotateCcw size={13} aria-hidden="true" /><span>RESET</span></button>
            </div>
          </div>
          <div ref={fieldRef} className={`observation-field phase-${snapshot.phase}`}>
            <i className="bracket bracket-tl" /><i className="bracket bracket-tr" /><i className="bracket bracket-bl" /><i className="bracket bracket-br" />
            <div className="field-index">OBSERVATION WINDOW <span>{String(snapshot.round || 1).padStart(3, "0")}</span></div>
            <div className={`signal-residue ${snapshot.phase === "reveal" ? "is-tracking" : ""}`} aria-hidden="true"><span className="residue-label">PULSE MEMORY</span><i className="residue-ring ring-one" /><i className="residue-ring ring-two" /><i className="residue-axis axis-x" /><i className="residue-axis axis-y" /></div>
            {(snapshot.phase === "reveal" || (snapshot.phase === "paused" && snapshot.revealProgress > 0)) && <div className={`reveal-timer ${snapshot.phase === "paused" ? "is-paused" : ""}`} aria-label={`点の表示残り時間 ${Math.ceil(snapshot.revealProgress * 100)} パーセント`}><div className="timer-copy"><span>{snapshot.phase === "paused" ? "SIGNAL HELD" : "FLASH WINDOW"}</span><b>{Math.ceil(snapshot.revealProgress * 100)}%</b></div><div className="timer-track"><i style={{ transform: `scaleX(${snapshot.revealProgress})` }} /></div></div>}
            {snapshot.dotsVisible && <div className="dot-field" aria-label="点が表示されています">{snapshot.dots.map((dot, index) => <span key={`${snapshot.round}-${index}`} className={`count-dot dot-${dot.accent} ${snapshot.dots.length > 35 ? "dense-dot" : ""}`} style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%`, "--dot-size": `${Math.max(6, Math.min(27, 152 / Math.sqrt(snapshot.dots.length)))}px` } as CSSProperties} />)}</div>}

            {snapshot.phase === "intro" && <div className="field-content intro-content"><p className="stage-kicker">ENDLESS SIGNAL / NO DOT LIMIT</p><h2>数えるな。<br /><em>見抜け。</em></h2><p className="stage-copy">シグナルは続きます。5ラウンドごとに、点の数と密度は上がり続けます。</p><button className="primary-action" onClick={start}><Zap aria-hidden="true" size={17} />エンドレスを開始</button><p className="key-hint">1–20は数字キー、21以上は入力欄で回答</p></div>}
            {snapshot.phase === "reveal" && <div className="field-content reveal-content" aria-live="polite"><p className="stage-kicker"><span className="live-mark" /> SIGNAL LIVE</p><h2>見えるままに。</h2><p>視線を止めず、量感をつかむ。</p></div>}
            {snapshot.phase === "answer" && <div className="field-content answer-content"><p className="stage-kicker">SIGNAL LOST</p><h2>いくつだった？</h2><p className="stage-copy">1–20はショートカット。21個以上だと思ったら、数値を直接入力してください。</p><div className="answer-grid" aria-label="1個から20個までの答えを選ぶ">{Array.from({ length: 20 }, (_, index) => index + 1).map((value) => <button key={value} onClick={() => submit(value)} aria-label={`${value} 個`}>{String(value).padStart(2, "0")}</button>)}</div><div className="manual-answer"><label htmlFor="manual-answer">21以上の回答</label><input id="manual-answer" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={manualAnswer} onChange={(event) => setManualAnswer(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") submitManualAnswer(); }} placeholder="例: 24" aria-label="21個以上の回答を数値で入力" /><button onClick={submitManualAnswer} disabled={!manualAnswer}>送信</button></div></div>}
            {snapshot.phase === "paused" && <div className="field-content pause-content"><p className="stage-kicker">SIGNAL ON HOLD</p><h2>一瞬を、<br /><em>止める。</em></h2><p className="stage-copy">表示状態とスコアを保ったまま、一時停止しています。</p><button className="primary-action" onClick={togglePause}><Play aria-hidden="true" size={17} />続きから再開</button><p className="key-hint">スペースキーでも再開できます</p></div>}
            {snapshot.phase === "levelup" && <div className="field-content levelup-content" aria-live="polite"><p className="stage-kicker">DENSITY UNLOCKED</p><div className="level-orbit" aria-hidden="true"><i /><i /><b>LV</b></div><div className="level-number">{String(snapshot.tier).padStart(2, "0")}</div><h2>限界の、<em>その先へ。</em></h2><p className="stage-copy">点の数は上限なく増えます。密度が、次の反射を試します。</p></div>}
            {snapshot.phase === "result" && <div className={`field-content result-content ${snapshot.correct ? "is-correct" : "is-miss"}`}>{snapshot.correct && <img className="spark" src={SPARK_URL} alt="" />}<p className="stage-kicker">{snapshot.correct ? "EXACT HIT" : "NEAR MISS"}</p><h2>{snapshot.correct ? "その一瞬を、捉えた。" : "誤差は、あと一歩。"}</h2>{snapshot.correct && <div className="combo-result"><span>COMBO × {snapshot.comboMultiplier.toFixed(1)}</span><b>+{snapshot.scoreGain} PTS</b></div>}<div className="result-numbers"><span><b>{String(snapshot.targetCount).padStart(2, "0")}</b>実際の数</span><span><b>{String(snapshot.answer ?? 0).padStart(2, "0")}</b>あなたの答え</span><span><b>{String(snapshot.difference ?? 0).padStart(2, "0")}</b>誤差</span></div><button className="primary-action" onClick={nextRound}>次のシグナル</button></div>}
          </div>
          <div className="field-footnote"><span><Sparkles size={14} aria-hidden="true" /> FAST VISUAL ESTIMATION</span><span>DOTS WILL VANISH</span></div>
        </section>
      </div>
    </main>
  );
}
