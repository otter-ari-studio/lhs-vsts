import {
  defineConfig,
  js,
  reactHooksPlugin,
  reactPlugin,
  ts,
} from '@rslint/core';

// R3F / Three host props are not DOM attributes; allow the common set.
const R3F_PROPS = [
  'args',
  'attach',
  'castShadow',
  'color',
  'dispose',
  'enablePan',
  'geometry',
  'intensity',
  'maxDistance',
  'maxPolarAngle',
  'metalness',
  'minDistance',
  'name',
  'opacity',
  'position',
  'receiveShadow',
  'rotation',
  'roughness',
  'scale',
  'shadow-mapSize',
  'target',
  'transparent',
  'userData',
  'visible',
  'wireframe',
];

export default defineConfig([
  js.configs.recommended,
  ts.configs.recommended,
  reactPlugin.configs.recommended,
  reactHooksPlugin.configs.recommended,
  {
    rules: {
      'react/no-unknown-property': ['error', { ignore: R3F_PROPS }],
    },
  },
]);
