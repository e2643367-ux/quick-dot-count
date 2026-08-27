# DOT / SNAP — Structure

## 原則

Reactはゲームの額縁、Babylonは観測フィールドのキャンバス、ゲームルールはフレームワークに依存しないTypeScriptで持つ。UIの状態・回答受付・得点計算は `DotSnapGame` に集約し、BabylonのメッシュやDOMの見た目にルールを散らさない。

## モジュール

| パス | 責務 |
| --- | --- |
| `client/src/components/GameCanvas.tsx` | StrictModeに安全なBabylonエンジンの初期化・破棄と、ゲーム用オーバーレイの保持。 |
| `client/src/game/scene.ts` | Babylonシーン、正投影カメラ、粒子ドット、背景の生成と、React側へ操作を公開する `GameHandle`。 |
| `client/src/game/DotSnapGame.ts` | ラウンド状態、正解数、得点、連続正解、ランダム点配置、デモ進行を保持する純粋なゲーム制御器。 |
| `client/src/pages/Home.tsx` | `GameCanvas` だけをルート表示する。 |
| `client/src/index.css` | ルミナ・パルスのテーマ、レイアウト、状態演出、レスポンシブ規則。 |

## 状態モデル

```text
intro → reveal → answer → result → (reveal | complete)
```

`reveal` は点をレンダリングするが入力を無効化する。`answer` は点を消し、数字入力だけを許可する。`result` は実数・回答・誤差を凍結して表示する。

観測点はBabylonキャンバスの描画と、アクセシビリティおよび高コントラストを担保する同一データ由来のDOM前景描画を重ねる。どちらも `dotsVisible` だけで同期し、回答状態では同時に消える。高密度時はDOM前景が全点を表示し、Babylon側は180点までの補助描画に留めるため、個数の正確さとフレームレートを両立する。

## Asset Hints

| 資産 | 使用箇所 | 表示サイズ |
| --- | --- | --- |
| `lumina-pulse-background` | 全画面の背景 | ビューポート全体、cover |
| `lumina-pulse-logo` | 左上のブランドマーク、favicon | 48×48 px / 64×64 px |
| `lumina-pulse-spark` | 正解時の観測フィールド中央 | 180×180 px |
| `lumina-pulse-reference` | 視覚QAの基準 | 16:9・実行時は非表示 |
