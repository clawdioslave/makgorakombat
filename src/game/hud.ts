import { GCD_FRAMES, MAX_RESOURCE, RESOURCE_COLOURS, RESOURCE_NAMES } from '../engine/abilities';
import { BRAND } from '../engine/brand';
import { abilityBlocked, type FloatingText, type Match } from '../engine/engine';
import { type InputAction, keyLabel } from '../engine/input';
import { HALF, HP, ROUND_FRAMES } from '../engine/stage';

/*
 * What is drawn over the ring: the bars, the clock, the round pips, the words that slam in,
 * each fighter's action bar with its cooldowns, the nameplates with their cast bars, the
 * numbers and words that float off a hit, the ground line, the hit sparks and the spells in
 * flight. Plain 2D canvas, redrawn each frame.
 */

export type Project = (point: readonly [number, number, number]) => [number, number] | undefined;

const SERIF = "'Cinzel', 'Palatino', serif";
const HEAVY = "'Metal Mania', 'Impact', sans-serif";
const GOLD = '#ffd100';
const BONE = '#f4f1e6';
/** Where a nameplate sits: this far above the feet. */
const HEAD = 2.3;

const ABILITY_KEYS: readonly InputAction[] = ['ability1', 'ability2', 'ability3', 'ability4'];

export function drawHud(ctx: CanvasRenderingContext2D, width: number, height: number, match: Match, names: [string, string], project: Project, debug?: string): void {
  ctx.clearRect(0, 0, width, height);
  const unit = Math.min(width / 1280, height / 720);
  ctx.save();
  ctx.scale(unit, unit);
  const w = width / unit;
  const h = height / unit;
  /** A world point in HUD units. */
  const at = (point: readonly [number, number, number]): [number, number] | undefined => {
    const p = project(point);
    return p ? [p[0] / unit, p[1] / unit] : undefined;
  };

  groundLine(ctx, at);
  healthBars(ctx, w, match, names);
  clock(ctx, w, match);
  nameplates(ctx, match, names, at);
  sparks(ctx, match, at);
  projectiles(ctx, match, at);
  floatingTexts(ctx, match, at);
  actionBars(ctx, w, h, match);
  banner(ctx, w, h, match);

  if (match.phase === 'intro' && match.round === 1) {
    ctx.font = `700 13px ${SERIF}`;
    ctx.fillStyle = 'rgba(244, 241, 230, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const keys = (p: 0 | 1) => ABILITY_KEYS.map((a) => keyLabel(p, a)).join(' ');
    ctx.fillText(
      `P1  ${keyLabel(0, 'left')} ${keyLabel(0, 'right')} move · ${keyLabel(0, 'jump')} jump · ${keyLabel(0, 'attack')} attack · ${keys(0)} abilities        P2  ${keyLabel(1, 'left')} ${keyLabel(1, 'right')} · ${keyLabel(1, 'jump')} · ${keyLabel(1, 'attack')} attack · ${keys(1)} abilities`,
      w / 2,
      h - 100,
    );
  }
  if (match.phase === 'matchEnd') {
    ctx.font = `700 22px ${SERIF}`;
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('ENTER  rematch        ESC  new champions', w / 2, h - 110);
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

/** The ground line, where the fighters' feet are. */
function groundLine(ctx: CanvasRenderingContext2D, at: (p: readonly [number, number, number]) => [number, number] | undefined): void {
  const left = at([-HALF - 0.5, 0, 0]);
  const right = at([HALF + 0.5, 0, 0]);
  if (!left || !right) return;
  const gradient = ctx.createLinearGradient(left[0], 0, right[0], 0);
  gradient.addColorStop(0, 'rgba(255, 209, 0, 0)');
  gradient.addColorStop(0.5, 'rgba(255, 209, 0, 0.55)');
  gradient.addColorStop(1, 'rgba(255, 209, 0, 0)');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left[0], left[1] + 2);
  ctx.lineTo(right[0], right[1] + 2);
  ctx.stroke();
}

/** Health bars drain toward the middle from each side; the class resource runs under each, in its colour. */
function healthBars(ctx: CanvasRenderingContext2D, w: number, match: Match, names: [string, string]): void {
  const barWidth = w * 0.4;
  const barHeight = 26;
  const top = 28;
  match.fighters.forEach((fighter, i) => {
    const kit = match.tables[i]!.kit;
    const x0 = i === 0 ? 40 : w - 40 - barWidth;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x0 - 3, top - 3, barWidth + 6, barHeight + 6 + 14);
    const trail = Math.max(0, Math.min(1, fighter.shownHp / HP));
    const life = Math.max(0, Math.min(1, fighter.hp / HP));
    const fill = (share: number, colour: string, y: number, height: number, from = 0) => {
      ctx.fillStyle = colour;
      const length = barWidth * share;
      const start = barWidth * from;
      // What is left stays at the outer edge; damage eats the bar from the middle of the screen.
      ctx.fillRect(i === 0 ? x0 + start : x0 + barWidth - start - length, y, length, height);
    };
    fill(1, '#3a0c0c', top, barHeight);
    fill(trail, BONE, top, barHeight);
    fill(life, life > 0.3 ? '#c8121c' : '#ff5a2a', top, barHeight);
    // A shield's absorb sits past the health, white.
    if (fighter.absorb > 0) fill(Math.min(1 - life, fighter.absorb / HP), 'rgba(244, 241, 230, 0.75)', top, barHeight, life);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, top, barWidth, barHeight);
    // The resource.
    const ry = top + barHeight + 4;
    fill(1, '#14110f', ry, 10);
    fill(Math.max(0, Math.min(1, fighter.resource / MAX_RESOURCE)), RESOURCE_COLOURS[kit.resource], ry, 10);
    ctx.strokeStyle = 'rgba(255, 209, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, ry, barWidth, 10);
    ctx.fillStyle = BONE;
    ctx.font = `700 11px ${SERIF}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = i === 0 ? 'right' : 'left';
    ctx.fillText(`${Math.floor(fighter.resource)} ${RESOURCE_NAMES[kit.resource]}`, i === 0 ? x0 + barWidth - 6 : x0 + 6, ry + 5);
    // The name and class, and a pip for each round won.
    ctx.fillStyle = GOLD;
    ctx.font = `700 18px ${SERIF}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = i === 0 ? 'left' : 'right';
    ctx.fillText(names[i]!, i === 0 ? x0 : x0 + barWidth, ry + 18);
    ctx.font = `700 11px ${SERIF}`;
    ctx.fillStyle = 'rgba(244, 241, 230, 0.75)';
    ctx.fillText(kit.className, i === 0 ? x0 : x0 + barWidth, ry + 40);
    for (let pip = 0; pip < 2; pip++) {
      const cx = i === 0 ? x0 + barWidth - 14 - pip * 24 : x0 + 14 + pip * 24;
      ctx.beginPath();
      ctx.arc(cx, ry + 28, 7, 0, Math.PI * 2);
      ctx.fillStyle = pip < fighter.wins ? GOLD : 'rgba(0,0,0,0.5)';
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

function clock(ctx: CanvasRenderingContext2D, w: number, match: Match): void {
  const top = 28;
  const seconds = Math.max(0, Math.ceil(match.timer / 60));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `48px ${HEAVY}`;
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#1a0606';
  ctx.strokeText(String(seconds), w / 2, top - 6);
  ctx.fillStyle = seconds <= 10 ? '#ff5a2a' : BONE;
  ctx.fillText(String(seconds), w / 2, top - 6);
  ctx.font = `700 13px ${SERIF}`;
  ctx.fillStyle = GOLD;
  ctx.fillText(BRAND.round(match.round), w / 2, top + 48);
  ctx.fillText(`${match.fighters[0].wins} – ${match.fighters[1].wins}`, w / 2, top + 66);
}

/** A thin plate over each head: the name, a sliver of health, the cast bar while casting, stars while stunned. */
function nameplates(ctx: CanvasRenderingContext2D, match: Match, names: [string, string], at: (p: readonly [number, number, number]) => [number, number] | undefined): void {
  match.fighters.forEach((fighter, i) => {
    if (fighter.state === 'death') return;
    const head = at([fighter.x, 0, HEAD + fighter.z]);
    if (!head) return;
    const [hx, hy] = head;
    const width = 96;
    ctx.font = `700 12px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(names[i]!, hx, hy - 10);
    ctx.fillStyle = i === 0 ? '#7bd88f' : '#ff7a6a';
    ctx.fillText(names[i]!, hx, hy - 10);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(hx - width / 2 - 1, hy - 8, width + 2, 7);
    const life = Math.max(0, Math.min(1, fighter.hp / HP));
    ctx.fillStyle = life > 0.3 ? '#c8121c' : '#ff5a2a';
    ctx.fillRect(hx - width / 2, hy - 7, width * life, 5);
    if (fighter.absorb > 0) {
      ctx.fillStyle = 'rgba(244, 241, 230, 0.8)';
      ctx.fillRect(hx - width / 2 + width * life, hy - 7, width * Math.min(1 - life, fighter.absorb / HP), 5);
    }
    // Damage over time: a purple square for each.
    fighter.dots.forEach((_, k) => {
      ctx.fillStyle = '#9b59ff';
      ctx.fillRect(hx + width / 2 + 4 + k * 8, hy - 7, 5, 5);
    });
    // The cast bar.
    if (fighter.cast && fighter.state === 'cast') {
      const ability = match.tables[i]!.kit.abilities[fighter.cast.ability]!;
      const share = Math.min(1, fighter.cast.t / fighter.cast.total);
      const cw = 120;
      const cy = hy + 4;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(hx - cw / 2 - 1, cy - 1, cw + 2, 12);
      ctx.fillStyle = GOLD;
      ctx.fillRect(hx - cw / 2, cy, cw * share, 10);
      ctx.strokeStyle = 'rgba(255, 209, 0, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hx - cw / 2, cy, cw, 10);
      ctx.font = `700 11px ${SERIF}`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = BONE;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(ability.name.toUpperCase(), hx, cy + 13);
      ctx.fillText(ability.name.toUpperCase(), hx, cy + 13);
    }
    // Stars circle a stunned head.
    if (fighter.state === 'stun' && fighter.stunT > 0) {
      ctx.font = `16px serif`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = GOLD;
      for (let s = 0; s < 3; s++) {
        const angle = match.frame * 0.12 + (s * Math.PI * 2) / 3;
        ctx.fillText('★', hx + Math.cos(angle) * 26, hy - 24 + Math.sin(angle) * 7);
      }
    }
  });
}

/** Sparks where a blow landed: yellow hit, orange crit, blue-white block, silver parry, violet spell. */
function sparks(ctx: CanvasRenderingContext2D, match: Match, at: (p: readonly [number, number, number]) => [number, number] | undefined): void {
  for (const spark of match.sparks) {
    const p = at([spark.x, 0, spark.z]);
    if (!p) continue;
    const [sx, sy] = p;
    const life = Math.max(0, 1 - spark.t / Math.max(1, spark.life));
    const colour = { hit: '255, 220, 90', crit: '255, 120, 40', block: '140, 200, 255', parry: '230, 230, 240', spell: '190, 120, 255' }[spark.kind];
    ctx.strokeStyle = `rgba(${colour}, ${life})`;
    ctx.lineWidth = 3 * life + 1;
    const rays = spark.kind === 'block' || spark.kind === 'parry' ? 6 : 10;
    const reach = (spark.kind === 'crit' ? 24 : 18) + spark.t * 4;
    for (let r = 0; r < rays; r++) {
      const angle = (r / rays) * Math.PI * 2 + spark.t * 0.1;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(angle) * reach * 0.35, sy + Math.sin(angle) * reach * 0.35);
      ctx.lineTo(sx + Math.cos(angle) * reach, sy + Math.sin(angle) * reach);
      ctx.stroke();
    }
  }
}

/** Spells in flight glow; arrows and shots streak. */
function projectiles(ctx: CanvasRenderingContext2D, match: Match, at: (p: readonly [number, number, number]) => [number, number] | undefined): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const shot of match.projectiles) {
    if (shot.ability < 0) {
      const head = at([shot.x, 0, shot.z]);
      const tail = at([shot.x - shot.vx * 4, 0, shot.z]);
      if (!head || !tail) continue;
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tail[0], tail[1]);
      ctx.lineTo(head[0], head[1]);
      ctx.stroke();
      continue;
    }
    for (let trail = 5; trail >= 0; trail--) {
      const p = at([shot.x - shot.vx * trail * 2, 0, shot.z]);
      if (!p) continue;
      const [sx, sy] = p;
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
}

const TEXT_STYLE: Record<FloatingText['kind'], { size: number; colour: string; font: string }> = {
  damage: { size: 26, colour: BONE, font: HEAVY },
  crit: { size: 40, colour: GOLD, font: HEAVY },
  dot: { size: 20, colour: '#c084fc', font: HEAVY },
  heal: { size: 26, colour: '#7bd88f', font: HEAVY },
  absorb: { size: 20, colour: '#dfe6ff', font: HEAVY },
  miss: { size: 22, colour: '#bdb7a8', font: HEAVY },
  dodge: { size: 22, colour: '#bdb7a8', font: HEAVY },
  parry: { size: 22, colour: '#e6e6f0', font: HEAVY },
  block: { size: 22, colour: '#8cc8ff', font: HEAVY },
  status: { size: 22, colour: '#ffb347', font: HEAVY },
  info: { size: 13, colour: '#ff8a8a', font: SERIF },
};

/** Numbers and words rise off the fighter they concern and fade; a crit pops in bigger. */
function floatingTexts(ctx: CanvasRenderingContext2D, match: Match, at: (p: readonly [number, number, number]) => [number, number] | undefined): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Texts born on the same frame over the same fighter stack up instead of overlapping.
  const stack: Record<string, number> = {};
  for (const text of match.texts) {
    const style = TEXT_STYLE[text.kind];
    const key = `${text.side}:${text.t}`;
    const slot = stack[key] ?? 0;
    stack[key] = slot + 1;
    const p = at([text.x, 0, text.z]);
    if (!p) continue;
    const rise = text.kind === 'info' ? text.t * 0.4 : text.t * 0.9;
    const x = p[0];
    const y = p[1] - rise - slot * 24 + (text.kind === 'info' ? 60 : 0);
    const fade = Math.min(1, (text.life - text.t) / 15);
    const pop = text.kind === 'crit' ? 1 + Math.max(0, 1 - text.t / 6) * 0.6 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.font = `${style.font === SERIF ? '700 ' : ''}${style.size}px ${style.font}`;
    ctx.lineWidth = style.size > 30 ? 6 : 4;
    ctx.strokeStyle = 'rgba(20, 5, 5, 0.9)';
    ctx.strokeText(text.text, 0, 0);
    ctx.fillStyle = style.colour;
    ctx.fillText(text.text, 0, 0);
    ctx.restore();
  }
}

/** Each fighter's four abilities as a row of slots: name, key, cooldown sweep, dimmed when they cannot go. */
function actionBars(ctx: CanvasRenderingContext2D, w: number, h: number, match: Match): void {
  const size = 64;
  const gap = 6;
  const bottom = h - 22;
  match.fighters.forEach((fighter, i) => {
    const kit = match.tables[i]!.kit;
    const rowWidth = size * 4 + gap * 3;
    const x0 = i === 0 ? 40 : w - 40 - rowWidth;
    kit.abilities.forEach((ability, n) => {
      const x = x0 + n * (size + gap);
      const y = bottom - size;
      const inUse = fighter.ability === n && (fighter.state === 'ability' || fighter.state === 'cast' || fighter.state === 'dash');
      const why = match.phase === 'fight' || match.phase === 'finish' ? abilityBlocked(match, i as 0 | 1, n) : undefined;
      const cooling = fighter.cooldowns[n]! > 0;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = why === 'OUT OF RANGE' || why === 'TOO CLOSE' ? 'rgba(90, 60, 30, 0.6)' : 'rgba(60, 30, 20, 0.7)';
      ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
      // The name, on one or two lines.
      const lines = ability.short.split(' ');
      ctx.font = `700 ${lines.length > 1 ? 11 : 12}px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = why && why.startsWith('NOT ENOUGH') ? '#ff6a6a' : why === 'NEEDS 20% HEALTH' ? '#8a8a8a' : BONE;
      if (why === 'OUT OF RANGE' || why === 'TOO CLOSE') ctx.fillStyle = '#c9b48a';
      lines.forEach((line, k) => ctx.fillText(line, x + size / 2, y + size / 2 + (k - (lines.length - 1) / 2) * 13));
      // The cooldown sweep, clockwise from the top, with the seconds left.
      const sweep = cooling ? fighter.cooldowns[n]! / Math.max(1, ability.cooldown) : ability.gcd && fighter.gcd > 0 ? fighter.gcd / GCD_FRAMES : 0;
      if (sweep > 0) {
        ctx.fillStyle = cooling ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y + size / 2);
        ctx.arc(x + size / 2, y + size / 2, size, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sweep, false);
        ctx.closePath();
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, size, size);
        ctx.clip();
        ctx.fill();
        ctx.restore();
        if (cooling) {
          const seconds = fighter.cooldowns[n]! / 60;
          ctx.font = `22px ${HEAVY}`;
          ctx.fillStyle = BONE;
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          const label = seconds >= 10 ? String(Math.ceil(seconds)) : seconds.toFixed(1);
          ctx.strokeText(label, x + size / 2, y + size / 2);
          ctx.fillText(label, x + size / 2, y + size / 2);
        }
      }
      // The key, in the corner; the cost at the bottom.
      ctx.font = `700 10px ${SERIF}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = GOLD;
      ctx.fillText(keyLabel(i as 0 | 1, ABILITY_KEYS[n]!), x + 4, y + 3);
      if (ability.cost > 0) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = RESOURCE_COLOURS[kit.resource];
        ctx.fillText(String(ability.cost), x + size - 4, y + size - 3);
      }
      if (ability.cast > 0) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(244, 241, 230, 0.7)';
        ctx.fillText(`${(ability.cast / 60).toFixed(1)}s`, x + 4, y + size - 3);
      }
      ctx.strokeStyle = inUse ? BONE : GOLD;
      ctx.lineWidth = inUse ? 3 : 1.5;
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    });
    // The auto-attack: a small swing-timer bar beside the row.
    const sx = i === 0 ? x0 + rowWidth + 10 : x0 - 18;
    const speed = match.tables[i]!.weapon.speed;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(sx, bottom - size, 8, size);
    const ready = 1 - fighter.swingT / Math.max(1, speed);
    ctx.fillStyle = fighter.auto || fighter.queued ? '#ffd100' : 'rgba(244, 241, 230, 0.5)';
    ctx.fillRect(sx + 1, bottom - 1 - (size - 2) * ready, 6, (size - 2) * ready);
  });
}

/** The words: ROUND 1, FIGHT!, FINISH THE MAK'GORA!, K.O., DISHONOR! */
function banner(ctx: CanvasRenderingContext2D, w: number, h: number, match: Match): void {
  if (!match.banner) return;
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
  const colourOf = (line: string) => (line === BRAND.fatality ? '#ff2a2a' : line === BRAND.flawless ? '#7bd88f' : GOLD);
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

export const roundSeconds = ROUND_FRAMES / 60;
