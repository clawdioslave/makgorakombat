import { cpuInputs } from './cpu';
import { type Inputs, type Match, noInputs } from './engine';

export type InputAction = keyof Inputs;
export type InputSource = 'keyboard' | 'gamepad' | 'cpu';

/** KeyboardEvent.code values per player and action. Exported so the UI can show the controls. */
export const KEYS: readonly [Record<InputAction, readonly string[]>, Record<InputAction, readonly string[]>] = [
  {
    left: ['KeyA'],
    right: ['KeyD'],
    jump: ['KeyW'],
    block: ['KeyU'],
    light: ['KeyJ'],
    heavy: ['KeyK'],
    special: ['KeyL'],
  },
  {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    jump: ['ArrowUp'],
    block: ['ShiftRight', 'Numpad0'],
    light: ['Comma', 'Numpad1'],
    heavy: ['Period', 'Numpad2'],
    special: ['Slash', 'Numpad3'],
  },
];

/** Keys the screens handle themselves. */
export const MENU_KEYS = { rematch: 'Enter', back: 'Escape', debug: 'F3' } as const;

/** Short labels for the HUD's controls hint. */
export const KEY_LABELS: Readonly<Record<string, string>> = {
  KeyA: 'A', KeyD: 'D', KeyW: 'W', KeyU: 'U', KeyJ: 'J', KeyK: 'K', KeyL: 'L',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  ShiftRight: 'R SHIFT', Numpad0: 'NUM 0', Numpad1: 'NUM 1', Numpad2: 'NUM 2', Numpad3: 'NUM 3',
  Comma: ',', Period: '.', Slash: '/',
};

/** Standard-mapping gamepad buttons per action (plus the left stick / d-pad for left and right). */
export const GAMEPAD_BUTTONS: Record<InputAction, readonly number[]> = {
  left: [14],
  right: [15],
  jump: [3, 12],
  block: [4, 5, 6, 7],
  light: [0],
  heavy: [1],
  special: [2],
};

const ACTIONS: readonly InputAction[] = ['left', 'right', 'jump', 'block', 'light', 'heavy', 'special'];
const EDGE: readonly InputAction[] = ['jump', 'light', 'heavy', 'special'];
const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab']);

type Listener = (event: KeyboardEvent) => void;

interface Target {
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
}

/** The raw button state of one player, before edge detection. */
type Held = Record<InputAction, boolean>;

function heldNone(): Held {
  return { left: false, right: false, jump: false, block: false, light: false, heavy: false, special: false };
}

/**
 * Turns the keyboard and gamepads into per-tick inputs for two players. Attach it to the stage
 * element (give it `tabIndex=0` and focus it) and call `read()` once per engine tick: jump, light,
 * heavy and special are true only on the tick after the button went down. A player whose source
 * is 'cpu' gets `cpuInputs` when `read` is given the match. Safe to import where there is no window.
 */
export class InputReader {
  private readonly down = new Set<string>();
  private readonly previous: [Held, Held] = [heldNone(), heldNone()];
  private readonly sources: [InputSource, InputSource] = ['keyboard', 'keyboard'];
  private readonly gamepadIndex: [number | undefined, number | undefined] = [undefined, undefined];
  private target: Target | undefined;
  /** Keys that went down since the last read, so a tap shorter than a tick still counts. */
  private readonly tapped = new Set<string>();
  private readonly onKeyDown: Listener = (event) => {
    if (PREVENT.has(event.code)) event.preventDefault();
    if (this.mapped(event.code)) event.preventDefault();
    if (!event.repeat && !this.down.has(event.code)) this.tapped.add(event.code);
    this.down.add(event.code);
  };
  private readonly onKeyUp: Listener = (event) => {
    this.down.delete(event.code);
  };
  private readonly onBlur = (): void => {
    this.down.clear();
  };

  attach(element: Target): void {
    this.detach();
    this.target = element;
    element.addEventListener('keydown', this.onKeyDown);
    element.addEventListener('keyup', this.onKeyUp);
    element.addEventListener('blur', this.onBlur as unknown as Listener);
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur as unknown as Listener);
    this.target = undefined;
    this.down.clear();
  }

  setSource(player: 0 | 1, source: InputSource, gamepadIndex?: number): void {
    this.sources[player] = source;
    this.gamepadIndex[player] = gamepadIndex;
    this.previous[player] = heldNone();
  }

  source(player: 0 | 1): InputSource {
    return this.sources[player];
  }

  /** Is this key down right now? For the screens' own keys. */
  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** Feed a key by hand, for tests or on-screen buttons. */
  press(code: string): void {
    if (!this.down.has(code)) this.tapped.add(code);
    this.down.add(code);
  }

  release(code: string): void {
    this.down.delete(code);
  }

  read(match?: Match): [Inputs, Inputs] {
    const out: [Inputs, Inputs] = [this.readPlayer(0, match), this.readPlayer(1, match)];
    this.tapped.clear();
    return out;
  }

  private mapped(code: string): boolean {
    for (const map of KEYS) for (const action of ACTIONS) if (map[action].includes(code)) return true;
    return false;
  }

  private readPlayer(player: 0 | 1, match: Match | undefined): Inputs {
    const source = this.sources[player];
    if (source === 'cpu') {
      return match ? cpuInputs(match, player) : noInputs();
    }
    const held = source === 'gamepad' ? this.gamepadHeld(player) : this.keyboardHeld(player);
    const previous = this.previous[player];
    const out = noInputs();
    for (const action of ACTIONS) {
      out[action] = EDGE.includes(action) ? held[action] && !previous[action] : held[action];
    }
    // A key pressed and released between two reads is an edge too: it was never seen held.
    if (source !== 'gamepad') {
      const map = KEYS[player];
      for (const action of EDGE) if (!out[action] && map[action].some((code) => this.tapped.has(code))) out[action] = true;
    }
    this.previous[player] = held;
    return out;
  }

  private keyboardHeld(player: 0 | 1): Held {
    const map = KEYS[player];
    const held = heldNone();
    for (const action of ACTIONS) held[action] = map[action].some((code) => this.down.has(code));
    return held;
  }

  private gamepadHeld(player: 0 | 1): Held {
    const held = heldNone();
    const pad = this.gamepad(player);
    if (!pad) return held;
    for (const action of ACTIONS) {
      held[action] = GAMEPAD_BUTTONS[action].some((b) => pad.buttons[b]?.pressed === true);
    }
    const stick = pad.axes[0] ?? 0;
    if (stick < -0.5) held.left = true;
    if (stick > 0.5) held.right = true;
    return held;
  }

  private gamepad(player: 0 | 1): Gamepad | undefined {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return undefined;
    const pads = navigator.getGamepads();
    const wanted = this.gamepadIndex[player];
    if (wanted !== undefined) return pads[wanted] ?? undefined;
    // No index given: the first pad goes to the first player using one, the second to the other.
    const connected = Array.from(pads).filter((p): p is Gamepad => p !== null && p !== undefined);
    const nth = this.sources[0] === 'gamepad' && this.sources[1] === 'gamepad' ? player : 0;
    return connected[nth];
  }
}

/** Is there a window to read keys from? False in node tests. */
export const HAS_WINDOW = typeof window !== 'undefined';
