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
  shake,
  ShakeAxis,
  forEachTween,
  relativePositionTween,
  asyncCounter,
  steppedCubicEase,
  onPointer,
  clamp,
  asyncLoad,
} from 'gate/util';
import Phaser from 'phaser';
import BaseScene from 'gate/scenes/base';
import Menu, { horizontalMenuItems } from 'gate/menu';
import Dialog from 'gate/dialog';
import { Entries } from 'type-fest';
import LoadingScene from 'gate/scenes/loading';
import { signMintData } from 'gate/signMintData';
import { SPHERE_QUIZ_NFT_ADDRESS } from 'gate/config';
import {
  Address,
  createPublicClient,
  createWalletClient,
  http,
  custom,
  encodeFunctionData,
  parseEther,
  formatUnits,
} from 'viem';
import { scroll, scrollSepolia } from 'viem/chains';
import { quizData } from 'gate/quiz-data';
import SphereQuizGameNFTAbi from '../abi/SphereQuizGameNFT.json';
import { CovalentClient } from '@covalenthq/client-sdk';
import { getAttackParametersFromContract } from 'gate/sepoliaCall';

type Vector2 = Phaser.Math.Vector2;

const { Align } = Phaser.Display;

const GRID_WIDTH = 8;
const GRID_HEIGHT = 9;

const ALPHA_FADED = 0.6;
const ALPHA_UNFADED = 0;

const DEPTH_BACKGROUND = -10;
const DEPTH_ENTITIES = 0;
const DEPTH_UI = 10;
const DEPTH_MODAL = 20;

const TINT_CREAM = 0xfffa9b;
const TINT_YELLOW = 0xfff55e;
const TINT_RED = 0xac311e;
const TINT_BLUE = 0x63a09b;
const TINT_GREEN = 0x5ad932;

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
  Dark, //For Damage
}

interface AttackParameters {
  baseAttackPower: number;
  adjustedVolatility: number;
  overallAttackParameter: number;
}

const CHARACTER_SPHERE_TYPES = {
  [Characters.Rojo]: SphereType.Red,
  [Characters.Blue]: SphereType.Cyan,
  [Characters.Midori]: SphereType.Green,
};

export default class BattleScene extends BaseScene {
  stateMachine!: StateMachine;
  publicClient: ReturnType<typeof createPublicClient>;

  // UI
  battleBorder!: Phaser.GameObjects.NineSlice;
  battleGrid!: Phaser.GameObjects.TileSprite;
  battleSphereWindow!: Phaser.GameObjects.Image;
  battleSphereStock!: Phaser.GameObjects.Image;
  battleSphereWindowOverlay!: Phaser.GameObjects.Rectangle;
  actionSprites!: { [character in Characters]: { [action in BattleActions]: Phaser.GameObjects.Sprite } };
  allActionSprites!: Phaser.GameObjects.Sprite;
  dialog!: Dialog;
  blackoutMask!: Phaser.GameObjects.Graphics;
  fullScreenButton!: FullScreenButton;
  // byline!: Phaser.GameObjects.Image;
  playButton!: PlayButton;
  scoreText!: Phaser.GameObjects.BitmapText;
  musicCredit!: MusicCredit;

  // Enemies
  enemySkelly!: Skelly;
  healthEnemy!: HealthBar;

  // Party
  party!: { [key in Characters]: PartyMember };
  partyHealth!: { [key in Characters]: HealthBar };

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
  soundPartyAttack!: { [key in Characters]: Phaser.Sound.BaseSound };
  soundEnemyAttack!: Phaser.Sound.BaseSound;
  soundPartyDeath!: Phaser.Sound.BaseSound;
  soundSuccess!: Phaser.Sound.BaseSound;
  soundFail!: Phaser.Sound.BaseSound;
  soundGameOver!: Phaser.Sound.BaseSound;
  soundVictory!: Phaser.Sound.BaseSound;
  soundBattleMusicAll!: Phaser.Sound.BaseSound;
  soundBattleMusicRed!: Phaser.Sound.BaseSound;
  soundBattleMusicBlue!: Phaser.Sound.BaseSound;
  soundBattleMusicGreen!: Phaser.Sound.BaseSound;
  soundBattleMusicRedBlue!: Phaser.Sound.BaseSound;
  soundBattleMusicRedGreen!: Phaser.Sound.BaseSound;
  soundBattleMusicBlueGreen!: Phaser.Sound.BaseSound;
  soundEnemyDeath!: Phaser.Sound.BaseSound;

  battleMusicState = {
    [Characters.Rojo]: true,
    [Characters.Blue]: true,
    [Characters.Midori]: true,
  };

  // Battle logic
  battleState!: BattleState;
  currentTurnInputs!: TurnInputs;
  currentTurnResult!: TurnResult;

  firstRound = true;
  quizCorrect = false;

  spheresClearedCount = 0;
  clearedSpheresThisTurn = 0;

  constructor() {
    super({
      key: 'battle',
    });
    const SCROLL_RPC_URL = import.meta.env.VITE_SCROLL_RPC_URL;
    this.publicClient = createPublicClient({
      chain: scroll,
      transport: http(SCROLL_RPC_URL),
    });
  }

  loadResources(scene: BaseScene) {
    Sphere.preload(scene);
    StockCount.preload(scene);
    Skelly.preload(scene);
    PartyMember.preload(scene);
    HealthBar.preload(scene);
    ActionChoiceState.preload(scene);
    Dialog.preload(scene);
    FullScreenButton.preload(scene);
    PlayButton.preload(scene);
    EndState.preload(scene);

    scene.load.image('battleBorder', 'ui/battle_border.png');
    scene.load.image('battleGrid', 'ui/battle_grid.png');
    scene.load.image('battleSphereWindow', 'ui/battle_sphere_window.png');
    scene.load.image('battleSphereStock', 'ui/color_stock.png');
    // scene.load.image('byline', 'ui/byline.png');
    scene.load.image('chest', 'ui/chest.png');
    scene.load.image('treasure', 'ui/treasure.png');

    scene.load.bitmapFont('numbers', 'ui/numbers.png', 'ui/numbers.fnt');

    scene.load.audio('swap', 'audio/swap.mp3');
    scene.load.audio('clear', 'audio/clear.mp3');
    scene.load.audio('actionAppear', 'audio/action_appear.mp3');
    scene.load.audio('select', 'audio/select.mp3');
    scene.load.audio('moveCursor', 'audio/move_cursor.mp3');
    scene.load.audio('soundText', 'audio/text.mp3');
    scene.load.audio('soundRojoAttack', 'audio/rojo_attack.mp3');
    scene.load.audio('soundBlueAttack', 'audio/blue_attack.mp3');
    scene.load.audio('soundMidoriAttack', 'audio/midori_attack.mp3');
    scene.load.audio('soundEnemyAttack', 'audio/enemy_attack.mp3');
    scene.load.audio('soundPartyDeath', 'audio/player_death.mp3');
    scene.load.audio('soundSuccess', 'audio/success.mp3');
    scene.load.audio('soundFail', 'audio/fail.mp3');
    scene.load.audio('soundGameOver', 'audio/gameover.mp3');
    scene.load.audio('soundVictory', 'audio/victory.mp3');
    scene.load.audio('soundEnemyDeath', 'audio/enemy_death.mp3');

    scene.load.audio('soundBattleMusicAll', 'audio/battle_music_all.mp3');
  }

  create() {
    super.create();

    Sphere.create(this);
    Skelly.create(this);
    PartyMember.create(this);
    ActionChoiceState.create(this);
    PlayButton.create(this);

    // Load variant background music async so it doesn't block starting the game.
    asyncLoad(this, (scene) => {
      scene.load.audio('soundBattleMusicRed', 'audio/battle_music_red.mp3');
      scene.load.audio('soundBattleMusicBlue', 'audio/battle_music_blue.mp3');
      scene.load.audio('soundBattleMusicGreen', 'audio/battle_music_green.mp3');
      scene.load.audio('soundBattleMusicRedBlue', 'audio/battle_music_red_blue.mp3');
      scene.load.audio('soundBattleMusicRedGreen', 'audio/battle_music_red_green.mp3');
      scene.load.audio('soundBattleMusicBlueGreen', 'audio/battle_music_blue_green.mp3');
    }).then(() => {
      this.soundBattleMusicRed = this.sound.add('soundBattleMusicRed').on('complete', () => {
        this.soundBattleMusicAll.play({ seek: 1.683 });
      });
      this.soundBattleMusicBlue = this.sound.add('soundBattleMusicBlue').on('complete', () => {
        this.soundBattleMusicBlue.play({ seek: 1.683 });
      });
      this.soundBattleMusicGreen = this.sound.add('soundBattleMusicGreen').on('complete', () => {
        this.soundBattleMusicGreen.play({ seek: 1.683 });
      });
      this.soundBattleMusicRedBlue = this.sound.add('soundBattleMusicRedBlue').on('complete', () => {
        this.soundBattleMusicRedBlue.play({ seek: 1.683 });
      });
      this.soundBattleMusicRedGreen = this.sound.add('soundBattleMusicRedGreen').on('complete', () => {
        this.soundBattleMusicRedGreen.play({ seek: 1.683 });
      });
      this.soundBattleMusicBlueGreen = this.sound.add('soundBattleMusicBlueGreen').on('complete', () => {
        this.soundBattleMusicBlueGreen.play({ seek: 1.683 });
      });
    });

    this.blackoutMask = this.make.graphics();
    this.cameras.main.setMask(this.blackoutMask.createGeometryMask());

    this.battleBorder = this.add
      .nineslice(this.cameras.main.centerX, this.cameras.main.centerY, 'battleBorder', 0, 330, 182, 1, 1)
      .setDepth(DEPTH_UI);
    this.battleGrid = this.add
      .tileSprite(
        this.battleBorder.x,
        this.battleBorder.y + 2,
        this.battleBorder.width + 16,
        this.battleBorder.height - 78,
        'battleGrid'
      )
      .setDepth(DEPTH_BACKGROUND);
    this.battleSphereWindow = this.add.image(0, 0, 'battleSphereWindow').setDepth(DEPTH_UI);
    this.battleSphereStock = this.add.image(0, 0, 'battleSphereStock').setDepth(DEPTH_UI);
    // this.byline = this.add.image(0, 0, 'byline').setScale(0.25).setOrigin(1, 0).setDepth(DEPTH_UI);

    Align.In.TopLeft(this.battleSphereWindow, this.battleBorder, -30, -7);
    Align.To.BottomCenter(this.battleSphereStock, this.battleSphereWindow, -4, 8);
    // Align.In.TopRight(this.byline, this.battleBorder, -5, -4);

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

    this.fullScreenButton = new FullScreenButton(this, 0, 0).setDepth(DEPTH_UI);
    Align.In.TopLeft(this.fullScreenButton, this.battleBorder, -6, -8);

    this.playButton = new PlayButton(this, 0, 0).setDepth(DEPTH_UI);
    Align.In.BottomLeft(this.playButton, this.battleBorder, -8, -10);

    this.soundSwap = this.sound.add('swap');
    this.soundClear = this.sound.add('clear');
    this.soundActionAppear = this.sound.add('actionAppear');
    this.soundSelect = this.sound.add('select');
    this.soundMoveCursor = this.sound.add('moveCursor');
    this.soundText = this.sound.add('soundText');
    this.soundPartyAttack = {
      [Characters.Rojo]: this.sound.add('soundRojoAttack'),
      [Characters.Blue]: this.sound.add('soundBlueAttack'),
      [Characters.Midori]: this.sound.add('soundMidoriAttack'),
    };
    this.soundEnemyAttack = this.sound.add('soundEnemyAttack');
    this.soundPartyDeath = this.sound.add('soundPartyDeath');
    this.soundSuccess = this.sound.add('soundSuccess');
    this.soundFail = this.sound.add('soundFail');
    this.soundGameOver = this.sound.add('soundGameOver', { loop: true });
    this.soundVictory = this.sound.add('soundVictory', { loop: true });
    this.soundEnemyDeath = this.sound.add('soundEnemyDeath');

    this.soundBattleMusicAll = this.sound.add('soundBattleMusicAll').on('complete', () => {
      this.soundBattleMusicAll.play({ seek: 1.683 });
    });

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

    this.enemySkelly = new Skelly(this);

    this.party = {
      [Characters.Rojo]: new PartyMember(this, Characters.Rojo),
      [Characters.Blue]: new PartyMember(this, Characters.Blue),
      [Characters.Midori]: new PartyMember(this, Characters.Midori),
    };

    const borderTopRight = this.battleBorder.getTopRight<Vector2>();
    this.healthEnemy = new HealthBar(
      this,
      HealthBarType.Enemy,
      borderTopRight.x - 39,
      borderTopRight.y + 20,
      this.battleState.enemyStatus.hp,
      this.battleState.enemyStatus.maxHp,
      0
    );

    const pStatus = this.battleState.partyMemberStatuses;
    const pBarX = this.healthEnemy.barFrame.x - 220;
    const pBarY = this.healthEnemy.barFrame.y - 6;
    this.partyHealth = {
      [Characters.Rojo]: new HealthBar(
        this,
        HealthBarType.Rojo,
        pBarX + 6,
        pBarY,
        pStatus[Characters.Rojo].hp,
        pStatus[Characters.Rojo].maxHp,
        pStatus[Characters.Rojo].atk
      ),
      [Characters.Blue]: new HealthBar(
        this,
        HealthBarType.Blue,
        pBarX + 3,
        pBarY + 11,
        pStatus[Characters.Blue].hp,
        pStatus[Characters.Blue].maxHp,
        pStatus[Characters.Blue].atk
      ),
      [Characters.Midori]: new HealthBar(
        this,
        HealthBarType.Midori,
        pBarX,
        pBarY + 22,
        pStatus[Characters.Midori].hp,
        pStatus[Characters.Midori].maxHp,
        pStatus[Characters.Midori].atk
      ),
    };

    const borderBottomRight = this.battleBorder.getBottomRight<Vector2>();
    this.dialog = new Dialog(this, borderBottomRight.x - 12 - 80, borderBottomRight.y - 8 - 12, {
      width: 160,
      height: 24,
      sound: this.soundText,
    }).setDepth(DEPTH_UI);

    this.scoreText = this.add.bitmapText(0, 0, 'sodapop', 'Score: 0').setTint(TINT_CREAM).setDepth(DEPTH_UI);
    Align.To.BottomRight(this.scoreText, this.healthEnemy.barFrame, -8, 6);

    this.musicCredit = new MusicCredit(this, 0, 0);
    Align.In.TopRight(this.musicCredit, this.battleBorder, -65, -5);

    this.stateMachine = new StateMachine(
      'intro',
      {
        intro: new IntroState(),
        startActionChoice: new StartActionChoiceState(),
        actionChoice: new ActionChoiceState(),
        quizPhase: new QuizPhaseState(),
        startMovePhase: new StartMovePhaseState(),
        movePhase: new MovePhaseState(),
        swapChoice: new SwapChoiceState(),
        swap: new SwapState(),
        solve: new SolveState(),
        turnResult: new TurnResultPhaseState(),
        gameOver: new EndState('GAME OVER\nRefresh to try again', this.soundGameOver, 'EndGameOver'),
        victory: new EndState('You won!\nThank you for playing!', this.soundVictory, 'EndVictory'),
      },
      [this]
    );
  }

  update(time: number, delta: number) {
    this.battleGrid.x -= pixelDiff(10, delta);
    if (this.battleGrid.x <= this.battleBorder.x - 8) {
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

  get activeCharacters() {
    return [Characters.Rojo, Characters.Blue, Characters.Midori].filter(
      (character) => this.battleState.partyMemberStatuses[character].hp > 0
    );
  }

  get soundBattleMusic() {
    const rojo = this.battleMusicState[Characters.Rojo];
    const blue = this.battleMusicState[Characters.Blue];
    const midori = this.battleMusicState[Characters.Midori];

    if (rojo && blue && midori) {
      return this.soundBattleMusicAll;
    } else if (rojo && blue) {
      return this.soundBattleMusicRedBlue;
    } else if (rojo && midori) {
      return this.soundBattleMusicRedGreen;
    } else if (blue && midori) {
      return this.soundBattleMusicBlueGreen;
    } else if (rojo) {
      return this.soundBattleMusicRed;
    } else if (blue) {
      return this.soundBattleMusicBlue;
    } else if (midori) {
      return this.soundBattleMusicGreen;
    }
  }

  battleMusicDeath(character: Characters) {
    const currentMusic = this.soundBattleMusic as Phaser.Sound.WebAudioSound;
    this.battleMusicState[character] = false;
    const newMusic = this.soundBattleMusic;

    const seek = currentMusic.seek;
    currentMusic.stop();
    newMusic?.play({ seek });
  }
  showBattleSphereWindow() {
    this.battleSphereWindow.setVisible(true);
    this.battleSphereStock.setVisible(true);
    this.battleSphereWindowOverlay.setVisible(true);
    for (const sphere of this.spheres) {
      sphere.sprite.setVisible(true);
    }
    for (const stockCount of this.stockCounts) {
      stockCount.bar.setVisible(true);
      stockCount.text.setVisible(true);
    }
    for (const character of Object.values(Characters)) {
      this.partyHealth[character].setVisible(false);
    }
  }

  hideBattleSphereWindow() {
    this.battleSphereWindow.setVisible(false);
    this.battleSphereStock.setVisible(false);
    this.battleSphereWindowOverlay.setVisible(false);
    for (const sphere of this.spheres) {
      sphere.sprite.setVisible(false);
    }
    for (const stockCount of this.stockCounts) {
      stockCount.bar.setVisible(false);
      stockCount.text.setVisible(false);
    }
    for (const character of Object.values(Characters)) {
      this.partyHealth[character].setVisible(true);
    }
  }

  async setBattleState(address: Address, bossHP: number) {
    console.log('Setting battle state for address:', address);
    const client = new CovalentClient(import.meta.env.VITE_API_KEY_COVALENT);
    let latestTransaction = null;
    await this.scene.get<LoadingScene>('loading').loadTransaction();
    for await (const resp of client.TransactionService.getAllTransactionsForAddress('scroll-mainnet', address, {
      noLogs: true,
      blockSignedAtAsc: false,
    })) {
      latestTransaction = resp;
      break;
    }

    if (latestTransaction) {
      await this.scene.get<LoadingScene>('loading').setParameter();
      console.log('latestTransaction', latestTransaction);

      // 最新のトランザクションのガス代を取得
      const latestTransactionGasPrice = BigInt(latestTransaction.gas_price);

      // 直近7日のトランザクション数を取得
      const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      let transactionCountInLastWeek = 0;
      for await (const resp of client.TransactionService.getAllTransactionsForAddress('scroll-mainnet', address, {
        noLogs: true,
        blockSignedAtAsc: false,
      })) {
        const blockSignedAtTimestamp = new Date(resp.block_signed_at).getTime() / 1000;
        if (blockSignedAtTimestamp >= weekAgo) {
          transactionCountInLastWeek++;
        } else {
          break;
        }
      }
      // 最新のトランザクションのブロック番号と現在のブロック番号の近さを計算
      const latestBlockNumber = await this.publicClient.getBlockNumber();
      const latestTransactionBlockNumber = latestTransaction.block_height;
      const blockDiff = Number(latestBlockNumber) - latestTransactionBlockNumber;
      const harfDaysAgo = Math.floor(blockDiff / 12500); // 24時間あたり約25000ブロック（3秒ブロック時間を想定）

      console.log('latestTransactionBlockNumber', latestTransactionBlockNumber, blockDiff);

      // 攻撃力を計算 (元の数値+10を上限とする)
      const latestTransactionGasPriceAttack = Math.max(
        Math.min(Math.floor(parseFloat(formatUnits(latestTransactionGasPrice, 9))) * 40, 90),
        15
      );
      const transactionCountAttack = Math.max(Math.min(transactionCountInLastWeek * 3, 80), 10);
      const blockProximityAttack = Math.max(5, 75 - harfDaysAgo * 5);

      console.log(
        'data',
        parseFloat(formatUnits(latestTransactionGasPrice, 9)),
        transactionCountInLastWeek,
        harfDaysAgo
      );
      console.log('Attack Power: ', latestTransactionGasPriceAttack, transactionCountAttack, blockProximityAttack);
      // HPを設定 (既存のコード)
      const balance = await this.publicClient.getBalance({ address });
      const lowThreshold = parseEther('0.05');
      const mediumThreshold = parseEther('0.1');

      console.log('balance', balance.toString());
      let hpSettings;
      if (balance < lowThreshold) {
        hpSettings = {
          [Characters.Rojo]: { hp: 50, maxHp: 101 },
          [Characters.Blue]: { hp: 30, maxHp: 93 },
          [Characters.Midori]: { hp: 70, maxHp: 123 },
        };
      } else if (balance < mediumThreshold) {
        hpSettings = {
          [Characters.Rojo]: { hp: 90, maxHp: 121 },
          [Characters.Blue]: { hp: 70, maxHp: 113 },
          [Characters.Midori]: { hp: 80, maxHp: 133 },
        };
      } else {
        hpSettings = {
          [Characters.Rojo]: { hp: 140, maxHp: 140 },
          [Characters.Blue]: { hp: 120, maxHp: 120 },
          [Characters.Midori]: { hp: 150, maxHp: 150 },
        };
      }

      this.battleState = new BattleState(
        {
          ...hpSettings,
          [Characters.Rojo]: { ...hpSettings[Characters.Rojo], atk: latestTransactionGasPriceAttack },
          [Characters.Blue]: { ...hpSettings[Characters.Blue], atk: transactionCountAttack },
          [Characters.Midori]: { ...hpSettings[Characters.Midori], atk: blockProximityAttack },
        },
        { hp: bossHP, maxHp: bossHP }
      );
    } else {
      console.log('No transactions found for the specified address');
      let hpSettings = {
        [Characters.Rojo]: { hp: 80, maxHp: 101 },
        [Characters.Blue]: { hp: 60, maxHp: 93 },
        [Characters.Midori]: { hp: 100, maxHp: 123 },
      };
      this.battleState = new BattleState(
        {
          ...hpSettings,
          [Characters.Rojo]: { ...hpSettings[Characters.Rojo], atk: 15 },
          [Characters.Blue]: { ...hpSettings[Characters.Blue], atk: 5 },
          [Characters.Midori]: { ...hpSettings[Characters.Midori], atk: 10 },
        },
        { hp: bossHP, maxHp: bossHP }
      );
    }
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
  death: boolean;
}

interface PartyActionResultDefend {
  character: Characters;
  battleAction: BattleActions.Defend;
}

type PartyActionResult = PartyActionResultAttack | PartyActionResultDefend;

interface EnemyActionResult {
  targets?: Characters[];
  target?: Characters;
  damages?: number[];
  damage?: number;
  deaths?: boolean[];
  death?: boolean;
}

interface TurnResult {
  partyActionResults: { [key in Characters]: PartyActionResult | null };
  enemyActionResult: EnemyActionResult | null;
  stockCounts: { [key in SphereType]: number };
}

class MusicCredit extends Phaser.GameObjects.BitmapText {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'sodapop');
    scene.add.existing(this);
    this.setScale(0.9);
    this.setTint(TINT_CREAM);
    this.setDepth(DEPTH_UI);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerup', () => {
      window.open('https://www.sound.xyz/samnogg/game-odyssea', '_blank');
    });
  }

  async animateText() {
    const texts = ['playing...', 'sound.xyz'];

    let index = 0; // Start from the beginning of the array
    while (true) {
      const text = texts[index]; // Get the current text
      this.setText(text);
      this.setInteractive({ useHandCursor: true });

      await asyncTween(this.scene, {
        targets: [this],
        alpha: 1,
        duration: 2000,
        ease: 'Sine.easeInOut',
      });

      await wait(this.scene, 3000); // Wait after completing the text
      await asyncTween(this.scene, {
        targets: [this],
        alpha: 0,
        duration: 2000,
        ease: 'Sine.easeInOut',
      });

      index++; // Move to the next item in texts
      if (index >= texts.length) {
        index = 0; // Reset index to loop back to the beginning
      }
    }
  }
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
      [SphereType.Dark]: 0,
    };
  }

  setStockCount(type: SphereType, value: number) {
    this.stockCounts[type] = value;
  }

  modStockCount(type: SphereType, value: number) {
    this.stockCounts[type] += value;
  }

  get isGameOver() {
    return Object.values(this.partyMemberStatuses).every((status) => status.hp < 1);
  }

  get isVictory() {
    return this.enemyStatus.hp < 1;
  }

  async executeTurn(turnInputs: TurnInputs): Promise<TurnResult> {
    const partyActionResults: Partial<TurnResult['partyActionResults']> = {};

    // Character actions
    let clearKey = false;
    for (const [character, battleAction] of Object.entries(turnInputs) as Entries<typeof turnInputs>) {
      const sphereType = CHARACTER_SPHERE_TYPES[character];
      if (battleAction === BattleActions.Attack && this.enemyStatus.hp > 0) {
        const damage = Math.max(
          0,
          this.partyMemberStatuses[character].atk + this.stockCounts[sphereType] + this.stockCounts[SphereType.Key]
        );
        this.enemyStatus.hp = Math.max(this.enemyStatus.hp - damage, 0);
        this.stockCounts[sphereType] = 0;
        clearKey = true;

        partyActionResults[character] = {
          character,
          battleAction: BattleActions.Attack,
          damage,
          death: this.enemyStatus.hp < 1,
        };
      } else {
        partyActionResults[character] = { character, battleAction: BattleActions.Defend };
      }
    }

    if (clearKey) {
      this.stockCounts[SphereType.Key] = 0;
    }

    let enemyActionResult = null;
    if (this.enemyStatus.hp > 0) {
      // Get attack parameters from the scene
      const { baseAttackPower, adjustedVolatility, overallAttackParameter } = await this.getAttackParameters();
      console.log('Boss Attack Parameters:', baseAttackPower, adjustedVolatility, overallAttackParameter);
      // 全体攻撃の条件を満たしているかどうかを判定
      const isAllOutAttack = Object.values(this.stockCounts).some((count) => count >= 11);

      if (isAllOutAttack) {
        // 全体攻撃の場合
        const targets = Object.values(Characters).filter((character) => this.partyMemberStatuses[character].hp > 0);
        enemyActionResult = {
          targets,
          damages: targets.map((target) => {
            const sphereType = CHARACTER_SPHERE_TYPES[target];
            const characterDefense = this.stockCounts[sphereType];
            const globalDefense = this.stockCounts[SphereType.Yellow];
            const totalDefense = characterDefense + globalDefense;
            // chainlink vol + eth price
            const targetDamage = Math.floor(
              overallAttackParameter * (Math.random() * adjustedVolatility + baseAttackPower)
            );
            const finalDamage = Math.max(0, targetDamage - totalDefense);
            this.partyMemberStatuses[target].hp = Math.max(this.partyMemberStatuses[target].hp - finalDamage, 0);
            return finalDamage;
          }),
          deaths: targets.map((target) => this.partyMemberStatuses[target].hp === 0),
        };

        // 全体攻撃の場合は防御に使用したスフィアを消費
        for (const target of targets) {
          const sphereType = CHARACTER_SPHERE_TYPES[target];
          this.stockCounts[sphereType] = 0;
        }
        this.stockCounts[SphereType.Yellow] = 0;
      } else {
        // 単体攻撃の場合（元の処理）
        const target = randomChoice(
          Object.values(Characters).filter((character) => this.partyMemberStatuses[character].hp > 0)
        );

        let damage = Math.floor(Math.random() * adjustedVolatility + baseAttackPower);
        if (turnInputs[target] === BattleActions.Defend) {
          const sphereType = CHARACTER_SPHERE_TYPES[target];
          damage -= this.stockCounts[sphereType] + this.stockCounts[SphereType.Yellow];
          this.stockCounts[sphereType] = 0;
          this.stockCounts[SphereType.Yellow] = 0;
        }

        damage = Math.max(0, damage);
        this.partyMemberStatuses[target].hp = Math.max(this.partyMemberStatuses[target].hp - damage, 0);

        enemyActionResult = {
          target,
          damage,
          death: this.partyMemberStatuses[target].hp === 0,
        };
      }
    }

    return {
      partyActionResults: partyActionResults as TurnResult['partyActionResults'],
      enemyActionResult,
      stockCounts: this.stockCounts,
    };
  }

  async getAttackParameters(): Promise<AttackParameters> {
    try {
      const { baseAttackPower, adjustedVolatility, overallAttackParameter } = await getAttackParametersFromContract();
      return {
        baseAttackPower,
        adjustedVolatility,
        overallAttackParameter,
      };
    } catch (error) {
      console.error('Error getting attack parameters:', error);
      return {
        baseAttackPower: 20,
        adjustedVolatility: 25,
        overallAttackParameter: 0.8,
      };
    }
  }
}

class Skelly {
  scene: BattleScene;
  sprite: Phaser.GameObjects.Sprite;
  ground: Phaser.GameObjects.Image;

  static preload(scene: BaseScene) {
    scene.load.spritesheet('enemySkelly', 'enemies/skelly.png', { frameWidth: 80, frameHeight: 64 });
    scene.load.image('enemySkellyGround', 'enemies/skelly_ground.png');
    scene.load.spritesheet('enemySkellyAttackEffect', 'effects/enemy_attack.png', { frameWidth: 96, frameHeight: 80 });
  }

  static create(scene: BattleScene) {
    scene.anims.create({
      key: 'enemySkellyIdle',
      frameRate: 3,
      frames: scene.anims.generateFrameNumbers('enemySkelly', { start: 0, end: 3 }),
      repeat: -1,
    });
    scene.anims.create({
      key: 'enemySkellyHurt',
      frameRate: 10,
      frames: scene.anims.generateFrameNumbers('enemySkelly', { start: 4, end: 5 }),
      repeat: 0,
    });
    scene.anims.create({
      key: 'enemySkellyAttack',
      frameRate: 10,
      frames: scene.anims.generateFrameNumbers('enemySkelly', { start: 6, end: 18 }),
      repeat: 0,
    });
    scene.anims.create({
      key: 'enemySkellyAttackEffect',
      frameRate: 10,
      frames: scene.anims.generateFrameNumbers('enemySkellyAttackEffect', {
        frames: [7, 7, 7, 0, 1, 2, 1, 3, 4, 5, 5, 6],
      }),
      repeat: 0,
    });
  }

  constructor(scene: BattleScene) {
    this.scene = scene;
    this.ground = scene.add.image(0, 0, 'enemySkellyGround').setDepth(DEPTH_ENTITIES);
    this.sprite = scene.add.sprite(0, 0, 'enemySkellyIdle', 0).setDepth(DEPTH_ENTITIES);

    Align.In.RightCenter(this.sprite, scene.battleBorder, -this.sprite.width - 2);
    Align.To.BottomCenter(this.ground, this.sprite, 3, -9);

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

  async animateHurt(death: boolean) {
    await asyncAnimation(this.sprite, 'enemySkellyHurt');
    if (death) {
      this.scene.soundBattleMusic?.stop();
      this.scene.soundEnemyDeath.play();
      await shake(this.scene, [this.sprite], ShakeAxis.X, [3, -3, -3, 3, -2, 2, -2, 1, -1, 1, -1, 1, -1, 0], 50);
      await asyncTween(this.scene, {
        targets: [this.sprite],
        alpha: 0,
        duration: 400,
        ease: steppedCubicEase(400),
      });
    } else {
      this.sprite.play('enemySkellyIdle');
    }
  }

  async animateAttack(onHit?: () => void) {
    const handleAnimationUpdate = (
      _animation: Phaser.Animations.Animation,
      frame: Phaser.Animations.AnimationFrame
    ) => {
      if (frame.index === 8) {
        this.sprite.off('animationupdate', handleAnimationUpdate);
        onHit?.();

        // Ground shake
        shake(this.scene, [this.ground], ShakeAxis.Y, [1, -1, 0], 50);
      }
    };
    this.sprite.on('animationupdate', handleAnimationUpdate);

    await asyncAnimation(this.sprite, 'enemySkellyAttack');
    this.sprite.play('enemySkellyIdle');
  }

  async animateAttackEffect(x: number, y: number) {
    const effectSprite = this.scene.add.sprite(x, y, 'enemySkellyAttackEffect', 7);
    return asyncAnimation(effectSprite, `enemySkellyAttackEffect`).then(() => effectSprite.destroy());
  }
}

class PartyMember {
  scene: BattleScene;
  character: Characters;
  sprite: Phaser.GameObjects.Sprite;
  ground: Phaser.GameObjects.Image;

  static attackDamageFrame = {
    [Characters.Rojo]: 7,
    [Characters.Blue]: 7,
    [Characters.Midori]: 9,
  };

  static preload(scene: BaseScene) {
    for (const character of Object.values(Characters)) {
      scene.load.spritesheet(`party[${character}]`, `party/${character}.png`, {
        frameWidth: 64,
        frameHeight: 48,
      });
      scene.load.image(`party[${character}]Ground`, `party/${character}_ground.png`);
    }
    scene.load.spritesheet('partyAttackEffects', 'effects/party_attacks.png', { frameWidth: 96, frameHeight: 96 });
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
    const partyAnims: [Characters, string, number[]][] = [
      [Characters.Rojo, 'Attack', [4, 5, 6, 7, 8, 9, 10, 11, 11, 11, 12, 13, 14, 15]],
      [Characters.Rojo, 'Hurt', [16, 17, 17, 17, 18, 18, 19, 20]],
      [Characters.Rojo, 'Death', [21, 22]],
      [Characters.Rojo, 'Victory', [4, 5, 6, 7, 8, 9, 10, 11]],
      [Characters.Blue, 'Attack', [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]],
      [Characters.Blue, 'Hurt', [16, 17, 17, 17, 18, 18, 19, 20]],
      [Characters.Blue, 'Death', [21, 22]],
      [Characters.Blue, 'Victory', [4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
      [Characters.Midori, 'Attack', [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 16, 17, 17]],
      [Characters.Midori, 'Hurt', [18, 19, 19, 19, 20, 20, 21, 22]],
      [Characters.Midori, 'Death', [23, 24]],
      [Characters.Midori, 'Victory', [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 25]],
    ];
    for (const [character, key, frames] of partyAnims) {
      scene.anims.create({
        key: `party[${character}]${key}`,
        frameRate: 10,
        repeat: 0,
        frames: scene.anims.generateFrameNumbers(`party[${character}]`, {
          frames,
        }),
      });
    }

    scene.anims.create({
      key: `party[${Characters.Rojo}]AttackEffect`,
      frameRate: 10,
      repeat: 0,
      frames: scene.anims.generateFrameNumbers('partyAttackEffects', {
        frames: [0, 0, 0, 1, 2, 3, 4, 5],
      }),
    });
    scene.anims.create({
      key: `party[${Characters.Blue}]AttackEffect`,
      frameRate: 10,
      repeat: 0,
      frames: scene.anims.generateFrameNumbers('partyAttackEffects', {
        frames: [0, 0, 6, 7, 8, 9, 10, 11, 12, 13],
      }),
    });
    scene.anims.create({
      key: `party[${Characters.Midori}]AttackEffect`,
      frameRate: 10,
      repeat: 0,
      frames: scene.anims.generateFrameNumbers('partyAttackEffects', {
        frames: [0, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      }),
    });
  }

  constructor(scene: BattleScene, character: Characters) {
    this.scene = scene;
    this.character = character;
    this.ground = scene.add.image(0, 0, `party[${character}]Ground`).setDepth(DEPTH_ENTITIES);
    this.sprite = scene.add.sprite(0, 0, `party[${character}]`, 0).setDepth(DEPTH_ENTITIES);

    switch (character) {
      case Characters.Rojo:
        Align.To.LeftCenter(this.sprite, scene.enemySkelly.sprite, 120, -39);
        break;
      case Characters.Blue:
        Align.To.LeftCenter(this.sprite, scene.enemySkelly.sprite, 140, -8);
        break;
      case Characters.Midori:
        Align.To.LeftCenter(this.sprite, scene.enemySkelly.sprite, 120, 23);
        break;
    }
    Align.To.BottomCenter(this.ground, this.sprite, -1, -9);

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

    // Effect frames are timed to match attack so we can play it without awaiting
    const effectSprite = this.scene.add.sprite(
      this.scene.enemySkelly.sprite.x,
      this.scene.enemySkelly.sprite.y,
      'partyAttackEffects',
      0
    );
    asyncAnimation(effectSprite, `party[${this.character}]AttackEffect`).then(() => effectSprite.destroy());

    await asyncAnimation(this.sprite, `party[${this.character}]Attack`);
    this.sprite.off('animationupdate', handleAnimationUpdate);
    this.sprite.play(`party[${this.character}]Idle`);
  }

  async animateHurt() {
    await asyncAnimation(this.sprite, `party[${this.character}]Hurt`);
    this.sprite.play(`party[${this.character}]Idle`);
  }

  async animateDeath() {
    await asyncAnimation(this.sprite, `party[${this.character}]Death`);
  }

  async animateVictory() {
    await asyncAnimation(this.sprite, `party[${this.character}]Victory`);
  }
}

class FullScreenButton extends Phaser.GameObjects.Sprite {
  static preload(scene: Phaser.Scene) {
    scene.load.spritesheet('fullscreenButton', 'ui/fullscreen_button.png', { frameWidth: 20, frameHeight: 20 });
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'fullscreenButton', 0);
    scene.add.existing(this);

    this.setInteractive({ useHandCursor: true });
    onPointer(this, {
      activate: () => {
        this.setFrame(this.baseFrame + 1);
      },
      deactivate: () => {
        this.setFrame(this.baseFrame);
      },
      click: () => {
        this.scene.scale.toggleFullscreen();
      },
    });

    this.scene.scale.on('enterfullscreen', () => {
      this.setFrame(this.baseFrame);
    });
    this.scene.scale.on('leavefullscreen', () => {
      this.setFrame(this.baseFrame);
    });
  }

  get baseFrame() {
    return this.scene.scale.isFullscreen ? 2 : 0;
  }
}

class PlayButton extends Phaser.GameObjects.Sprite {
  appearing = false;

  static preload(scene: Phaser.Scene) {
    scene.load.spritesheet('playButton', 'ui/play_button.png', { frameWidth: 20, frameHeight: 20 });
  }

  static create(scene: Phaser.Scene) {
    scene.anims.create({
      key: 'playAppear',
      frameRate: 10,
      frames: scene.anims.generateFrameNumbers('playButton', { start: 0, end: 8 }),
      repeat: 0,
    });
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'playButton', 0);
    scene.add.existing(this);

    onPointer(this, {
      activate: () => {
        this.setFrame(9);
      },
      deactivate: () => {
        this.setFrame(8);
      },
      click: () => {
        this.emit('clickplay');
      },
    });
  }

  appear() {
    if (!this.appearing) {
      this.appearing = true;
      this.once('animationcomplete', () => {
        this.setInteractive({ useHandCursor: true });
      });
      this.play('playAppear');
    }
    return this;
  }

  disappear() {
    if (this.appearing) {
      this.appearing = false;
      this.disableInteractive();
      this.playReverse('playAppear');
    }
    return this;
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
  currentHealthText?: Phaser.GameObjects.BitmapText;
  maxHealthText?: Phaser.GameObjects.BitmapText;
  portrait: Phaser.GameObjects.Sprite;
  attackText?: Phaser.GameObjects.BitmapText;

  maxHealth = 0;
  currentHealth = 0;

  static barColors = {
    [HealthBarType.Rojo]: CHARACTER_COLORS[Characters.Rojo],
    [HealthBarType.Blue]: CHARACTER_COLORS[Characters.Blue],
    [HealthBarType.Midori]: CHARACTER_COLORS[Characters.Midori],
    [HealthBarType.Enemy]: TINT_YELLOW,
  };

  static preload(scene: BaseScene) {
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
    maxHealth: number,
    attack: number
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
      this.currentHealthText = scene.add
        .bitmapText(barX + 33, barY - 2, 'numbers', '')
        .setOrigin(1, 0)
        .setTint(TINT_CREAM)
        .setDepth(DEPTH_UI);
      this.maxHealthText = scene.add
        .bitmapText(barX + 33, barY - 2, 'numbers', '')
        .setTint(TINT_CREAM)
        .setDepth(DEPTH_UI);
      this.attackText = scene.add
        .bitmapText(barX + 70, barY - 2, 'sodapop', '')
        .setTint(TINT_CREAM)
        .setDepth(DEPTH_UI)
        .setScale(0.9);
    }

    this.portrait = scene.add
      .sprite(barX - this.barFrame.width / 2 - 8, barY + this.barFrame.height / 2 - 8, 'portraits', type)
      .setDepth(DEPTH_UI);

    this.setHealth(currentHealth, maxHealth);
    this.setAttack(attack, type);
  }

  setHealth(currentHealth: number, maxHealth?: number) {
    this.currentHealth = Math.max(currentHealth, 0);
    this.maxHealth = maxHealth ?? this.maxHealth;

    const percent = this.currentHealth / this.maxHealth;
    this.bar1.width = Math.ceil(percent * this.fullBarWidth);
    this.bar2.width = Math.ceil(percent * this.fullBarWidth);
    this.currentHealthText?.setText(this.currentHealth.toString().padStart(3, ' '));
    this.maxHealthText?.setText(`/${this.maxHealth}`);

    if (this.currentHealth < 1) {
      this.portrait.setFrame(this.type + 4);
    }
  }

  setAttack(attack: number, type: HealthBarType) {
    if (type === HealthBarType.Rojo) {
      this.attackText?.setText(`${attack.toString().padStart(2, '0')} Gwei`);
    } else if (type === HealthBarType.Blue) {
      this.attackText?.setText(`${attack.toString().padStart(2, '0')} Txs`);
    } else {
      this.attackText?.setText(`${attack.toString().padStart(2, '0')} Block`);
    }
  }

  setVisible(visible: boolean) {
    this.barFrame.setVisible(visible);
    this.bar1.setVisible(visible);
    this.bar2.setVisible(visible);
    this.currentHealthText?.setVisible(visible);
    this.maxHealthText?.setVisible(visible);
    this.portrait.setVisible(visible);
    this.attackText?.setVisible(visible);
  }

  async animateDamage(damage: number, color: number = TINT_YELLOW, shouldShake = true) {
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

    // Hurt face
    this.portrait.setFrame(this.type + 4);

    const animations = [
      asyncTween(this.scene, {
        targets: [damageBar1, damageBar2],
        width: 0,
        delay: 400,
        duration: 400,
        completeDelay: 100,
        ease: steppedCubicEase(400),
      }),
    ];

    // Shake bars and portrait
    if (shouldShake) {
      animations.push(
        shake(
          this.scene,
          [this.barFrame, this.bar1, this.bar2, damageBar1, damageBar2],
          ShakeAxis.X,
          [-2, 1, -1, 0],
          50
        ),
        shake(this.scene, [this.portrait], ShakeAxis.X, [-1, 1, 0], 50)
      );

      // Shake and tint current health if available too
      if (this.currentHealthText) {
        const originalX = this.currentHealthText.x;
        animations.push(
          forEachTween(
            this.scene,
            [
              [TINT_RED, 3],
              [TINT_YELLOW, -2],
              [null, 0],
            ],
            50,
            ([tint, xMod]) => {
              this.currentHealthText?.setTint(tint ?? TINT_CREAM);
              this.currentHealthText?.setX(originalX + (xMod ?? 0));
            }
          )
        );
      }
    }
    await Promise.all(animations);

    // Un-hurt face
    if (this.currentHealth > 0) {
      this.portrait.setFrame(this.type);
    }

    damageBar1.destroy();
    damageBar2.destroy();
  }

  async animateRecovery(recoveryAmount: number) {
    const startWidth = this.bar1.width;
    this.setHealth(this.currentHealth + recoveryAmount);
    const recoveryWidth = this.bar1.width - startWidth;

    const recoveryBar1 = this.scene.add
      .rectangle(this.bar1.x + startWidth, this.bar1.y, 0, this.bar1.height, TINT_GREEN)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI);
    const recoveryBar2 = this.scene.add
      .rectangle(this.bar2.x + startWidth, this.bar2.y, 0, this.bar2.height, TINT_GREEN)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI);

    await asyncTween(this.scene, {
      targets: [recoveryBar1, recoveryBar2],
      width: recoveryWidth,
      duration: 400,
      ease: steppedCubicEase(400),
    });

    recoveryBar1.destroy();
    recoveryBar2.destroy();
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

  static preload(scene: BaseScene) {
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

    const topLeft = scene.battleSphereWindow.getTopLeft<Vector2>();
    this.sprite = scene.add
      .sprite(gridX * 14 + topLeft.x + 9, gridY * 14 + topLeft.y + 9, 'battleSpheres', type)
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
  text: Phaser.GameObjects.BitmapText;
  count!: number;

  static preload(scene: BaseScene) {
    scene.load.spritesheet('sphereStockBar', 'ui/stock_bar.png', { frameWidth: 80, frameHeight: 4 });
  }

  constructor(scene: BattleScene, type: SphereType) {
    this.scene = scene;
    this.bar = scene.add.image(0, 0, 'sphereStockBar', type).setDepth(DEPTH_UI);
    Align.In.TopLeft(this.bar, scene.battleSphereStock, -11, -2);
    this.bar.y += type * 6;

    this.mask = scene.add
      .rectangle(0, 0, this.bar.width, this.bar.height, 0x000000)
      .setDepth(DEPTH_UI)
      .setOrigin(1, 0.5);
    Align.In.RightCenter(this.mask, this.bar);

    this.text = scene.add.bitmapText(0, 0, 'numbers', '').setTint(TINT_CREAM).setDepth(DEPTH_UI);
    Align.To.RightTop(this.text, this.bar, 3, 1);

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
    return this.animateSetCount(Math.min(this.count + count, 40));
  }

  async animateSetCount(count: number) {
    await Promise.all([
      asyncTween(this.scene, {
        targets: [this.mask],
        displayWidth: (40 - count) * 2,
        duration: 400,
      }),
      (async () => {
        this.text.setTint(0x3f3e47);
        await wait(this.scene, 100);
        this.text.setText(`${count}`);
        await wait(this.scene, 100);
        this.text.setTint(TINT_CREAM);
      })(),
    ]);

    this.count = count;
  }
}

class IntroState extends State {
  async handleEntered(scene: BattleScene) {
    scene.hideBattleSphereWindow();
    scene.soundBattleMusicAll.play();
    scene.musicCredit.animateText();
    await scene.scene.get<LoadingScene>('loading').countdown();

    const topLeft = scene.battleBorder.getTopLeft<Vector2>();
    const center = scene.battleBorder.getCenter<Vector2>();

    scene.blackoutMask.fillStyle(0xffffff);
    await asyncCounter(scene, {
      from: 0,
      to: scene.battleBorder.width / 2,
      ease: steppedCubicEase(400),
      duration: 400,
      onUpdate(tween) {
        scene.blackoutMask.fillRect(center.x - tween.getValue(), center.y, tween.getValue() * 2, 2);
      },
    });
    await asyncCounter(scene, {
      from: 0,
      to: 91,
      ease: steppedCubicEase(600),
      duration: 600,
      onUpdate(tween) {
        scene.blackoutMask.fillRect(
          topLeft.x,
          center.y - tween.getValue(),
          scene.battleBorder.width,
          tween.getValue() * 2
        );
      },
    });

    this.transition('startActionChoice');
  }
}

class StartActionChoiceState extends State {
  async handleEntered(scene: BattleScene) {
    scene.hideBattleSphereWindow();

    const fadeTweens = [scene.enemySkelly.animateFaded(true)];
    for (const character of scene.activeCharacters.slice(1)) {
      fadeTweens.push(scene.party[character].animateFaded(true));
    }
    await Promise.all(fadeTweens);

    if (scene.battleState.isGameOver) {
      return this.transition('gameOver');
    }

    if (scene.firstRound) {
      scene.dialog.animateScript('-Press action or use \n  arrows and spacebar.');
    }

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

  static preload(scene: BaseScene) {
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
    for (const character of scene.activeCharacters) {
      const partyMember = scene.party[character];
      const actionSprites = {
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

      // Add mouse/touch handlers
      for (const [battleAction, sprite] of Object.entries(actionSprites) as Entries<typeof actionSprites>) {
        onPointer(sprite, {
          hover: () => {
            if (this.menu.cursor !== battleAction) {
              this.menu.moveCursorTo(battleAction);
            }
          },
          click: () => {
            this.menu.select(battleAction);
          },
        });
      }

      scene.actionSprites[character] = actionSprites;
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
        sprite.disableInteractive();
      }
      this.partyMember.animateFaded(true);

      if (this.characterIndex < scene.activeCharacters.length - 1) {
        this.transition('actionChoice', this.characterIndex + 1);
      } else {
        // this.transition('startMovePhase');
        this.transition('quizPhase');
      }
    });
  }

  async handleEntered(scene: BattleScene, characterIndex: number) {
    this.characterIndex = characterIndex;
    this.character = scene.activeCharacters[characterIndex];
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
      sprite.setVisible(true).setInteractive({ useHandCursor: true });
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

class QuizPhaseState extends State {
  scene!: BattleScene;
  questions: typeof quizData = [];
  remainingQuestions: typeof quizData = [];

  currentQuestionIndex = 0;
  dialog!: Dialog;
  dialogOverlay!: Phaser.GameObjects.Rectangle;
  choiceCards!: ChoiceCard[];

  init(scene: BattleScene) {
    this.scene = scene;
    this.loadQuizData();
    this.dialog = new Dialog(scene, scene.battleBorder.x, scene.battleBorder.y - 10, {
      width: 240,
      height: 95,
    }).setDepth(DEPTH_MODAL);
    this.dialogOverlay = this.scene.add
      .rectangle(this.dialog.box.x, this.dialog.box.y, this.dialog.box.width, this.dialog.box.height, 0x000000, 0.5)
      .setDepth(DEPTH_MODAL);

    this.dialog.setVisible(false);
    this.dialogOverlay.setVisible(false);
  }

  handleEntered(scene: BattleScene) {
    if (scene.firstRound) {
      scene.dialog.animateScript(['\n - Press Select Answer']);
    }
    this.dialog.setVisible(true);
    this.showQuestion();
  }

  shuffleQuestions() {
    this.remainingQuestions = [...this.questions];
    for (let i = this.remainingQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.remainingQuestions[i], this.remainingQuestions[j]] = [
        this.remainingQuestions[j],
        this.remainingQuestions[i],
      ];
    }
  }

  loadQuizData() {
    this.questions = quizData;
    this.shuffleQuestions();
  }

  showQuestion() {
    if (this.remainingQuestions.length === 0) {
      this.shuffleQuestions();
    }
    const currentQuestion = this.remainingQuestions.shift()!;
    const questionText = `${currentQuestion.question}\n\n`;
    const choiceText = currentQuestion.choices.map((choice, index) => `${index + 1}. ${choice}`).join('\n');
    this.dialog.setText(questionText + choiceText);

    const dialogBottomCenter = this.dialog.box.getBottomCenter<Vector2>();
    const buttonSpacing = 90;
    const buttonY = dialogBottomCenter.y + 20;

    this.choiceCards = currentQuestion.choices.map((choice, index) => {
      const buttonX = dialogBottomCenter.x + (index - 1) * buttonSpacing;
      const card: any = new ChoiceCard(this.scene, buttonX, buttonY, index + 1, () =>
        this.handleChoiceClick(choice === currentQuestion.answer, card)
      );
      return card;
    });
  }

  async handleChoiceClick(isCorrect: boolean, selectedCard: ChoiceCard) {
    for (const card of this.choiceCards) {
      if (card !== selectedCard) {
        card.destroy();
      }
    }

    await selectedCard.animateSelect();

    await wait(this.scene, 400);

    this.dialogOverlay.setVisible(true);
    // play success or fail Sound
    if (isCorrect) {
      this.scene.quizCorrect = true;
      this.scene.soundSuccess.play();
    } else {
      this.scene.quizCorrect = false;
      this.scene.soundFail.play();
    }
    await selectedCard.animateResult(isCorrect);

    await wait(this.scene, 400);

    const resultText = this.scene.add
      .bitmapText(
        this.scene.cameras.main.centerX,
        this.scene.cameras.main.centerY,
        'sodapop',
        isCorrect ? 'Success' : 'Fail'
      )
      .setOrigin(0.5)
      .setTint(isCorrect ? TINT_GREEN : TINT_RED)
      .setDepth(DEPTH_MODAL)
      .setAlpha(0)
      .setScale(0);

    await Promise.all([
      asyncTween(this.scene, {
        targets: [resultText],
        alpha: 1,
        scale: 1,
        duration: 400,
        ease: Phaser.Math.Easing.Back.Out,
      }),
      asyncTween(this.scene, {
        targets: [resultText],
        alpha: 0,
        scale: 1.2,
        delay: 600,
        duration: 400,
        ease: Phaser.Math.Easing.Cubic.In,
      }),
    ]);

    resultText.destroy();

    selectedCard.destroy();

    if (isCorrect) {
      this.transition('startMovePhase');
    } else {
      await this.animateIncorrect();
      // change all character action to defence
      for (const character of this.scene.activeCharacters) {
        this.scene.currentTurnInputs[character] = BattleActions.Defend;
        // close character action sprite
        for (const [key, sprite] of Object.entries(this.scene.actionSprites[character])) {
          sprite.play({ key: `battleActionDisappearUnselected[${key}]`, hideOnComplete: true });
          sprite.disableInteractive();
        }
      }

      // skip to Enemy's turn
      this.transition('turnResult');
    }
  }

  async animateIncorrect() {
    const originalScale = this.dialog.box.scale;
    const originalTextPosition = { x: this.dialog.text.x, y: this.dialog.text.y };

    await Promise.all([
      asyncTween(this.scene, {
        targets: [this.dialog.box],
        scale: originalScale * 1.1,
        duration: 200,
        yoyo: true,
        repeat: 1,
        ease: Phaser.Math.Easing.Sine.InOut,
      }),
      asyncTween(this.scene, {
        targets: [this.dialog.text],
        x: originalTextPosition.x + 5,
        y: originalTextPosition.y + 5,
        duration: 100,
        yoyo: true,
        repeat: 1,
        ease: Phaser.Math.Easing.Sine.InOut,
      }),
    ]);
  }

  handleExited() {
    this.dialogOverlay.setVisible(false);
    this.dialog.setVisible(false);
  }
}

class ChoiceCard {
  scene: BaseScene;
  box: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.BitmapText;
  choice: number;

  constructor(scene: BaseScene, x: number, y: number, choice: number, onClick: () => void) {
    this.scene = scene;
    this.choice = choice;
    const color = TINT_CREAM;

    this.box = scene.add
      .rectangle(x, y - 5, 60, 20, color)
      .setOrigin(0.5)
      .setDepth(DEPTH_MODAL)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);

    this.text = scene.add
      .bitmapText(x, y, 'sodapop', choice.toString())
      .setOrigin(0.5)
      .setTint(TINT_BLUE)
      .setDepth(DEPTH_MODAL);

    this.scene.input.keyboard?.on('keydown', this.handleKeyDown, this);
  }

  handleKeyDown(event: any) {
    const key = event.key;

    if (parseInt(key) === this.choice) {
      this.box.emit('pointerdown');
    }
  }

  disableInteractive() {
    this.box.disableInteractive();
  }

  async animateSelect() {
    await Promise.all([
      asyncTween(this.scene, {
        targets: [this.box],
        scale: 1.1,
        duration: 200,
        ease: Phaser.Math.Easing.Bounce.Out,
      }),
      asyncTween(this.scene, {
        targets: [this.text],
        scale: 1.1,
        duration: 200,
        ease: Phaser.Math.Easing.Bounce.Out,
      }),
    ]);
  }

  async animateResult(isCorrect: boolean) {
    const targetColor = isCorrect ? TINT_GREEN : TINT_RED;

    await asyncTween(this.scene, {
      targets: [this.box],
      fillColor: targetColor,
      duration: 500,
    });
  }

  destroy() {
    this.scene.input.keyboard?.off('keydown', this.handleKeyDown, this);

    this.box.destroy();
    this.text.destroy();
  }
}

class StartMovePhaseState extends State {
  async handleEntered(scene: BattleScene) {
    scene.showBattleSphereWindow();

    scene.tweens.add({
      targets: [scene.battleSphereWindowOverlay],
      alpha: ALPHA_UNFADED,
      duration: 400,
    });
    scene.playButton.appear();

    if (scene.firstRound) {
      scene.dialog.animateScript([
        '-Match 3 or more\n  to buff actions.<delay>',
        '-Click and drag or hold\n  space to move sphere.<delay>',
        '-Press Play button or\n  Shift to continue.',
      ]);
    }

    return this.transition('movePhase');
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
    const topLeft = this.scene.battleSphereWindow.getTopLeft<Vector2>();
    this.cursorX = clamp(0, x, 7);
    this.cursorY = clamp(0, y, 8);
    this.cursor.setPosition(topLeft.x + 9 + this.cursorX * 14, topLeft.y + 9 + this.cursorY * 14);
  }

  moveCursor(xDiff: number, yDiff: number) {
    this.scene.soundMoveCursor.play();
    this.setCursorPos(this.cursorX + xDiff, this.cursorY + yDiff);
  }

  handlePointerMove = (_pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
    const gridX = Math.floor((localX - 2) / 14);
    const gridY = Math.floor((localY - 2) / 14);
    this.setCursorPos(gridX, gridY);
  };

  handlePointerDown = (_pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
    this.handlePointerMove(_pointer, localX, localY);
    this.transition('swapChoice', this.cursorX, this.cursorY);
  };

  handleClickPlay = () => {
    this.transition('solve');
  };

  handleEntered(scene: BattleScene, toX?: number, toY?: number) {
    this.cursor.setVisible(true);

    if (toX !== undefined && toY !== undefined) {
      this.setCursorPos(toX, toY);
    }

    scene.battleSphereWindow
      .setInteractive({ useHandCursor: true })
      .on('pointermove', this.handlePointerMove)
      .on('pointerdown', this.handlePointerDown);
    scene.playButton.on('clickplay', this.handleClickPlay);

    if (scene.keys.space.isDown || scene.input.activePointer.isDown) {
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
    this.scene.battleSphereWindow
      .disableInteractive()
      .off('pointermove', this.handlePointerMove)
      .off('pointerdown', this.handlePointerDown);
    this.cursor.setVisible(false);
    this.scene.playButton.off('clickplay', this.handleClickPlay);
  }
}

class SwapChoiceState extends State {
  scene!: BattleScene;
  fromX!: number;
  fromY!: number;
  fromSphere!: Sphere;

  init(scene: BattleScene) {
    this.scene = scene;
  }

  handleEntered(scene: BattleScene, fromX: number, fromY: number) {
    this.fromX = fromX;
    this.fromY = fromY;
    this.fromSphere = scene.getSphere(fromX, fromY)!;
    this.fromSphere.select();

    scene.battleSphereWindow
      .setInteractive({ useHandCursor: true })
      .on('pointerup', this.handlePointerUp)
      .on('pointermove', this.handlePointerMove);
  }

  handlePointerUp = () => {
    this.transition('movePhase');
  };

  handlePointerMove = (_pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
    if (this.scene.input.activePointer.isDown) {
      const gridX = clamp(0, Math.floor((localX - 2) / 14), 7);
      const gridY = clamp(0, Math.floor((localY - 2) / 14), 8);
      if (gridY < this.fromY && this.fromY > 0) {
        return this.swap(Direction.Up);
      }
      if (gridY > this.fromY && this.fromY < GRID_HEIGHT - 1) {
        return this.swap(Direction.Down);
      }
      if (gridX < this.fromX && this.fromX > 0) {
        return this.swap(Direction.Left);
      }
      if (gridX > this.fromX && this.fromX < GRID_WIDTH - 1) {
        return this.swap(Direction.Right);
      }
    }
  };

  swap(direction: Direction) {
    return this.transition('swap', this.fromX, this.fromY, direction);
  }

  execute(scene: BattleScene) {
    if (!scene.keys.space.isDown && !scene.input.activePointer.isDown) {
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
    this.scene.battleSphereWindow
      .disableInteractive()
      .off('pointerup', this.handlePointerUp)
      .off('pointermove', this.handlePointerMove);
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
    scene.playButton.disappear();
    scene.dialog.setText('');

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
    scene.clearedSpheresThisTurn = matchGroups.flat().length;
    scene.spheresClearedCount += scene.clearedSpheresThisTurn;
    scene.scoreText.setText(`Score: ${scene.spheresClearedCount.toString()}`);

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
      return this.transition('turnResult');
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

interface DamageAnimation {
  damage: Phaser.Types.Math.Vector2Like[];
  highlight: Phaser.Types.Math.Vector2Like[];
}

const DamageAnimations: { [key: string]: DamageAnimation } = {
  TO_ENEMY: {
    damage: [
      { x: -15, y: 5 },
      { x: -8, y: -3 },
      { x: -6, y: 5 },
      { x: -3, y: -2 },
      { x: -1, y: 1 },
      { x: 0, y: 0 },
    ],
    highlight: [
      { x: -14, y: 6 },
      { x: -6, y: -1 },
      { x: -4, y: 5 },
      { x: -1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 0 },
    ],
  },
  TO_PARTY: {
    damage: [
      { x: -1, y: -3 },
      { x: 2, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 0 },
    ],
    highlight: [
      { x: 3, y: 0 },
      { x: 1, y: -2 },
      { x: 0, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: -1 },
      { x: 0, y: 0 },
    ],
  },
};

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
      .setTint(TINT_CREAM);
  }

  async animateAppear(animation: DamageAnimation) {
    // Manual animation because abstracting this is just too annoying right now without a much better animation
    // abstraction.
    this.highlightSprite.setVisible(true).setPosition(this.x + 1, this.y + 1);
    this.damageSprite.setVisible(true).setPosition(this.x, this.y);

    await Promise.all([
      relativePositionTween(this.scene, [this.damageSprite], animation.damage, 75),
      relativePositionTween(this.scene, [this.highlightSprite], animation.highlight, 75),
    ]);

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
    scene.hideBattleSphereWindow();
    const hideAnimations = [
      asyncTween(scene, {
        targets: [scene.battleSphereWindowOverlay],
        alpha: ALPHA_FADED,
        duration: 400,
      }),
    ];
    for (const character of scene.activeCharacters) {
      const battleAction = scene.currentTurnInputs[character];
      hideAnimations.push(
        asyncAnimation(scene.actionSprites[character][battleAction], {
          key: `battleActionDisappearSelected[${battleAction}]`,
          hideOnComplete: true,
        })
      );
    }
    await Promise.all(hideAnimations);

    const defendingCharacters = scene.activeCharacters.filter(
      (character) => scene.currentTurnInputs[character] === BattleActions.Defend
    );

    if (scene.quizCorrect) {
      for (const character of defendingCharacters) {
        const status = scene.battleState.partyMemberStatuses[character];
        const maxRecovery = status.maxHp - status.hp;
        const baseRecovery = Math.floor(scene.clearedSpheresThisTurn);
        const characterRecovery = scene.battleState.stockCounts[CHARACTER_SPHERE_TYPES[character]];
        const actualRecovery = Math.min(baseRecovery + characterRecovery, maxRecovery);

        if (actualRecovery > 0) {
          status.hp += actualRecovery;
          await scene.partyHealth[character].animateRecovery(actualRecovery);
          await wait(scene, 200);
        }
      }
    }
    const fadeInAnimations = [scene.enemySkelly.animateFaded(false)];
    for (const character of scene.activeCharacters) {
      fadeInAnimations.push(scene.party[character].animateFaded(false));
    }
    await Promise.all(fadeInAnimations);

    const { partyActionResults, enemyActionResult, stockCounts } = (scene.currentTurnResult =
      await scene.battleState.executeTurn(scene.currentTurnInputs));

    // Animate attacks, if needed
    const partyAttacked = Object.values(partyActionResults).some(
      (result) => result?.battleAction === BattleActions.Attack
    );
    if (partyAttacked) {
      await scene.dialog.animateScript('-Attack!');
      await wait(scene, 100);

      const attackResults = Object.values(partyActionResults).filter(
        (result): result is PartyActionResultAttack => result?.battleAction === BattleActions.Attack
      );

      // Prepare damage numbers for display
      const skellyTopLeft = scene.enemySkelly.sprite.getTopLeft<Vector2>();
      const partyDamageNumbers = attackResults.map(
        ({ character, damage }, index) =>
          new DamageNumber(
            scene,
            damage,
            CHARACTER_COLORS[character],
            skellyTopLeft.x + 16 - 3 * index,
            skellyTopLeft.y - 4 + 11 * index
          )
      );

      const attackAnimations: Promise<void>[] = [];
      for (let k = 0; k < attackResults.length; k++) {
        const { character, damage, death } = attackResults[k];
        attackAnimations.push(
          scene.party[character].animateAttack(() => {
            partyDamageNumbers[k].animateAppear(DamageAnimations.TO_ENEMY);
            scene.healthEnemy.animateDamage(damage, CHARACTER_COLORS[character], false);
            scene.enemySkelly.animateHurt(death);

            const sphereType = CHARACTER_SPHERE_TYPES[character];
            scene.stockCounts[sphereType].animateSetCount(stockCounts[sphereType]);
            if (k === 0) {
              scene.stockCounts[SphereType.Key].animateSetCount(stockCounts[SphereType.Key]);
            }
          })
        );
        scene.soundPartyAttack[character].play();
        await wait(scene, 600);
      }

      await Promise.all(attackAnimations);
      await wait(scene, 400);
      await Promise.all(partyDamageNumbers.map((damageNumber) => damageNumber.animateDestroy()));
    }

    if (scene.battleState.isVictory) {
      return this.transition('victory');
    }

    if (enemyActionResult) {
      if (enemyActionResult.targets) {
        // 全体攻撃の場合
        const { targets, damages, deaths } = enemyActionResult;
        if (partyAttacked) {
          await scene.dialog.animateScript('-The <red>Enemy</red> unleashes\n  a devastating attack!');
        } else {
          await scene.dialog.animateScript('-The <red>Enemy</red> unleashes\n  a devastating attack!');
        }

        const enemyAttackAnimations: Promise<void>[] = [
          scene.enemySkelly.animateAttack(async () => {
            const damageNumbers: DamageNumber[] = [];
            const deathAnimations: Promise<void>[] = [];
            for (let i = 0; i < targets.length; i++) {
              const target = targets[i];
              const damage = damages?.[i] || 0;
              const death = deaths?.[i];
              const targetMember = scene.party[target];
              const enemyDamageNumber = new DamageNumber(
                scene,
                damage,
                CHARACTER_COLORS[target],
                targetMember.sprite.x + 16,
                targetMember.sprite.y + 8
              );
              damageNumbers.push(enemyDamageNumber);

              const hurtAnimation = targetMember.animateHurt().then(async () => {
                if (death) {
                  scene.soundPartyDeath.play();
                  scene.battleMusicDeath(target);
                  targetMember.setFaded(true);
                  deathAnimations.push(targetMember.animateDeath());
                }
              });

              enemyAttackAnimations.push(
                shake(scene, [scene.dialog.box], ShakeAxis.Y, [2, -1, 0], 50),
                shake(scene, [scene.dialog.text], ShakeAxis.Y, [0, 2, -1, 0], 50),
                scene.partyHealth[target].animateDamage(damage),
                hurtAnimation,
                enemyDamageNumber.animateAppear(DamageAnimations.TO_PARTY)
              );

              await wait(scene, 200);
            }

            await Promise.all(deathAnimations);

            await wait(scene, 400);
            await Promise.all(damageNumbers.map((damageNumber) => damageNumber.animateDestroy()));
          }),
        ];

        for (const target of targets) {
          const targetMember = scene.party[target];
          enemyAttackAnimations.push(
            scene.enemySkelly.animateAttackEffect(targetMember.sprite.x, targetMember.sprite.y)
          );
        }

        scene.soundEnemyAttack.play();

        await Promise.all(enemyAttackAnimations);
      } else {
        // 単体攻撃の場合（元の処理）
        const { target, damage, death } = enemyActionResult;
        if (partyAttacked) {
          await scene.dialog.animateScript('-The <red>Enemy</red> strikes\n  back!');
        } else {
          await scene.dialog.animateScript('-The <red>Enemy</red> attacks!');
        }

        const targetMember = scene.party[target!];
        const enemyDamageNumber = new DamageNumber(
          scene,
          damage ? damage : 0,
          CHARACTER_COLORS[target!],
          targetMember.sprite.x + 16,
          targetMember.sprite.y + 8
        );
        const enemyAttackAnimations: Promise<void>[] = [
          scene.enemySkelly.animateAttack(() => {
            const hurtAnimation = targetMember.animateHurt().then(async () => {
              if (death) {
                scene.soundPartyDeath.play();
                scene.battleMusicDeath(target!);
                targetMember.setFaded(true);
                await targetMember.animateDeath();
              }
            });
            enemyAttackAnimations.push(
              shake(scene, [scene.dialog.box], ShakeAxis.Y, [2, -1, 0], 50),
              shake(scene, [scene.dialog.text], ShakeAxis.Y, [0, 2, -1, 0], 50),
              scene.partyHealth[target!].animateDamage(damage ? damage : 0),
              hurtAnimation,
              enemyDamageNumber.animateAppear(DamageAnimations.TO_PARTY)
            );

            if (partyActionResults[target!]?.battleAction === BattleActions.Defend) {
              const sphereType = CHARACTER_SPHERE_TYPES[target!];
              enemyAttackAnimations.push(
                scene.stockCounts[sphereType].animateSetCount(stockCounts[sphereType]),
                scene.stockCounts[SphereType.Yellow].animateSetCount(stockCounts[SphereType.Yellow])
              );
            }
          }),
          scene.enemySkelly.animateAttackEffect(targetMember.sprite.x, targetMember.sprite.y),
        ];
        scene.soundEnemyAttack.play();

        await Promise.all(enemyAttackAnimations);
        await wait(scene, 400);
        await enemyDamageNumber.animateDestroy();
      }
    }

    scene.dialog.setText('');
    scene.firstRound = false;
    return this.transition('startActionChoice');
  }
}

class EndCard {
  scene: BaseScene;
  box: Phaser.GameObjects.NineSlice;
  text: Phaser.GameObjects.BitmapText;
  portrait: Phaser.GameObjects.Image;

  constructor(scene: BaseScene, x: number, y: number, portrait: string, text: string, color: number, href: string) {
    this.scene = scene;
    this.box = scene.add.nineslice(x, y, 'dialogSlice', 0, 105, 46, 1, 1, 1, 2).setDepth(DEPTH_MODAL).setVisible(false);

    onPointer(this.box, {
      activate: () => {
        window.open(href, '_blank');
      },
    });

    const boxTopLeft = this.box.getTopLeft<Vector2>();
    this.text = scene.add
      .bitmapText(boxTopLeft.x + 36, boxTopLeft.y + 8, 'sodapop', text)
      .setTint(TINT_CREAM)
      .setMaxWidth(this.box.width - 28)
      .setDepth(DEPTH_MODAL)
      .setVisible(false)
      .setCharacterTint(0, text.indexOf('\n'), true, color);
    this.portrait = scene.add
      .image(boxTopLeft.x + 18, boxTopLeft.y + 22, portrait)
      .setDepth(DEPTH_MODAL)
      .setVisible(false);
  }

  async animateAppear() {
    const initialWidth = this.box.width;
    const initialHeight = this.box.height;

    const textMask = this.scene.make.graphics().fillStyle(0xffffff);
    this.text.setMask(textMask.createGeometryMask()).setVisible(true);
    this.portrait.setMask(textMask.createGeometryMask()).setVisible(true);

    this.box.setSize(3, 4).setVisible(true);
    await asyncTween(this.scene, {
      targets: [this.box],
      width: initialWidth,
      ease: steppedCubicEase(400),
      duration: 400,
    });
    await asyncTween(this.scene, {
      targets: [this.box],
      height: initialHeight,
      ease: steppedCubicEase(600),
      duration: 600,
      onUpdate: () => {
        const topLeft = this.box.getTopLeft<Phaser.Math.Vector2>();
        textMask.fillRect(topLeft.x, topLeft.y + 1, this.box.width, this.box.height - 3);
      },
    });

    this.box.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(0, 0, this.box.width, this.box.height),
      callback: Phaser.Geom.Rectangle.Contains,
    });

    this.text.clearMask();
    this.portrait.clearMask();
  }
}
class MintButton {
  scene: BaseScene;
  box: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.BitmapText;
  x: number;
  y: number;

  constructor(scene: BaseScene, x: number, y: number, onClick: () => void) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    const width = 60;
    const height = 20;
    this.box = scene.add
      .rectangle(x, y + 10, width, height, TINT_CREAM)
      .setOrigin(0.5)
      .setDepth(DEPTH_MODAL)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);

    this.text = scene.add
      .bitmapText(x, y + 15, 'sodapop', ' Mint ')
      .setOrigin(0.5)
      .setTint(0x000000)
      .setDepth(DEPTH_MODAL)
      .setVisible(false);
  }

  async animateAppear() {
    this.box.setVisible(true);
    this.text.setVisible(true);

    await Promise.all([
      asyncTween(this.scene, {
        targets: [this.box],
        scale: 1.1,
        duration: 400,
        ease: Phaser.Math.Easing.Back.Out,
        yoyo: true,
      }),
      asyncTween(this.scene, {
        targets: [this.text],
        scale: 1.1,
        duration: 400,
        ease: Phaser.Math.Easing.Back.Out,
        yoyo: true,
      }),
    ]);
  }
  destroy() {
    this.box.destroy();
    this.text.destroy();
  }
}

class EndState extends State {
  fadeRect!: Phaser.GameObjects.Rectangle;
  dialog!: Dialog;
  message: string;
  music: Phaser.Sound.BaseSound;
  endCards!: EndCard[];
  analyticsEndType: string;
  walletClient: any;
  mintButton!: MintButton;
  chest!: Phaser.GameObjects.Image;
  treasure!: Phaser.GameObjects.Image;

  static preload(scene: BaseScene) {
    scene.load.image('portraitPhi', 'ui/phi.png');
    scene.load.image('portraitZak', 'ui/zak3939.png');
    scene.load.image('portraitGithub', 'ui/github.png');
  }

  constructor(message: string, music: Phaser.Sound.BaseSound, analyticsEndType: string) {
    super();
    this.message = message;
    this.music = music;
    this.analyticsEndType = analyticsEndType;

    try {
      this.walletClient = createWalletClient({
        chain: scrollSepolia,
        transport: custom((window as any).ethereum),
      });
    } catch (error) {
      console.error('Error initializing wallet client:', error);
    }
  }

  init(scene: BattleScene) {
    this.fadeRect = scene.add
      .rectangle(
        scene.battleBorder.x,
        scene.battleBorder.y,
        scene.battleBorder.width,
        scene.battleBorder.height,
        0x000000,
        1
      )
      .setAlpha(0)
      .setDepth(DEPTH_MODAL);

    this.dialog = new Dialog(scene, scene.battleBorder.x, scene.battleBorder.y - 20)
      .setText(this.message, true)
      .setVisible(false)
      .setDepth(DEPTH_MODAL);
    this.dialog.text.setCenterAlign();

    const bottomLeft = scene.battleBorder.getBottomLeft<Vector2>();
    this.endCards = [
      new EndCard(
        scene,
        bottomLeft.x + 57,
        bottomLeft.y - 26,
        'portraitZak',
        'Zak3939\nGame\nCreator',
        TINT_RED,
        'https://twitter.com/ZacK_3939'
      ),
      new EndCard(
        scene,
        bottomLeft.x + 164,
        bottomLeft.y - 26,
        'portraitPhi',
        'Proposal\nAdd\nQuiz Here',
        TINT_BLUE,
        'https://forms.gle/AUJ8YaX9wsexi8ie7'
      ),
      new EndCard(
        scene,
        bottomLeft.x + 271,
        bottomLeft.y - 26,
        'portraitGithub',
        'Source\navailable\non Github',
        TINT_GREEN,
        'https://github.com/ZaK3939/sphere-quiz'
      ),
    ];
  }

  async handleEntered(scene: BattleScene) {
    window.plausible(this.analyticsEndType);
    scene.dialog.setText('');
    await asyncTween(scene, {
      targets: [scene.soundBattleMusic],
      volume: 0,
      duration: 100,
    });
    this.music.play();
    await Promise.all(scene.activeCharacters.map((character) => scene.party[character].animateVictory()));
    await wait(scene, 300);

    if (this.analyticsEndType === 'EndVictory') {
      await Promise.all(scene.activeCharacters.map((character) => scene.party[character].animateVictory()));
      await wait(scene, 300);

      const bossPosition = scene.enemySkelly.sprite.getCenter();
      this.chest = scene.add.image(bossPosition.x, bossPosition.y + 25, 'chest').setDepth(DEPTH_ENTITIES);
      this.chest.setScale(0.01);
    }

    await asyncTween(scene, {
      targets: [this.fadeRect],
      alpha: 0.8,
      duration: 500,
    });
    this.dialog.animateAppear();

    if (this.analyticsEndType === 'EndVictory') {
      const score = scene.spheresClearedCount;

      const dialogBottomCenter = this.dialog.box.getBottomCenter<Vector2>();
      this.mintButton = new MintButton(scene, dialogBottomCenter.x, dialogBottomCenter.y + 28, () =>
        this.handleMintButtonClick(score, scene)
      );
      await this.mintButton.animateAppear();
    }

    for (const endCard of this.endCards) {
      await wait(scene, 300);
      endCard.animateAppear();
    }
  }

  async handleMintButtonClick(score: number, scene: BattleScene) {
    if (!this.walletClient) {
      console.error('Wallet client not initialized');
      return;
    }

    try {
      const [address] = await this.walletClient.getAddresses();

      const currentChainId = await this.walletClient.getChainId();

      const targetChainId = scrollSepolia.id;

      if (currentChainId !== targetChainId) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetChainId.toString(16)}` }],
          });
          console.log('Network switched to Scroll');
        } catch (error) {
          console.error('Error switching network:', error);
          alert('Please switch to the Scroll network in your wallet.');
          return;
        }
      }

      const signature = await signMintData(address, score);

      console.log(`Minting NFT (${SPHERE_QUIZ_NFT_ADDRESS}) for`, address, 'with score', score);

      const tx = await this.walletClient.sendTransaction({
        account: address,
        chain: scrollSepolia,
        to: SPHERE_QUIZ_NFT_ADDRESS,
        data: encodeFunctionData({
          abi: [
            {
              type: 'function',
              name: 'mint',
              inputs: [
                { name: 'to', type: 'address', internalType: 'address' },
                { name: 'score', type: 'uint256', internalType: 'uint256' },
                { name: 'sig', type: 'bytes', internalType: 'bytes' },
              ],
              outputs: [],
              stateMutability: 'payable',
            },
          ],
          functionName: 'mint',
          args: [address, BigInt(score), signature],
        }),
        value: parseEther('0.00001'),
      });

      console.log('NFT minted:', tx);

      this.mintButton.destroy();

      const dialogBottomCenter = this.dialog.box.getBottomCenter<Vector2>();
      const chestOwnedText = scene.add
        .bitmapText(dialogBottomCenter.x, dialogBottomCenter.y + 28, 'sodapop', 'Treasure Chest Key Acquired!')
        .setOrigin(0.5)
        .setTint(TINT_CREAM)
        .setDepth(DEPTH_MODAL)
        .setScale(0.9);

      await asyncTween(scene, {
        targets: [chestOwnedText],
        alpha: { from: 0, to: 1 },
        duration: 500,
      });

      const scrollSepoliaClient = createPublicClient({
        chain: scrollSepolia,
        transport: http(),
      });
      scrollSepoliaClient.watchContractEvent({
        address: SPHERE_QUIZ_NFT_ADDRESS,
        abi: SphereQuizGameNFTAbi.abi,
        eventName: 'ChestOpened',
        onLogs: (log: any) => {
          const [player, ethAmount] = log.args;
          console.log('Player:', player, 'Eth Amount:', ethAmount);

          this.chest.destroy();
          const bossPosition = scene.enemySkelly.sprite.getCenter();
          this.treasure = scene.add.image(bossPosition.x, bossPosition.y + 25, 'chest').setDepth(DEPTH_ENTITIES);
          this.treasure.setScale(0.05);
          this.dialog.setText('Congratulations!\n Got treasure chest!');
        },
      });
    } catch (error) {
      console.error('Error minting NFT:', error);
    }
  }
}
