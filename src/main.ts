import Phaser from 'phaser';
import BattleScene from 'gate/scenes/battle';
import LoadingScene from 'gate/scenes/loading';

class MobileMessageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MobileMessage' });
  }

  create() {
    const message = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'This game is not compatible with mobile devices.\nPlease play on a PC.',
      {
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
      }
    );
    message.setOrigin(0.5);
  }
}

declare global {
  const IS_DEV_MODE: boolean;
  interface Window {
    game: Phaser.Game;
  }
}

window.addEventListener('load', () => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const sceneList: Phaser.Scene[] = [new LoadingScene(), new BattleScene()];
  if (isMobile) {
    sceneList.unshift(new MobileMessageScene());
  }

  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    height: 202,
    width: 350,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
    },
    backgroundColor: '#000',
    render: {
      pixelArt: true,
    },
    scene: sceneList,
  });
});
