import * as THREE from 'three';

// The HTML buttons sit over the actual meshes. Mouse, touch, keyboard and the
// no-WebGL view all manipulate the same quantities; the canvas is decorative to AT.
export class NumberScene {
  constructor(host, { reduced, activate, changed }) {
    this.host = host;
    this.reduced = reduced;
    this.activate = activate;
    this.changed = changed;
    this.items = [];
    this.frame = 0;
    this.materials = new Map();
    this.sphere = new THREE.SphereGeometry(1, 20, 14);
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-7, 7, 4, -4, 0.1, 100);
    this.camera.position.set(0, 0, 30);
    this.scene.add(new THREE.AmbientLight(0xffffff, 2.3));
    const light = new THREE.DirectionalLight(0xfff5de, 3.2);
    light.position.set(-6, 9, 16);
    this.scene.add(light);
    const canvas = document.createElement('canvas');
    try {
      const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
      if (context) {
        this.renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        canvas.setAttribute('aria-hidden', 'true');
        host.append(canvas);
        host.classList.add('three-ready');
        canvas.addEventListener('webglcontextlost', this.onContextLost = event => {
          event.preventDefault();
          cancelAnimationFrame(this.frame);
          host.classList.remove('three-ready');
          this.lost = true;
          this.changed?.('The picture counters are ready. You can keep playing.');
        });
      }
    } catch { /* The equivalent HTML counters remain usable. */ }
    this.layer = document.createElement('div');
    this.layer.className = 'counter-layer';
    this.layer.setAttribute('role', 'group');
    this.layer.setAttribute('aria-label', 'Hands-on counting picture');
    host.append(this.layer);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
  }
  material(color) {
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    return this.materials.get(color);
  }
  piece(group, color, position, scale, box = false) {
    const mesh = new THREE.Mesh(box ? this.box : this.sphere, this.material(color));
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    group.add(mesh);
    return mesh;
  }
  apple(group) {
    this.piece(group, '#e5684c', [0, 0, 0], [0.4, 0.38, 0.3]);
    this.piece(group, '#734b30', [0, 0.4, 0], [0.04, 0.14, 0.04], true);
    const leaf = this.piece(group, '#578b52', [0.18, 0.44, 0], [0.22, 0.085, 0.07]);
    leaf.rotation.z = 0.35;
    this.piece(group, '#f7ae84', [-0.16, 0.13, 0.255], [0.08, 0.1, 0.025]);
  }
  frog(group, gold) {
    const color = gold ? '#e9b849' : '#53a891';
    this.piece(group, gold ? '#fae8b1' : '#c3deaf', [0, -0.28, -0.15], [0.58, 0.2, 0.09]);
    this.piece(group, color, [0, -0.05, 0], [0.4, 0.31, 0.28]);
    this.piece(group, '#f9ebbb', [0, -0.13, 0.24], [0.26, 0.18, 0.07]);
    for (const side of [-1, 1]) {
      this.piece(group, color, [side * 0.23, 0.24, 0.05], [0.18, 0.19, 0.18]);
      this.piece(group, '#fff9e7', [side * 0.23, 0.26, 0.19], [0.11, 0.12, 0.06]);
      this.piece(group, '#263e35', [side * 0.23, 0.25, 0.245], [0.052, 0.073, 0.03]);
      this.piece(group, color, [side * 0.36, -0.27, 0.04], [0.19, 0.1, 0.12]);
    }
  }
  flower(group, gold) {
    this.piece(group, '#639456', [0, -0.2, -0.04], [0.05, 0.4, 0.05], true);
    const leaf = this.piece(group, '#8db871', [0.17, -0.29, 0], [0.23, 0.1, 0.06]);
    leaf.rotation.z = 0.5;
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      this.piece(group, gold ? '#f5c567' : '#ede2f2', [Math.sin(angle) * 0.22, 0.1 + Math.cos(angle) * 0.22, 0.12], [0.18, 0.18, 0.1]);
    }
    this.piece(group, '#cf8d39', [0, 0.1, 0.22], [0.14, 0.14, 0.08]);
  }
  show(lesson) {
    this.lesson = lesson;
    for (const item of this.items) this.scene.remove(item.group);
    this.items = [];
    this.layer.replaceChildren();
    const n = lesson.kind === 'ten' ? 10 : lesson.kind === 'join' ? lesson.a + lesson.b : lesson.kind === 'tens' ? lesson.a + lesson.b : lesson.a;
    for (let i = 0; i < n; i++) {
      const group = new THREE.Group();
      const picture = new THREE.Group();
      group.add(picture);
      if (lesson.kind === 'count') this.apple(picture);
      else if (lesson.kind === 'join' || lesson.kind === 'take') this.frog(picture, lesson.kind === 'join' && i >= lesson.a);
      else if (lesson.kind === 'ten') {
        this.piece(group, '#dde7cc', [0, -0.04, -0.26], [1.07, 1.1, 0.08], true);
        this.piece(group, '#f9faef', [0, -0.02, -0.2], [1, 1.03, 0.06], true);
        this.flower(picture, i >= lesson.a);
      } else {
        const tower = i < lesson.a;
        for (let b = 0; b < (tower ? 10 : 1); b++) {
          this.piece(picture, tower ? '#7fabc6' : '#e8b14d', [0, tower ? b * 0.29 - 1.3 : 0, 0], [0.42, 0.265, 0.36], true);
        }
        picture.rotation.y = 0.22;
      }
      this.scene.add(group);
      const button = document.createElement('button');
      button.className = `token ${lesson.kind === 'tens' && i < lesson.a ? 'tower-token' : ''}`;
      button.dataset.token = i;
      const fallback = document.createElement('span');
      fallback.className = `fallback-picture ${lesson.kind} ${i >= lesson.a ? 'second-group' : ''}`;
      fallback.setAttribute('aria-hidden', 'true');
      if (lesson.kind === 'tens') {
        fallback.innerHTML = Array.from({ length: i < lesson.a ? 10 : 1 }, () => '<i></i>').join('');
      } else fallback.textContent = { count: '●', join: '●', take: '●', ten: '✿' }[lesson.kind];
      const badge = document.createElement('span');
      badge.className = 'counted-badge';
      badge.setAttribute('aria-hidden', 'true');
      button.append(fallback, badge);
      button.addEventListener('click', () => this.activate(i));
      this.layer.append(button);
      this.items.push({ group, picture, button, badge, from: new THREE.Vector3(), target: new THREE.Vector3(), startScale: 1, targetScale: 1 });
    }
    this.resize();
  }
  position(i, state) {
    const q = this.lesson;
    const grid = (index, count, columns = 5, gap = 1.35, center = 0) => {
      const cols = Math.min(columns, count);
      const rows = Math.ceil(count / columns);
      return [center + (index % columns - (cols - 1) / 2) * gap, ((rows - 1) / 2 - Math.floor(index / columns)) * 1.5, 0];
    };
    if (q.kind === 'count' || q.kind === 'take') return grid(i, q.a, q.a > 10 ? 8 : 5);
    if (q.kind === 'ten') return grid(i, 10, 5, 1.25);
    if (q.kind === 'tens') {
      if (i < q.a) return [(q.a <= 3 ? -2.5 : -5.1) + i * (q.a <= 3 ? 1.1 : 0.8), 0.15, 0];
      return [(q.a <= 3 ? 1.3 : 3.0) + (i - q.a) % 3 * 0.75, 0.9 - Math.floor((i - q.a) / 3) * 0.85, 0];
    }
    // Once a friend hops in, it belongs to the first group. The whole is
    // laid out in countable rows; friends still waiting stay on the right.
    const joined = state.moved;
    if (i < q.a || joined.includes(i)) {
      const index = i < q.a ? i : q.a + joined.indexOf(i);
      return grid(index, q.a + joined.length, 5, 1.08, joined.length === q.b ? 0 : -3);
    }
    const waiting = Array.from({ length: q.b }, (_, n) => n + q.a).filter(n => !joined.includes(n));
    return grid(waiting.indexOf(i), waiting.length, 5, 1.08, 3);
  }
  update(state, instant = false) {
    this.state = state;
    const q = this.lesson;
    this.items.forEach((item, i) => {
      item.from.copy(item.group.position);
      item.target.set(...this.position(i, state));
      item.startScale = item.group.scale.x;
      const removed = q.kind === 'take' && state.moved.includes(i);
      const empty = q.kind === 'ten' && i >= q.a && !state.filled.includes(i);
      item.targetScale = removed ? 0.7 : 1;
      item.picture.visible = !empty;
      const order = state.marked.indexOf(i);
      item.button.classList.toggle('marked', order >= 0);
      item.button.classList.toggle('removed', removed);
      item.button.classList.toggle('empty', empty);
      item.button.classList.toggle('added', state.filled.includes(i));
      item.button.setAttribute('aria-pressed', String(q.kind === 'ten' ? state.filled.includes(i) : removed || order >= 0 || state.moved.includes(i)));
      let label;
      if (q.kind === 'ten') label = i < q.a ? `Flower ${i + 1}, already growing` : `${empty ? 'Plant a flower in' : 'Remove your flower from'} space ${i + 1}`;
      else if (q.kind === 'tens') label = i < q.a ? `Tower ${i + 1}, ten blocks` : `One block ${i - q.a + 1}`;
      else label = `${q.kind === 'count' ? 'Apple' : 'Frog'} ${i + 1}${removed ? ', hopped away' : order >= 0 ? ', counted' : ''}`;
      item.button.setAttribute('aria-label', label);
      item.badge.textContent = removed ? '↗' : order >= 0 ? String(q.kind === 'tens' ? state.marked.slice(0, order + 1).reduce((sum, id) => sum + (id < q.a ? 10 : 1), 0) : order + 1) : '';
      // A moved-away frog is visually muted without changing shared materials.
      item.picture.scale.setScalar(removed ? 0.7 : 1);
    });
    this.started = performance.now();
    this.duration = this.reduced || instant ? 0 : 480;
    cancelAnimationFrame(this.frame);
    this.animate();
  }
  animate = () => {
    if (this.disposed || !this.state) return;
    const t = this.duration ? Math.min(1, (performance.now() - this.started) / this.duration) : 1;
    const ease = 1 - Math.pow(1 - t, 3);
    const rect = this.host.getBoundingClientRect();
    for (const item of this.items) {
      item.group.position.lerpVectors(item.from, item.target, ease);
      const moving = item.from.distanceToSquared(item.target) > 0.01;
      if (moving && !this.reduced) item.group.position.y += Math.sin(Math.PI * t) * 0.5;
      const size = item.startScale + (item.targetScale - item.startScale) * ease;
      item.group.scale.setScalar(size);
      const point = item.group.position.clone().project(this.camera);
      item.button.style.left = `${(point.x + 1) / 2 * rect.width}px`;
      item.button.style.top = `${(1 - point.y) / 2 * rect.height}px`;
      const unit = rect.width / (this.camera.right - this.camera.left);
      item.button.style.width = `${Math.max(34, unit * (item.button.classList.contains('tower-token') ? 0.6 : 1.1))}px`;
      item.button.style.height = `${Math.max(40, unit * (item.button.classList.contains('tower-token') ? 3.15 : 1.18))}px`;
    }
    if (this.renderer && !this.lost) this.renderer.render(this.scene, this.camera);
    if (t < 1 && !document.hidden) this.frame = requestAnimationFrame(this.animate);
  };
  resize() {
    if (this.disposed) return;
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    const q = this.lesson;
    const halfWidth = !q || q.kind === 'join' || (q.kind === 'take' && q.a > 10) || (q.kind === 'tens' && q.a > 3) ? 6.1 : q.kind === 'ten' ? 3.6 : 3.8;
    const halfHeight = Math.max(3, halfWidth * height / width);
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(width, height, false);
    if (this.state) this.update(this.state, true);
  }
  setReduced(value) { this.reduced = value; if (this.state) this.update(this.state, true); }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.sphere.dispose(); this.box.dispose();
    this.materials.forEach(material => material.dispose());
    this.scene.clear();
    this.host.replaceChildren();
  }
}
