import { MeshPhysicalMaterial } from "three";

export class GlossyPipMaterial extends MeshPhysicalMaterial {
  public constructor(color: number) {
    super({
      color,
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      ior: 1.5,
      specularIntensity: 1,
      envMapIntensity: 1.1,
    });
  }
}
