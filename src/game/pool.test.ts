import { describe, expect, it } from 'vitest';
import { Pool } from './pool';

describe('Pool', () => {
  it('reuses released items instead of growing', () => {
    const pool = new Pool(() => ({ active: false, n: 0 }), 2);
    const a = pool.acquire();
    const b = pool.acquire();
    expect(pool.activeCount).toBe(2);
    pool.release(a);
    const c = pool.acquire();
    expect(c).toBe(a);
    expect(pool.items.length).toBe(2);
    expect(b.active).toBe(true);
  });

  it('grows when empty and ignores double release', () => {
    const pool = new Pool(() => ({ active: false }), 1);
    const a = pool.acquire();
    pool.acquire();
    expect(pool.items.length).toBe(2);
    pool.release(a);
    pool.release(a);
    expect(pool.activeCount).toBe(1);
    pool.releaseAll();
    expect(pool.activeCount).toBe(0);
  });
});
