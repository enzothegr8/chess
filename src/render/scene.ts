import * as THREE from 'three';

export interface SceneBundle {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
}

function makeBackground(): THREE.Mesh {
  // Full-screen-scale inverted sphere with a vertical gradient shader, so the
  // camera can orbit freely without ever seeing an edge.
  const geometry = new THREE.SphereGeometry(500, 32, 32);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      colorTop: { value: new THREE.Color('#0c1330') },
      colorBottom: { value: new THREE.Color('#04060f') },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 colorTop;
      uniform vec3 colorBottom;
      void main() {
        float h = normalize(vPos).y * 0.5 + 0.5;
        gl_FragColor = vec4(mix(colorBottom, colorTop, h), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -10;
  return mesh;
}

function makeStarfield(): THREE.Points {
  const count = 4000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // distribute on a large sphere shell so stars never appear to move with parallax
    const radius = 300 + Math.random() * 150;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: '#eafeff',
    size: 1.1,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

export function createScene(container: HTMLElement): SceneBundle {
  const scene = new THREE.Scene();

  const canvas = document.createElement('canvas');
  canvas.className = 'viewport';
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x04060f, 1);

  scene.add(makeBackground());
  scene.add(makeStarfield());

  const ambient = new THREE.AmbientLight(0x2a3a5c, 1.2);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0x9fd8ff, 0.4);
  directional.position.set(4, 6, 3);
  scene.add(directional);

  window.addEventListener('resize', () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  return { scene, renderer, canvas };
}
