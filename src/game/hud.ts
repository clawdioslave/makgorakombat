import { BRAND } from '../engine/brand';
import type { Match } from '../engine/engine';
import { HALF, HP, ROUND_FRAMES } from '../engine/stage';

/*
 * What is drawn over the ring: the bars, the clock, the round pips, the words that slam in,
 * the ground line, the hit sparks and the spell in flight. Plain 2D canvas, redrawn each frame.
 */

export type Project = (point: readonly [number, number, number]) => [number, number] | undefined;

const SERIF = "'Cinzel', 'Palatino', serif";
const HEAVY = "'Metal Mania', 'Impact', sans-serif";

export function drawHud(ctx: CanvasRenderingContext2D, width: number, height: number, match: Match, names: [string, string], project: Project, debug?: string): void {
  ctx.clearRect(0, 0, width, height);
  const unit = Math.min(width / 1280, height / 720);
  ctx.save();
  ctx.scale(unit, unit);
  const w = width / unit;
  const h = height / unit;

  // The ground line, where the fighters' feet are.
  const left = project([-HALF - 0.5, 0, 0]);
  const right = project([HALF + 0.5, 0, 0]);
  if (left && right) {
    const gradient = ctx.createLinearGradient(left[0] / unit, 0, right[0] / unit, 0);
    gradient.addColorStop(0, 'rgba(255, 209, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 209, 0, 0.55)');
    gradient.addColorStop(1, 'rgba(255, 209, 0, 0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left[0] / unit, left[1] / unit + 2);
    ctx.lineTo(right[0] / unit, right[1] / unit + 2);
    ctx.stroke();
  }

  // Health bars: player 1 drains toward the middle from the left, player 2 from the right.
  const barWidth = w * 0.4;
  const barHeight = 26;
  const top = 28;
  match.fighters.forEach((fighter, i) => {
    const x0 = i === 0 ? 40 : w - 40 - barWidth;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x0 - 3, top - 3, barWidth + 6, barHeight + 6);
    const trail = Math.max(0, Math.min(1, fighter.shownHp / HP));
    const life = Math.max(0, Math.min(1, fighter.hp / HP));
    const fill = (share: number, colour: string) => {
      ctx.fillStyle = colour;
      const length = barWidth * share;
      // What is left stays at the outer edge; damage eats the bar from the middle of the screen.
      ctx.fillRect(i === 0 ? x0 : x0 + barWidth - length, top, length, barHeight);
    };
    fill(1, '#3a0c0c');
    fill(trail, '#f4f1e6');
    fill(life, life > 0.3 ? '#c8121c' : '#ff5a2a');
    ctx.strokeStyle = '#ffd100';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, top, barWidth, barHeight);
    // The name, and a pip for each round won.
    ctx.fillStyle = '#ffd100';
    ctx.font = `700 18px ${SERIF}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = i === 0 ? 'left' : 'right';
    ctx.fillText(names[i]!, i === 0 ? x0 : x0 + barWidth, top + barHeight + 8);
    for (let pip = 0; pip < 2; pip++) {
      const cx = i === 0 ? x0 + barWidth - 14 - pip * 24 : x0 + 14 + pip * 24;
      ctx.beginPath();
      ctx.arc(cx, top + barHeight + 18, 7, 0, Math.PI * 2);
      ctx.fillStyle = pip < fighter.wins ? '#ffd100' : 'rgba(0,0,0,0.5)';
      ctx.fill();
      ctx.strokeStyle = '#ffd100';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  // The clock.
  const seconds = Math.max(0, Math.ceil(match.timer / 60));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `48px ${HEAVY}`;
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#1a0606';
  ctx.strokeText(String(seconds), w / 2, top - 6);
  ctx.fillStyle = seconds <= 10 ? '#ff5a2a' : '#f4f1e6';
  ctx.fillText(String(seconds), w / 2, top - 6);
  ctx.font = `700 13px ${SERIF}`;
  ctx.fillStyle = '#ffd100';
  ctx.fillText(BRAND.round(match.round), w / 2, top + 48);
  ctx.fillText(`${match.fighters[0].wins} – ${match.fighters[1].wins}`, w / 2, top + 66);

  // Sparks where a blow landed, and the spell in flight.
  for (const spark of match.sparks) {
    const at = project([spark.x, 0, spark.z]);
    if (!at) continue;
    const [sx, sy] = [at[0] / unit, at[1] / unit];
    const life = Math.max(0, 1 - spark.t / Math.max(1, spark.life));
    const colour = spark.kind === 'block' ? '140, 200, 255' : spark.kind === 'crit' ? '255, 120, 40' : '255, 220, 90';
    ctx.strokeStyle = `rgba(${colour}, ${life})`;
    ctx.lineWidth = 3 * life + 1;
    const rays = spark.kind === 'block' ? 6 : 10;
    const reach = 18 + spark.t * 4;
    for (let r = 0; r < rays; r++) {
      const angle = (r / rays) * Math.PI * 2 + spark.t * 0.1;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(angle) * reach * 0.35, sy + Math.sin(angle) * reach * 0.35);
      ctx.lineTo(sx + Math.cos(angle) * reach, sy + Math.sin(angle) * reach);
      ctx.stroke();
    }
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const shot of match.projectiles) {
    for (let trail = 5; trail >= 0; trail--) {
      const at = project([shot.x - shot.vx * trail * 2, 0, shot.z]);
      if (!at) continue;
      const [sx, sy] = [at[0] / unit, at[1] / unit];
      const radius = 22 - trail * 3;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      glow.addColorStop(0, `rgba(255, 255, 220, ${trail === 0 ? 0.95 : 0.25})`);
      glow.addColorStop(0.4, `rgba(120, 200, 255, ${trail === 0 ? 0.7 : 0.15})`);
      glow.addColorStop(1, 'rgba(60, 120, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // The words: ROUND 1, FIGHT!, FINISH THE MAK'GORA!, K.O., DISHONOR!
  if (match.banner) {
    const { text, sub, t, life } = match.banner;
    const grow = Math.min(1, t / 8);
    const scale = 1.6 - 0.6 * (1 - Math.pow(1 - grow, 3));
    const fade = life > 0 ? Math.min(1, Math.max(0, (life - t) / 12)) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(w / 2, h * 0.42);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const colourOf = (line: string) => (line === BRAND.fatality ? '#ff2a2a' : line === BRAND.flawless ? '#7bd88f' : '#ffd100');
    const long = text.length > 12;
    ctx.font = `${long ? 64 : 96}px ${HEAVY}`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#2a0606';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = colourOf(text);
    ctx.fillText(text, 0, 0);
    if (sub) {
      ctx.font = `36px ${HEAVY}`;
      ctx.lineWidth = 6;
      ctx.strokeText(sub, 0, long ? 52 : 72);
      ctx.fillStyle = colourOf(sub);
      ctx.fillText(sub, 0, long ? 52 : 72);
    }
    ctx.restore();
  }

  if (match.phase === 'intro' && match.round === 1) {
    ctx.font = `700 13px ${SERIF}`;
    ctx.fillStyle = 'rgba(244, 241, 230, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('P1  A D move · W jump · J light · K heavy · L spell · U block        P2  ← → · ↑ · , light · . heavy · / spell · Right Shift block', w / 2, h - 16);
  }
  if (match.phase === 'matchEnd') {
    ctx.font = `700 22px ${SERIF}`;
    ctx.fillStyle = '#ffd100';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('ENTER  rematch        ESC  new champions', w / 2, h - 40);
  }
  if (debug) {
    ctx.font = '12px monospace';
    ctx.fillStyle = '#7bd88f';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(debug, 12, h - 8);
  }
  ctx.restore();
}

export const roundSeconds = ROUND_FRAMES / 60;
