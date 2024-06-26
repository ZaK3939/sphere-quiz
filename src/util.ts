export enum Direction {
  Up = Phaser.UP,
  Down = Phaser.DOWN,
  Left = Phaser.LEFT,
  Right = Phaser.RIGHT,
}

export const DIRECTIONS = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];

export function oppositeDir(direction: Direction): Direction {
  switch (direction) {
    case Direction.Left:
      return Direction.Right;
    case Direction.Right:
      return Direction.Left;
    case Direction.Up:
      return Direction.Down;
    case Direction.Down:
      return Direction.Up;
  }
}

export function gridMove(x: number, y: number, direction: Direction) {
  switch (direction) {
    case Direction.Left:
      return [x - 1, y];
    case Direction.Right:
      return [x + 1, y];
    case Direction.Up:
      return [x, y - 1];
    case Direction.Down:
      return [x, y + 1];
  }
}

/**
 * Returns the number of pixels to move something at a rate of pixelsPerSecond
 * over a period of delta milliseconds.
 */
export function pixelDiff(pixelsPerSecond: number, deltaMs: number): number {
  return pixelsPerSecond * (deltaMs / 1000);
}

/** Choose a single value from the given list randomly and return it. */
export function randomChoice<T>(list: T[]): T {
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

export class StateMachine {
  initialState: string;
  possibleStates: { [key: string]: State };
  stateArgs: any[];
  state: string | null;

  constructor(initialState: string, possibleStates: { [key: string]: State }, stateArgs: any[] = []) {
    this.initialState = initialState;
    this.possibleStates = possibleStates;
    this.stateArgs = stateArgs;
    this.state = null;

    // State instances get access to the state machine via this.stateMachine.
    // This is annoyingly implicit, but the alternative is fucking up a bunch
    // of method signatures that won't otherwise use this.
    // Useful for triggering a transition outside of `execute`.
    for (const state of Object.values(this.possibleStates)) {
      state.stateMachine = this;
      state.init(...this.stateArgs);
    }
  }

  step(...stepArgs: any[]) {
    if (this.state === null) {
      this.state = this.initialState;
      this.possibleStates[this.state].handleEntered(...this.stateArgs);
    }

    // State function returns the state to transition to.
    // Transitions happen instantly rather than next-frame, so we need
    // to loop through until we don't transition.
    while (true) {
      // eslint-disable-line no-constant-condition
      const newState = this.possibleStates[this.state].execute(...this.stateArgs, ...stepArgs);
      if (newState) {
        this.transition(newState);
      } else {
        break;
      }
    }
  }

  async transition(newState: string, ...enterArgs: any[]) {
    if (!(newState in this.possibleStates)) {
      throw Error(`Invalid state ${newState}`);
    }

    if (this.state) {
      await this.possibleStates[this.state].handleExited(...this.stateArgs);
    }
    this.state = newState;
    await this.possibleStates[this.state].handleEntered(...this.stateArgs, ...enterArgs);
  }
}

export class State {
  stateMachine!: StateMachine;

  init(..._args: any[]) {}

  handleEntered(..._args: any[]): void | Promise<any> {}

  handleExited(..._args: any[]): void | Promise<any> {}

  execute(..._args: any[]): string | null | undefined | void {
    return null;
  }

  transition(newState: string, ...args: any[]) {
    this.stateMachine.transition(newState, ...args);
  }
}

interface JustDownKey {
  _repeatCounter?: number;
}

export function justDown(key: Phaser.Input.Keyboard.Key & JustDownKey, repeatDelay?: number, repeatRate: number = 100) {
  const justDown = Phaser.Input.Keyboard.JustDown(key);
  if (repeatDelay === undefined) {
    return justDown;
  }

  if (key._repeatCounter === undefined) {
    key._repeatCounter = 0;
  }

  if (!key.isDown) {
    return false;
  }

  const duration = key.getDuration();
  if (justDown || duration < repeatDelay) {
    key._repeatCounter = 0;
    return justDown;
  }

  if (duration > repeatDelay + repeatRate * key._repeatCounter) {
    key._repeatCounter++;
    return true;
  }

  return false;
}

/** Wait for duration milliseconds and resolve the returned Promise. */
export function wait(scene: Phaser.Scene, duration: number) {
  return new Promise((resolve) => {
    scene.time.delayedCall(duration, resolve);
  });
}

/** Play an animation and resolve the returned promise once it completes. */
export function asyncAnimation(
  sprite: Phaser.GameObjects.Sprite,
  keyOrConfig: string | Phaser.Types.Animations.PlayAnimationConfig
): Promise<void> {
  return new Promise((resolve) => {
    sprite.once('animationcomplete', resolve);
    sprite.play(keyOrConfig);
  });
}

interface TweenPromise extends Promise<void> {
  tween: Phaser.Tweens.Tween;
}

/** Execute a tween and resolve the returned promise once it completes */
export function asyncTween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  let tween: Phaser.Tweens.Tween | null = null;
  const promise: TweenPromise = new Promise<void>((resolve) => {
    tween = scene.add.tween({
      ...config,
      onComplete(...args) {
        if (config.onComplete) {
          config.onComplete(...args);
        }
        resolve();
      },
    });
  }) as TweenPromise;
  promise.tween = tween!;
  return promise;
}

/** Execute a counter tween and resolve the returned promise once it completes */
export function asyncCounter(scene: Phaser.Scene, config: Phaser.Types.Tweens.NumberTweenBuilderConfig) {
  let tween: Phaser.Tweens.Tween | null = null;
  const promise: TweenPromise = new Promise<void>((resolve) => {
    tween = scene.tweens.addCounter({
      ...config,
      onComplete(...args) {
        if (config.onComplete) {
          config.onComplete(...args);
        }
        resolve();
      },
    });
  }) as TweenPromise;
  promise.tween = tween!;
  return promise;
}

export function setFaded(gameObject: Phaser.GameObjects.Components.Tint, faded: boolean) {
  gameObject.setTint(faded ? 0x666666 : 0xffffff);
}

export async function animateFaded(
  scene: Phaser.Scene,
  gameObject: Phaser.GameObjects.Components.Tint,
  faded: boolean,
  duration: number = 400
) {
  const tint = faded ? 0x66 : 0xff;
  return asyncCounter(scene, {
    from: gameObject.tintTopLeft & 0xff,
    to: tint,
    duration,
    onUpdate: (tween) => {
      const value = Math.floor(tween.getValue());
      const color = Phaser.Display.Color.GetColor(value, value, value);
      gameObject.setTint(color);
    },
  });
}

export async function forEachTween<T>(
  scene: Phaser.Scene,
  values: T[],
  frameDuration: number,
  callback: (value: T) => void
) {
  return asyncCounter(scene, {
    from: 0,
    to: values.length - 1,
    duration: frameDuration * values.length,
    ease(v: number) {
      return Phaser.Math.Easing.Stepped(v, values.length - 1);
    },
    onUpdate(tween) {
      callback(values[Math.floor(tween.getValue())]);
    },
  });
}

export async function relativePositionTween(
  scene: Phaser.Scene,
  targets: Phaser.GameObjects.Components.Transform[],
  positions: Phaser.Types.Math.Vector2Like[],
  frameDuration: number
) {
  const originalPositions = targets.map((target) => ({ x: target.x, y: target.y }));
  await forEachTween(scene, positions, frameDuration, (position) => {
    for (let k = 0; k < targets.length; k++) {
      const target = targets[k];
      target.x = originalPositions[k].x + (position.x ?? 0);
      target.y = originalPositions[k].y + (position.y ?? 0);
    }
  });
}

export enum ShakeAxis {
  X = 'x',
  Y = 'y',
}

export async function shake(
  scene: Phaser.Scene,
  targets: Phaser.GameObjects.Components.Transform[],
  axis: ShakeAxis,
  amounts: number[],
  frameDuration: number
) {
  return relativePositionTween(
    scene,
    targets,
    amounts.map((amount) => {
      const vec: Phaser.Types.Math.Vector2Like = { x: 0, y: 0 };
      vec[axis] = amount;
      return vec;
    }),
    frameDuration
  );
}

export function asyncLoad(scene: Phaser.Scene, loadFunc: (scene: Phaser.Scene) => unknown) {
  return new Promise((resolve) => {
    loadFunc(scene);
    scene.load.once('complete', resolve);
    scene.load.start();
  });
}

export function steppedCubicEase(duration: number, frameRate = 10) {
  const frameDuration = 1000 / frameRate;
  const steps = duration / frameDuration;
  return (v: number) => {
    return Phaser.Math.Easing.Cubic.Out(Phaser.Math.Easing.Stepped(v, steps));
  };
}

interface PointerEventHandlers {
  hover?: () => unknown;
  activate?: () => unknown;
  deactivate?: () => unknown;
  click?: () => unknown;
}

export function onPointer(gameObject: Phaser.GameObjects.GameObject, handlers: PointerEventHandlers) {
  let clicking = false;
  gameObject.on('pointerdown', () => {
    handlers.activate?.();
    clicking = true;
  });
  gameObject.on('pointerout', () => {
    if (clicking) {
      handlers.deactivate?.();
    }
    clicking = false;
  });
  gameObject.on('pointerup', () => {
    if (clicking) {
      clicking = false;
      handlers.deactivate?.();
      handlers.click?.();
    }
  });
  gameObject.on('pointerover', () => {
    handlers.hover?.();
  });
}

export function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
