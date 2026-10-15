// Lossless implementation of Lorenz Chaos + Non-Homogeneous Poisson Sniffing Scheduler
export interface LorenzState {
  x: number;
  y: number;
  z: number;
}

export class StochasticOlfactoryScheduler {
  private state: LorenzState = { x: 1.1, y: 2.05, z: 24.8 };
  private readonly sigma = 10.0;
  private readonly rho = 28.0;
  private readonly beta = 8.0 / 3.0;
  private readonly dt = 0.01;

  /**
   * Advances the Lorenz attractor by one Runge-Kutta / Euler step
   * and computes the next unpredictable sniffing interval in milliseconds.
   */
  public nextChaosPulse(
    globalThreatEntropy: number = 0.35, // H_threat in [0, 1]
    baseRatePerSec: number = 0.25,      // lambda_base
    entropyGainKappa: number = 2.5
  ): {
    nextIntervalMs: number;
    instantaneousRateLambda: number;
    lorenzState: LorenzState;
  } {
    const { x, y, z } = this.state;

    // dx/dt = sigma * (y - x)
    const dx = this.sigma * (y - x) * this.dt;
    // dy/dt = x * (rho - z) - y
    const dy = (x * (this.rho - z) - y) * this.dt;
    // dz/dt = x * y - beta * z
    const dz = (x * y - this.beta * z) * this.dt;

    this.state = {
      x: x + dx,
      y: y + dy,
      z: z + dz,
    };

    // Instantaneous Poisson rate: Lambda(t) = lambda_base * (1 + kappa * H_threat + |x(t)| / 30)
    const clampedEntropy = Math.max(0, Math.min(1, globalThreatEntropy));
    const chaosModulator = Math.abs(this.state.x) / 30.0;
    const instantaneousRateLambda =
      baseRatePerSec * (1.0 + entropyGainKappa * clampedEntropy + chaosModulator);

    // Inverse transform sampling for exponential waiting time: Delta_t = -ln(U) / Lambda(t)
    const u = Math.max(0.0001, Math.random());
    const deltaSeconds = -Math.log(u) / instantaneousRateLambda;

    // Clamp between 450ms (rapid burst) and 15000ms (deep silence)
    const nextIntervalMs = Math.round(Math.max(450, Math.min(15000, deltaSeconds * 1000)));

    return {
      nextIntervalMs,
      instantaneousRateLambda: Number(instantaneousRateLambda.toFixed(4)),
      lorenzState: { ...this.state },
    };
  }
}
