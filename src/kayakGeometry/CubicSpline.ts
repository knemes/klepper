/**
 * Natural Cubic Spline 1D Interpolator.
 * Solves a tridiagonal matrix system to construct a C2-continuous set of cubic polynomials.
 */
export class CubicSpline1D {
  private x: number[];
  private y: number[];
  private a: number[] = [];
  private b: number[] = [];
  private c: number[] = [];
  private d: number[] = [];

  constructor(x: number[], y: number[]) {
    if (x.length !== y.length) {
      throw new Error("X and Y arrays must have the same length.");
    }
    if (x.length < 2) {
      throw new Error("Spline requires at least 2 knots.");
    }
    this.x = [...x];
    this.y = [...y];
    this.calcCoefficients();
  }

  private calcCoefficients() {
    const n = this.x.length;
    const h: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      h.push(this.x[i + 1] - this.x[i]);
    }

    const A: number[] = [];
    const B: number[] = [];
    const C: number[] = [];
    const D: number[] = [];

    // Natural boundary condition: second derivative is 0 at both ends
    A.push(0);
    B.push(1);
    C.push(0);
    D.push(0);

    for (let i = 1; i < n - 1; i++) {
      A.push(h[i - 1]);
      B.push(2.0 * (h[i - 1] + h[i]));
      C.push(h[i]);
      D.push(3.0 * ((this.y[i + 1] - this.y[i]) / h[i] - (this.y[i] - this.y[i - 1]) / h[i - 1]));
    }

    A.push(0);
    B.push(1);
    C.push(0);
    D.push(0);

    // Thomas algorithm solver for tridiagonal system
    const cPrime: number[] = new Array(n).fill(0);
    const dPrime: number[] = new Array(n).fill(0);
    cPrime[0] = C[0] / B[0];
    dPrime[0] = D[0] / B[0];

    for (let i = 1; i < n; i++) {
      const denom = B[i] - A[i] * cPrime[i - 1];
      cPrime[i] = C[i] / denom;
      dPrime[i] = (D[i] - A[i] * dPrime[i - 1]) / denom;
    }

    const cSolve: number[] = new Array(n).fill(0);
    cSolve[n - 1] = dPrime[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      cSolve[i] = dPrime[i] - cPrime[i] * cSolve[i + 1];
    }

    for (let i = 0; i < n - 1; i++) {
      this.a.push(this.y[i]);
      this.c.push(cSolve[i]);
      this.d.push((cSolve[i + 1] - cSolve[i]) / (3.0 * h[i]));
      this.b.push((this.y[i + 1] - this.y[i]) / h[i] - h[i] * (cSolve[i + 1] + 2.0 * cSolve[i]) / 3.0);
    }
  }

  public interpolate(val: number): number {
    const n = this.x.length;
    if (val <= this.x[0]) return this.y[0];
    if (val >= this.x[n - 1]) return this.y[n - 1];

    let low = 0;
    let high = n - 1;
    while (low < high - 1) {
      const mid = Math.floor((low + high) / 2);
      if (this.x[mid] <= val) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const idx = low;
    const dx = val - this.x[idx];
    return this.a[idx] + this.b[idx] * dx + this.c[idx] * dx * dx + this.d[idx] * dx * dx * dx;
  }
}
