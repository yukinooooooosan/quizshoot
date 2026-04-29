// mob_sprites.js - 通常敵モブのピクセルスプライト定義

export const ENEMY_PIXEL = 4;

export const MOB_DEFS = [
  {
    id: 'scout',
    name: 'SCOUT',
    color: '#6bcb77',
    frameDuration: 24,
    frames: [
      [
        '0001000',
        '0011100',
        '0111110',
        '1101011',
        '1111111',
        '0100010',
        '1000001',
      ],
      [
        '0001000',
        '1011101',
        '0111110',
        '1101011',
        '1111111',
        '0010100',
        '0100010',
      ],
    ],
  },
  {
    id: 'guard',
    name: 'GUARD',
    color: '#4d96ff',
    frameDuration: 24,
    frames: [
      [
        '0100010',
        '0010100',
        '0111110',
        '1101011',
        '1111111',
        '0010100',
        '0100010',
      ],
      [
        '1000001',
        '0010100',
        '0111110',
        '1101011',
        '1111111',
        '0100010',
        '1000001',
      ],
    ],
  },
  {
    id: 'drone',
    name: 'DRONE',
    color: '#ff6b6b',
    frameDuration: 24,
    frames: [
      [
        '0011100',
        '0111110',
        '1111111',
        '1010101',
        '1111111',
        '0100010',
        '0010100',
      ],
      [
        '0011100',
        '1111111',
        '0111110',
        '1010101',
        '1111111',
        '1000001',
        '0100010',
      ],
    ],
  },
];

export const ENEMY_SPRITE_COUNT = MOB_DEFS.length;
export const DEFAULT_MOB_IDS = MOB_DEFS.map(sprite => sprite.id);

function getMobSprite(mobId) {
  return MOB_DEFS.find(sprite => sprite.id === mobId) || MOB_DEFS[0];
}

export function getMobIdByIndex(index) {
  return DEFAULT_MOB_IDS[index % DEFAULT_MOB_IDS.length];
}

export function drawEnemyMob(ctx, enemy, x, y, frameCount = 0, animationSpeed = 1) {
  const sprite = getMobSprite(enemy.mobId);
  const frameIndex = Math.floor((frameCount * animationSpeed) / sprite.frameDuration) % sprite.frames.length;
  const frame = sprite.frames[frameIndex];
  const color = enemy.color || sprite.color;

  ctx.save();
  ctx.shadowBlur = 6;
  ctx.shadowColor = color;
  ctx.fillStyle = color;

  for (let r = 0; r < frame.length; r++) {
    const row = frame[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '0') {
        ctx.fillRect(x + c * ENEMY_PIXEL, y + r * ENEMY_PIXEL, ENEMY_PIXEL, ENEMY_PIXEL);
      }
    }
  }

  ctx.restore();
}
