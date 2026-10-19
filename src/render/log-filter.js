// Filters benign ANGLE/HLSL shader-compiler warnings out of three's console output.
// Idempotent; render/ installs it at init — main.js may install it at boot so env's early compiles are covered:
//   import { installShaderLogFilter } from './render/log-filter.js'; installShaderLogFilter();
import { getConsoleFunction, setConsoleFunction } from 'three';

/**
 * three routes shader-compiler logs through its console hook. ANGLE/D3D11 reports benign HLSL warnings
 * (X3595 "gradient instruction used in a loop", X3557 loop unrolling, X3570/X3571) for library shaders
 * (N8AO's sampling loops). Drop a Program Info Log only when it contains nothing but such warnings;
 * everything else passes through unchanged.
 */
export function installShaderLogFilter() {
  const prev = getConsoleFunction();
  if (prev?.mikdashFilter) return;
  const benign = /^\s*(\(\d+,\d+(-\d+)?\): )?warning X(3595|3557|3570|3571|4000|4121|4122): .*$/;
  const fn = (type, message, ...params) => {
    if (type === 'warn' && typeof message === 'string' && message.includes('Program Info Log')) {
      const text = params.map(String).join('\n');
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length && lines.every((l) => benign.test(l))) { fn.suppressed++; return; }
    }
    if (prev) prev(type, message, ...params);
    else console[type === 'log' ? 'log' : type === 'warn' ? 'warn' : 'error'](message, ...params);
  };
  fn.mikdashFilter = true;
  fn.suppressed = 0;
  setConsoleFunction(fn);
}

