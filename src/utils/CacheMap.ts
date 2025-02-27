type CacheMapOptions = {
  expirationInMs?: number;
};

export class CacheMap<K, T> extends Map {
  constructor({ expirationInMs }: CacheMapOptions) {
    super();
    this.expirationInMs = expirationInMs;
  }

  private expirationInMs: number | undefined;

  private timeouts = new Map<K, number>();

  private clearTimeout(key: K) {
    if (this.timeouts.has(key)) {
      window.clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
    }
  }

  private setTimeout(key: K) {
    if (this.expirationInMs !== undefined) {
      this.timeouts.set(
        key,
        window.setTimeout(() => {
          this.delete(key);
          this.timeouts.delete(key);
        }, this.expirationInMs),
      );
    }
  }

  get(key: K): T | undefined {
    return super.get(key);
  }

  set(key: K, value: T) {
    if (this.timeouts.has(key)) {
      this.clearTimeout(key);
    }
    super.set(key, value);
    this.setTimeout(key);
    return this;
  }

  delete(key: K): boolean {
    this.clearTimeout(key);
    return super.delete(key);
  }
}
