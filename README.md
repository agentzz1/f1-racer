<div align="center">

# 🏎️ F1 Racer

### A full 3D Formula 1 racing game in your browser — React + Three.js, no game engine needed.

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-3D-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Lines of Code](https://img.shields.io/badge/LOC-~1700-blue?style=for-the-badge)]()
[![No Game Engine](https://img.shields.io/badge/Game_Engine-None_🤯-red?style=for-the-badge)]()

<br />

**Race a Red Bull RB19 against 7 AI opponents through dynamic weather, activate DRS on the straights, manage your ERS battery, and fight for the fastest lap — all rendered in real-time 3D inside a browser tab.**

<br />

[<img src="https://img.shields.io/badge/▶_PLAY_NOW-00C853?style=for-the-badge&logoColor=white&logo=googlechrome" height="50" />](https://agentzz1.github.io/f1-racer/)

<sub>No install. No download. Just click and race.</sub>

<br />

<!-- Replace with actual gameplay GIF/screenshot -->
<!-- ![F1 Racer Gameplay](docs/gameplay.gif) -->
> 🎬 *GIF / Screenshot coming soon — star the repo to stay updated!*

</div>

---

## ⚡ What Makes This Insane

This isn't a demo. It's not a proof of concept. It's a **~1700-line, single-file, fully playable 3D racing game** with:

| Feature | Details |
|---|---|
| 🏎️ **Real 3D Car Model** | Red Bull RB19 GLB model loaded via GLTFLoader |
| 🧲 **Racing Physics** | Acceleration curves, braking, steering, drift mechanics |
| 🌬️ **DRS System** | Drag Reduction System — activate in slipstream zones for a speed boost |
| 🔋 **ERS System** | Energy Recovery System — deploy stored energy for bursts of power |
| 🤖 **7 AI Opponents** | Each with different aggression levels and racing lines |
| 🌧️ **Dynamic Weather** | Clear → Overcast → Storm with real-time rain particles |
| 🎥 **3 Camera Modes** | Chase cam, Cockpit view, Broadcast camera |
| 🔊 **Synthesized Engine Audio** | Exhaust resonance, turbo whine, gear shift sounds — all Web Audio API |
| 💨 **Tire Smoke & Sparks** | Particle effects on hard braking and barrier contact |
| ⏱️ **Lap Timing** | Sector splits, best lap tracking, race position |
| 💥 **Damage System** | Hit the barriers and feel the consequences |
| 🗺️ **Live Minimap** | Track overview with all car positions |
| 📊 **Full HUD** | Speed, RPM, gear indicator, lap counter, ERS bar, damage meter |
| ⚙️ **Tuning Panel** | Adjust max speed, acceleration, steering sensitivity, brake power, AI difficulty |
| 🎨 **Quality Presets** | Auto-detected based on your hardware — runs smooth on laptops too |

**Zero dependencies on Unity, Unreal, Godot, or any game engine. Pure web tech.**

---

## 🎮 Controls

| Key | Action |
|---|---|
| `↑` / `W` | Accelerate |
| `↓` / `S` | Brake / Reverse |
| `←` / `→` or `A` / `D` | Steer |
| `Space` | Drift / Handbrake |
| `D` | Activate DRS |
| `E` | Deploy ERS |
| `C` | Cycle Camera Mode |

---

## 🚀 Quick Start

```bash
git clone https://github.com/agentzz1/f1-racer.git
cd f1-racer
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) and start racing.

---

## 🛠️ Tech Stack

```
┌─────────────────────────────────────────────┐
│              No Unity. No Unreal.           │
│          Just React + Three.js.             │
└─────────────────────────────────────────────┘
```

| Layer | Technology |
|---|---|
| **UI & State** | React 19 |
| **3D Rendering** | Three.js + GLTFLoader |
| **Audio Engine** | Web Audio API (OscillatorNode, BiquadFilter, GainNode) |
| **Physics** | Custom — velocity, friction, collision detection, drift model |
| **Particles** | Three.js Points + BufferGeometry (smoke, rain, sparks) |

---

## 🏗️ Architecture

The entire game runs in a **single React component** using `useRef`, `useEffect`, and `requestAnimationFrame` — no external game loop library.

```
┌──────────────────────────────────────────────────────┐
│                    React Component                   │
│                                                      │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Three.js │  │  Physics   │  │   Web Audio API  │  │
│  │  Scene   │◄─┤  Engine    │  │   Sound Engine   │  │
│  │          │  │            │  │                  │  │
│  │ • Camera │  │ • Velocity │  │ • Exhaust tone   │  │
│  │ • Lights │  │ • Steering │  │ • Turbo whine    │  │
│  │ • Models │  │ • Drift    │  │ • Gear shifts    │  │
│  │ • Particles│ │ • Collision│  │ • Rev matching   │  │
│  └────┬─────┘  └─────┬─────┘  └────────┬─────────┘  │
│       │               │                 │            │
│       └───────────────┼─────────────────┘            │
│                       ▼                              │
│              requestAnimationFrame()                 │
│              ~~~~~~~~~~~~~~~~~~~~~~~~                │
│              60 FPS game loop driving                │
│              rendering, physics & audio              │
└──────────────────────────────────────────────────────┘
```

**How it fits together:**
- **Physics** runs every frame: updates car position, checks collisions, applies friction/drift
- **Rendering** reads physics state and updates Three.js object transforms
- **Audio** maps RPM + gear + speed → oscillator frequencies for real-time engine sound
- **AI** follows racing lines with per-opponent aggression, braking points, and overtake logic
- **Weather** dynamically spawns/removes rain particles and adjusts track grip

---

## 📸 Screenshots

<!-- Replace these with actual screenshots -->
<div align="center">

| Chase Camera | Cockpit View | Broadcast |
|---|---|---|
| *Coming soon* | *Coming soon* | *Coming soon* |

| Rain Weather | DRS Zone | Minimap |
|---|---|---|
| *Coming soon* | *Coming soon* | *Coming soon* |

</div>

> **Want to contribute screenshots?** Play a few laps, capture some epic moments, and open a PR!

---

## 🤝 Contributing

Found a bug? Want to add a new track? Improve the physics model? PRs are welcome!

1. Fork it
2. Create your branch (`git checkout -b feature/monza-circuit`)
3. Commit your changes (`git commit -m 'Add Monza circuit'`)
4. Push (`git push origin feature/monza-circuit`)
5. Open a Pull Request

---

## 📄 License

MIT — do whatever you want with it. See [LICENSE](LICENSE) for details.

---

<div align="center">

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=agentzz1/f1-racer&type=Date)](https://star-history.com/#agentzz1/f1-racer&Date)

<br />

**If you think a full 3D racing game in the browser with no game engine is cool, smash that ⭐ button.**

<sub>Built with 🏁 caffeine and questionable physics by <a href="https://github.com/agentzz1">@agentzz1</a></sub>

</div>
