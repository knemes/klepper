
interface SectionPoint {
  y: number;
  z: number;
}

interface Section {
  x: number;
  points: SectionPoint[];
}

export class SectionsImporter {
  public sections: Section[] = [];
  public L: number = 168.0;

  constructor(jsonData: any, L = 168.0) {
    this.L = L;
    if (jsonData && jsonData.sections) {
      // Map section X coordinates from JSON (reversing direction: X_builder = L - X_json)
      this.sections = jsonData.sections.map((s: any) => {
        return {
          x: this.L - s.x,
          points: s.points || []
        };
      });

      // Add a clean stern tip point at X = 0 if it is missing
      const hasSternTip = this.sections.some((s: any) => Math.abs(s.x) < 0.01);
      if (!hasSternTip) {
        this.sections.push({
          x: 0.0,
          points: [
            { y: 0.0, z: 8.0 } // Stern tip point at planar gunwale height
          ]
        });
      }

      // Sort sections by X (stern to bow)
      this.sections.sort((a, b) => a.x - b.x);
    }
  }

  public hasData(): boolean {
    return this.sections.length > 0;
  }

  /**
   * Find the neighboring sections for a given X coordinate.
   */
  private getNeighboringSections(targetX: number): { s0: Section; s1: Section; t: number } | null {
    if (this.sections.length === 0) return null;

    // Clamp targetX to boat length boundaries
    const x = Math.max(0, Math.min(this.L, targetX));

    if (x <= this.sections[0].x) {
      return { s0: this.sections[0], s1: this.sections[0], t: 0 };
    }
    const lastIdx = this.sections.length - 1;
    if (x >= this.sections[lastIdx].x) {
      return { s0: this.sections[lastIdx], s1: this.sections[lastIdx], t: 0 };
    }

    for (let i = 0; i < lastIdx; i++) {
      const s0 = this.sections[i];
      const s1 = this.sections[i + 1];
      if (x >= s0.x && x <= s1.x) {
        const t = (x - s0.x) / (s1.x - s0.x || 1.0);
        return { s0, s1, t };
      }
    }
    return null;
  }

  /**
   * Interpolate Z coordinate at a given Y coordinate for a specific section.
   */
  private interpolateZForY(points: SectionPoint[], targetY: number): number {
    if (points.length === 0) return 8.0; // default to planar gunwale height
    if (points.length === 1) return points[0].z;

    // points are already sorted by Y coordinate from negative to positive
    const y = targetY;
    if (y <= points[0].y) return points[0].z;
    if (y >= points[points.length - 1].y) return points[points.length - 1].z;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      if (y >= p0.y && y <= p1.y) {
        const t = (y - p0.y) / (p1.y - p0.y || 1.0);
        return p0.z + (p1.z - p0.z) * t;
      }
    }
    return points[0].z;
  }

  /**
   * Evaluates the hull height at a given X and Y.
   * Hull has Z <= 8.0.
   */
  public getHullZ(x: number, y: number): number {
    const neighbors = this.getNeighboringSections(x);
    if (!neighbors) return 0.0;

    const { s0, s1, t } = neighbors;

    // Proportional Y interpolation based on local section beam boundaries
    const W_x = this.getGunwaleY(x);
    const pct = y / (W_x || 1.0);

    const W_0 = Math.max(0.001, ...s0.points.map(p => Math.abs(p.y)));
    const W_1 = Math.max(0.001, ...s1.points.map(p => Math.abs(p.y)));

    const y0 = pct * W_0;
    const y1 = pct * W_1;

    // Filter hull points (Z <= 8.0)
    const hull0 = s0.points.filter(p => p.z <= 8.001);
    const hull1 = s1.points.filter(p => p.z <= 8.001);

    const z0 = this.interpolateZForY(hull0, y0);
    const z1 = this.interpolateZForY(hull1, y1);

    return z0 + (z1 - z0) * t;
  }

  /**
   * Evaluates the deck height at a given X and Y.
   * Deck has Z >= 8.0.
   */
  public getDeckZ(x: number, y: number): number {
    const neighbors = this.getNeighboringSections(x);
    if (!neighbors) return 8.0;

    const { s0, s1, t } = neighbors;

    // Proportional Y interpolation based on local section beam boundaries
    const W_x = this.getGunwaleY(x);
    const pct = y / (W_x || 1.0);

    const W_0 = Math.max(0.001, ...s0.points.map(p => Math.abs(p.y)));
    const W_1 = Math.max(0.001, ...s1.points.map(p => Math.abs(p.y)));

    const y0 = pct * W_0;
    const y1 = pct * W_1;

    // Filter deck points (Z >= 8.0)
    const deck0 = s0.points.filter(p => p.z >= 7.999);
    const deck1 = s1.points.filter(p => p.z >= 7.999);

    const z0 = this.interpolateZForY(deck0, y0);
    const z1 = this.interpolateZForY(deck1, y1);

    return z0 + (z1 - z0) * t;
  }

  /**
   * Gets the maximum half-beam at a given X coordinate.
   * This is the maximum Y coordinate in the section.
   */
  public getGunwaleY(x: number): number {
    const neighbors = this.getNeighboringSections(x);
    if (!neighbors) return 0.0;

    const { s0, s1, t } = neighbors;

    const maxY0 = Math.max(...s0.points.map(p => Math.abs(p.y)));
    const maxY1 = Math.max(...s1.points.map(p => Math.abs(p.y)));

    return maxY0 + (maxY1 - maxY0) * t;
  }

  /**
   * Gets the keel Z height at a given X coordinate.
   */
  public getKeelZ(x: number): number {
    return this.getHullZ(x, 0.0);
  }

  /**
   * Gets the deck centerline peak height at a given X coordinate.
   */
  public getDeckCenterlineZ(x: number): number {
    return this.getDeckZ(x, 0.0);
  }
}
