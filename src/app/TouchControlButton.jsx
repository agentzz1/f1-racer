import React from 'react';

export default function TouchControlButton({ className, controlKey, keysRef, children }) {
  const releaseControl = (event) => {
    event.preventDefault();
    keysRef.current[controlKey] = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const pressControl = (event) => {
    event.preventDefault();
    if (event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Some mobile browsers can reject pointer capture for synthetic transitions.
      }
    }
    keysRef.current[controlKey] = true;
  };

  return (
    <button
      type="button"
      className={className}
      onPointerDown={pressControl}
      onPointerUp={releaseControl}
      onPointerCancel={releaseControl}
      onPointerLeave={(event) => {
        if ((event.buttons & 1) === 0) releaseControl(event);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
  );
}
