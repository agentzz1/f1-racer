import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import './index.css';

const TOTAL_LAPS = 5;
const TRACK_WIDTH = 20;
const CAMERA_MODES = ['CHASE', 'COCKPIT', 'BROADCAST'];
const DRS_ZONES = [[0, 0.12], [0.25, 0.39]];
const WEATHER_PRESETS = [
  { name: 'CLEAR', rain: 0.0, fog: 0.0019, sun: 1.25, ambient: 0.32, top: '#08132d', mid: '#225884', bot: '#f5b36b' },
  { name: 'OVERCAST', rain: 0.3, fog: 0.0028, sun: 0.85, ambient: 0.42, top: '#1f2d44', mid: '#4b6179', bot: '#aeb4bc' },
  { name: 'STORM', rain: 0.75, fog: 0.0038, sun: 0.52, ambient: 0.26, top: '#0c1220', mid: '#1d2c3d', bot: '#45576c' }
];

const TRACK_POINTS = [
  [0, 0, 0], [80, 0, 0], [110, 6, -20], [130, 12, -50], [140, 15, -80], [130, 12, -110], [140, 8, -140],
  [160, 4, -160], [200, 2, -170], [250, 0, -175], [280, -2, -160], [290, -4, -130], [280, -4, -90],
  [260, -2, -60], [240, 0, -40], [200, 2, -30], [160, 4, -20], [120, 2, 20], [80, 0, 40], [40, 0, 50],
  [0, 0, 55], [-40, -2, 50], [-60, -2, 35], [-50, -2, 10], [-25, -1, 0]
];

const DEFAULT_SETTINGS = {
  maxSpeed: 320,
  acceleration: 68,
  steering: 58,
  brakePower: 70,
  aiLevel: 62
};

const DEFAULT_CAREER_STATS = {
  races: 0,
  wins: 0,
  podiums: 0,
  bestLap: null,
  lastPosition: null,
  lastWeather: 'CLEAR',
  recentResults: []
};

const QUALITY_PRESETS = {
  low: {
    label: 'PERFORMANCE',
    antialias: false,
    maxPixelRatio: 0.85,
    minPixelRatio: 0.6,
    logarithmicDepthBuffer: false,
    shadowMapEnabled: false,
    shadowMapSize: 0,
    rainCount: 260,
    rainUpdateInterval: 0.05,
    skyResolution: 256,
    skySegments: 24,
    skyUpdateInterval: 0.24,
    minimapInterval: 0.22,
    minimapSize: 170,
    groundSegments: 140,
    trackSamples: 540,
    terrainCheckStep: 6,
    treeCount: 650,
    barrierStep: 4,
    smokeCount: 72,
    sparkCount: 48,
    grassAnisotropy: 2,
    wheelSegments: 10,
    shadowUpdateInterval: 0.3,
    useDetailedCarModel: false
  },
  medium: {
    label: 'BALANCED',
    antialias: true,
    maxPixelRatio: 1.05,
    minPixelRatio: 0.8,
    logarithmicDepthBuffer: false,
    shadowMapEnabled: true,
    shadowMapSize: 1024,
    rainCount: 700,
    rainUpdateInterval: 0.033,
    skyResolution: 512,
    skySegments: 32,
    skyUpdateInterval: 0.16,
    minimapInterval: 0.14,
    minimapSize: 200,
    groundSegments: 220,
    trackSamples: 660,
    terrainCheckStep: 5,
    treeCount: 1200,
    barrierStep: 3,
    smokeCount: 96,
    sparkCount: 64,
    grassAnisotropy: 4,
    wheelSegments: 12,
    shadowUpdateInterval: 0.18,
    useDetailedCarModel: true
  }
};

const detectQualityPreset = () => {
  if (typeof window === 'undefined') return QUALITY_PRESETS.medium;
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
  const memory = typeof navigator !== 'undefined' ? (navigator.deviceMemory || 4) : 4;
  const dpr = window.devicePixelRatio || 1;
  const smallViewport = window.innerWidth < 1180 || window.innerHeight < 720;
  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (cores <= 6 || memory <= 6 || dpr > 1.5 || smallViewport || reducedMotion) return QUALITY_PRESETS.low;
  return QUALITY_PRESETS.medium;
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const normAngle = (a) => {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
};

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
};

const inDrsZone = (t) => DRS_ZONES.some(([a, b]) => t >= a && t <= b);

const loadSettings = () => {
  try {
    const raw = localStorage.getItem('f1-pro-settings');
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      maxSpeed: clamp(Number(parsed.maxSpeed) || DEFAULT_SETTINGS.maxSpeed, 220, 360),
      acceleration: clamp(Number(parsed.acceleration) || DEFAULT_SETTINGS.acceleration, 30, 100),
      steering: clamp(Number(parsed.steering) || DEFAULT_SETTINGS.steering, 25, 100),
      brakePower: clamp(Number(parsed.brakePower) || DEFAULT_SETTINGS.brakePower, 30, 100),
      aiLevel: clamp(Number(parsed.aiLevel) || DEFAULT_SETTINGS.aiLevel, 25, 100)
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const loadCareerStats = () => {
  try {
    const raw = localStorage.getItem('f1-pro-career');
    if (!raw) return DEFAULT_CAREER_STATS;
    const parsed = JSON.parse(raw);
    return {
      races: Math.max(0, Number(parsed.races) || 0),
      wins: Math.max(0, Number(parsed.wins) || 0),
      podiums: Math.max(0, Number(parsed.podiums) || 0),
      bestLap: Number.isFinite(parsed.bestLap) ? parsed.bestLap : null,
      lastPosition: Number.isFinite(parsed.lastPosition) ? parsed.lastPosition : null,
      lastWeather: typeof parsed.lastWeather === 'string' ? parsed.lastWeather : 'CLEAR',
      recentResults: Array.isArray(parsed.recentResults)
        ? parsed.recentResults
          .filter((entry) => entry && Number.isFinite(entry.position) && Number.isFinite(entry.total))
          .slice(0, 4)
        : []
    };
  } catch {
    return DEFAULT_CAREER_STATS;
  }
};

const paintSky = (ctx, w, h, weather, sunPhase) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, weather.top);
  g.addColorStop(0.5, weather.mid);
  g.addColorStop(1, weather.bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const sx = w * (0.2 + 0.6 * sunPhase);
  const sy = h * (0.55 - 0.3 * Math.sin(sunPhase * Math.PI));
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 220);
  glow.addColorStop(0, `rgba(255,220,150,${0.9 - weather.rain * 0.5})`);
  glow.addColorStop(0.35, `rgba(255,150,80,${0.35 - weather.rain * 0.2})`);
  glow.addColorStop(1, 'rgba(255,120,50,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
};

export default function F1RacingGame() {
  const containerRef = useRef(null);
  const minimapRef = useRef(null);
  const debugStateRef = useRef({
    coordinateSystem: 'trackProgress is 0..1 around the circuit; lateralOffsetMeters is signed from centerline (+left, -right).',
    phase: 'menu',
    countdown: null,
    player: null,
    race: null,
    leaders: [],
    hudMessage: null
  });

  const [settings, setSettings] = useState(loadSettings);
  const settingsRef = useRef(settings);

  const [careerStats, setCareerStats] = useState(loadCareerStats);
  const careerStatsRef = useRef(careerStats);

  const [phase, setPhase] = useState('menu');
  const phaseRef = useRef(phase);

  const [showSettings, setShowSettings] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [sessionId, setSessionId] = useState(0);
  const [result, setResult] = useState(null);

  const [hud, setHud] = useState({
    speed: 0,
    gear: 1,
    rpm: 4000,
    lap: 1,
    bestLap: null,
    lapTime: 0,
    raceTime: 0,
    position: 1,
    competitors: 7,
    sector: 1,
    sectors: [null, null, null],
    drsReady: false,
    drsOn: false,
    ers: 100,
    ersOn: false,
    damage: 0,
    weather: 'CLEAR',
    camera: 'CHASE',
    slipstream: false,
    offTrack: false,
    message: '',
    fps: 60,
    tireTemp: 82
  });

  const keysRef = useRef({ up: false, down: false, left: false, right: false, drift: false, drs: false, ers: false, repair: false });
  const tiltSteerRef = useRef(0);
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const tiltEnabledRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onOrientation = (event) => {
      if (!tiltEnabledRef.current) return;
      const gamma = Number(event.gamma);
      if (!Number.isFinite(gamma)) return;
      const normalized = clamp(gamma / 32, -1, 1);
      const deadZone = 0.08;
      const shaped = Math.abs(normalized) < deadZone ? 0 : normalized;
      tiltSteerRef.current = shaped;
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [tiltEnabled]);

  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem('f1-pro-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    careerStatsRef.current = careerStats;
    localStorage.setItem('f1-pro-career', JSON.stringify(careerStats));
  }, [careerStats]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    tiltEnabledRef.current = tiltEnabled;
  }, [tiltEnabled]);

  useEffect(() => {
    debugStateRef.current = {
      ...debugStateRef.current,
      phase,
      countdown,
      quality: {
        preset: detectQualityPreset().label
      },
      career: {
        races: careerStats.races,
        wins: careerStats.wins,
        podiums: careerStats.podiums,
        bestLap: careerStats.bestLap ? Number(careerStats.bestLap.toFixed(3)) : null
      },
      result: result ? {
        position: result.position,
        total: Number(result.total.toFixed(3)),
        best: result.best ? Number(result.best.toFixed(3)) : null,
        weather: result.weather,
        isNewBestLap: Boolean(result.isNewBestLap)
      } : null
    };
  }, [phase, countdown, result, careerStats]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.render_game_to_text = () => JSON.stringify(debugStateRef.current);
    return () => {
      delete window.render_game_to_text;
    };
  }, []);

  const resetHud = () => {
    setHud((prev) => ({
      ...prev,
      speed: 0,
      gear: 1,
      rpm: 4000,
      lap: 1,
      bestLap: null,
      lapTime: 0,
      raceTime: 0,
      position: 1,
      sector: 1,
      sectors: [null, null, null],
      drsReady: false,
      drsOn: false,
      ers: 100,
      ersOn: false,
      damage: 0,
      weather: 'CLEAR',
      camera: CAMERA_MODES[0],
      slipstream: false,
      offTrack: false,
      message: '',
      fps: 60,
      tireTemp: 82
    }));
  };

  const startRace = () => {
    resetHud();
    setResult(null);
    setShowSettings(false);
    setCountdown(3);
    setPhase('countdown');
    setSessionId((v) => v + 1);
  };

  const restartRace = () => {
    resetHud();
    setResult(null);
    setCountdown(3);
    setPhase('countdown');
    setSessionId((v) => v + 1);
  };

  const backToMenu = () => {
    setPhase('menu');
    setResult(null);
    setCountdown(null);
    setSessionId((v) => v + 1);
  };

  useEffect(() => {
    if (!containerRef.current || phaseRef.current === 'menu') return undefined;

    const container = containerRef.current;
    container.innerHTML = '';
    const quality = detectQualityPreset();

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x30465d, 0.0019);

    const camera = new THREE.PerspectiveCamera(76, container.clientWidth / container.clientHeight, 0.5, 2500);
    const renderer = new THREE.WebGLRenderer({
      antialias: quality.antialias,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: quality.logarithmicDepthBuffer
    });
    let targetPixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
    let activePixelRatio = targetPixelRatio;
    const applyRendererMetrics = () => {
      renderer.setPixelRatio(activePixelRatio);
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    applyRendererMetrics();
    renderer.shadowMap.enabled = quality.shadowMapEnabled;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.32;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x6b90b8, 0.42);
    const hemi = new THREE.HemisphereLight(0xa7c9eb, 0x345533, 0.9);
    const sun = new THREE.DirectionalLight(0xfff1d1, 1.45);
    sun.position.set(150, 220, 120);
    sun.castShadow = quality.shadowMapEnabled;
    sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 850;
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    scene.add(ambient, hemi, sun);

    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = quality.skyResolution;
    skyCanvas.height = quality.skyResolution;
    const skyCtx = skyCanvas.getContext('2d');
    paintSky(skyCtx, quality.skyResolution, quality.skyResolution, WEATHER_PRESETS[0], 0.3);
    const skyTexture = new THREE.CanvasTexture(skyCanvas);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1300, quality.skySegments, quality.skySegments),
      new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false })
    );
    scene.add(sky);

    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = 256;
    grassCanvas.height = 256;
    const grassCtx = grassCanvas.getContext('2d');
    grassCtx.fillStyle = '#2a5d2f';
    grassCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i += 1) {
      const x = Math.floor(Math.random() * 256);
      const y = Math.floor(Math.random() * 256);
      const shade = 60 + Math.floor(Math.random() * 70);
      grassCtx.fillStyle = `rgb(${18 + Math.floor(shade * 0.25)}, ${shade}, ${18 + Math.floor(shade * 0.2)})`;
      grassCtx.fillRect(x, y, 2, 2);
    }
    const grassTexture = new THREE.CanvasTexture(grassCanvas);
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(40, 40);
    grassTexture.colorSpace = THREE.SRGBColorSpace;
    grassTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), quality.grassAnisotropy);

    const groundGeo = new THREE.PlaneGeometry(3000, 3000, quality.groundSegments, quality.groundSegments);
    groundGeo.rotateX(-Math.PI / 2);

    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ map: grassTexture, color: 0x3a7338, roughness: 0.96, metalness: 0.02 })
    );
    ground.receiveShadow = quality.shadowMapEnabled;
    scene.add(ground);

    const curve = new THREE.CatmullRomCurve3(
      TRACK_POINTS.map(([x, y, z]) => new THREE.Vector3(x * 3.6, y * 3.6, z * 3.6)),
      true,
      'catmullrom',
      0.52
    );

    const samples = quality.trackSamples;
    const points = [];
    const tangents = [];
    const normals = [];
    const curvatures = [];
    let trackLength = 0;

    for (let i = 0; i < samples; i += 1) {
      const t = i / samples;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      points.push(p);
      tangents.push(tan);
      normals.push(n);
      if (i) trackLength += p.distanceTo(points[i - 1]);
    }
    trackLength += points[0].distanceTo(points[samples - 1]);

    // Deform terrain safely using Trench Cap
    const posAttribute = groundGeo.attributes.position;
    for (let i = 0; i < posAttribute.count; i++) {
      const vx = posAttribute.getX(i);
      const vz = posAttribute.getZ(i);

      let closestDist = Infinity;
      let closestY = 0;
      let trenchCap = Infinity;

      for (let j = 0; j < samples; j += quality.terrainCheckStep) {
        const pt = points[j];
        const dx = vx - pt.x;
        const dz = vz - pt.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < closestDist) {
          closestDist = dist;
          closestY = pt.y;
        }

        let cap;
        // Expand the Trench Cap Zone to 28 to completely encompass the Triangle grid diagonals!
        // 10 unit grid means the edge can reach 14.1 diagonal. track is radius 10. 10+14=24.
        if (dist < 28) {
          cap = pt.y - 0.4;
        } else {
          cap = pt.y - 0.4 + (dist - 28) * 1.5;
        }
        if (cap < trenchCap) trenchCap = cap;
      }

      let baseElevation = closestY - 0.4 - (closestDist > 28 ? (closestDist - 28) * 0.15 : 0);
      baseElevation = Math.max(-15, baseElevation);

      const targetY = Math.min(trenchCap, baseElevation);
      posAttribute.setY(i, targetY);
    }
    groundGeo.computeVertexNormals();

    for (let i = 0; i < samples; i += 1) {
      curvatures.push(clamp((1 - tangents[i].dot(tangents[(i + 8) % samples])) * 6, 0, 1));
    }

    const roadVertices = [];
    const roadUV = [];
    const roadIndices = [];
    for (let i = 0; i < samples; i += 1) {
      const p = points[i];
      const n = normals[i];
      const l = p.clone().addScaledVector(n, TRACK_WIDTH * 0.5);
      const r = p.clone().addScaledVector(n, -TRACK_WIDTH * 0.5);
      roadVertices.push(l.x, l.y + 0.03, l.z, r.x, r.y + 0.03, r.z);
      roadUV.push(0, (i / samples) * 32, 1, (i / samples) * 32);
      const base = i * 2;
      const nxt = ((i + 1) % samples) * 2;
      roadIndices.push(base, nxt, base + 1, base + 1, nxt, nxt + 1);
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUV, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();

    // Asphalt Texture
    const asphaltCanvas = document.createElement('canvas');
    asphaltCanvas.width = 512;
    asphaltCanvas.height = 512;
    const ctxA = asphaltCanvas.getContext('2d');
    ctxA.fillStyle = '#22262a';
    ctxA.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      ctxA.fillStyle = Math.random() > 0.5 ? '#1a1d21' : '#2b3036';
      ctxA.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const asphaltTex = new THREE.CanvasTexture(asphaltCanvas);
    asphaltTex.wrapS = THREE.RepeatWrapping;
    asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.repeat.set(2, 80);
    asphaltTex.anisotropy = 4;

    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: 0x888888,
      roughness: 0.8,
      metalness: 0.1,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.receiveShadow = quality.shadowMapEnabled;
    scene.add(road);

    // Starting Grid Markings
    const startGridGeo = new THREE.BufferGeometry();
    const gridVerts = [];
    const gridIndices = [];
    let gidx = 0;

    // Draw grid slots for first 5 cars (0 to 0.015 of the track)
    for (let k = 0; k < 5; k++) {
      const gT = k * 0.003;
      const rp = curve.getPointAt(gT);
      const rtan = curve.getTangentAt(gT).normalize();
      const rn = new THREE.Vector3(-rtan.z, 0, rtan.x).normalize();

      const side = (k % 2 === 0) ? -1 : 1;
      const offset = TRACK_WIDTH * 0.25 * side;
      const center = rp.clone().addScaledVector(rn, offset);

      // Slot box
      const w = 1.6;
      const h = 4.0;
      const bl = center.clone().addScaledVector(rn, -w).addScaledVector(rtan, -h);
      const br = center.clone().addScaledVector(rn, w).addScaledVector(rtan, -h);
      const tl = center.clone().addScaledVector(rn, -w).addScaledVector(rtan, h);
      const tr = center.clone().addScaledVector(rn, w).addScaledVector(rtan, h);

      gridVerts.push(
        bl.x, bl.y + 0.04, bl.z, br.x, br.y + 0.04, br.z,
        tl.x, tl.y + 0.04, tl.z, tr.x, tr.y + 0.04, tr.z
      );
      gridIndices.push(gidx, gidx + 1, gidx + 2, gidx + 2, gidx + 1, gidx + 3);
      gidx += 4;
    }

    // Start/Finish Line
    const sfP = curve.getPointAt(0);
    const sfTan = curve.getTangentAt(0).normalize();
    const sfN = new THREE.Vector3(-sfTan.z, 0, sfTan.x).normalize();
    const sfL = sfP.clone().addScaledVector(sfN, -TRACK_WIDTH * 0.48);
    const sfR = sfP.clone().addScaledVector(sfN, TRACK_WIDTH * 0.48);
    const sfW = 0.8; // thickness
    const sbl = sfL.clone().addScaledVector(sfTan, -sfW);
    const sbr = sfR.clone().addScaledVector(sfTan, -sfW);
    const stl = sfL.clone().addScaledVector(sfTan, sfW);
    const str = sfR.clone().addScaledVector(sfTan, sfW);
    gridVerts.push(
      sbl.x, sbl.y + 0.05, sbl.z, sbr.x, sbr.y + 0.05, sbr.z,
      stl.x, stl.y + 0.05, stl.z, str.x, str.y + 0.05, str.z
    );
    gridIndices.push(gidx, gidx + 1, gidx + 2, gidx + 2, gidx + 1, gidx + 3);

    startGridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridVerts, 3));
    startGridGeo.setIndex(gridIndices);
    const startGridMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const startGrid = new THREE.Mesh(startGridGeo, startGridMat);
    scene.add(startGrid);

    // Curbs (Rumble Strips) and Braeking Boards
    const curbVerts = [];
    const curbColors = [];
    const curbIndices = [];
    let curIdx = 0;

    const boardGeo = new THREE.PlaneGeometry(1.5, 0.8);

    // Pre-calculate sharp corners to place braking boards 50m, 100m, 150m beforehand
    let isCornering = false;

    for (let i = 0; i < samples; i += 1) {
      const c = curvatures[i];
      const p = points[i];
      const n = normals[i];

      if (c > 0.45) { // Sharp corner generates curbs
        // Inside or outside curb depending on turn direction
        const curveDir = tangents[i].clone().cross(tangents[(i + 1) % samples]);
        const isLeftTurn = curveDir.y > 0;
        const sideOffset = isLeftTurn ? -TRACK_WIDTH * 0.5 : TRACK_WIDTH * 0.5;

        const curbCenter = p.clone().addScaledVector(n, sideOffset);
        const curbWidth = isLeftTurn ? new THREE.Vector3().copy(n).multiplyScalar(0.8) : new THREE.Vector3().copy(n).multiplyScalar(-0.8);

        const cl = curbCenter.clone().sub(curbWidth);
        const cr = curbCenter.clone().add(curbWidth);

        // Slight height above the displaced track
        curbVerts.push(cl.x, cl.y + 0.06, cl.z, cr.x, cr.y + 0.08, cr.z);

        // Alternating color based on segment index (Yellow and Red for Spa style)
        const color = (i % 4 < 2) ? [0.86, 0.72, 0.11] : [0.8, 0.1, 0.1];
        curbColors.push(...color, ...color);

        if (curIdx > 0 && i > 0 && curvatures[i - 1] > 0.45) {
          const b = curIdx;
          curbIndices.push(b - 2, b - 1, b, b, b - 1, b + 1);
        }
        curIdx += 2;

        // If we just started cornering, place brake markers backwards
        if (!isCornering) {
          const boardDistances = [150, 100, 50];
          boardDistances.forEach((dist, bIdx) => {
            const lookbackFrames = Math.floor(dist / (trackLength / samples));
            const placeIdx = (i - lookbackFrames + samples) % samples;
            const pb = points[placeIdx];
            const nb = normals[placeIdx];
            const tb = tangents[placeIdx];

            // Boards on the outside of the approaching straight
            const boardSide = isLeftTurn ? TRACK_WIDTH * 0.7 : -TRACK_WIDTH * 0.7;
            const boardPos = pb.clone().addScaledVector(nb, boardSide);

            const boardCanvas = document.createElement('canvas');
            boardCanvas.width = 128;
            boardCanvas.height = 64;
            const bctx = boardCanvas.getContext('2d');
            bctx.fillStyle = '#0a0d10';
            bctx.fillRect(0, 0, 128, 64);
            bctx.fillStyle = '#ffffff';
            bctx.font = 'bold 36px monospace';
            bctx.textAlign = 'center';
            bctx.textBaseline = 'middle';
            bctx.fillText(dist.toString(), 64, 34);

            const boardTex = new THREE.CanvasTexture(boardCanvas);
            const bMat = new THREE.MeshBasicMaterial({ map: boardTex });
            const board = new THREE.Mesh(boardGeo, bMat);
            board.position.copy(boardPos);
            board.position.y = boardPos.y + 1.0;

            // Orient facing approaching driver
            const angle = Math.atan2(tb.x, tb.z);
            board.rotation.y = angle + Math.PI;
            scene.add(board);
          });
        }
        isCornering = true;
      } else {
        isCornering = false;
      }
    }

    if (curbIndices.length > 0) {
      const curbGeo = new THREE.BufferGeometry();
      curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
      curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
      curbGeo.setIndex(curbIndices);
      curbGeo.computeVertexNormals();
      const curbMesh = new THREE.Mesh(curbGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
      scene.add(curbMesh);
    }

    const linePos = [];
    const lineCol = [];
    for (let i = 0; i < samples; i += 1) {
      const p = points[i];
      const c = curvatures[i];
      linePos.push(p.x, p.y + 0.2, p.z);
      if (c < 0.4) lineCol.push(0.2 + c, 0.95, 0.32);
      else if (c < 0.72) lineCol.push(0.9, 0.85, 0.2);
      else lineCol.push(0.95, 0.35, 0.15);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineCol, 3));
    scene.add(new THREE.LineLoop(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.52 })));

    const edgeL = [];
    const edgeR = [];
    const centerDash = [];
    for (let i = 0; i < samples; i += 1) {
      const p = points[i];
      const n = normals[i];
      const left = p.clone().addScaledVector(n, TRACK_WIDTH * 0.45);
      const right = p.clone().addScaledVector(n, -TRACK_WIDTH * 0.45);
      edgeL.push(left.x, left.y + 0.055, left.z);
      edgeR.push(right.x, right.y + 0.055, right.z);

      if (i % 12 < 6) {
        const p0 = points[i];
        const p1 = points[(i + 2) % samples];
        centerDash.push(p0.x, p0.y + 0.06, p0.z, p1.x, p1.y + 0.06, p1.z);
      }
    }

    const edgeLGeo = new THREE.BufferGeometry();
    edgeLGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeL, 3));
    scene.add(new THREE.LineLoop(edgeLGeo, new THREE.LineBasicMaterial({ color: 0xe9edf5, transparent: true, opacity: 0.85 })));

    const edgeRGeo = new THREE.BufferGeometry();
    edgeRGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeR, 3));
    scene.add(new THREE.LineLoop(edgeRGeo, new THREE.LineBasicMaterial({ color: 0xe9edf5, transparent: true, opacity: 0.85 })));

    const centerDashGeo = new THREE.BufferGeometry();
    centerDashGeo.setAttribute('position', new THREE.Float32BufferAttribute(centerDash, 3));
    scene.add(new THREE.LineSegments(centerDashGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })));

    // Procedural Pine Forests (Eau Rouge Ardennes vibes)
    const treeCount = quality.treeCount;
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 2.5, 5);
    trunkGeo.translate(0, 1.25, 0); // Put base at 0
    const leavesGeo = new THREE.ConeGeometry(2.5, 7, 7);
    leavesGeo.translate(0, 5.0, 0); // Put base above trunk

    const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x183015, roughness: 0.95 });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 1.0 });

    const leavesMesh = new THREE.InstancedMesh(leavesGeo, treeMaterial, treeCount);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMaterial, treeCount);
    leavesMesh.castShadow = quality.shadowMapEnabled;
    trunkMesh.castShadow = quality.shadowMapEnabled;
    leavesMesh.receiveShadow = quality.shadowMapEnabled;
    trunkMesh.receiveShadow = quality.shadowMapEnabled;

    const dummy = new THREE.Object3D();
    const tPos = new THREE.Vector3();
    let placed = 0;
    const groundPos = groundGeo.attributes.position;
    const vertexCount = groundPos.count;

    while (placed < treeCount) {
      const vIdx = Math.floor(Math.random() * vertexCount);
      tPos.set(groundPos.getX(vIdx), groundPos.getY(vIdx), groundPos.getZ(vIdx));

      let tooClose = false;
      for (let j = 0; j < samples; j += 12) { // check every 12th point
        if (tPos.distanceToSquared(points[j]) < 1200) { // Keep trees ~34 units away from track edge
          tooClose = true;
          break;
        }
      }

      // Keep trees clustered near the visible area
      if (Math.abs(tPos.x) > 600 || Math.abs(tPos.z) > 600) tooClose = true;

      if (!tooClose) {
        dummy.position.copy(tPos);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.7 + Math.random() * 0.8;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        leavesMesh.setMatrixAt(placed, dummy.matrix);
        trunkMesh.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
    }
    scene.add(leavesMesh);
    scene.add(trunkMesh);

    // Procedural Grandstand on Start/Finish straight
    const grandstandGroup = new THREE.Group();
    const standMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });

    for (let t = 0; t < 8; t++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(60, 0.8, 1.5), standMat);
      step.position.set(0, t * 1.0, -t * 1.5);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(58, 0.6, 0.8), seatMat);
      seat.position.set(0, t * 1.0 + 0.6, -t * 1.5 - 0.2);
      grandstandGroup.add(step);
      grandstandGroup.add(seat);
    }

    const roofGeo = new THREE.BoxGeometry(62, 0.4, 16);
    roofGeo.translate(0, 0, -8);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
    roof.position.set(0, 12, 2);
    roof.rotation.x = -0.15;
    grandstandGroup.add(roof);

    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 12);
    pillarGeo.translate(0, 6, 0);
    for (let px = -25; px <= 25; px += 25) {
      const p1 = new THREE.Mesh(pillarGeo, standMat);
      p1.position.set(px, 0, -10);
      grandstandGroup.add(p1);
    }

    grandstandGroup.position.copy(points[15]); // Placed near T=15 (start straight)
    const sfNormal2 = normals[15].clone();
    grandstandGroup.position.addScaledVector(sfNormal2, TRACK_WIDTH * 0.5 + 8); // push outside

    // Orient facing the track
    grandstandGroup.rotation.y = Math.atan2(-sfNormal2.x, -sfNormal2.z);
    grandstandGroup.position.y = points[15].y + 0.5;

    scene.add(grandstandGroup);

    // ── Tire Smoke Particle System ──
    const SMOKE_COUNT = quality.smokeCount;
    const smokePositions = new Float32Array(SMOKE_COUNT * 3);
    const smokeSizes = new Float32Array(SMOKE_COUNT);
    const smokeAlphas = new Float32Array(SMOKE_COUNT);
    const smokeLife = new Float32Array(SMOKE_COUNT);
    const smokeVel = new Float32Array(SMOKE_COUNT * 3);
    for (let i = 0; i < SMOKE_COUNT; i++) { smokeLife[i] = -1; smokeSizes[i] = 0; smokeAlphas[i] = 0; }
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    smokeGeo.setAttribute('size', new THREE.BufferAttribute(smokeSizes, 1));
    const smokeMat = new THREE.PointsMaterial({ color: 0xcccccc, size: 1.5, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true });
    const smokeFx = new THREE.Points(smokeGeo, smokeMat);
    scene.add(smokeFx);
    let smokeIdx = 0;

    // ── Spark Particle System ──
    const SPARK_COUNT = quality.sparkCount;
    const sparkPositions = new Float32Array(SPARK_COUNT * 3);
    const sparkLife = new Float32Array(SPARK_COUNT);
    const sparkVel = new Float32Array(SPARK_COUNT * 3);
    for (let i = 0; i < SPARK_COUNT; i++) sparkLife[i] = -1;
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({ color: 0xffcc44, size: 0.4, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true });
    const sparkFx = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkFx);
    let sparkIdx = 0;

    // ── Track Barriers (Armco style) ──
    const barrierVerts = [];
    const barrierIndices = [];
    let bIdx = 0;
    const BARRIER_HEIGHT = 1.8;
    for (let i = 0; i < samples; i += quality.barrierStep) {
      const p = points[i];
      const n = normals[i];
      const ni = (i + quality.barrierStep) % samples;
      const pn = points[ni];
      const nn = normals[ni];
      // Both sides
      for (const side of [1, -1]) {
        const off = TRACK_WIDTH * 0.62 * side;
        const b0 = p.clone().addScaledVector(n, off);
        const b1 = pn.clone().addScaledVector(nn, off);
        barrierVerts.push(
          b0.x, b0.y + 0.05, b0.z,
          b0.x, b0.y + BARRIER_HEIGHT, b0.z,
          b1.x, b1.y + 0.05, b1.z,
          b1.x, b1.y + BARRIER_HEIGHT, b1.z
        );
        barrierIndices.push(bIdx, bIdx + 1, bIdx + 2, bIdx + 2, bIdx + 1, bIdx + 3);
        bIdx += 4;
      }
    }
    const barrierGeo = new THREE.BufferGeometry();
    barrierGeo.setAttribute('position', new THREE.Float32BufferAttribute(barrierVerts, 3));
    barrierGeo.setIndex(barrierIndices);
    barrierGeo.computeVertexNormals();
    const barrierMesh = new THREE.Mesh(barrierGeo, new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
    scene.add(barrierMesh);

    // ── Screen shake state ──
    let shakeIntensity = 0;
    let shakeDecay = 0;

    const player = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 4.8), new THREE.MeshStandardMaterial({ color: 0xd8141f, metalness: 0.85, roughness: 0.18 }));
    body.position.y = 0.35;
    body.castShadow = quality.shadowMapEnabled;
    player.add(body);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.2, 10), body.material);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.33, 3.4);
    player.add(nose);

    const wheels = [];
    const wheelPos = [[-1.0, 0.35, 2.2], [1.0, 0.35, 2.2], [-1.05, 0.38, -1.5], [1.05, 0.38, -1.5]];
    wheelPos.forEach((p) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, quality.wheelSegments), new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.9 }));
      w.rotation.z = Math.PI / 2;
      w.castShadow = quality.shadowMapEnabled;
      w.position.set(p[0], p[1], p[2]);
      player.add(w);
      wheels.push(w);
    });

    const flap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.25), new THREE.MeshStandardMaterial({ color: 0x1f2329 }));
    flap.position.set(0, 1.15, -2.1);
    player.add(flap);

    if (quality.useDetailedCarModel) {
      const loader = new GLTFLoader();
      loader.load(
        `${process.env.PUBLIC_URL}/redbull.glb`,
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(3.45, 3.45, 3.45);
          model.rotation.y = -Math.PI / 2;
          model.position.set(0, 0.05, -0.5);
          model.traverse((obj) => {
            if (obj.isMesh) {
              obj.castShadow = quality.shadowMapEnabled;
              obj.receiveShadow = quality.shadowMapEnabled;
            }
          });
          body.visible = false;
          nose.visible = false;
          wheels.forEach((w) => { w.visible = false; });
          flap.visible = false;
          player.add(model);
        },
        undefined,
        () => { }
      );
    }

    const startT = 0.015;
    player.position.copy(curve.getPointAt(startT));
    player.position.y += 0.03;
    let heading = Math.atan2(curve.getTangentAt(startT).x, curve.getTangentAt(startT).z);
    player.rotation.y = heading;
    scene.add(player);

    const npcDefs = [
      { name: 'Mercedes', color: 0x0d81f2 },
      { name: 'McLaren', color: 0xff8a00 },
      { name: 'Aston', color: 0x18aa64 },
      { name: 'Williams', color: 0x4a62de },
      { name: 'Haas', color: 0xffffff },
      { name: 'Alpine', color: 0xe42f90 }
    ];

    const npcs = npcDefs.map((def, i) => {
      const car = new THREE.Group();
      const npcMat = new THREE.MeshStandardMaterial({ color: def.color, metalness: 0.82, roughness: 0.2 });
      // Body
      const npcBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 4.4), npcMat);
      npcBody.position.y = 0.35;
      npcBody.castShadow = quality.shadowMapEnabled;
      car.add(npcBody);
      // Nose cone
      const npcNoseMesh = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.8, 8), npcMat);
      npcNoseMesh.rotation.x = Math.PI / 2;
      npcNoseMesh.position.set(0, 0.33, 3.0);
      car.add(npcNoseMesh);
      // Rear wing
      const npcWing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: 0x1f2329 }));
      npcWing.position.set(0, 1.05, -1.9);
      car.add(npcWing);
      // Wheels
      const npcWheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.26, quality.wheelSegments);
      const npcWheelMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.9 });
      [[-0.9, 0.32, 1.9], [0.9, 0.32, 1.9], [-0.95, 0.34, -1.3], [0.95, 0.34, -1.3]].forEach(wp => {
        const wm = new THREE.Mesh(npcWheelGeo, npcWheelMat);
        wm.rotation.z = Math.PI / 2;
        wm.castShadow = quality.shadowMapEnabled;
        wm.position.set(wp[0], wp[1], wp[2]);
        car.add(wm);
      });
      // Driver helmet
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), npcMat);
      helmet.position.set(0, 0.7, 0.4);
      car.add(helmet);

      const t = (startT - 0.018 * (i + 1) + 1) % 1;
      car.position.copy(curve.getPointAt(t));
      car.position.y += 0.25;
      scene.add(car);
      return {
        name: def.name,
        mesh: car,
        t,
        lap: 1,
        speed: 62 + Math.random() * 6,
        lane: (Math.random() - 0.5) * 3,
        laneTarget: 0,
        aggression: 0.4 + Math.random() * 0.45,
        seed: Math.random() * 1000
      };
    });

    const standingsList = [{ id: 'YOU', p: 0 }];
    npcDefs.forEach((def) => standingsList.push({ id: def.name, p: 0 }));

    const rainCount = quality.rainCount;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i += 1) {
      rainPos[i * 3] = player.position.x + (Math.random() - 0.5) * 80;
      rainPos[i * 3 + 1] = 8 + Math.random() * 35;
      rainPos[i * 3 + 2] = player.position.z + (Math.random() - 0.5) * 80;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0xaed7ff, size: 0.12, transparent: true, opacity: 0.14, depthWrite: false });
    const rainFx = new THREE.Points(rainGeo, rainMat);
    rainFx.visible = false;
    scene.add(rainFx);

    const minimapSize = quality.minimapSize;
    const minimap = document.createElement('canvas');
    minimap.width = minimapSize;
    minimap.height = minimapSize;
    minimap.style.width = '100%';
    minimap.style.height = '100%';
    const minimapCtx = minimap.getContext('2d');
    const minimapHost = minimapRef.current;
    if (minimapHost) {
      minimapHost.innerHTML = '';
      minimapHost.appendChild(minimap);
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    points.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    });
    const pad = 14;
    const mapScale = Math.min((minimapSize - pad * 2) / (maxX - minX), (minimapSize - pad * 2) / (maxZ - minZ));
    const mapPos = (p) => ({
      x: pad + (p.x - minX) * mapScale,
      y: minimapSize - (pad + (p.z - minZ) * mapScale)
    });
    const mapTrackPoints = points.map((p) => mapPos(p));
    const mapDrsSegments = DRS_ZONES.map(([a, b]) => {
      const segment = [];
      for (let t = a; t <= b; t += 0.004) {
        segment.push(mapPos(curve.getPointAt(t)));
      }
      return segment;
    });
    const minimapStatic = document.createElement('canvas');
    minimapStatic.width = minimapSize;
    minimapStatic.height = minimapSize;
    const minimapStaticCtx = minimapStatic.getContext('2d');
    if (minimapStaticCtx) {
      minimapStaticCtx.fillStyle = 'rgba(8,16,28,0.92)';
      minimapStaticCtx.fillRect(0, 0, minimapSize, minimapSize);

      minimapStaticCtx.strokeStyle = '#30435c';
      minimapStaticCtx.lineWidth = 7;
      minimapStaticCtx.beginPath();
      mapTrackPoints.forEach((p, i) => {
        if (!i) minimapStaticCtx.moveTo(p.x, p.y);
        else minimapStaticCtx.lineTo(p.x, p.y);
      });
      minimapStaticCtx.closePath();
      minimapStaticCtx.stroke();

      minimapStaticCtx.strokeStyle = '#30e87a';
      minimapStaticCtx.lineWidth = 2.5;
      mapDrsSegments.forEach((segment) => {
        minimapStaticCtx.beginPath();
        segment.forEach((p, i) => {
          if (!i) minimapStaticCtx.moveTo(p.x, p.y);
          else minimapStaticCtx.lineTo(p.x, p.y);
        });
        minimapStaticCtx.stroke();
      });
    }

    const keys = keysRef.current;
    let cameraMode = 0;

    const keyDown = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.up = true;
      if (k === 's' || k === 'arrowdown') keys.down = true;
      if (k === 'a' || k === 'arrowleft') keys.left = true;
      if (k === 'd' || k === 'arrowright') keys.right = true;
      if (k === ' ') keys.drift = true;
      if (k === 'shift') keys.drs = true;
      if (k === 'f') keys.ers = true;
      if (k === 'b') keys.repair = true;

      if (e.repeat) return;
      if (k === 'escape') {
        setPhase((prev) => {
          if (prev === 'paused') return 'racing';
          if (prev === 'racing' || prev === 'countdown') return 'paused';
          return prev;
        });
      }
      if (k === 'c') cameraMode = (cameraMode + 1) % CAMERA_MODES.length;
    };

    const keyUp = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.up = false;
      if (k === 's' || k === 'arrowdown') keys.down = false;
      if (k === 'a' || k === 'arrowleft') keys.left = false;
      if (k === 'd' || k === 'arrowright') keys.right = false;
      if (k === ' ') keys.drift = false;
      if (k === 'shift') keys.drs = false;
      if (k === 'f') keys.ers = false;
      if (k === 'b') keys.repair = false;
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    let speed = 0;
    let steer = 0;
    let drift = 0;
    let tireTemp = 82;
    let pT = startT;
    let prevT = startT;
    let lap = 1;
    let bestLap = null;
    let lapStart = 0;
    let raceStart = 0;
    let sector = 1;
    let sectorStart = 0;
    let sectorTimes = [null, null, null];
    let lastCross = -999999;
    let ers = 100;
    let damage = 0;
    let weatherIdx = 0;
    let weatherTarget = 0;
    let weatherBlend = 1;
    let weatherLapTimer = 0;
    let countdownStart = performance.now();
    let countdownStep = 3;
    let finished = false;
    let fps = 60;
    let fpsFrames = 0;
    let fpsTimer = 0;
    let skyTick = 1;
    let shadowTick = 1;
    let rainTick = 0;
    let perfAdjustTick = 0;
    let lastFov = camera.fov;

    const sampleTrack = (t, outPoint, outTangent, outNormal) => {
      const wrappedT = ((t % 1) + 1) % 1;
      const scaledT = wrappedT * samples;
      const baseIdx = Math.floor(scaledT) % samples;
      const nextIdx = (baseIdx + 1) % samples;
      const blend = scaledT - Math.floor(scaledT);

      if (outPoint) outPoint.copy(points[baseIdx]).lerp(points[nextIdx], blend);
      if (outTangent) outTangent.copy(tangents[baseIdx]).lerp(tangents[nextIdx], blend).normalize();
      if (outNormal) outNormal.copy(normals[baseIdx]).lerp(normals[nextIdx], blend).normalize();
    };

    const findNearestT = (pos, around) => {
      const center = Math.floor(around * samples);
      let best = center;
      let bestD = Infinity;
      for (let o = -14; o <= 14; o += 1) {
        const idx = (center + o + samples) % samples;
        const pt = points[idx];
        const dx = pos.x - pt.x;
        const dz = pos.z - pt.z;
        const d = dx * dx + dz * dz; // 2D distance calculation
        if (d < bestD) {
          bestD = d;
          best = idx;
        }
      }

      const p1 = points[best];
      const nextIdx = (best + 1) % samples;
      const prevIdx = (best - 1 + samples) % samples;

      const dNext = Math.pow(pos.x - points[nextIdx].x, 2) + Math.pow(pos.z - points[nextIdx].z, 2);
      const dPrev = Math.pow(pos.x - points[prevIdx].x, 2) + Math.pow(pos.z - points[prevIdx].z, 2);

      const secondBest = dNext < dPrev ? nextIdx : prevIdx;
      const p2 = points[secondBest];

      const dx12 = p2.x - p1.x;
      const dz12 = p2.z - p1.z;
      const lenSq = dx12 * dx12 + dz12 * dz12;

      let tOffset = 0;
      if (lenSq > 0.0001) {
        const tProj = ((pos.x - p1.x) * dx12 + (pos.z - p1.z) * dz12) / lenSq;
        tOffset = clamp(tProj, 0, 1);
      }

      let continuousT = (secondBest === nextIdx) ? (best + tOffset) : (best - tOffset);
      return ((continuousT + samples) % samples) / samples;
    };

    const resize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      targetPixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
      activePixelRatio = clamp(activePixelRatio, quality.minPixelRatio, targetPixelRatio);
      applyRendererMetrics();
    };
    window.addEventListener('resize', resize);

    let last = performance.now();
    let hudTick = 0;
    let miniTick = 0;
    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const camTarget = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const camLift = new THREE.Vector3();
    const lookLift = new THREE.Vector3();
    const npcPoint = new THREE.Vector3();
    const npcTangent = new THREE.Vector3();
    const npcNormal = new THREE.Vector3();
    const npcTarget = new THREE.Vector3();
    const trackPoint = new THREE.Vector3();
    const trackTangent = new THREE.Vector3();
    let anim = 0;
    let manualFrameMode = false;
    let simulatedNow = last;

    const renderFrame = (now) => {
      const dt = clamp((now - last) / 1000, 0, 0.04);
      last = now;

      fpsFrames += 1;
      fpsTimer += dt;
      if (fpsTimer >= 0.5) {
        fps = Math.round(fpsFrames / fpsTimer);
        fpsFrames = 0;
        fpsTimer = 0;
      }
      perfAdjustTick += dt;
      if (perfAdjustTick >= 1) {
        if (fps < 28 && activePixelRatio > quality.minPixelRatio + 0.01) {
          activePixelRatio = Math.max(quality.minPixelRatio, activePixelRatio - 0.08);
          applyRendererMetrics();
        } else if (fps > 52 && activePixelRatio < targetPixelRatio - 0.01) {
          activePixelRatio = Math.min(targetPixelRatio, activePixelRatio + 0.05);
          applyRendererMetrics();
        }
        perfAdjustTick = 0;
      }

      const state = phaseRef.current;
      const inCountdown = state === 'countdown';
      const racing = state === 'racing';

      if (inCountdown) {
        const elapsed = (now - countdownStart) / 1000;
        const rem = 3 - Math.floor(elapsed);
        if (rem > 0 && rem !== countdownStep) {
          countdownStep = rem;
          setCountdown(rem);
        }
        if (elapsed >= 3 && countdownStep !== 0) {
          countdownStep = 0;
          setCountdown('GO');
        }
        if (elapsed >= 3.2) {
          setCountdown(null);
          setPhase('racing');
          raceStart = now;
          lapStart = now;
          sectorStart = now;
        }
      }

      const cfg = settingsRef.current;
      const maxSpeed = cfg.maxSpeed / 3.6;
      const acc = 9 + (cfg.acceleration / 100) * 22;
      const brk = 13 + (cfg.brakePower / 100) * 24;
      const steerRate = 1.8 + (cfg.steering / 100) * 2.6;
      const aiTop = 68 + (cfg.aiLevel / 100) * 16;

      if (!finished && (racing || inCountdown)) {
        pT = findNearestT(player.position, pT);
        const idx = Math.floor(pT * samples) % samples;
        const center = points[idx];
        const normal = normals[idx];
        sampleTrack(pT, trackPoint, trackTangent, null);

        tmpA.copy(player.position).sub(center);
        const lateral = tmpA.dot(normal);
        const offTrack = Math.abs(lateral) > TRACK_WIDTH * 0.48;
        const hardOff = Math.abs(lateral) > TRACK_WIDTH * 0.72;

        const wA = WEATHER_PRESETS[weatherIdx];
        const wB = WEATHER_PRESETS[weatherTarget];
        if (weatherIdx !== weatherTarget) {
          weatherBlend = clamp(weatherBlend + dt * 0.15, 0, 1);
        }
        const rainLevel = lerp(wA.rain, wB.rain, weatherBlend);
        const fog = lerp(wA.fog, wB.fog, weatherBlend);
        const sunInt = lerp(wA.sun, wB.sun, weatherBlend);
        const ambInt = lerp(wA.ambient, wB.ambient, weatherBlend);
        if (weatherBlend >= 1 && weatherIdx !== weatherTarget) weatherIdx = weatherTarget;

        scene.fog.density = fog;
        ambient.intensity = ambInt + 0.12;
        sun.intensity = sunInt * 1.12;
        hemi.intensity = 0.62 + (1 - rainLevel) * 0.28;

        const sunPhase = (now * 0.00002) % 1;
        skyTick += dt;
        if (skyTick >= quality.skyUpdateInterval) {
          paintSky(skyCtx, quality.skyResolution, quality.skyResolution, WEATHER_PRESETS[weatherTarget], sunPhase);
          skyTexture.needsUpdate = true;
          skyTick = 0;
        }
        sun.position.set(150 * Math.cos(sunPhase * Math.PI * 2), 150 + 130 * Math.sin(sunPhase * Math.PI), 120 * Math.sin(sunPhase * Math.PI * 2));
        shadowTick += dt;
        if (quality.shadowMapEnabled && shadowTick >= quality.shadowUpdateInterval) {
          renderer.shadowMap.needsUpdate = true;
          shadowTick = 0;
        }

        roadMat.roughness = 0.68 - rainLevel * 0.3;
        roadMat.metalness = 0.14 + rainLevel * 0.26;

        rainFx.visible = rainLevel > 0.08 && quality.rainCount > 0;
        rainMat.opacity = clamp(0.08 + rainLevel * 0.65, 0.1, 0.78);
        if (rainFx.visible) {
          rainTick += dt;
          if (rainTick >= quality.rainUpdateInterval) {
            for (let i = 0; i < rainCount; i += 1) {
              const r = i * 3;
              rainPos[r + 1] -= (18 + rainLevel * 68) * rainTick;
              if (rainPos[r + 1] < 0 || Math.abs(rainPos[r] - player.position.x) > 50 || Math.abs(rainPos[r + 2] - player.position.z) > 50) {
                rainPos[r] = player.position.x + (Math.random() - 0.5) * 84;
                rainPos[r + 1] = 8 + Math.random() * 32;
                rainPos[r + 2] = player.position.z + (Math.random() - 0.5) * 84;
              }
            }
            rainGeo.attributes.position.needsUpdate = true;
            rainTick = 0;
          }
        } else {
          rainTick = 0;
        }

        const kmh = Math.abs(speed) * 3.6;
        const gearRanges = [0, 44, 75, 105, 138, 173, 215, 255, 400];
        let gear = 1;
        for (let i = 1; i < gearRanges.length; i += 1) {
          if (kmh >= gearRanges[i]) gear = Math.min(8, i + 1);
        }
        const rpm = clamp(4000 + ((kmh - gearRanges[gear - 1]) / Math.max(1, gearRanges[gear] - gearRanges[gear - 1])) * 13500, 4000, 18000);
        const drsReady = inDrsZone(pT) && kmh > 135;
        const drsOn = racing && keys.drs && drsReady;
        const ersOn = racing && keys.ers && ers > 1 && kmh > 60;
        ers = ersOn ? clamp(ers - dt * 24, 0, 100) : clamp(ers + dt * 11, 0, 100);

        let slip = 0;
        const forward = tmpB.set(Math.sin(heading), 0, Math.cos(heading));
        npcs.forEach((npc) => {
          tmpA.copy(npc.mesh.position).sub(player.position);
          const dist = tmpA.length();
          if (dist > 4 && dist < 24) {
            const dirDot = forward.dot(tmpA.normalize());
            const lat = Math.abs(tmpA.dot(normal));
            if (dirDot > 0.78 && lat < 3.3) slip = Math.max(slip, 1 - dist / 24);
          }
        });

        if (racing) {
          const baseGrip = clamp(1 - rainLevel * 0.28 - damage * 0.22, 0.45, 1);
          const downforceGrip = clamp(kmh / 320, 0, 0.18);
          const tireTempTarget = 78 + kmh * 0.22 + Math.abs(steer) * 26 + drift * 18;
          tireTemp = lerp(tireTemp, tireTempTarget, clamp(dt * 0.55, 0, 1));
          const tempDelta = Math.abs(tireTemp - 94);
          const tempGripPenalty = clamp(tempDelta / 180, 0, 0.22);
          const grip = clamp(baseGrip + downforceGrip - tempGripPenalty, 0.42, 1.08);
          const offPenalty = offTrack ? (hardOff ? 0.4 : 0.24) : 0;

          const aeroDrag = (0.0012 + rainLevel * 0.0004) * speed * Math.abs(speed);
          speed -= aeroDrag * dt;

          if (keys.up) speed += acc * (grip - offPenalty) * dt;
          if (keys.down) speed -= brk * dt;
          if (!keys.up && !keys.down) speed *= Math.exp(-(offTrack ? 2 : 1.35) * dt);

          drift = keys.drift && kmh > 85 ? clamp(drift + dt * 1.7, 0, 1) : clamp(drift - dt * 2.3, 0, 1);
          if (keys.repair && inDrsZone(pT) && kmh < 55) {
            damage = clamp(damage - dt * 0.22, 0, 1);
            speed = Math.min(speed, 12);
          }

          let targetV = maxSpeed * (1 - damage * 0.24);
          targetV *= 1 - offPenalty * 0.68;
          targetV *= 1 + slip * 0.08;
          if (drsOn) targetV *= 1.14;
          if (ersOn) targetV *= 1.09;
          speed = clamp(speed, -25, targetV);

          const keyInput = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
          const sInput = clamp(keyInput + (tiltEnabledRef.current ? tiltSteerRef.current : 0), -1, 1);
          steer = lerp(steer, sInput, clamp(dt * 10, 0, 1));
          const vRatio = clamp(Math.abs(speed) / Math.max(targetV, 1), 0, 1);
          const authority = (1 - vRatio * 0.72) * (grip - offPenalty * 0.35);
          heading += steer * steerRate * authority * (1 + drift * 0.45) * Math.sign(speed || 1) * dt;
          heading = normAngle(heading);

          const moveYaw = heading + steer * drift * 0.25;
          player.position.x += Math.sin(moveYaw) * speed * dt;
          player.position.z += Math.cos(moveYaw) * speed * dt;
          player.position.y = trackPoint.y + 0.03;
          if (offTrack) player.position.addScaledVector(normal, -lateral * dt * 0.8);

          npcs.forEach((npc) => {
            const d = player.position.distanceTo(npc.mesh.position);
            if (d < 2.6) {
              tmpA.copy(npc.mesh.position).sub(player.position).normalize();
              const impact = clamp((Math.abs(speed - npc.speed) / 70) + 0.08, 0.05, 1);
              player.position.addScaledVector(tmpA, -impact * 0.8);
              npc.mesh.position.addScaledVector(tmpA, impact * 1.2);
              speed *= 0.95;
              npc.speed *= 0.95;
              damage = clamp(damage + impact * 0.005, 0, 1);
              // Screen shake on collision
              shakeIntensity = Math.max(shakeIntensity, impact * 1.5);
              shakeDecay = 0.4;
            }
          });

          // ── Barrier collision ──
          if (Math.abs(lateral) > TRACK_WIDTH * 0.58) {
            const pushBack = Math.sign(lateral) * (Math.abs(lateral) - TRACK_WIDTH * 0.56);
            player.position.addScaledVector(normal, -pushBack * 0.7);
            speed *= 0.88;
            damage = clamp(damage + 0.002, 0, 1);
            if (Math.abs(speed) > 20) {
              shakeIntensity = Math.max(shakeIntensity, 0.6);
              shakeDecay = 0.3;
              // Spawn sparks at barrier contact
              for (let si = 0; si < 6; si++) {
                const sIdx3 = sparkIdx * 3;
                sparkPositions[sIdx3] = player.position.x + (Math.random() - 0.5) * 2;
                sparkPositions[sIdx3 + 1] = player.position.y + 0.3 + Math.random() * 0.5;
                sparkPositions[sIdx3 + 2] = player.position.z + (Math.random() - 0.5) * 2;
                sparkVel[sIdx3] = (Math.random() - 0.5) * 12;
                sparkVel[sIdx3 + 1] = 3 + Math.random() * 8;
                sparkVel[sIdx3 + 2] = (Math.random() - 0.5) * 12;
                sparkLife[sparkIdx] = 0.4 + Math.random() * 0.3;
                sparkIdx = (sparkIdx + 1) % SPARK_COUNT;
              }
            }
          }
        }

        wheels.forEach((w, i) => {
          w.rotation.x += speed * dt * 2.6;
          if (i < 2) w.rotation.y = steer * 0.35;
        });
        flap.rotation.x = lerp(flap.rotation.x, drsOn ? -0.25 : 0, dt * 9);

        // ── Tire smoke when drifting ──
        if (drift > 0.3 && kmh > 80) {
          for (let si = 0; si < 2; si++) {
            const sIdx3 = smokeIdx * 3;
            const rearOff = si === 0 ? -1 : 1;
            smokePositions[sIdx3] = player.position.x - Math.sin(heading) * 2 + rearOff * Math.cos(heading) * 0.8 + (Math.random() - 0.5);
            smokePositions[sIdx3 + 1] = player.position.y + 0.15 + Math.random() * 0.3;
            smokePositions[sIdx3 + 2] = player.position.z - Math.cos(heading) * 2 - rearOff * Math.sin(heading) * 0.8 + (Math.random() - 0.5);
            smokeVel[sIdx3] = (Math.random() - 0.5) * 2;
            smokeVel[sIdx3 + 1] = 0.8 + Math.random() * 1.5;
            smokeVel[sIdx3 + 2] = (Math.random() - 0.5) * 2;
            smokeLife[smokeIdx] = 1.0 + Math.random() * 0.6;
            smokeSizes[smokeIdx] = 0.6 + Math.random() * 0.8;
            smokeIdx = (smokeIdx + 1) % SMOKE_COUNT;
          }
        }

        // ── Sparks on high-speed ground scrape (lock-up under braking) ──
        if (keys.down && kmh > 140) {
          const sIdx3 = sparkIdx * 3;
          sparkPositions[sIdx3] = player.position.x + (Math.random() - 0.5) * 1.5;
          sparkPositions[sIdx3 + 1] = player.position.y + 0.1;
          sparkPositions[sIdx3 + 2] = player.position.z + (Math.random() - 0.5) * 1.5;
          sparkVel[sIdx3] = (Math.random() - 0.5) * 8;
          sparkVel[sIdx3 + 1] = 2 + Math.random() * 5;
          sparkVel[sIdx3 + 2] = (Math.random() - 0.5) * 8;
          sparkLife[sparkIdx] = 0.3 + Math.random() * 0.2;
          sparkIdx = (sparkIdx + 1) % SPARK_COUNT;
        }

        // ── Update smoke particles ──
        for (let pi = 0; pi < SMOKE_COUNT; pi++) {
          if (smokeLife[pi] > 0) {
            smokeLife[pi] -= dt;
            const pi3 = pi * 3;
            smokePositions[pi3] += smokeVel[pi3] * dt;
            smokePositions[pi3 + 1] += smokeVel[pi3 + 1] * dt;
            smokePositions[pi3 + 2] += smokeVel[pi3 + 2] * dt;
            smokeVel[pi3 + 1] += 0.5 * dt; // rise
            smokeSizes[pi] += dt * 2; // expand
          } else {
            smokePositions[pi * 3 + 1] = -999;
          }
        }
        smokeGeo.attributes.position.needsUpdate = true;
        smokeGeo.attributes.size.needsUpdate = true;
        smokeMat.opacity = drift > 0.3 ? 0.3 : 0.15;

        // ── Update spark particles ──
        for (let pi = 0; pi < SPARK_COUNT; pi++) {
          if (sparkLife[pi] > 0) {
            sparkLife[pi] -= dt;
            const pi3 = pi * 3;
            sparkPositions[pi3] += sparkVel[pi3] * dt;
            sparkPositions[pi3 + 1] += sparkVel[pi3 + 1] * dt;
            sparkPositions[pi3 + 2] += sparkVel[pi3 + 2] * dt;
            sparkVel[pi3 + 1] -= 18 * dt; // gravity
          } else {
            sparkPositions[pi * 3 + 1] = -999;
          }
        }
        sparkGeo.attributes.position.needsUpdate = true;

        // ── Screen shake decay ──
        if (shakeIntensity > 0.01) {
          shakeDecay -= dt;
          if (shakeDecay <= 0) shakeIntensity *= 0.85;
        } else {
          shakeIntensity = 0;
        }

        // Visual Chassis Physics
        const hillSlope = Math.atan2(trackTangent.y, Math.sqrt(trackTangent.x * trackTangent.x + trackTangent.z * trackTangent.z));

        // 1. Pitch (Braking Dive & Acceleration Squat & Hill Slope)
        let targetPitch = -hillSlope;
        if (keys.down && speed > 10) targetPitch += 0.06; // Braking dive
        else if (keys.up && speed > 5) targetPitch -= 0.035; // Acceleration squat

        const aeroSquat = clamp(kmh / 300, 0, 1) * -0.015; // Downforce pushes car down at high speed
        targetPitch += aeroSquat;

        player.rotation.x = lerp(player.rotation.x, targetPitch, dt * 8);

        // 2. Roll (Lateral G-Forces)
        const lateralG = steer * clamp(kmh / 150, 0, 1);
        const targetRoll = -lateralG * 0.14;
        player.rotation.z = lerp(player.rotation.z, targetRoll, dt * 10);

        // 3. Yaw (Slip Angle is naturally handled by difference between 'heading' and 'moveYaw')
        player.rotation.y = heading;

        // 4. High-Speed Vibrations
        const rpmNorm = clamp(kmh / maxSpeed, 0.2, 1);
        const vibAmp = (clamp((kmh - 100) / 200, 0, 1) * 0.015) + (rpmNorm * 0.005);

        player.children.forEach((child) => {
          // Identify the loaded GLB model by checking scale (it was set to 3.45)
          if (child.type === 'Group' && child.scale.x > 3) {
            child.position.x = (Math.random() - 0.5) * vibAmp;
            child.position.y = 0.05 + (Math.random() - 0.5) * vibAmp;
          }
        });

        weatherLapTimer += dt;

        npcs.forEach((npc, n) => {
          const ni = Math.floor(npc.t * samples) % samples;
          const c = curvatures[(ni + 6) % samples];
          const laneWobble = Math.sin(now * 0.00025 + npc.seed) * 2.2;
          npc.laneTarget = clamp(laneWobble + (n % 2 ? -0.9 : 0.9), -3.6, 3.6);
          if (Math.abs(npc.t - pT) < 0.035) npc.laneTarget += speed > npc.speed ? -1.1 : 1.1;
          npc.lane = lerp(npc.lane, npc.laneTarget, clamp(dt * 0.9, 0, 1));

          const cornerPenalty = c * (0.36 + rainLevel * 0.22);
          const aggro = (cfg.aiLevel / 100) * 0.24 + npc.aggression * 0.14;
          const tSpeed = aiTop * (1 - cornerPenalty) * (1 + aggro * 0.16);
          npc.speed = lerp(npc.speed, tSpeed, clamp(dt * 1.7, 0, 1));
          npc.t += (npc.speed * dt) / trackLength;
          if (npc.t >= 1) {
            npc.t -= 1;
            npc.lap += 1;
          }

          sampleTrack(npc.t, npcPoint, npcTangent, npcNormal);
          npcTarget.copy(npcPoint).addScaledVector(npcNormal, npc.lane);
          npcTarget.y += 0.25;
          npc.mesh.position.lerp(npcTarget, clamp(dt * 4.2, 0, 1));

          const yaw = Math.atan2(npcTangent.x, npcTangent.z);
          npc.mesh.rotation.y += normAngle(yaw - npc.mesh.rotation.y) * clamp(dt * 4.5, 0, 1);
          npc.mesh.rotation.z = -normAngle(yaw - npc.mesh.rotation.y) * 0.12;

          const npcHillSlope = Math.atan2(npcTangent.y, Math.sqrt(npcTangent.x * npcTangent.x + npcTangent.z * npcTangent.z));
          npc.mesh.rotation.x = -npcHillSlope;
        });
        prevT = pT;
        pT = findNearestT(player.position, pT);

        if (racing && prevT > 0.93 && pT < 0.08 && now - lastCross > 7000 && kmh > 70) {
          lastCross = now;
          const lapSecs = lapStart > 0 ? (now - lapStart) / 1000 : 0;
          if (lap > 1 && lapSecs > 20) bestLap = bestLap === null ? lapSecs : Math.min(bestLap, lapSecs);

          lap += 1;
          lapStart = now;
          sector = 1;
          sectorStart = now;
          sectorTimes = [null, null, null];

          if (lap > TOTAL_LAPS) {
            finished = true;
            setPhase('finished');
            standingsList[0].p = lap - 1 + pT;
            npcs.forEach((n, i) => { standingsList[i + 1].p = n.lap + n.t; });
            standingsList.sort((a, b) => b.p - a.p);
            const finalPosition = standingsList.findIndex((x) => x.id === 'YOU') + 1;
            const totalTime = raceStart ? (now - raceStart) / 1000 : 0;
            const currentCareer = careerStatsRef.current;
            const isNewBestLap = bestLap !== null && (currentCareer.bestLap === null || bestLap < currentCareer.bestLap);
            const nextCareer = {
              races: currentCareer.races + 1,
              wins: currentCareer.wins + (finalPosition === 1 ? 1 : 0),
              podiums: currentCareer.podiums + (finalPosition <= 3 ? 1 : 0),
              bestLap: isNewBestLap ? bestLap : currentCareer.bestLap,
              lastPosition: finalPosition,
              lastWeather: WEATHER_PRESETS[weatherTarget].name,
              recentResults: [
                {
                  position: finalPosition,
                  total: Number(totalTime.toFixed(3)),
                  weather: WEATHER_PRESETS[weatherTarget].name,
                  timestamp: Date.now()
                },
                ...currentCareer.recentResults
              ].slice(0, 4)
            };
            careerStatsRef.current = nextCareer;
            setCareerStats(nextCareer);
            setResult({
              position: finalPosition,
              total: totalTime,
              best: bestLap,
              weather: WEATHER_PRESETS[weatherTarget].name,
              isNewBestLap,
              personalBest: nextCareer.bestLap,
              career: nextCareer,
              standings: standingsList.map((s, idx) => ({ id: s.id, position: idx + 1, laps: Math.floor(s.p) }))
            });
          }

          if (lap >= 2 && lap <= TOTAL_LAPS && weatherLapTimer > 40) {
            weatherLapTimer = 0;
            weatherTarget = (weatherTarget + 1 + Math.floor(Math.random() * 2)) % WEATHER_PRESETS.length;
            weatherBlend = 0;
          }
        }

        if (racing) {
          const newSector = pT < 0.333 ? 1 : (pT < 0.666 ? 2 : 3);
          if (newSector !== sector) {
            sectorTimes[sector - 1] = sectorStart ? (now - sectorStart) / 1000 : 0;
            sectorStart = now;
            sector = newSector;
          }
        }

        standingsList[0].p = lap - 1 + pT;
        npcs.forEach((n, i) => { standingsList[i + 1].p = n.lap + n.t; });
        standingsList.sort((a, b) => b.p - a.p);
        const pos = standingsList.findIndex((x) => x.id === 'YOU') + 1;
        const raceTime = raceStart ? (now - raceStart) / 1000 : 0;
        const lapTime = lapStart ? (now - lapStart) / 1000 : 0;
        let hudMessage = '';
        if (offTrack) hudMessage = 'OFF TRACK - GRIP REDUCED';
        else if (keys.repair && inDrsZone(pT) && kmh < 55) hudMessage = 'PIT REPAIR IN PROGRESS';
        else if (slip > 0.2) hudMessage = 'SLIPSTREAM BOOST';
        else if (damage > 0.45) hudMessage = 'CAR DAMAGE HIGH - PIT WINDOW OPEN';
        else if (drsReady && !drsOn) hudMessage = 'DRS READY';

        const vRatio = clamp(Math.abs(speed) / Math.max(maxSpeed, 1), 0, 1);
        const camForward = tmpA.set(Math.sin(heading), 0, Math.cos(heading));
        const side = tmpB.set(camForward.z, 0, -camForward.x);

        if (cameraMode === 0) {
          camLift.set(0, 4 + vRatio * 2.5, 0);
          lookLift.set(0, 1.2, 0);
          camTarget.copy(player.position).addScaledVector(camForward, -11 - vRatio * 5).add(camLift);
          lookTarget.copy(player.position).addScaledVector(camForward, 10 + vRatio * 5).add(lookLift);
          camera.fov = 72 + vRatio * 16;
          camera.position.lerp(camTarget, clamp(dt * 6.2, 0, 1));
        } else if (cameraMode === 1) {
          camLift.set(0, 1.05, 0);
          lookLift.set(0, 1.3, 0);
          camTarget.copy(player.position).addScaledVector(camForward, 1.4).add(camLift);
          lookTarget.copy(player.position).addScaledVector(camForward, 30).add(lookLift);
          camera.fov = 84 + vRatio * 8;
          camera.position.lerp(camTarget, clamp(dt * 12, 0, 1));
        } else {
          camLift.set(0, 8 + vRatio * 2.5, 0);
          lookLift.set(0, 1.2, 0);
          camTarget.copy(player.position).addScaledVector(side, 12).addScaledVector(camForward, 3.5).add(camLift);
          lookTarget.copy(player.position).addScaledVector(camForward, 11).add(lookLift);
          camera.fov = 66 + vRatio * 8;
          camera.position.lerp(camTarget, clamp(dt * 3.8, 0, 1));
        }
        // ── Apply screen shake ──
        if (shakeIntensity > 0.01) {
          camera.position.x += (Math.random() - 0.5) * shakeIntensity;
          camera.position.y += (Math.random() - 0.5) * shakeIntensity * 0.6;
          camera.position.z += (Math.random() - 0.5) * shakeIntensity;
        }

        camera.lookAt(lookTarget);
        if (Math.abs(lastFov - camera.fov) > 0.01) {
          camera.updateProjectionMatrix();
          lastFov = camera.fov;
        }

        miniTick += dt;
        if (miniTick > quality.minimapInterval && minimapCtx) {
          miniTick = 0;
          minimapCtx.drawImage(minimapStatic, 0, 0);

          npcs.forEach((npc) => {
            const m = mapPos(npc.mesh.position);
            minimapCtx.fillStyle = '#ffab47';
            minimapCtx.beginPath();
            minimapCtx.arc(m.x, m.y, 3.6, 0, Math.PI * 2);
            minimapCtx.fill();
          });

          const pm = mapPos(player.position);
          minimapCtx.save();
          minimapCtx.translate(pm.x, pm.y);
          minimapCtx.rotate(-heading);
          minimapCtx.fillStyle = '#ff1f51';
          minimapCtx.beginPath();
          minimapCtx.moveTo(0, -7);
          minimapCtx.lineTo(5.5, 6);
          minimapCtx.lineTo(-5.5, 6);
          minimapCtx.closePath();
          minimapCtx.fill();
          minimapCtx.restore();
        }

        hudTick += dt;
        if (hudTick > 0.09) {
          hudTick = 0;
          // Fast DOM updates to bypass React re-renders for high-frequency data
          const speedEl = document.getElementById('hud-speed');
          if (speedEl) speedEl.textContent = Math.round(kmh);
          const gearEl = document.getElementById('hud-gear');
          if (gearEl) gearEl.textContent = `G${gear}`;
          const rpmFill = document.getElementById('hud-rpm-fill');
          if (rpmFill) rpmFill.style.width = `${(Math.round(rpm) / 18000) * 100}%`;
          const rpmLabel = document.getElementById('hud-rpm-label');
          if (rpmLabel) rpmLabel.textContent = `${Math.round(rpm / 1000)}K RPM`;

          const lapTimeEl = document.getElementById('hud-lap-time');
          if (lapTimeEl) lapTimeEl.textContent = formatTime(lapTime);
          const raceTimeEl = document.getElementById('hud-race-time');
          if (raceTimeEl) raceTimeEl.textContent = formatTime(raceTime);

          const posEl = document.getElementById('hud-pos');
          if (posEl) posEl.textContent = `P ${pos}/${npcs.length + 1}`;

          const lapEl = document.getElementById('hud-lap');
          if (lapEl) lapEl.textContent = `LAP ${Math.min(lap, TOTAL_LAPS)}/${TOTAL_LAPS}`;

          const fpsEl = document.getElementById('hud-fps');
          if (fpsEl) fpsEl.textContent = `FPS: ${fps}`;

          setHud((prev) => ({
            ...prev,
            speed: Math.round(kmh),
            gear,
            rpm: Math.round(rpm),
            lap: Math.min(lap, TOTAL_LAPS),
            lapTime,
            raceTime,
            position: pos,
            bestLap,
            sector,
            sectors: [...sectorTimes],
            drsReady,
            drsOn,
            ers: Math.round(ers),
            ersOn,
            damage: Math.round(damage * 100),
            weather: WEATHER_PRESETS[weatherTarget].name,
            camera: CAMERA_MODES[cameraMode],
            slipstream: slip > 0.2,
            offTrack,
            message: hudMessage,
            tireTemp: Math.round(tireTemp)
          }));

          debugStateRef.current = {
            coordinateSystem: 'trackProgress is 0..1 around the circuit; lateralOffsetMeters is signed from centerline (+left, -right).',
            phase: state,
            countdown: inCountdown ? (countdownStep === 0 ? 'GO' : countdownStep) : null,
            player: {
              lap: Math.min(lap, TOTAL_LAPS),
              trackProgress: Number(pT.toFixed(3)),
              lateralOffsetMeters: Number(lateral.toFixed(2)),
              speedKmh: Math.round(kmh),
              gear,
              rpm: Math.round(rpm),
              damagePct: Math.round(damage * 100),
              tireTempC: Math.round(tireTemp)
            },
            race: {
              position: pos,
              competitors: npcs.length + 1,
              sector,
              fps,
              lapTime: Number(lapTime.toFixed(3)),
              raceTime: Number(raceTime.toFixed(3)),
              bestLap: bestLap ? Number(bestLap.toFixed(3)) : null,
              drsReady,
              drsOn,
              ersPct: Math.round(ers),
              ersOn,
              weather: WEATHER_PRESETS[weatherTarget].name,
              camera: CAMERA_MODES[cameraMode],
              renderScale: Number(activePixelRatio.toFixed(2)),
              slipstream: slip > 0.2,
              offTrack,
              finished
            },
            leaders: standingsList.slice(0, 3).map((entry) => ({
              id: entry.id,
              progress: Number(entry.p.toFixed(3))
            })),
            hudMessage: hudMessage || null
          };
        }

        
            // ── Wind noise: speed dependent ──

            // ── Exhaust pops on lift-off at high RPM ──

            // ── Gear shift thump ──

            // ── Master volume ──
      }

      renderer.render(scene, camera);
    };

    const animate = () => {
      if (manualFrameMode) return;
      renderFrame(performance.now());
      if (!finished || phaseRef.current !== 'menu') anim = requestAnimationFrame(animate);
    };

    window.advanceTime = async (ms) => {
      manualFrameMode = true;
      cancelAnimationFrame(anim);
      simulatedNow += Math.max(ms, 40);
      renderFrame(simulatedNow);
    };

    anim = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(anim);
      delete window.advanceTime;
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('resize', resize);
      smokeGeo.dispose();
      smokeMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      barrierGeo.dispose();
      rainGeo.dispose();
      rainMat.dispose();
      skyTexture.dispose();
      grassTexture.dispose();
      roadGeo.dispose();
      roadMat.dispose();
      lineGeo.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose && m.dispose());
          else if (obj.material.dispose) obj.material.dispose();
        }
      });
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      if (minimapHost) minimapHost.innerHTML = '';
    };
  }, [sessionId]);

  const updateSetting = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="f1-root">
      <div ref={containerRef} className="f1-canvas" />
      <div className="screen-fx" />

      {phase === 'menu' && (
        <div className="menu-overlay">
          <div className="menu-card">
            <p className="menu-kicker">Prototype Build 0.9</p>
            <h1 className="menu-title">SILVERSTONE RUSH</h1>
            <p className="menu-subtitle">Turning this F1 prototype into a high-end arcade racer feel.</p>

            <div className="menu-controls">
              <div className="control-block"><span>W / Arrow Up</span><span>Throttle</span></div>
              <div className="control-block"><span>S / Arrow Down</span><span>Brake</span></div>
              <div className="control-block"><span>A/D or Arrows</span><span>Steer</span></div>
              <div className="control-block"><span>Shift / F / Space</span><span>DRS / ERS / Drift</span></div>
            </div>

            <div className="menu-actions">
              <button id="start-btn" type="button" className="btn btn-primary" onClick={startRace}>Start Race</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSettings((v) => !v)}>
                {showSettings ? 'Hide Setup' : 'Setup'}
              </button>
            </div>

            <div className="career-strip">
              <div className="career-card">
                <span className="career-label">Races</span>
                <strong>{careerStats.races}</strong>
              </div>
              <div className="career-card">
                <span className="career-label">Wins</span>
                <strong>{careerStats.wins}</strong>
              </div>
              <div className="career-card">
                <span className="career-label">Podiums</span>
                <strong>{careerStats.podiums}</strong>
              </div>
              <div className="career-card">
                <span className="career-label">Personal Best</span>
                <strong>{careerStats.bestLap ? formatTime(careerStats.bestLap) : '--:--.---'}</strong>
              </div>
            </div>

            {careerStats.recentResults.length > 0 && (
              <div className="recent-form">
                <span className="recent-label">Recent Form</span>
                <div className="recent-list">
                  {careerStats.recentResults.map((entry) => (
                    <span key={`${entry.timestamp}-${entry.position}`} className={`recent-pill ${entry.position <= 3 ? 'recent-pill-good' : ''}`}>
                      P{entry.position} · {entry.weather}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {showSettings && (
              <div className="settings-panel">
                <div className="setting-row">
                  <label>Top Speed</label>
                  <span>{settings.maxSpeed} km/h</span>
                  <input type="range" min="220" max="360" step="5" value={settings.maxSpeed} onChange={(e) => updateSetting('maxSpeed', Number(e.target.value))} />
                </div>
                <div className="setting-row">
                  <label>Acceleration</label>
                  <span>{settings.acceleration}%</span>
                  <input type="range" min="30" max="100" step="1" value={settings.acceleration} onChange={(e) => updateSetting('acceleration', Number(e.target.value))} />
                </div>
                <div className="setting-row">
                  <label>Steering Response</label>
                  <span>{settings.steering}%</span>
                  <input type="range" min="25" max="100" step="1" value={settings.steering} onChange={(e) => updateSetting('steering', Number(e.target.value))} />
                </div>
                <div className="setting-row">
                  <label>Brake Power</label>
                  <span>{settings.brakePower}%</span>
                  <input type="range" min="30" max="100" step="1" value={settings.brakePower} onChange={(e) => updateSetting('brakePower', Number(e.target.value))} />
                </div>
                <div className="setting-row">
                  <label>AI Difficulty</label>
                  <span>{settings.aiLevel}%</span>
                  <input type="range" min="25" max="100" step="1" value={settings.aiLevel} onChange={(e) => updateSetting('aiLevel', Number(e.target.value))} />
                </div>
                <button type="button" className="btn btn-reset" onClick={() => setSettings(DEFAULT_SETTINGS)}>Reset Setup</button>
              </div>
            )}
          </div>
        </div>
      )}

      {phase !== 'menu' && (
        <>
          <div className="top-hud">
            <div className="top-hud-left">
              <span id="hud-pos" className="hud-chip">P {hud.position}/{hud.competitors}</span>
              <span id="hud-lap" className="hud-chip">LAP {hud.lap}/{TOTAL_LAPS}</span>
              <span className="hud-chip">SECTOR {hud.sector}</span>
            </div>
            <div className="top-hud-right">
              <span className={`hud-chip ${hud.drsOn ? 'active-chip' : ''}`}>{hud.drsOn ? 'DRS OPEN' : (hud.drsReady ? 'DRS READY' : 'DRS OFF')}</span>
              <span className={`hud-chip cyan-chip ${hud.ersOn ? 'active-chip' : ''}`}>ERS {hud.ers}%</span>
              <span className="hud-chip">CAM {hud.camera}</span>
            </div>
          </div>

          <div className="speed-hud">
            <div id="hud-speed" className="speed-main">{hud.speed}</div>
            <div className="speed-unit">KM/H</div>
            <div id="hud-gear" className="gear-block">G{hud.gear}</div>
            <div className="rpm-wrap">
              <div className="rpm-bar"><div id="hud-rpm-fill" className="rpm-fill" style={{ width: `${(hud.rpm / 18000) * 100}%` }} /></div>
              <div id="hud-rpm-label" className="rpm-label">{Math.round(hud.rpm / 1000)}K RPM</div>
            </div>
          </div>

          <div className="timer-hud">
            <div><label>Lap Time</label><strong id="hud-lap-time">{formatTime(hud.lapTime)}</strong></div>
            <div><label>Race Time</label><strong id="hud-race-time">{formatTime(hud.raceTime)}</strong></div>
            <div><label>Best</label><strong>{hud.bestLap ? formatTime(hud.bestLap) : '--:--.---'}</strong></div>
            <div className="sectors">
              {hud.sectors.map((v, i) => (
                <span key={`sector-${i}`} className={hud.sector === i + 1 ? 'active-sector' : ''}>S{i + 1} {v ? v.toFixed(2) : '--.--'}</span>
              ))}
            </div>
          </div>

          <div className="status-strip">
            <span className={hud.slipstream ? 'accent-green' : ''}>Slipstream: {hud.slipstream ? 'ON' : 'OFF'}</span>
            <span className={hud.offTrack ? 'accent-red' : ''}>Track: {hud.offTrack ? 'OFF' : 'ON'}</span>
            <span className={hud.damage > 45 ? 'accent-red' : (hud.damage > 22 ? 'accent-yellow' : '')}>Damage: {hud.damage}%</span>
            <span>Weather: {hud.weather}</span>
            <span className={hud.tireTemp > 112 || hud.tireTemp < 66 ? 'accent-yellow' : ''}>Tyres: {hud.tireTemp}°C</span>
            <span>{tiltEnabled ? 'Input: Tilt' : 'Input: Buttons'}</span>
            <span id="hud-fps">FPS: {hud.fps}</span>
          </div>

          {hud.message && <div className="event-banner">{hud.message}</div>}

          <div ref={minimapRef} className="minimap-shell" />

          <div className="controls-strip">
            <span>WASD / Arrows Drive</span><span>Shift DRS</span><span>F ERS</span><span>Space Drift</span><span>B Pit Repair</span><span>C Camera</span><span>Esc Pause</span><span>Mobile: Tilt Mode</span>
          </div>

          {/* ── Mobile Touch Controls ── */}
          <div className="touch-controls">
            <div className="touch-left">
              <button className="touch-btn touch-steer-l" onTouchStart={() => { keysRef.current.left = true; }} onTouchEnd={() => { keysRef.current.left = false; }} onTouchCancel={() => { keysRef.current.left = false; }} onMouseDown={() => { keysRef.current.left = true; }} onMouseUp={() => { keysRef.current.left = false; }} onContextMenu={(e) => e.preventDefault()}>&#9664;</button>
              <button className="touch-btn touch-steer-r" onTouchStart={() => { keysRef.current.right = true; }} onTouchEnd={() => { keysRef.current.right = false; }} onTouchCancel={() => { keysRef.current.right = false; }} onMouseDown={() => { keysRef.current.right = true; }} onMouseUp={() => { keysRef.current.right = false; }} onContextMenu={(e) => e.preventDefault()}>&#9654;</button>
            </div>
            <div className="touch-right">
              <button className="touch-btn touch-gas" onTouchStart={() => { keysRef.current.up = true; }} onTouchEnd={() => { keysRef.current.up = false; }} onTouchCancel={() => { keysRef.current.up = false; }} onMouseDown={() => { keysRef.current.up = true; }} onMouseUp={() => { keysRef.current.up = false; }} onContextMenu={(e) => e.preventDefault()}>GAS</button>
              <button className="touch-btn touch-brake" onTouchStart={() => { keysRef.current.down = true; }} onTouchEnd={() => { keysRef.current.down = false; }} onTouchCancel={() => { keysRef.current.down = false; }} onMouseDown={() => { keysRef.current.down = true; }} onMouseUp={() => { keysRef.current.down = false; }} onContextMenu={(e) => e.preventDefault()}>BRK</button>
            </div>
            <div className="touch-extras">
              <button className="touch-btn touch-sm" onTouchStart={() => { keysRef.current.drs = true; }} onTouchEnd={() => { keysRef.current.drs = false; }} onTouchCancel={() => { keysRef.current.drs = false; }} onMouseDown={() => { keysRef.current.drs = true; }} onMouseUp={() => { keysRef.current.drs = false; }} onContextMenu={(e) => e.preventDefault()}>DRS</button>
              <button className="touch-btn touch-sm" onTouchStart={() => { keysRef.current.ers = true; }} onTouchEnd={() => { keysRef.current.ers = false; }} onTouchCancel={() => { keysRef.current.ers = false; }} onMouseDown={() => { keysRef.current.ers = true; }} onMouseUp={() => { keysRef.current.ers = false; }} onContextMenu={(e) => e.preventDefault()}>ERS</button>
              <button className="touch-btn touch-sm" onTouchStart={() => { keysRef.current.drift = true; }} onTouchEnd={() => { keysRef.current.drift = false; }} onTouchCancel={() => { keysRef.current.drift = false; }} onMouseDown={() => { keysRef.current.drift = true; }} onMouseUp={() => { keysRef.current.drift = false; }} onContextMenu={(e) => e.preventDefault()}>DRFT</button>
              <button className={`touch-btn touch-sm ${tiltEnabled ? 'touch-btn-active' : ''}`} type="button" onClick={() => setTiltEnabled((v) => !v)} onContextMenu={(e) => e.preventDefault()}>{tiltEnabled ? 'TILT ON' : 'TILT'}</button>
            </div>
          </div>

          {/* ── DRS/ERS screen effect overlays ── */}
          {hud.drsOn && <div className="drs-screen-fx" />}
          {hud.ersOn && <div className="ers-screen-fx" />}

          {countdown !== null && (
            <div className="countdown-overlay">
              <div className="starting-lights">
                {[1, 2, 3].map(n => (
                  <div key={n} className={`light-col ${countdown !== 'GO' && (4 - countdown) >= n ? 'light-on' : ''} ${countdown === 'GO' ? 'light-go' : ''}`}>
                    <div className="light-bulb" />
                    <div className="light-bulb" />
                  </div>
                ))}
              </div>
              <div className="countdown-value">{countdown}</div>
            </div>
          )}

          {phase === 'paused' && (
            <div className="modal-overlay">
              <div className="modal-card">
                <h2>Race Paused</h2>
                <p>Press ESC to continue, or choose an action.</p>
                <div className="modal-actions">
                  <button type="button" className="btn btn-primary" onClick={() => setPhase('racing')}>Continue</button>
                  <button type="button" className="btn btn-secondary" onClick={restartRace}>Restart</button>
                  <button type="button" className="btn btn-ghost" onClick={backToMenu}>Back to Menu</button>
                </div>
              </div>
            </div>
          )}

          {phase === 'finished' && result && (
            <div className="modal-overlay finish">
              <div className="modal-card finish-card">
                <div className="finish-badge">{result.position === 1 ? '🏆' : `P${result.position}`}</div>
                <h2>{result.position === 1 ? 'VICTORY!' : result.position <= 3 ? 'PODIUM FINISH!' : 'RACE COMPLETE'}</h2>
                <div className="finish-stats">
                  <div className="stat-block"><span className="stat-label">Position</span><span className="stat-value">{result.position}/{result.standings ? result.standings.length : 7}</span></div>
                  <div className="stat-block"><span className="stat-label">Total Time</span><span className="stat-value">{formatTime(result.total)}</span></div>
                  <div className="stat-block"><span className="stat-label">Best Lap</span><span className="stat-value">{result.best ? formatTime(result.best) : '--:--.---'}</span></div>
                  <div className="stat-block"><span className="stat-label">Weather</span><span className="stat-value">{result.weather}</span></div>
                </div>
                <div className={`finish-callout ${result.isNewBestLap ? 'finish-callout-hot' : ''}`}>
                  {result.isNewBestLap ? 'New personal best lap.' : `Personal best: ${result.personalBest ? formatTime(result.personalBest) : '--:--.---'}`}
                </div>
                {result.career && (
                  <div className="finish-career-grid">
                    <div className="career-card">
                      <span className="career-label">Career Races</span>
                      <strong>{result.career.races}</strong>
                    </div>
                    <div className="career-card">
                      <span className="career-label">Career Wins</span>
                      <strong>{result.career.wins}</strong>
                    </div>
                    <div className="career-card">
                      <span className="career-label">Career Podiums</span>
                      <strong>{result.career.podiums}</strong>
                    </div>
                  </div>
                )}
                {result.standings && (
                  <div className="standings-table">
                    <div className="standings-header">FINAL CLASSIFICATION</div>
                    {result.standings.map((s, idx) => (
                      <div key={s.id} className={`standings-row ${s.id === 'YOU' ? 'standings-you' : ''}`}>
                        <span className="standings-pos">{s.position}</span>
                        <span className="standings-name">{s.id}</span>
                        <span className="standings-laps">{s.laps} laps</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="modal-actions">
                  <button type="button" className="btn btn-primary" onClick={restartRace}>Race Again</button>
                  <button type="button" className="btn btn-ghost" onClick={backToMenu}>Menu</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
