const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const DEFAULT_SETTINGS = {
  maxSpeed: 320,
  acceleration: 68,
  steering: 58,
  brakePower: 70,
  aiLevel: 62
};

export const DEFAULT_CAREER_STATS = {
  races: 0,
  wins: 0,
  podiums: 0,
  bestLap: null,
  lastPosition: null,
  lastWeather: 'CLEAR',
  recentResults: []
};

export const DRIVER_PRESETS = [
  {
    id: 'hammer',
    name: 'HAMMER TIME',
    shortLabel: 'HAMMER',
    callSign: 'Qualifying edge',
    summary: 'Late-brake rotation, big straight-line map, and a car that rewards commitment.',
    focus: 'Attack the Maggots-Becketts direction changes and release the brake cleanly into Stowe.',
    traits: ['late brake', 'front bite', 'exit speed'],
    settings: {
      maxSpeed: 342,
      acceleration: 84,
      steering: 71,
      brakePower: 82,
      aiLevel: 78
    }
  },
  {
    id: 'tyre-whisperer',
    name: 'TYRE WHISPERER',
    shortLabel: 'TYRE',
    callSign: 'Grand prix craft',
    summary: 'Softer on the fronts, calm on exits, and built to cash in during the final laps.',
    focus: 'Protect the front-left through Abbey and let the race come to you before the final stint.',
    traits: ['tyre life', 'traction', 'race pace'],
    settings: {
      maxSpeed: 330,
      acceleration: 73,
      steering: 62,
      brakePower: 76,
      aiLevel: 72
    }
  },
  {
    id: 'rain-intel',
    name: 'RAIN INTEL',
    shortLabel: 'RAIN',
    callSign: 'Mixed-condition calm',
    summary: 'Sharper steering support and extra brake authority for those ugly Silverstone weather swings.',
    focus: 'Hands quiet in the wet, patient brake release, and trust the aero platform on entry.',
    traits: ['wet grip', 'rotation', 'confidence'],
    settings: {
      maxSpeed: 308,
      acceleration: 66,
      steering: 79,
      brakePower: 84,
      aiLevel: 75
    }
  }
];

const normalizeSetting = (value, min, max) => clamp((value - min) / (max - min), 0, 1);

export const getSetupMetrics = (cfg) => {
  const topEnd = normalizeSetting(cfg.maxSpeed, 220, 360);
  const launch = normalizeSetting(cfg.acceleration, 30, 100);
  const turnIn = normalizeSetting(cfg.steering, 25, 100);
  const braking = normalizeSetting(cfg.brakePower, 30, 100);
  const pressure = normalizeSetting(cfg.aiLevel, 25, 100);
  const score = (raw) => Math.round(52 + clamp(raw, 0, 1) * 43);

  return {
    attack: score(topEnd * 0.42 + launch * 0.34 + pressure * 0.24),
    precision: score(turnIn * 0.46 + braking * 0.34 + (1 - topEnd) * 0.2),
    tyreCare: score((1 - launch) * 0.34 + braking * 0.28 + turnIn * 0.18 + (1 - topEnd) * 0.14 + (1 - pressure) * 0.06)
  };
};

export const analyzeSetup = (cfg) => {
  let bestPreset = DRIVER_PRESETS[0];
  let bestDistance = Infinity;

  DRIVER_PRESETS.forEach((preset) => {
    const distance =
      Math.abs(cfg.maxSpeed - preset.settings.maxSpeed) / 140 +
      Math.abs(cfg.acceleration - preset.settings.acceleration) / 70 +
      Math.abs(cfg.steering - preset.settings.steering) / 75 +
      Math.abs(cfg.brakePower - preset.settings.brakePower) / 70 +
      Math.abs(cfg.aiLevel - preset.settings.aiLevel) / 75;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestPreset = preset;
    }
  });

  return {
    preset: bestPreset,
    matchPct: Math.round(clamp(1 - bestDistance / 5, 0, 1) * 100),
    metrics: getSetupMetrics(cfg)
  };
};

export const buildEngineerBrief = (analysis, careerStats) => {
  const recentLine = Number.isFinite(careerStats.lastPosition)
    ? `Last result was P${careerStats.lastPosition}.`
    : 'Fresh slate. Build the lap with intent.';

  const weatherLine = careerStats.lastWeather === 'STORM'
    ? 'If the clouds roll back in, keep the brake release longer and stay disciplined on throttle.'
    : analysis.preset.id === 'hammer'
      ? 'Commit on the brakes, then get the car straight before full deployment.'
      : analysis.preset.id === 'tyre-whisperer'
        ? 'Keep the front axle alive early and harvest the race later.'
        : 'If grip falls away, make smaller steering corrections and trust the platform.';

  return {
    eyebrow: analysis.preset.callSign,
    title: analysis.preset.name,
    copy: `${analysis.preset.summary} ${weatherLine} ${recentLine}`,
    focus: analysis.preset.focus,
    metrics: [
      { label: 'Attack', value: analysis.metrics.attack },
      { label: 'Precision', value: analysis.metrics.precision },
      { label: 'Tyre Care', value: analysis.metrics.tyreCare },
      { label: 'Preset Match', value: analysis.matchPct }
    ]
  };
};

export const DEFAULT_SETUP_ANALYSIS = analyzeSetup(DEFAULT_SETTINGS);

export const loadSettings = () => {
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

export const loadCareerStats = () => {
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
