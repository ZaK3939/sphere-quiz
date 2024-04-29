import BaseScene from 'gate/scenes/base';
import BattleScene from 'gate/scenes/battle';
import { asyncAnimation, asyncLoad } from 'gate/util';
import { createPublicClient, createWalletClient, http, custom, Address } from 'viem';
import { scroll } from 'viem/chains';
import { getbossHp } from 'gate/scrollCall';

interface MintKeyEvent {
  keyId: string;
  player: string;
  score: string;
  to: string;
  tokenId: string;
}

interface Response {
  data: {
    mintKeyEvents: MintKeyEvent[];
  };
}

export default class LoadingScene extends BaseScene {
  loadingCount!: Phaser.GameObjects.Sprite;
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  walletConnected: boolean = false;
  resourcesLoaded: boolean = false;
  connectButton!: Phaser.GameObjects.Text;
  battleScene!: BattleScene;
  titleText!: Phaser.GameObjects.BitmapText;
  topScoreText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super({
      key: 'loading',
    });
    const SCROLL_RPC_URL = import.meta.env.VITE_SCROLL_RPC_URL;

    this.publicClient = createPublicClient({
      chain: scroll,
      transport: http(SCROLL_RPC_URL),
    });

    this.walletClient = createWalletClient({
      chain: scroll,
      transport: custom((window as any).ethereum),
    });
  }

  preload() {
    this.load.spritesheet('loadingCount', 'ui/loading_count.png', { frameWidth: 20, frameHeight: 20 });
    this.load.bitmapFont('pixelFont', 'font/square_6x6.png', 'font/square_6x6.xml');
  }

  create() {
    this.fetchTopScore(); //Get top score from Graph
    // アニメーションの設定
    this.anims.create({
      key: 'loadingWait',
      frameRate: 10,
      frames: this.anims.generateFrameNumbers('loadingCount', { frames: [0, 1, 2, 1] }),
      repeat: -1,
    });

    this.anims.create({
      key: 'loadingToStart',
      frameRate: 10,
      frames: this.anims.generateFrameNumbers('loadingCount', { frames: [3, 4, 5, 6] }),
      repeat: 0,
    });

    this.anims.create({
      key: 'loadingStartToEmpty',
      frameRate: 10,
      frames: this.anims.generateFrameNumbers('loadingCount', { frames: [6, 5, 4] }),
      repeat: 0,
    });

    this.anims.create({
      key: 'loadingCountdown',
      frameRate: 10,
      frames: this.anims.generateFrameNumbers('loadingCount', {
        frames: [8, 9, 10, 10, 11, 12, 13, 13, 14, 15, 16, 16, 17, 18, 19, 20, 21, 22, 23],
      }),
      repeat: 0,
    });

    this.loadingCount = this.add
      .sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'loadingCount')
      .play('loadingWait'); // 初期アニメーション

    this.titleText = this.add
      .bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 50, 'pixelFont', 'SPHERE QUIZ', 32)
      .setOrigin(0.5)
      .setTint(0xffffff)
      .setLetterSpacing(2);

    this.topScoreText = this.add
      .bitmapText(this.cameras.main.centerX, this.cameras.main.centerY + 80, 'pixelFont', 'Top Score: -', 16)
      .setOrigin(0.5)
      .setTint(0xffffff);

    this.connectButton = this.add
      .text(this.cameras.main.centerX, this.cameras.main.centerY + 50, 'Loading...', {
        fontSize: '20px',
        color: '#fff',
      })
      .setOrigin(0.5);

    // リソースロード処理
    this.battleScene = this.scene.get('battle') as BattleScene;
    asyncLoad(this, () => {
      this.battleScene.loadResources(this); // リソースロード
    }).then(() => {
      this.resourcesLoaded = true; // リソースロード完了
      this.connectButton.setText('Connect Wallet');
      this.connectButton.setInteractive({ useHandCursor: true });
      this.connectButton.on('pointerdown', this.onConnect);
    });
  }

  private onConnect = async () => {
    if (!(window as any).ethereum) {
      console.error('Ethereum wallet not found. Please install MetaMask or a similar wallet.');
      return;
    }

    try {
      const [address] = await this.walletClient.requestAddresses();
      this.walletConnected = true; // ウォレット接続完了

      this.connectButton.setText('Battle Ready'); // ウォレット接続後にテキストを変更
      this.checkTransition(address); // トランジションチェック
    } catch (error) {
      console.error('WalletConnect Error:', error);
    }
  };

  private async fetchTopScore() {
    try {
      const query = `
        query {
          mintKeyEvents(orderBy: score, orderDirection: desc, first: 1) {
            score
          }
        }
      `;

      const response = await fetch('https://api.studio.thegraph.com/query/29168/spherequizgamenft/v0.0.1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: Response = await response.json();
      if (data.data.mintKeyEvents.length > 0) {
        const topScore = data.data.mintKeyEvents[0].score;
        this.topScoreText.setText(`Top Score: ${topScore}`);
      }
    } catch (error) {
      console.error('Error fetching top score:', error);
    }
  }

  private checkTransition = async (address: Address) => {
    if (this.walletConnected && this.resourcesLoaded) {
      // 両方の完了を確認
      this.loadingCount.play('loadingToStart'); // ロード完了アニメーション

      this.loadingCount.on('pointerdown', () => {
        this.loadingCount.setFrame(7);
      });

      this.loadingCount.on('pointerup', async () => {
        this.loadingCount.disableInteractive(); // インタラクションを無効化
        if (this.walletClient) {
          const bossHp = await getbossHp(); // ボスHPを取得
          console.log('bossHp:', bossHp);
          await asyncAnimation(this.loadingCount, 'loadingStartToEmpty'); // ロード完了アニメーション

          await this.battleScene.setBattleState(address, Number(bossHp)); // バトルステートを設定
          this.scene.run('battle'); // バトルシーンを開始
        } else {
          console.error('Wallet client not initialized');
        }
      });

      this.loadingCount.setInteractive({ useHandCursor: true });
    }
  };

  async loadTransaction() {
    this.topScoreText.setText(`Getting Histrory...`);
  }

  async setParameter() {
    this.topScoreText.setText(`Creating Characters...`);
  }

  async countdown() {
    this.topScoreText.setText(`Game is ready!`);
    await asyncAnimation(this.loadingCount, 'loadingCountdown'); // カウントダウン
    this.scene.stop(); // シーンを停止
  }
  update() {}
}
