import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// The tab-wide Kokoro session: one worker, one audio graph, one cache entry.
//
// Everything it owns is module-scoped, so each test loads the module fresh
// rather than sharing a session with the test before it. The worker and the
// player are faked because neither exists in jsdom and neither is what is under
// test here — the lifecycle around them is.
// ---------------------------------------------------------------------------

class FakeStreamPlayer {
  onDrained: (() => void) | null = null;
  stop = vi.fn();

  constructor() {
    players.push(this);
  }
}

vi.mock('../stream-player', () => ({
  StreamPlayer: FakeStreamPlayer,
}));

class FakeWorker {
  onmessage: unknown = null;
  onerror: unknown = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor(
    readonly url: unknown,
    readonly options: unknown,
  ) {
    workers.push(this);
  }
}

let players: FakeStreamPlayer[] = [];
let workers: FakeWorker[] = [];
let blobUrls = 0;

async function loadSession() {
  vi.resetModules();
  players = [];
  workers = [];
  blobUrls = 0;
  return import('../kokoro-session');
}

function wav(byte = 1) {
  return new Blob([new Uint8Array([byte])], { type: 'audio/wav' });
}

beforeEach(() => {
  vi.stubGlobal('Worker', FakeWorker);
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    blobUrls += 1;
    return `blob:kokoro-${blobUrls}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getKokoroWorker', () => {
  it('constructs the worker from the compiled worker entry point', async () => {
    const { getKokoroWorker } = await loadSession();

    getKokoroWorker();

    expect(workers).toHaveLength(1);
    expect(String(workers[0].url)).toContain('kokoro.worker');
    expect(workers[0].options).toEqual({ type: 'module' });
  });

  // ~88 MB of weights live in there; a second worker would download them again.
  it('reuses the same worker across calls', async () => {
    const { getKokoroWorker } = await loadSession();

    expect(getKokoroWorker()).toBe(getKokoroWorker());
    expect(workers).toHaveLength(1);
  });
});

describe('getKokoroPlayer', () => {
  it('constructs the player lazily and reuses it', async () => {
    const { getKokoroPlayer } = await loadSession();
    expect(players).toHaveLength(0);

    const player = getKokoroPlayer();

    expect(player).toBe(getKokoroPlayer());
    expect(players).toHaveLength(1);
  });
});

describe('nextKokoroRequestId', () => {
  it('hands out a fresh id per utterance', async () => {
    const { nextKokoroRequestId } = await loadSession();

    expect([
      nextKokoroRequestId(),
      nextKokoroRequestId(),
      nextKokoroRequestId(),
    ]).toEqual([1, 2, 3]);
  });
});

describe('the audio cache', () => {
  it('misses while nothing has been cached', async () => {
    const { getCachedKokoroAudio } = await loadSession();

    expect(getCachedKokoroAudio('m1', 'af_heart')).toBeNull();
  });

  it('replays the same message in the same voice', async () => {
    const { cacheKokoroAudio, getCachedKokoroAudio } = await loadSession();

    cacheKokoroAudio('m1', 'af_heart', wav());

    expect(getCachedKokoroAudio('m1', 'af_heart')).toBe('blob:kokoro-1');
  });

  // Keying on the message id alone would replay the old voice after a change.
  it('misses when the same message is asked for in another voice', async () => {
    const { cacheKokoroAudio, getCachedKokoroAudio } = await loadSession();

    cacheKokoroAudio('m1', 'af_heart', wav());

    expect(getCachedKokoroAudio('m1', 'am_michael')).toBeNull();
  });

  it('misses for a different message in the cached voice', async () => {
    const { cacheKokoroAudio, getCachedKokoroAudio } = await loadSession();

    cacheKokoroAudio('m1', 'af_heart', wav());

    expect(getCachedKokoroAudio('m2', 'af_heart')).toBeNull();
  });

  it('holds one entry, revoking the URL it evicts', async () => {
    const { cacheKokoroAudio, getCachedKokoroAudio } = await loadSession();

    cacheKokoroAudio('m1', 'af_heart', wav(1));
    cacheKokoroAudio('m2', 'af_heart', wav(2));

    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      'blob:kokoro-1',
    );
    expect(getCachedKokoroAudio('m1', 'af_heart')).toBeNull();
    expect(getCachedKokoroAudio('m2', 'af_heart')).toBe('blob:kokoro-2');
  });

  it('revokes nothing on the first entry', async () => {
    const { cacheKokoroAudio } = await loadSession();

    cacheKokoroAudio('m1', 'af_heart', wav());

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe('teardownKokoro', () => {
  it('does nothing before a session exists', async () => {
    const { teardownKokoro } = await loadSession();

    expect(() => teardownKokoro()).not.toThrow();
    expect(workers).toHaveLength(0);
    expect(players).toHaveLength(0);
  });

  it('cancels the in-flight request and detaches its handlers', async () => {
    const { getKokoroWorker, nextKokoroRequestId, teardownKokoro } =
      await loadSession();
    const worker = getKokoroWorker();
    worker.onmessage = () => {};
    worker.onerror = () => {};
    nextKokoroRequestId();

    teardownKokoro();

    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'cancel' });
  });

  // Terminating would throw away the loaded model and re-download it.
  it('keeps the worker alive for the next utterance', async () => {
    const { getKokoroWorker, teardownKokoro } = await loadSession();
    const worker = getKokoroWorker();

    teardownKokoro();

    expect(workers[0].terminate).not.toHaveBeenCalled();
    expect(getKokoroWorker()).toBe(worker);
    expect(workers).toHaveLength(1);
  });

  it('silences the graph and drops the drained callback', async () => {
    const { getKokoroPlayer, teardownKokoro } = await loadSession();
    const player = getKokoroPlayer();
    player.onDrained = () => {};

    teardownKokoro();

    expect(player.onDrained).toBeNull();
    expect(player.stop).toHaveBeenCalledOnce();
    expect(workers).toHaveLength(0);
  });

  it('leaves the cached utterance intact', async () => {
    const { cacheKokoroAudio, getCachedKokoroAudio, teardownKokoro } =
      await loadSession();
    cacheKokoroAudio('m1', 'af_heart', wav());

    teardownKokoro();

    expect(getCachedKokoroAudio('m1', 'af_heart')).toBe('blob:kokoro-1');
  });
});
