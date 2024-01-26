import {
  DIRECTIONS,
  Direction,
  State,
  StateMachine,
  asyncAnimation,
  asyncTween,
  gridMove,
  justDown,
  oppositeDir,
  pixelDiff,
  randomChoice,
  wait,
  setFaded,
  animateFaded,
} from 'gate/util';
import Text from 'gate/text';
import Phaser from 'phaser';
import BaseScene from 'gate/scenes/base';
import Menu, { horizontalMenuItems } from 'gate/menu';
import Dialog from 'gate/dialog';
import { Entries } from 'type-fest';

const GRID_WIDTH = 8;
const GRID_HEIGHT = 9;

const SPHERE_WINDOW_LEFT = 48;
const SPHERE_WINDOW_TOP = 40;
const SPHERE_STOCK_LEFT = 54;
const SPHERE_STOCK_TOP = 172;
const HEALTH_LEFT = 186;
const HEALTH_TOP = 37;

const PARTY_LEFT = 184;
const PARTY_TOP = 62;
const ENEMY_LEFT = 275;
const ENEMY_TOP = 85;

const DIALOG_LEFT = 178;
const DIALOG_TOP = 172;

const ALPHA_FADED = 0.6;
const ALPHA_UNFADED = 0;

const DEPTH_BACKGROUND = -10;
const DEPTH_ENTITIES = 0;
const DEPTH_UI = 10;

const TINT_YELLOW = 0xfffa9b;

enum Characters {
  Rojo = 'rojo',
  Blue = 'blue',
  Midori = 'midori',
}

const CHARACTER_COLORS = {
  [Characters.Rojo]: 0xac311e,
  [Characters.Blue]: 0x63a09b,
  [Characters.Midori]: 0x5ad932,
};

enum SphereType {
  Red = 0,
  Cyan,
  Green,
  Yellow,
  Key,
}

const CHARACTER_SPHERE_TYPES = {
  [Characters.Rojo]: SphereType.Red,
  [Characters.Blue]: SphereType.Cyan,
  [Characters.Midori]: SphereType.Green,
};

export default class BattleScene extends BaseScene {
  stateMachine!: StateMachine;

  // UI
  battleBorder!: Phaser.GameObjects.Image;
  battleGrid!: Phaser.GameObjects.TileSprite;
  battleSphereWindow!: Phaser.GameObjects.Image;
  battleSphereStock!: Phaser.GameObjects.Image;
  battleSphereWindowOverlay!: Phaser.GameObjects.Rectangle;
  actionSprites!: { [character in Characters]: { [action in BattleActions]: Phaser.GameObjects.Sprite } };
  allActionSprites!: Phaser.GameObjects.Sprite;
  dialog!: Dialog;

  // Enemies
  enemySkelly!: Skelly;

  // Party
  party!: { [key in Characters]: PartyMember };

  // Health bars
  healthRojo!: HealthBar;
  healthBlue!: HealthBar;
  healthMidori!: HealthBar;
  healthEnemy!: HealthBar;

  // Spheres
  stockCounts!: StockCount[];
  spheres!: Sphere[];

  // Sound
  soundSwap!: Phaser.Sound.BaseSound;
  soundClear!: Phaser.Sound.BaseSound;
  soundActionAppear!: Phaser.Sound.BaseSound;
  soundSelect!: Phaser.Sound.BaseSound;
  soundMoveCursor!: Phaser.Sound.BaseSound;
  soundText!: Phaser.Sound.BaseSound;

  // Battle logic
  battleState!: BattleState;
  currentTurnInputs!: TurnInputs;
  currentTurnResult!: TurnResult;

  /** Order in which character stuff generally happens */
  characterOrder = [Characters.Rojo, Characters.Blue, Characters.Midori];

  constructor() {
    super({
      key: 'board',
    });
  }

  preload() {
    Sphere.preload(this);
    Text.preload(this);
    StockCount.preload(this);
    Skelly.preload(this);
    PartyMember.preload(this);
    HealthBar.preload(this);
    ActionChoiceState.preload(this);
    Dialog.preload(this);

    this.load.image('battleBorder', 'ui/battle_border.png');
    this.load.image('battleGrid', 'ui/battle_grid.png');
    this.load.image('battleSphereWindow', 'ui/battle_sphere_window.png');
    this.load.image('battleSphereStock', 'ui/color_stock.png');

    this.load.audio('swap', 'audio/swap.mp3');
    this.load.audio('clear', 'audio/clear.mp3');
    this.load.audio('actionAppear', 'audio/action_appear.mp3');
    this.load.audio('select', 'audio/select.mp3');
    this.load.audio('moveCursor', 'audio/move_cursor.mp3');
    this.load.audio('soundText', 'audio/text.mp3');
  }

  create() {
    super.create();

    Sphere.create(this);
    Skelly.create(this);
    PartyMember.create(this);
    ActionChoiceState.create(this);

    this.battleGrid = this.add.tileSprite(196, 114, 326, 104, 'battleGrid').setDepth(DEPTH_BACKGROUND);
    this.battleBorder = this.add.image(190, 120, 'battleBorder').setDepth(DEPTH_UI);
    this.battleSphereWindow = this.add
      .image(SPHERE_WINDOW_LEFT + 58, SPHERE_WINDOW_TOP + 65, 'battleSphereWindow')
      .setDepth(DEPTH_UI);
    this.battleSphereStock = this.add
      .image(SPHERE_STOCK_LEFT + 46, SPHERE_STOCK_TOP + 16, 'battleSphereStock')
      .setDepth(DEPTH_UI);
    this.battleSphereWindowOverlay = this.add
      .rectangle(
        this.battleSphereWindow.x,
        this.battleSphereWindow.y,
        this.battleSphereWindow.width,
        this.battleSphereWindow.height,
        0x000000
      )
      .setDepth(DEPTH_UI + 1)
      .setAlpha(ALPHA_FADED);

    this.soundSwap = this.sound.add('swap');
    this.soundClear = this.sound.add('clear');
    this.soundActionAppear = this.sound.add('actionAppear');
    this.soundSelect = this.sound.add('select');
    this.soundMoveCursor = this.sound.add('moveCursor');
    this.soundText = this.sound.add('soundText');

    this.spheres = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        this.spheres.push(new Sphere(this, x, y, randomChoice(SPHERE_TYPES)));
      }
    }

    this.stockCounts = [];
    for (const type of SPHERE_TYPES) {
      this.stockCounts.push(new StockCount(this, type));
    }

    this.enemySkelly = new Skelly(this, ENEMY_LEFT + 32, ENEMY_TOP + 32);

    this.party = {
      [Characters.Rojo]: new PartyMember(this, Characters.Rojo, PARTY_LEFT + 32, PARTY_TOP + 16),
      [Characters.Blue]: new PartyMember(this, Characters.Blue, PARTY_LEFT + 16, PARTY_TOP + 48),
      [Characters.Midori]: new PartyMember(this, Characters.Midori, PARTY_LEFT + 32, PARTY_TOP + 78),
    };

    this.battleState = new BattleState(
      {
        [Characters.Rojo]: { hp: 101, maxHp: 101, atk: 70 },
        [Characters.Blue]: { hp: 93, maxHp: 93, atk: 25 },
        [Characters.Midori]: { hp: 123, maxHp: 123, atk: 35 },
      },
      { hp: 300, maxHp: 300 }
    );

    const pStatus = this.battleState.partyMemberStatuses;
    this.healthRojo = new HealthBar(
      this,
      HealthBarType.Rojo,
      HEALTH_LEFT + 23,
      HEALTH_TOP + 3,
      pStatus[Characters.Rojo].hp,
      pStatus[Characters.Rojo].maxHp
    );
    this.healthBlue = new HealthBar(
      this,
      HealthBarType.Blue,
      HEALTH_LEFT + 20,
      HEALTH_TOP + 14,
      pStatus[Characters.Blue].hp,
      pStatus[Characters.Blue].maxHp
    );
    this.healthMidori = new HealthBar(
      this,
      HealthBarType.Midori,
      HEALTH_LEFT + 17,
      HEALTH_TOP + 25,
      pStatus[Characters.Midori].hp,
      pStatus[Characters.Midori].maxHp
    );
    this.healthEnemy = new HealthBar(
      this,
      HealthBarType.Enemy,
      HEALTH_LEFT + 124,
      HEALTH_TOP + 14,
      this.battleState.enemyStatus.hp,
      this.battleState.enemyStatus.maxHp
    );

    this.dialog = new Dialog(this, DIALOG_LEFT + 82, DIALOG_TOP + 16).setDepth(DEPTH_UI);

    this.stateMachine = new StateMachine(
      'startActionChoice',
      {
        startActionChoice: new StartActionChoiceState(),
        actionChoice: new ActionChoiceState(),
        movePhase: new MovePhaseState(),
        swapChoice: new SwapChoiceState(),
        swap: new SwapState(),
        solve: new SolveState(),
        turnResult: new TurnResultPhaseState(),
      },
      [this]
    );
  }

  update(time: number, delta: number) {
    this.battleGrid.x -= pixelDiff(10, delta);
    if (this.battleGrid.x <= 188) {
      this.battleGrid.x += 8;
    }

    this.stateMachine.step(time, delta);
  }

  getSphere(gridX: number, gridY: number) {
    if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_HEIGHT) {
      return null;
    }

    return this.spheres[gridY * GRID_WIDTH + gridX];
  }
}

interface EnemyStatus {
  hp: number;
  maxHp: number;
}

interface PartyMemberStatus {
  hp: number;
  maxHp: number;
  atk: number;
}

type TurnInputs = { [key in Characters]: BattleActions };

interface PartyActionResultAttack {
  character: Characters;
  battleAction: BattleActions.Attack;
  damage: number;
}

interface PartyActionResultDefend {
  character: Characters;
  battleAction: BattleActions.Defend;
}

type PartyActionResult = PartyActionResultAttack | PartyActionResultDefend;

interface EnemyActionResult {
  target: Characters;
  damage: number;
}

interface TurnResult {
  partyActionResults: { [key in Characters]: PartyActionResult | null };
  enemyActionResult: EnemyActionResult | null;
  stockCounts: { [key in SphereType]: number };
}

class BattleState {
  partyMemberStatuses: { [key in Characters]: PartyMemberStatus };
  enemyStatus: EnemyStatus;
  stockCounts: { [key in SphereType]: number };

  constructor(partyMemberStatuses: { [key in Characters]: PartyMemberStatus }, enemyStatus: EnemyStatus) {
    this.partyMemberStatuses = partyMemberStatuses;
    this.enemyStatus = enemyStatus;
    this.stockCounts = {
      [SphereType.Red]: 0,
      [SphereType.Cyan]: 0,
      [SphereType.Green]: 0,
      [SphereType.Yellow]: 0,
      [SphereType.Key]: 0,
    };
  }

  setStockCount(type: SphereType, value: number) {
    this.stockCounts[type] = value;
  }

  modStockCount(type: SphereType, value: number) {
    this.stockCounts[type] += value;
  }

  executeTurn(turnInputs: TurnInputs): TurnResult {
    const partyActionResults: Partial<TurnResult['partyActionResults']> = {};

    // Character actions
    let clearKey = false;
    for (const [character, battleAction] of Object.entries(turnInputs) as Entries<typeof turnInputs>) {
      const sphereType = CHARACTER_SPHERE_TYPES[character];
      if (battleAction === BattleActions.Attack) {
        const damage =
          this.partyMemberStatuses[character].atk + this.stockCounts[sphereType] + this.stockCounts[SphereType.Key];
        this.enemyStatus.hp = Math.max(this.enemyStatus.hp - damage, 0);
        this.stockCounts[sphereType] = 0;
        clearKey = true;

        partyActionResults[character] = { character, battleAction, damage };
      } else {
        partyActionResults[character] = { character, battleAction };
      }
    }

    if (clearKey) {
      this.stockCounts[SphereType.Key] = 0;
    }

    let enemyActionResult = null;
    if (this.enemyStatus.hp > 0) {
      const target = randomChoice(
        Object.values(Characters).filter((character) => this.partyMemberStatuses[character].hp > 0)
      );

      let damage = Math.floor(Math.random() * 15) + 20;
      if (turnInputs[target] === BattleActions.Defend) {
        const sphereType = CHARACTER_SPHERE_TYPES[target];
        damage -= this.stockCounts[sphereType] + this.stockCounts[SphereType.Yellow];
        this.stockCounts[sphereType] = 0;
        this.stockCounts[SphereType.Yellow] = 0;
      }

      this.partyMemberStatuses[target].hp = Math.max(this.partyMemberStatuses[target].hp - damage, 0);

      enemyActionResult = {
        target,
        damage,
      };
    }

    return {
      partyActionResults: partyActionResults as TurnResult['partyActionResults'],
      enemyActionResult,
      stockCounts: this.stockCounts,
    };
  }
}

class Skelly {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Sprite;
  ground: Phaser.GameObjects.Image;

  static preload(scene: BattleScene) {
    scene.load.spritesheet('enemySkelly', 'enemies/skelly.png', { frameWidth: 64, frameHeight: 64 });
    scene.load.image('enemySkellyGround', 'enemies/skelly_ground.png');
  }

  static create(scene: BattleScene) {
    scene.anims.create({
      key: 'enemySkellyIdle',
      frameRate: 5,
      frames: scene.anims.generateFrameNumbers('enemySkelly', { start: 0, end: 3 }),
      repeat: -1,
    });
  }

  constructor(scene: BattleScene, x: number, y: number) {
    this.scene = scene;
    this.ground = scene.add.image(x - 6, y + 23, 'enemySkellyGround').setDepth(DEPTH_ENTITIES);
    this.sprite = scene.add.sprite(x, y, 'enemySkellyIdle', 0).setDepth(DEPTH_ENTITIES);
    this.sprite.play('enemySkellyIdle');
  }

  setFaded(faded: boolean) {
    setFaded(this.sprite, faded);
    setFaded(this.ground, faded);
  }

  async animateFaded(faded: boolean) {
    return Promise.all([
      animateFaded(this.scene, this.sprite, faded, 400),
      animateFaded(this.scene, this.ground, faded, 400),
    ]);
  }
}

class PartyMember {
  scene: Phaser.Scene;
  character: Characters;
  sprite: Phaser.GameObjects.Sprite;
  ground: Phaser.GameObjects.Image;

  static attackDamageFrame = {
    [Characters.Rojo]: 7,
    [Characters.Blue]: 7,
    [Characters.Midori]: 9,
  };

  static preload(scene: BattleScene) {
    for (const character of Object.values(Characters)) {
      scene.load.spritesheet(`party[${character}]`, `party/${character}.png`, {
        frameWidth: 64,
        frameHeight: 48,
      });
      scene.load.image(`party[${character}]Ground`, `party/${character}_ground.png`);
    }
  }

  static create(scene: BattleScene) {
    for (const character of Object.values(Characters)) {
      scene.anims.create({
        key: `party[${character}]Idle`,
        frameRate: 5,
        frames: scene.anims.generateFrameNumbers(`party[${character}]`, { start: 0, end: 3 }),
        repeat: -1,
      });
    }

    // Character-specific animations
    scene.anims.create({
      key: `party[${Characters.Rojo}]Attack`,
      frameRate: 10,
      repeat: 0,
      frames: scene.anims.generateFrameNumbers(`party[${Characters.Rojo}]`, {
        frames: [4, 5, 6, 7, 8, 9, 10, 11, 11, 11, 12, 13, 14, 15],
      }),
    });
    scene.anims.create({
      key: `party[${Characters.Blue}]Attack`,
      frameRate: 10,
      repeat: 0,
      frames: scene.anims.generateFrameNumbers(`party[${Characters.Blue}]`, {
        start: 4,
        end: 15,
      }),
    });
    scene.anims.create({
      key: `party[${Characters.Midori}]Attack`,
      frameRate: 10,
      repeat: 0,
      frames: scene.anims.generateFrameNumbers(`party[${Characters.Midori}]`, {
        frames: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 16, 17, 17],
      }),
    });
  }

  constructor(scene: BattleScene, character: Characters, x: number, y: number) {
    this.scene = scene;
    this.character = character;
    this.ground = scene.add.image(x - 1, y + 23, `party[${character}]Ground`).setDepth(DEPTH_ENTITIES);
    this.sprite = scene.add.sprite(x, y, `party[${character}]`, 0).setDepth(DEPTH_ENTITIES);
    this.sprite.play(`party[${character}]Idle`);
  }

  setFaded(faded: boolean) {
    setFaded(this.sprite, faded);
    setFaded(this.ground, faded);
  }

  async animateFaded(faded: boolean) {
    return Promise.all([
      animateFaded(this.scene, this.sprite, faded, 400),
      animateFaded(this.scene, this.ground, faded, 400),
    ]);
  }

  async animateAttack(showDamageCallback: () => void) {
    // Trigger damage numbers on a specific animation frame
    const handleAnimationUpdate = (
      _animation: Phaser.Animations.Animation,
      frame: Phaser.Animations.AnimationFrame
    ) => {
      if (frame.index === PartyMember.attackDamageFrame[this.character]) {
        showDamageCallback();
      }
    };
    this.sprite.on('animationupdate', handleAnimationUpdate);
    await asyncAnimation(this.sprite, `party[${this.character}]Attack`);
    this.sprite.off('animationupdate', handleAnimationUpdate);
    this.sprite.play(`party[${this.character}]Idle`);
  }
}

enum HealthBarType {
  Rojo = 0,
  Blue = 1,
  Midori = 2,
  Enemy = 3,
}

class HealthBar {
  scene: Phaser.Scene;
  type: HealthBarType;
  fullBarWidth: number;
  halfBarWidth: number;
  halfBarHeight: number;

  barFrame: Phaser.GameObjects.Image;
  bar1: Phaser.GameObjects.Rectangle;
  bar2: Phaser.GameObjects.Rectangle;
  text?: Text;
  portrait: Phaser.GameObjects.Sprite;

  maxHealth = 0;
  currentHealth = 0;

  static barColors = {
    [HealthBarType.Rojo]: CHARACTER_COLORS[Characters.Rojo],
    [HealthBarType.Blue]: CHARACTER_COLORS[Characters.Blue],
    [HealthBarType.Midori]: CHARACTER_COLORS[Characters.Midori],
    [HealthBarType.Enemy]: 0xfff55e,
  };

  static preload(scene: BattleScene) {
    scene.load.spritesheet('partyHealthBarFrames', 'ui/party_health_bar_frames.png', {
      frameWidth: 34,
      frameHeight: 6,
    });
    scene.load.spritesheet('portraits', 'ui/portraits.png', { frameWidth: 16, frameHeight: 16 });
    scene.load.image('enemyHealthBarFrame', 'ui/enemy_health_bar_frame.png');
  }

  constructor(
    scene: BattleScene,
    type: HealthBarType,
    barX: number,
    barY: number,
    currentHealth: number,
    maxHealth: number
  ) {
    this.scene = scene;
    this.type = type;

    if (type === HealthBarType.Enemy) {
      this.barFrame = scene.add.image(barX, barY, 'enemyHealthBarFrame').setDepth(DEPTH_UI);
    } else {
      this.barFrame = scene.add.image(barX, barY, 'partyHealthBarFrames', type).setDepth(DEPTH_UI);
    }

    this.fullBarWidth = this.barFrame.width - (type === HealthBarType.Enemy ? 5 : 6);
    this.halfBarWidth = Math.floor(this.fullBarWidth / 2);
    this.halfBarHeight = (this.barFrame.height - 4) / 2;

    this.bar1 = scene.add
      .rectangle(
        barX - this.halfBarWidth,
        barY - this.halfBarHeight / 2,
        this.fullBarWidth,
        this.halfBarHeight,
        HealthBar.barColors[type]
      )
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI);
    this.bar2 = scene.add
      .rectangle(
        barX - this.halfBarWidth - 1,
        barY + this.halfBarHeight / 2,
        this.fullBarWidth,
        this.halfBarHeight,
        HealthBar.barColors[type]
      )
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI);

    if (type !== HealthBarType.Enemy) {
      this.text = new Text(scene, barX + 18, barY - 2, 7, 1, '', { tint: TINT_YELLOW }).setDepth(DEPTH_UI);
    }

    this.portrait = scene.add
      .sprite(barX - this.barFrame.width / 2 - 8, barY + this.barFrame.height / 2 - 8, 'portraits', type)
      .setDepth(DEPTH_UI);

    this.setHealth(currentHealth, maxHealth);
  }

  setHealth(currentHealth: number, maxHealth?: number) {
    this.currentHealth = currentHealth;
    this.maxHealth = maxHealth ?? this.maxHealth;

    const percent = this.currentHealth / this.maxHealth;
    this.bar1.width = Math.ceil(percent * this.fullBarWidth);
    this.bar2.width = Math.ceil(percent * this.fullBarWidth);
    this.text?.setText(`${this.currentHealth.toString().padStart(3, ' ')}/${this.maxHealth}`);
  }

  async animateDamage(damage: number, color: number = 0xfff55e) {
    const startWidth = this.bar1.width;
    this.setHealth(this.currentHealth - damage);
    const damageWidth = startWidth - this.bar1.width;

    const damageBar1 = this.scene.add
      .rectangle(this.bar1.x + this.bar1.width, this.bar1.y, damageWidth, this.bar1.height, color)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI);
    const damageBar2 = this.scene.add
      .rectangle(this.bar2.x + this.bar2.width, this.bar2.y, damageWidth, this.bar2.height, color)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI);

    await asyncTween(this.scene, {
      targets: [damageBar1, damageBar2],
      width: 0,
      delay: 400,
      duration: 400,
      completeDelay: 100,
      ease: 'Cubic.out',
    });
    damageBar1.destroy();
    damageBar2.destroy();
  }
}

const SPHERE_TYPES = [SphereType.Red, SphereType.Cyan, SphereType.Green, SphereType.Yellow, SphereType.Key];
const SPHERE_DIRECTION_OFFSETS = {
  [Direction.Up]: 0,
  [Direction.Right]: 8,
  [Direction.Down]: 16,
  [Direction.Left]: 24,
};

class Sphere {
  scene: BattleScene;
  gridX: number;
  gridY: number;
  index: number;
  type: SphereType | null;
  sprite: Phaser.GameObjects.Sprite;

  static EMPTY_FRAME = 29;

  static preload(scene: BattleScene) {
    scene.load.spritesheet('battleSpheres', 'ui/spheres.png', { frameWidth: 14, frameHeight: 14 });
  }

  static create(scene: BattleScene) {
    for (const type of SPHERE_TYPES) {
      // Swaps
      for (const direction of DIRECTIONS) {
        scene.anims.create({
          key: `sphereSwapFrom:${type}:${direction}`,
          frameRate: 10,
          frames: scene.anims.generateFrameNumbers('battleSpheres', {
            frames: [type + 16 + SPHERE_DIRECTION_OFFSETS[oppositeDir(direction)], type],
          }),
        });
        scene.anims.create({
          key: `sphereSwapTo:${type}:${direction}`,
          frameRate: 10,
          frames: scene.anims.generateFrameNumbers('battleSpheres', {
            frames: [type + 16 + SPHERE_DIRECTION_OFFSETS[direction], type + 8],
          }),
        });
      }

      // Clear
      scene.anims.create({
        key: `sphereClear:${type}`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleSpheres', {
          frames: [type + 48, 52, 13, 21, Sphere.EMPTY_FRAME],
        }),
      });

      // Refill
      for (const refillFromType of SPHERE_TYPES) {
        scene.anims.create({
          key: `sphereRefillTop:${refillFromType}:${type}`,
          frameRate: 10,
          frames: scene.anims.generateFrameNumbers('battleSpheres', {
            frames: [refillFromType + 56, 37, type + 8, type],
          }),
        });
        scene.anims.create({
          key: `sphereRefillMiddle:${refillFromType}:${type}`,
          frameRate: 10,
          frames: scene.anims.generateFrameNumbers('battleSpheres', {
            frames: [refillFromType + 56, 45, type + 8, type],
          }),
        });
      }

      // Refill empty
      scene.anims.create({
        key: `sphereRefillTop:${null}:${type}`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleSpheres', {
          frames: [Sphere.EMPTY_FRAME, 37, type + 8, type],
        }),
      });
      scene.anims.create({
        key: `sphereRefillMiddle:${null}:${type}`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleSpheres', { frames: [Sphere.EMPTY_FRAME, 45, type + 8, type] }),
      });
      scene.anims.create({
        key: `sphereRefillBottom:${null}:${type}`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleSpheres', {
          frames: [Sphere.EMPTY_FRAME, type + 64, type + 8, type],
        }),
      });
    }
  }

  constructor(scene: BattleScene, gridX: number, gridY: number, type: SphereType) {
    this.scene = scene;
    this.gridX = gridX;
    this.gridY = gridY;
    this.index = gridX + gridY * GRID_WIDTH;
    this.type = type;
    this.sprite = scene.add
      .sprite(gridX * 14 + SPHERE_WINDOW_LEFT + 9, gridY * 14 + SPHERE_WINDOW_TOP + 9, 'battleSpheres', type)
      .setDepth(DEPTH_UI);
  }

  select() {
    if (this.type !== null) {
      this.sprite.setFrame(this.type + 8);
    }
  }

  deselect() {
    if (this.type !== null) {
      this.sprite.setFrame(this.type);
    }
  }
}

class StockCount {
  scene: BattleScene;
  bar: Phaser.GameObjects.Image;
  mask: Phaser.GameObjects.Rectangle;
  text: Text;
  count!: number;

  static preload(scene: BattleScene) {
    scene.load.spritesheet('sphereStockBar', 'ui/stock_bar.png', { frameWidth: 80, frameHeight: 4 });
  }

  constructor(scene: BattleScene, type: SphereType) {
    this.scene = scene;
    this.bar = scene.add
      .image(SPHERE_STOCK_LEFT + 11 + 40, SPHERE_STOCK_TOP + 4 + 6 * type, 'sphereStockBar', type)
      .setDepth(DEPTH_UI);
    this.mask = scene.add.rectangle(this.bar.x + 40, this.bar.y, 80, 4, 0x000000).setDepth(DEPTH_UI);
    this.mask.setOrigin(1, 0.5);
    this.text = new Text(scene, SPHERE_STOCK_LEFT + 94, SPHERE_STOCK_TOP + 1 + 6 * type, 2, 1, '0', {
      tint: TINT_YELLOW,
    }).setDepth(DEPTH_UI);

    this.setCount(0);
  }

  modCount(count: number) {
    this.setCount(this.count + count);
  }

  setCount(count: number) {
    this.count = Math.min(count, 40);
    this.mask.setDisplaySize((40 - count) * 2, 4);
    this.text.setText(`${count}`);
  }

  async animateModCount(count: number) {
    const newCount = Math.min(this.count + count, 40);
    await Promise.all([
      asyncTween(this.scene, {
        targets: [this.mask],
        displayWidth: (40 - newCount) * 2,
        duration: 400,
      }),
      (async () => {
        await wait(this.scene, 300);
        this.text.setTint(0x3f3e47);
        await wait(this.scene, 100);
        this.text.setText(`${newCount}`);
        await wait(this.scene, 100);
        this.text.setTint(TINT_YELLOW);
      })(),
    ]);

    this.count = newCount;
  }
}

class StartActionChoiceState extends State {
  async handleEntered(scene: BattleScene) {
    await wait(scene, 500);

    const fadeTweens = [scene.enemySkelly.animateFaded(true)];
    for (const character of scene.characterOrder.slice(1)) {
      fadeTweens.push(scene.party[character].animateFaded(true));
    }
    await Promise.all(fadeTweens);

    this.transition('actionChoice', 0);
  }
}

enum BattleActions {
  Attack = 'attack',
  Defend = 'defend',
}

class ActionChoiceState extends State {
  menu!: Menu;
  characterIndex!: number;
  character!: Characters;
  partyMember!: PartyMember;

  static actionSpriteIndex = {
    [BattleActions.Defend]: 0,
    [BattleActions.Attack]: 9,
  };

  static preload(scene: BattleScene) {
    scene.load.spritesheet('battleActions', 'ui/battle_actions.png', { frameWidth: 22, frameHeight: 20 });
  }

  static create(scene: BattleScene) {
    for (const battleAction of Object.values(BattleActions)) {
      const index = ActionChoiceState.actionSpriteIndex[battleAction];
      scene.anims.create({
        key: `battleActionAppear[${battleAction}]`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleActions', {
          frames: [index, index + 1, index + 2],
        }),
      });
      scene.anims.create({
        key: `battleActionSelect[${battleAction}]`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleActions', {
          frames: [index + 4, index + 8, index + 3],
        }),
      });
      scene.anims.create({
        key: `battleActionDisappearSelected[${battleAction}]`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleActions', {
          frames: [index + 5, index + 6, index + 7],
        }),
      });
      scene.anims.create({
        key: `battleActionDisappearUnselected[${battleAction}]`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleActions', {
          frames: [index, index + 6, index + 7],
        }),
      });
    }
  }

  init(scene: BattleScene) {
    scene.actionSprites = {} as typeof scene.actionSprites;
    for (const character of scene.characterOrder) {
      const partyMember = scene.party[character];
      scene.actionSprites[character] = {
        [BattleActions.Defend]: scene.add.sprite(
          partyMember.sprite.x - 26,
          partyMember.sprite.y + 8,
          'battleActions',
          1
        ),
        [BattleActions.Attack]: scene.add.sprite(
          partyMember.sprite.x + 26,
          partyMember.sprite.y + 8,
          'battleActions',
          9
        ),
      };
    }

    const allSprites = Object.values(scene.actionSprites).flatMap((actionMap) => Object.values(actionMap));
    for (const sprite of allSprites) {
      sprite.setVisible(false);
    }

    this.menu = new Menu(scene, horizontalMenuItems([{ key: BattleActions.Defend }, { key: BattleActions.Attack }]));
    this.menu.pauseInput();
    this.menu.on('focus', (cursor: string) => {
      // Only play sound for user-initiated focus
      if (!this.menu.inputPaused) {
        scene.soundMoveCursor.play();
      }

      for (const [key, sprite] of Object.entries(scene.actionSprites[this.character])) {
        sprite.setFrame(ActionChoiceState.actionSpriteIndex[key as BattleActions] + (key === cursor ? 3 : 2));
      }
    });
    this.menu.on('select', (cursor: string) => {
      this.menu.pauseInput();

      scene.currentTurnInputs[this.character] = cursor as BattleActions;

      scene.soundSelect.play();
      for (const [key, sprite] of Object.entries(scene.actionSprites[this.character])) {
        if (key === cursor) {
          sprite.play(`battleActionSelect[${key}]`);
        } else {
          sprite.play({ key: `battleActionDisappearUnselected[${key}]`, hideOnComplete: true });
        }
      }
      this.partyMember.animateFaded(true);

      if (this.characterIndex < scene.characterOrder.length - 1) {
        this.transition('actionChoice', this.characterIndex + 1);
      } else {
        this.transition('movePhase');
      }
    });
  }

  async handleEntered(scene: BattleScene, characterIndex: number) {
    this.characterIndex = characterIndex;
    this.character = scene.characterOrder[characterIndex];
    this.partyMember = scene.party[this.character];

    // Reset choices if new turn
    if (characterIndex === 0) {
      scene.currentTurnInputs = {} as TurnInputs;
    }

    scene.soundActionAppear.play();

    const animations: Promise<any>[] = [this.partyMember.animateFaded(false)];
    for (const action of [BattleActions.Defend, BattleActions.Attack]) {
      const sprite = scene.actionSprites[this.character][action];
      animations.push(asyncAnimation(sprite, `battleActionAppear[${action}]`));
      sprite.setVisible(true);
      await wait(scene, 100);
    }
    await Promise.all(animations);

    this.menu.moveCursorTo(BattleActions.Attack);
    this.menu.resumeInput();
  }

  execute() {
    this.menu.update();
  }
}

class MovePhaseState extends State {
  scene!: BattleScene;
  cursor!: Phaser.GameObjects.Sprite;
  cursorX!: number;
  cursorY!: number;

  init(scene: BattleScene) {
    this.scene = scene;
    this.cursor = scene.add.sprite(0, 0, 'battleSpheres', 5).setDepth(DEPTH_UI);
    this.cursorX = 0;
    this.cursorY = 0;
    this.cursor.setVisible(false);

    this.setCursorPos(0, 0);
  }

  setCursorPos(x: number, y: number) {
    this.cursorX = x;
    this.cursorY = y;
    this.cursor.setPosition(SPHERE_WINDOW_LEFT + 9 + x * 14, SPHERE_WINDOW_TOP + 9 + y * 14);
  }

  moveCursor(xDiff: number, yDiff: number) {
    this.scene.soundMoveCursor.play();
    this.setCursorPos(this.cursorX + xDiff, this.cursorY + yDiff);
  }

  handleEntered(scene: BattleScene, toX?: number, toY?: number) {
    scene.tweens.add({
      targets: [scene.battleSphereWindowOverlay],
      alpha: ALPHA_UNFADED,
      duration: 400,
    });
    this.cursor.setVisible(true);

    if (toX !== undefined && toY !== undefined) {
      this.setCursorPos(toX, toY);
    }

    if (scene.keys.space.isDown) {
      return this.transition('swapChoice', this.cursorX, this.cursorY);
    }
  }

  execute(scene: BattleScene) {
    if (justDown(scene.keys.space)) {
      return this.transition('swapChoice', this.cursorX, this.cursorY);
    }
    if (justDown(scene.keys.shift)) {
      return this.transition('solve');
    }

    if (justDown(scene.keys.right, 500) && this.cursorX < GRID_WIDTH - 1) {
      this.moveCursor(1, 0);
    }
    if (justDown(scene.keys.left, 500) && this.cursorX > 0) {
      this.moveCursor(-1, 0);
    }
    if (justDown(scene.keys.up, 500) && this.cursorY > 0) {
      this.moveCursor(0, -1);
    }
    if (justDown(scene.keys.down, 500) && this.cursorY < GRID_HEIGHT - 1) {
      this.moveCursor(0, 1);
    }
  }

  handleExited() {
    this.cursor.setVisible(false);
  }
}

class SwapChoiceState extends State {
  fromX!: number;
  fromY!: number;
  fromSphere!: Sphere;

  handleEntered(scene: BattleScene, fromX: number, fromY: number) {
    this.fromX = fromX;
    this.fromY = fromY;
    this.fromSphere = scene.getSphere(fromX, fromY)!;
    this.fromSphere.select();
  }

  swap(direction: Direction) {
    return this.transition('swap', this.fromX, this.fromY, direction);
  }

  execute(scene: BattleScene) {
    if (!scene.keys.space.isDown) {
      return this.transition('movePhase');
    }

    if (scene.keys.up.isDown && this.fromY > 0) {
      return this.swap(Direction.Up);
    }
    if (scene.keys.down.isDown && this.fromY < GRID_HEIGHT - 1) {
      return this.swap(Direction.Down);
    }
    if (scene.keys.left.isDown && this.fromX > 0) {
      return this.swap(Direction.Left);
    }
    if (scene.keys.right.isDown && this.fromX < GRID_WIDTH - 1) {
      return this.swap(Direction.Right);
    }
  }

  handleExited() {
    this.fromSphere.deselect();
  }
}

class SwapState extends State {
  async handleEntered(scene: BattleScene, fromX: number, fromY: number, direction: Direction) {
    let toX = fromX;
    let toY = fromY;
    switch (direction) {
      case Direction.Up:
        toY--;
        break;
      case Direction.Down:
        toY++;
        break;
      case Direction.Left:
        toX--;
        break;
      case Direction.Right:
        toX++;
        break;
    }

    const fromSphere = scene.getSphere(fromX, fromY)!;
    const toSphere = scene.getSphere(toX, toY)!;
    const fromType = fromSphere.type;
    const toType = toSphere.type;

    scene.soundSwap.play();
    await Promise.all([
      asyncAnimation(fromSphere.sprite, `sphereSwapFrom:${toType}:${direction}`),
      asyncAnimation(toSphere.sprite, `sphereSwapTo:${fromType}:${direction}`),
    ]);

    fromSphere.type = toType;
    toSphere.type = fromType;

    fromSphere.deselect();
    toSphere.deselect();

    this.transition('movePhase', toX, toY);
  }
}

function findGroup(scene: BattleScene, sphere: Sphere, visited: Set<number>, group: Sphere[]) {
  for (const direction of DIRECTIONS) {
    const [x, y] = gridMove(sphere.gridX, sphere.gridY, direction);
    const checkSphere = scene.getSphere(x, y);
    if (checkSphere && !visited.has(checkSphere.index) && sphere.type === checkSphere.type) {
      group.push(checkSphere);
      visited.add(checkSphere.index);
      findGroup(scene, checkSphere, visited, group);
    }
  }

  return group;
}

class SolveState extends State {
  async handleEntered(scene: BattleScene) {
    // Find all matched groups
    const visited = new Set<number>();
    const groups: Sphere[][] = [];
    for (const sphere of scene.spheres) {
      if (visited.has(sphere.index)) {
        continue;
      }
      visited.add(sphere.index);
      groups.push(findGroup(scene, sphere, visited, [sphere]));
    }

    // Group matches by type
    const matchGroups = groups.filter((group) => group.length >= 3);
    const matchedByType: Map<SphereType, Sphere[]> = new Map();
    for (const type of SPHERE_TYPES) {
      const spheres = matchGroups.filter((group) => group[0].type === type).flat();
      if (spheres.length > 0) {
        matchedByType.set(type, spheres);
      }
    }

    // If no matches, exit early
    if (matchGroups.flat().length < 1) {
      // TODO: Add bad sound to indicate no matches
      return this.transition('movePhase');
    }

    // Update the battle state first before animations
    for (const [type, spheres] of matchedByType.entries()) {
      scene.battleState.modStockCount(type, spheres.length);
    }

    // Clearing audio
    scene.soundClear.play();

    // Clear spheres
    const clearAnimations: Promise<void>[] = [];
    for (const [type, spheres] of matchedByType.entries()) {
      for (const sphere of spheres) {
        clearAnimations.push(asyncAnimation(sphere.sprite, `sphereClear:${type}`));
      }
      clearAnimations.push(scene.stockCounts[type].animateModCount(spheres.length));
      await wait(scene, 100);
    }
    await Promise.all(clearAnimations);
    for (const sphere of matchGroups.flat()) {
      sphere.type = null;
    }

    // Collapse each column and fill in new spheres
    const refillAnimations: Promise<void>[] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      const oldColumnTypes: (SphereType | null)[] = [];
      for (let y = 0; y < GRID_HEIGHT; y++) {
        oldColumnTypes.push(scene.getSphere(x, y)!.type);
      }

      // Early exit if nothing changed
      if (!oldColumnTypes.some((type) => type === null)) {
        continue;
      }

      let newColumnTypes: (SphereType | null)[] = oldColumnTypes.filter((type) => type !== null);
      newColumnTypes = [...Array(GRID_HEIGHT - newColumnTypes.length).fill(null), ...newColumnTypes];
      newColumnTypes = newColumnTypes.map((type) => type ?? randomChoice(SPHERE_TYPES));

      const animEnd = oldColumnTypes.findLastIndex((type) => type === null);
      for (let y = 0; y <= animEnd; y++) {
        const oldType = oldColumnTypes[y];
        const newType = newColumnTypes[y];

        const sphere = scene.getSphere(x, y)!;
        sphere.type = newType;

        let refillAnimationKey = 'sphereRefillMiddle';
        if (y === 0) {
          refillAnimationKey = 'sphereRefillTop';
        } else if (y === animEnd) {
          refillAnimationKey = 'sphereRefillBottom';
        }
        refillAnimations.push(asyncAnimation(sphere.sprite, `${refillAnimationKey}:${oldType}:${newType}`));
      }
    }
    await Promise.all(refillAnimations);

    // DEBUG: Reset in case the visuals don't match
    for (const sphere of scene.spheres) {
      sphere.sprite.setFrame(sphere.type ?? Sphere.EMPTY_FRAME);
    }

    return this.transition('turnResult');
  }
}

class DamageNumber {
  scene: BaseScene;
  x: number;
  y: number;
  damageSprite: Phaser.GameObjects.BitmapText;
  highlightSprite: Phaser.GameObjects.BitmapText;
  borderSprites: Phaser.GameObjects.BitmapText[];

  static appearFrames = [[]];

  constructor(scene: BaseScene, amount: number, color: number, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.borderSprites = [
      [-1, 0],
      [0, -1],
      [1, 0],
      [0, 1],
      [1, 2],
      [2, 1],
    ].map(([xMod, yMod]) =>
      scene.add
        .bitmapText(x + xMod, y + yMod, 'sodapop', amount.toString())
        .setDepth(DEPTH_UI)
        .setVisible(false)
        .setTint(0x000000)
    );
    this.highlightSprite = scene.add
      .bitmapText(x + 1, y + 1, 'sodapop', amount.toString())
      .setDepth(DEPTH_UI)
      .setVisible(false)
      .setTint(color);
    this.damageSprite = scene.add
      .bitmapText(x, y, 'sodapop', amount.toString())
      .setDepth(DEPTH_UI)
      .setVisible(false)
      .setTint(TINT_YELLOW);
  }

  async animateAppear() {
    // Manual animation because abstracting this is just too annoying right now without a much better animation
    // abstraction.
    this.highlightSprite.setVisible(true).setPosition(this.x - 15, this.y + 5);
    await wait(this.scene, 75);

    this.damageSprite.setVisible(true).setPosition(this.x - 8, this.y - 3);
    this.highlightSprite.setPosition(this.x - 7, this.y - 2);
    await wait(this.scene, 75);

    this.damageSprite.setPosition(this.x - 6, this.y + 5);
    this.highlightSprite.setPosition(this.x - 5, this.y + 4);
    await wait(this.scene, 75);

    this.damageSprite.setPosition(this.x - 3, this.y - 2);
    this.highlightSprite.setPosition(this.x - 2, this.y);
    await wait(this.scene, 75);

    this.damageSprite.setPosition(this.x - 1, this.y + 1);
    this.highlightSprite.setPosition(this.x, this.y + 1);
    await wait(this.scene, 75);

    this.damageSprite.setPosition(this.x, this.y);
    this.highlightSprite.setPosition(this.x + 1, this.y + 1);
    for (const sprite of this.borderSprites) {
      sprite.setVisible(true);
    }
  }

  async animateDestroy() {
    this.damageSprite.destroy();
    this.highlightSprite.setPosition(this.highlightSprite.x + 1, this.highlightSprite.y);
    for (const sprite of this.borderSprites) {
      sprite.setPosition(sprite.x + 1, sprite.y);
    }
    await wait(this.scene, 75);

    this.highlightSprite.destroy();
    for (const sprite of this.borderSprites) {
      sprite.destroy();
    }
  }
}

class TurnResultPhaseState extends State {
  async handleEntered(scene: BattleScene) {
    const hideAnimations = [
      asyncTween(scene, {
        targets: [scene.battleSphereWindowOverlay],
        alpha: ALPHA_FADED,
        duration: 400,
      }),
    ];
    for (const character of scene.characterOrder) {
      const battleAction = scene.currentTurnInputs[character];
      hideAnimations.push(
        asyncAnimation(scene.actionSprites[character][battleAction], {
          key: `battleActionDisappearSelected[${battleAction}]`,
          hideOnComplete: true,
        })
      );
    }
    await Promise.all(hideAnimations);

    const fadeInAnimations = [scene.enemySkelly.animateFaded(false)];
    for (const partyMember of Object.values(scene.party)) {
      fadeInAnimations.push(partyMember.animateFaded(false));
    }
    await Promise.all(fadeInAnimations);

    const { partyActionResults } = (scene.currentTurnResult = scene.battleState.executeTurn(scene.currentTurnInputs));

    // Animate attacks, if needed
    if (Object.values(partyActionResults).some((result) => result?.battleAction === BattleActions.Attack)) {
      await scene.dialog.animateText('- Attack!', 75, scene.soundText);
      await wait(scene, 100);

      const attackResults = Object.values(partyActionResults).filter(
        (result): result is PartyActionResultAttack => result?.battleAction === BattleActions.Attack
      );

      // Prepage damage numbers for display
      const damageNumbers = attackResults.map(
        ({ character, damage }, index) =>
          new DamageNumber(scene, damage, CHARACTER_COLORS[character], 272 - 3 * index, 82 + 11 * index)
      );

      const attackAnimations: Promise<void>[] = [];
      for (let k = 0; k < attackResults.length; k++) {
        const { character, damage } = attackResults[k];
        attackAnimations.push(
          scene.party[character].animateAttack(() => {
            damageNumbers[k].animateAppear();
            scene.healthEnemy.animateDamage(damage, CHARACTER_COLORS[character]);
          })
        );
        await wait(scene, 600);
      }

      await Promise.all(attackAnimations);
      await wait(scene, 400);
      await Promise.all(damageNumbers.map((damageNumber) => damageNumber.animateDestroy()));
    }
  }
}
