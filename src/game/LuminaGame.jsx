import React from 'react';
import useGameLoop from './useGameLoop';
import { SKINS } from '../shop/skins';

export default function LuminaGame() {
  useGameLoop();
  return (
    <div style={{padding:20}}>
      <h2>Lumina Game (placeholder)</h2>
      <p>Skins available: {SKINS.length}</p>
    </div>
  );
}
