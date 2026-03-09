# F1 Racer

F1 Racer is a browser-based Formula 1 game built with React and Three.js. The project focuses on fast local iteration, custom 3D gameplay systems, and a polished racing experience without relying on a heavyweight game engine.

## Demo

Play the demo here:

https://agentzz1.github.io/f1-racer

## Highlights

- 3D racing in the browser with a custom gameplay loop
- Multiple AI opponents with overtaking and racing-line behavior
- Dynamic weather conditions and track-state changes
- ERS, DRS, camera switching, and a live race HUD
- Web Audio-based vehicle and environment sound design

## Controls

| Action | Key |
| --- | --- |
| Accelerate | `W` or `Up Arrow` |
| Brake / Reverse | `S` or `Down Arrow` |
| Steer Left | `A` or `Left Arrow` |
| Steer Right | `D` or `Right Arrow` |
| Use ERS | `Shift` |
| Change Camera | `C` |

## Tech Stack

- React 19
- Three.js
- Custom browser-side racing logic and physics systems
- Web Audio API for synthesized sound effects

## Local Development

```bash
git clone https://github.com/agentzz1/f1-racer.git
cd f1-racer
npm install
npm start
```

The development server starts on `http://localhost:3000`.

## Project Focus

This repository is primarily a gameplay and rendering experiment. The codebase is optimized for rapid iteration on browser-native 3D systems, race mechanics, and interface polish.

## License

MIT
