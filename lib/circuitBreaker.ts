/**
 * VISOR Circuit Breaker
 * Prevents cascading failures when external APIs (Groq, NewsAPI, OpenWeather) are down.
 * States: CLOSED (normal) → OPEN (failing, reject fast) → HALF_OPEN (test recovery)
 */

import { createLogger } from './logger';

const logger = createLogger('CircuitBreaker');

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Name for logging */
  name: string;
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting recovery (OPEN → HALF_OPEN) */
  recoveryTimeMs: number;
  /** Timeout in ms for wrapped operations */
  timeoutMs: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  name: 'default',
  failureThreshold: 3,
  recoveryTimeMs: 30000,
  timeoutMs: 15000,
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private options: CircuitBreakerOptions;

  constructor(opts: Partial<CircuitBreakerOptions> & { name: string }) {
    this.options = { ...DEFAULT_OPTIONS, ...opts };
  }

  getState(): CircuitState {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.options.recoveryTimeMs) {
        this.state = CircuitState.HALF_OPEN;
        logger.info('state-transition', `${this.options.name}: OPEN → HALF_OPEN (attempting recovery)`);
      } else {
        logger.warn('circuit-open', `${this.options.name}: Circuit OPEN, rejecting request (recovery in ${Math.round((this.options.recoveryTimeMs - elapsed) / 1000)}s)`);
        if (fallback) return fallback();
        throw new Error(`Circuit breaker OPEN for ${this.options.name}`);
      }
    }

    try {
      // Apply timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${this.options.name} timed out after ${this.options.timeoutMs}ms`)), this.options.timeoutMs)
        ),
      ]);

      // Success — reset
      if (this.state === CircuitState.HALF_OPEN) {
        logger.info('state-transition', `${this.options.name}: HALF_OPEN → CLOSED (recovered)`);
      }
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      return result;

    } catch (error: any) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.options.failureThreshold) {
        this.state = CircuitState.OPEN;
        logger.error('state-transition', `${this.options.name}: → OPEN after ${this.failureCount} failures`, { error: error?.message });
      }

      logger.warn('execution-failed', `${this.options.name}: failure ${this.failureCount}/${this.options.failureThreshold}`, { error: error?.message });

      if (fallback) return fallback();
      throw error;
    }
  }

  /** Force reset the circuit breaker */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    logger.info('reset', `${this.options.name}: Circuit manually reset`);
  }
}

// Pre-configured circuit breakers for VISOR services
export const groqCircuit = new CircuitBreaker({
  name: 'Groq',
  failureThreshold: 3,
  recoveryTimeMs: 30000,
  timeoutMs: 15000,
});

export const newsCircuit = new CircuitBreaker({
  name: 'NewsAPI',
  failureThreshold: 2,
  recoveryTimeMs: 60000,
  timeoutMs: 8000,
});

export const weatherCircuit = new CircuitBreaker({
  name: 'OpenWeather',
  failureThreshold: 3,
  recoveryTimeMs: 30000,
  timeoutMs: 5000,
});
