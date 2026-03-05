<div align="center">
  <h1>🏎️ React F1 Game</h1>
  <p><strong>A fully playable 3D Formula 1 racing game built entirely in the browser using React and Three.js.</strong></p>
  
  <p>
    <a href="https://agentzz1.github.io/react-f1-game"><strong>🎮 PLAY THE DEMO HERE!</strong></a>
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#controls">Controls</a> •
    <a href="#architecture">Architecture</a>
  </p>

  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/ThreeJs-black?style=for-the-badge&logo=three.js&logoColor=white" />
  <img src="https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white" />
</div>

---

> 🚀 **Want a taste of the speed?** Test your driving skills against 7 AI opponents with dynamic weather, proper physics, DRS, ERS, and realistic tire wear. All running locally in your browser!

![Gameplay Demo](/public/img/demo.gif)

## ✨ Features

- **🏎️ Proper Racing Physics:** Features realistic acceleration curves, drafting, drifting, sparks, and collisions.
- **🤖 7 Dynamic AI Opponents:** AI racers have different aggression levels, take racing lines, and pass intelligently.
- **🌧️ Dynamic Weather System:** Race in Clear, Overcast, or Storm conditions with realistic slippery tracks and rain effects.
- **🔋 Energy Recovery System (ERS) & DRS:** Manage your battery and use DRS zones to overtake opponents.
- **🚀 Web Audio Synthesis:** Engine RPM, tire screeching, and wind noise are procedurally generated directly in the browser via the Web Audio API!
- **📹 Dynamic Cameras:** Switch between Chase, Cockpit, and Broadcast TV cameras.
- **📊 Live HUD:** Real-time minimap, speedometer, tachometer, lap timer, and position tracker.

## 🚀 Quick Start

Want to run it locally or tweak the physics? It takes less than a minute.

**1. Clone the repository**
```bash
git clone https://github.com/agentzz1/react-f1-game.git
cd react-f1-game
```

**2. Install dependencies**
```bash
npm install
```

**3. Start the dev server**
```bash
npm start
```
The game will instantly open in your browser at `http://localhost:3000`.

## 🎮 Controls

| Action | Key |
| :--- | :--- |
| **Accelerate** | `W` or `Up Arrow` |
| **Brake/Reverse** | `S` or `Down Arrow` |
| **Steer Left** | `A` or `Left Arrow` |
| **Steer Right** | `D` or `Right Arrow` |
| **Use ERS (Boost)** | `Shift` (Hold) |
| **Change Camera** | `C` |

>*Tip: Don't hold accelerate through sharp corners! You will drift and ruin your lap time.*

## 🏗️ Architecture Stack

This project is built from scratch to push the limits of what's possible in a browser tab without heavy game engines like Unity or Unreal.

- **Frontend Framework:** `React 19`
- **3D Rendering Engine:** `Three.js`
- **Physics Engine:** Custom rigid-body simulation built in Javascript
- **Sound:** Native `Web Audio API` (Oscillators and gain nodes, no static `.mp3` engine loops!)
- **Assets:** Highly optimized `.glb` 3D models

## 🤝 Contributing

Contributions are always welcome! If you want to add new tracks, tuning options, or multiplayer:
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---
⭐ **If you enjoyed playing or poking around the code, please drop a star!** ⭐
