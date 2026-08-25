
interface SectionPoint {
  y: number;
  z: number;
}

interface Section {
  x: number;
  points: SectionPoint[];
  gunwaleLeft: SectionPoint;
  gunwaleRight: SectionPoint;
  hullPoints: SectionPoint[];
  deckPoints: SectionPoint[];
  width: number;
}

export class SectionsImporter {
  public sections: Section[] = [];
  public L: number = 168.0;

  constructor(jsonData: any, L = 168.0) {
    this.L = L;
    if (jsonData && jsonData.sections) {
      // Map section X coordinates from JSON (reversing direction: X_builder = L - X_json)
      this.sections = jsonData.sections.map((s: any) => {
        const rawPoints: SectionPoint[] = s.points || [];
        const sorted = [...rawPoints].sort((a, b) => a.y - b.y);

        if (sorted.length === 0) {
          const defaultPt = { y: 0.0, z: 8.0 };
          return {
            x: this.L - s.x,
            points: [defaultPt],
            gunwaleLeft: defaultPt,
            gunwaleRight: defaultPt,
            hullPoints: [defaultPt],
            deckPoints: [defaultPt],
            width: 0.001
          };
        }

        const gunwaleLeft = sorted[0];
        const gunwaleRight = sorted[sorted.length - 1];
        const width = Math.max(0.001, Math.abs(gunwaleLeft.y), Math.abs(gunwaleRight.y));

        const getRefZ = (y: number) => {
          const span = gunwaleRight.y - gunwaleLeft.y || 1.0;
          const t = (y - gunwaleLeft.y) / span;
          return gunwaleLeft.z + (gunwaleRight.z - gunwaleLeft.z) * t;
        };

        const hullPoints: SectionPoint[] = [gunwaleLeft];
        const deckPoints: SectionPoint[] = [gunwaleLeft];

        for (let i = 1; i < sorted.length - 1; i++) {
          const pt = sorted[i];
          const refZ = getRefZ(pt.y);
          if (pt.z >= refZ) {
            deckPoints.push(pt);
          } else {
            hullPoints.push(pt);
          }
        }

        hullPoints.push(gunwaleRight);
        deckPoints.push(gunwaleRight);

        // Sort by Y ascending to guarantee monotonic traversal
        hullPoints.sort((a, b) => a.y - b.y);
        deckPoints.sort((a, b) => a.y - b.y);

        return {
          x: this.L - s.x,
          points: sorted,
          gunwaleLeft,
          gunwaleRight,
          hullPoints,
          deckPoints,
          width
        };
      });

      // Add a clean stern tip point at X = 0 if it is missing
      const hasSternTip = this.sections.some((s: any) => Math.abs(s.x) < 0.01);
      if (!hasSternTip) {
        const sternPt = { y: 0.0, z: 8.0 };
        this.sections.push({
          x: 0.0,
          points: [sternPt],
          gunwaleLeft: sternPt,
          gunwaleRight: sternPt,
          hullPoints: [sternPt],
          deckPoints: [sternPt],
          width: 0.001
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
    if (points.length === 0) return 8.0;
    if (points.length === 1) return points[0].z;

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
   */
  public getHullZ(x: number, y: number): number {
    const neighbors = this.getNeighboringSections(x);
    if (!neighbors) return 0.0;

    const { s0, s1, t } = neighbors;

    // Proportional Y interpolation based on local section beam boundaries
    const W_x = this.getGunwaleY(x);
    const pct = y / (W_x || 1.0);

    const y0 = pct * s0.width;
    const y1 = pct * s1.width;

    const z0 = this.interpolateZForY(s0.hullPoints, y0);
    const z1 = this.interpolateZForY(s1.hullPoints, y1);

    return z0 + (z1 - z0) * t;
  }

  /**
   * Evaluates the deck height at a given X and Y.
   */
  public getDeckZ(x: number, y: number): number {
    const neighbors = this.getNeighboringSections(x);
    if (!neighbors) return 8.0;

    const { s0, s1, t } = neighbors;

    // Proportional Y interpolation based on local section beam boundaries
    const W_x = this.getGunwaleY(x);
    const pct = y / (W_x || 1.0);

    const y0 = pct * s0.width;
    const y1 = pct * s1.width;

    const z0 = this.interpolateZForY(s0.deckPoints, y0);
    const z1 = this.interpolateZForY(s1.deckPoints, y1);

    return z0 + (z1 - z0) * t;
  }

  /**
   * Gets the maximum half-beam at a given X coordinate.
   */
  public getGunwaleY(x: number): number {
    const neighbors = this.getNeighboringSections(x);
    if (!neighbors) return 0.0;

    const { s0, s1, t } = neighbors;
    return s0.width + (s1.width - s0.width) * t;
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
