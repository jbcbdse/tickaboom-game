import { Vector3 } from "three";

export class PipLayout {
  public position(index: number, count: number, origin: Vector3): Vector3 {
    const z = 0.22;
    if (count <= 1) {
      return new Vector3(origin.x, origin.y, z);
    }
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const radius = count === 2 ? 0.16 : 0.2;
    return new Vector3(
      origin.x + Math.cos(angle) * radius,
      origin.y + Math.sin(angle) * radius,
      z,
    );
  }
}
