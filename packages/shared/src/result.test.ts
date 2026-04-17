import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, map, mapErr, unwrap } from './result.js';

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it('err wraps an error', () => {
    const r = err('boom');
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toBe('boom');
  });

  it('map transforms ok value', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
  });

  it('map passes through err unchanged', () => {
    expect(map(err('x'), (n: number) => n * 3)).toEqual(err('x'));
  });

  it('mapErr transforms err', () => {
    expect(mapErr(err('x'), (s) => s.toUpperCase())).toEqual(err('X'));
  });

  it('unwrap returns ok value', () => {
    expect(unwrap(ok(7))).toBe(7);
  });

  it('unwrap throws on err', () => {
    expect(() => unwrap(err('boom'))).toThrow('boom');
  });
});
