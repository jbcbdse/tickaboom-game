import type { GameEvent, GameState, Move, PlayerId } from "@tickaboom/engine";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { PLACE_MS, ROUND_MS, roundDelayMs, roundFlightMs } from "./FxTiming.ts";
import { GlossyPipMaterial } from "./GlossyPipMaterial.ts";
import { MotionQueue } from "./MotionQueue.ts";
import { PipLayout } from "./PipLayout.ts";
import { PlayerColors } from "./PlayerColors.ts";

type Exploded = Extract<GameEvent, { type: "exploded" }>;
type PipAdded = Extract<GameEvent, { type: "pip_added" }>;

export class BoardView {
  private readonly scene = new Scene();
  private readonly camera: OrthographicCamera;
  private readonly renderer: WebGLRenderer;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly cellGeometry = new PlaneGeometry(0.9, 0.9);
  private readonly pipGeometry = new SphereGeometry(0.15, 32, 32);
  private readonly emptyMaterial = new MeshStandardMaterial({
    color: 0x2a3344,
  });
  private readonly legalMaterial = new MeshStandardMaterial({
    color: 0x3d4d66,
  });
  private readonly tiles = new Map<string, Mesh>();
  private readonly cellPips = new Map<string, Mesh[]>();
  private readonly flying: Mesh[] = [];
  private readonly pipMaterials = new Map<PlayerId, GlossyPipMaterial>();
  private readonly pipOwners = new WeakMap<Mesh, PlayerId>();
  private readonly motions = new MotionQueue();
  private readonly layout = new PipLayout();
  private legal = new Set<string>();
  private readonly onPick: (x: number, y: number) => void;
  private readonly colors: PlayerColors;
  private readonly size = 11;
  private disposed = false;
  private busy = false;
  private resizeObserver: ResizeObserver | null = null;
  private envTexture: Texture | null = null;

  public constructor(
    canvas: HTMLCanvasElement,
    onPick: (x: number, y: number) => void,
    colors: PlayerColors,
  ) {
    this.onPick = onPick;
    this.colors = colors;
    this.scene.background = new Color(0x12151c);
    const extent = (this.size - 1) / 2 + 0.7;
    this.camera = new OrthographicCamera(-extent, extent, extent, -extent, 0.1, 100);
    this.camera.position.set(0, 0, 12);
    this.camera.lookAt(0, 0, 0);

    this.renderer = BoardView.createRenderer(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    const pmrem = new PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.envTexture = env.texture;
    this.scene.environment = env.texture;
    this.scene.environmentIntensity = 0.85;
    pmrem.dispose();

    const ambient = new AmbientLight(0xffffff, 0.28);
    const key = new DirectionalLight(0xffffff, 1.35);
    key.position.set(4, 8, 16);
    const spec = new PointLight(0xffffff, 2.4, 0, 1.2);
    spec.position.set(2.2, 3.4, 7);
    const rim = new DirectionalLight(0xd8e7ff, 0.4);
    rim.position.set(-8, -4, 9);
    this.scene.add(ambient, key, spec, rim);

    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const tile = new Mesh(this.cellGeometry, this.emptyMaterial);
        tile.position.copy(this.cellPosition(x, y));
        tile.userData = { x, y };
        this.scene.add(tile);
        this.tiles.set(this.key(x, y), tile);
      }
    }

    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    this.resizeObserver = new ResizeObserver(() => {
      this.onResize();
    });
    const parent = canvas.parentElement;
    if (parent) {
      this.resizeObserver.observe(parent);
    }
    window.addEventListener("resize", this.onResize);
    this.onResize();
    requestAnimationFrame(this.onResize);
    this.tick();
  }

  public isBusy(): boolean {
    return this.busy;
  }

  public setState(state: GameState, legalMoves: Move[]): void {
    this.setLegal(legalMoves);
    this.clearPips();
    for (let y = 0; y < this.size; y += 1) {
      const row = state.board[y];
      if (!row) {
        continue;
      }
      for (let x = 0; x < this.size; x += 1) {
        const cell = row[x];
        if (!cell || cell.pips === 0 || cell.owner === null) {
          continue;
        }
        this.spawnCell(x, y, cell.pips, cell.owner);
      }
    }
  }

  public playEvents(
    events: GameEvent[],
    final: GameState,
    legalMoves: Move[],
    onDone: () => void,
  ): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.setLegal([]);
    void this.runEvents(events).then(() => {
      if (this.disposed) {
        return;
      }
      this.setState(final, legalMoves);
      this.busy = false;
      onDone();
    });
  }

  public dispose(): void {
    this.disposed = true;
    this.motions.cancel();
    this.renderer.domElement.removeEventListener(
      "pointermove",
      this.onPointerMove,
    );
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.onPointerDown,
    );
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.onResize);
    this.clearPips();
    for (const material of this.pipMaterials.values()) {
      material.dispose();
    }
    this.envTexture?.dispose();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.cellGeometry.dispose();
    this.pipGeometry.dispose();
    this.emptyMaterial.dispose();
    this.legalMaterial.dispose();
  }

  private async runEvents(events: GameEvent[]): Promise<void> {
    let index = 0;
    while (index < events.length && !this.disposed) {
      const event = events[index];
      if (!event) {
        break;
      }
      if (event.type === "pip_added") {
        await this.animatePlace(event);
        index += 1;
        continue;
      }
      if (event.type === "exploded") {
        const round = event.cascadeIndex;
        const wave: Exploded[] = [];
        while (index < events.length) {
          const next = events[index];
          if (!next) {
            break;
          }
          if (next.type === "exploded" && next.cascadeIndex === round) {
            wave.push(next);
            index += 1;
            continue;
          }
          if (
            next.type === "captured" ||
            next.type === "player_eliminated" ||
            next.type === "ended"
          ) {
            index += 1;
            continue;
          }
          break;
        }
        const started = performance.now();
        await this.animateWave(wave);
        const leftover = ROUND_MS - (performance.now() - started);
        if (leftover > 0) {
          await this.delay(leftover);
        }
        continue;
      }
      index += 1;
    }
  }

  private async animatePlace(event: PipAdded): Promise<void> {
    const origin = this.cellPosition(event.x, event.y);
    const list = this.pipsAt(event.x, event.y);
    const count = list.length + 1;
    const pip = this.spawnPip(
      event.owner,
      this.layout.position(count - 1, count, origin),
    );
    pip.scale.setScalar(0);
    list.push(pip);
    const moves = list.map((mesh, i) =>
      this.moveMesh(mesh, this.layout.position(i, count, origin), PLACE_MS),
    );
    await Promise.all([
      ...moves,
      this.motions.play(PLACE_MS, (t) => {
        pip.scale.setScalar(MotionQueue.easeOutBack(t));
      }),
    ]);
  }

  private async animateWave(wave: Exploded[]): Promise<void> {
    const count = wave.length;
    const flightMs = roundFlightMs(count);
    await Promise.all(
      wave.map(async (boom, index) => {
        await this.delay(roundDelayMs(index, count));
        if (this.disposed) {
          return;
        }
        await this.animateBoom(boom, flightMs);
      }),
    );
  }

  private async animateBoom(boom: Exploded, flightMs: number): Promise<void> {
    const origin = this.cellPosition(boom.x, boom.y);
    const list = this.pipsAt(boom.x, boom.y);
    const owner = this.ownerOf(list) ?? boom.ownerAfter ?? 0;
    const flyCount = boom.neighbors.length;
    while (list.length < flyCount) {
      list.push(this.spawnPip(owner, origin));
    }
    while (list.length > flyCount + boom.pipsAfter) {
      const extra = list.pop();
      if (extra) {
        this.scene.remove(extra);
      }
    }
    const flyers = list.splice(Math.max(0, list.length - flyCount), flyCount);
    this.flying.push(...flyers);
    if (boom.ownerAfter !== null) {
      this.recolor(list, boom.ownerAfter);
    }
    const restack = list.map((mesh, i) =>
      this.moveMesh(mesh, this.layout.position(i, list.length, origin), flightMs),
    );
    const flights = boom.neighbors.map((neighbor, i) => {
      const flyer = flyers[i];
      if (!flyer) {
        return Promise.resolve();
      }
      const start = flyer.position.clone();
      const target = this.layout.position(0, 1, this.cellPosition(neighbor.x, neighbor.y));
      const peak = start.clone().lerp(target, 0.5);
      peak.z = 0.9;
      return this.motions
        .play(
          flightMs,
          (t) => {
            const u = MotionQueue.easeInOutCubic(t);
            flyer.position.copy(this.bezier(start, peak, target, u));
          },
          flyer,
        )
        .then(() => {
          if (!this.disposed) {
            this.landPip(flyer, neighbor.x, neighbor.y, owner);
          }
        });
    });
    await Promise.all([...restack, ...flights]);
  }

  private landPip(
    flyer: Mesh,
    x: number,
    y: number,
    owner: PlayerId,
  ): void {
    this.releaseFlying([flyer]);
    const list = this.pipsAt(x, y);
    list.push(flyer);
    this.recolor(list, owner);
    const origin = this.cellPosition(x, y);
    const settle = Math.min(90, PLACE_MS);
    list.forEach((mesh, i) => {
      void this.moveMesh(mesh, this.layout.position(i, list.length, origin), settle);
    });
  }

  private spawnCell(x: number, y: number, count: number, owner: PlayerId): void {
    const origin = this.cellPosition(x, y);
    const list = this.pipsAt(x, y);
    for (let i = 0; i < count; i += 1) {
      list.push(this.spawnPip(owner, this.layout.position(i, count, origin)));
    }
  }

  private spawnPip(owner: PlayerId, position: Vector3): Mesh {
    const pip = new Mesh(this.pipGeometry, this.materialFor(owner));
    pip.position.copy(position);
    this.pipOwners.set(pip, owner);
    this.scene.add(pip);
    return pip;
  }

  private pipsAt(x: number, y: number): Mesh[] {
    const key = this.key(x, y);
    const list = this.cellPips.get(key);
    if (list) {
      return list;
    }
    const created: Mesh[] = [];
    this.cellPips.set(key, created);
    return created;
  }

  private materialFor(owner: PlayerId): GlossyPipMaterial {
    const existing = this.pipMaterials.get(owner);
    if (existing) {
      return existing;
    }
    const material = new GlossyPipMaterial(this.colors.hex(owner));
    this.pipMaterials.set(owner, material);
    return material;
  }

  private recolor(meshes: Mesh[], owner: PlayerId): void {
    const material = this.materialFor(owner);
    for (const mesh of meshes) {
      mesh.material = material;
      this.pipOwners.set(mesh, owner);
    }
  }

  private ownerOf(meshes: Mesh[]): PlayerId | null {
    const first = meshes[0];
    if (!first) {
      return null;
    }
    return this.pipOwners.get(first) ?? null;
  }

  private releaseFlying(meshes: Mesh[]): void {
    for (const mesh of meshes) {
      const index = this.flying.indexOf(mesh);
      if (index >= 0) {
        this.flying.splice(index, 1);
      }
    }
  }

  private moveMesh(mesh: Mesh, target: Vector3, durationMs: number): Promise<void> {
    this.motions.finish(mesh);
    const start = mesh.position.clone();
    return this.motions.play(
      durationMs,
      (t) => {
        const u = MotionQueue.easeInOutCubic(t);
        mesh.position.lerpVectors(start, target, u);
      },
      mesh,
    );
  }

  private bezier(a: Vector3, b: Vector3, c: Vector3, t: number): Vector3 {
    const u = 1 - t;
    return new Vector3(
      u * u * a.x + 2 * u * t * b.x + t * t * c.x,
      u * u * a.y + 2 * u * t * b.y + t * t * c.y,
      u * u * a.z + 2 * u * t * b.z + t * t * c.z,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  private setLegal(legalMoves: Move[]): void {
    this.legal = new Set(legalMoves.map((move) => this.key(move.x, move.y)));
    for (const [key, tile] of this.tiles) {
      tile.material = this.legal.has(key)
        ? this.legalMaterial
        : this.emptyMaterial;
    }
  }

  private clearPips(): void {
    for (const list of this.cellPips.values()) {
      for (const pip of list) {
        this.scene.remove(pip);
      }
    }
    this.cellPips.clear();
    for (const pip of this.flying) {
      this.scene.remove(pip);
    }
    this.flying.length = 0;
  }

  private cellPosition(x: number, y: number): Vector3 {
    const origin = (this.size - 1) / 2;
    return new Vector3(x - origin, origin - y, 0);
  }

  private key(x: number, y: number): string {
    return `${String(x)},${String(y)}`;
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const hit = this.hit(event);
    this.renderer.domElement.style.cursor = hit ? "pointer" : "default";
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.busy) {
      return;
    }
    const hit = this.hit(event);
    if (hit) {
      this.onPick(hit.x, hit.y);
    }
  };

  private hit(event: PointerEvent): { x: number; y: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const tiles = [...this.tiles.values()];
    const intersections = this.raycaster.intersectObjects(tiles);
    const first = intersections[0];
    if (!first) {
      return null;
    }
    const { x, y } = first.object.userData as { x: number; y: number };
    if (!this.legal.has(this.key(x, y))) {
      return null;
    }
    return { x, y };
  }

  private static createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
    try {
      return new WebGLRenderer({ canvas, antialias: true });
    } catch {
      return new WebGLRenderer({ canvas, antialias: false });
    }
  }

  private readonly onResize = (): void => {
    if (this.disposed) {
      return;
    }
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? 0;
    const height = parent?.clientHeight ?? 0;
    const measured = Math.min(width, height);
    const size = measured >= 2 ? measured : 640;
    this.renderer.setSize(size, size);
  };

  private readonly tick = (): void => {
    if (this.disposed) {
      return;
    }
    this.motions.tick(performance.now());
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.tick);
  };
}
