export abstract class KayakGeometry {
  public abstract componentType: string;
  protected rhino: any;

  constructor(rhino: any) {
    if (!rhino) {
      throw new Error("rhino3dm instance is required to initialize KayakGeometry.");
    }
    this.rhino = rhino;
  }
}
