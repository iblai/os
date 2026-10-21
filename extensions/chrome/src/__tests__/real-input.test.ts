import { beforeEach, describe, expect, it } from 'vitest';
import { attach, detach, onDetach, realInput } from '../real-input';
import { installChromeStub, type ChromeStub } from './chrome.stub';

let chromeStub: ChromeStub;

beforeEach(() => {
  chromeStub = installChromeStub();
});

const commands = () =>
  chromeStub.stub.debugger.sendCommand.mock.calls.map((call) => [
    call[1],
    call[2],
  ]);

describe('real input', () => {
  it('clicks with a move, a press and a release at the point', async () => {
    await realInput(7).click(60, 40);
    expect(chromeStub.stub.debugger.sendCommand.mock.calls[0][0]).toEqual({
      tabId: 7,
    });
    expect(commands()).toEqual([
      ['Input.dispatchMouseEvent', { type: 'mouseMoved', x: 60, y: 40 }],
      [
        'Input.dispatchMouseEvent',
        { type: 'mousePressed', x: 60, y: 40, button: 'left', clickCount: 1 },
      ],
      [
        'Input.dispatchMouseEvent',
        { type: 'mouseReleased', x: 60, y: 40, button: 'left', clickCount: 1 },
      ],
    ]);
  });

  it('types by inserting the text, and presses Enter as a key', async () => {
    const input = realInput(7);
    await input.insertText('jane');
    await input.pressEnter();
    const enter = {
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
      text: '\r',
    };
    expect(commands()).toEqual([
      ['Input.insertText', { text: 'jane' }],
      ['Input.dispatchKeyEvent', { type: 'keyDown', ...enter }],
      ['Input.dispatchKeyEvent', { type: 'keyUp', ...enter }],
    ]);
  });

  it('attaches with the protocol version, and detaching never throws', async () => {
    await attach(7);
    expect(chromeStub.stub.debugger.attach).toHaveBeenCalledWith(
      { tabId: 7 },
      '1.3',
    );
    chromeStub.stub.debugger.detach.mockRejectedValueOnce(
      new Error('Debugger is not attached to the tab'),
    );
    await expect(detach(7)).resolves.toBeUndefined();
  });

  it('reports a detach of its own tab only, until unsubscribed', () => {
    let fired = 0;
    const stop = onDetach(7, () => {
      fired += 1;
    });
    for (const listener of [...chromeStub.detached]) listener({ tabId: 9 });
    expect(fired).toBe(0);
    for (const listener of [...chromeStub.detached]) listener({ tabId: 7 });
    expect(fired).toBe(1);
    stop();
    expect(chromeStub.detached.size).toBe(0);
  });
});
