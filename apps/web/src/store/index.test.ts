import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './index.js';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      mode: 'demo',
      apiKey: '',
      activeLookup: null,
    });
  });

  it('switches mode to byo-key', () => {
    useAppStore.getState().setMode('byo-key');
    expect(useAppStore.getState().mode).toBe('byo-key');
  });

  it('sets api key', () => {
    useAppStore.getState().setApiKey('sk-ant-xxx');
    expect(useAppStore.getState().apiKey).toBe('sk-ant-xxx');
  });
});
