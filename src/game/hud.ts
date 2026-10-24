import { BRAND } from '../engine/brand';
import type { FloatingText, Match } from '../engine/engine';
import { HALF, HP, ROUND_FRAMES } from '../engine/stage';

/*
 * What is drawn over the ring and belongs to the world: the ground line, the nameplates with
 * their slivers of health, cast bars and stun stars, the hit sparks, the spells in flight, the
 * numbers and words that float off a hit, and the words that slam in (ROUND 1, FIGHT!, K.O.).
 * The unit frames, action bars and clock are the DOM layer's (ui/FightUi.tsx). Plain 2D canvas,
 * redrawn each frame.
 */

export type Project = (point: readonly [number, number, number]) => [number, number] | undefined;

const SERIF = "'Cinzel', 'Palatino', serif";
const HEAVY = "'Metal Mania', 'Impact', sans-serif";
const GOLD = '#ffd100';
const BONE = '#f4f1e6';
/** Where a nameplate sits: this far above the feet. */
const HEAD = 2.3;

export interface HudOptions {
  /** Which fighters a person plays: a blow they take floats red, as the game shows damage taken. Both by default. */
  human?: [boolean, boolean];
  debug?: string;
}

export function drawHud(ctx: CanvasRenderingContext2D, width: number, height: number, match: Match, names: [string, string], project: Project, options: HudOptions = {}): void {
  const { debug } = options;
  const human = options.human ?? [true, true];
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
  hurtFlash(ctx, w, h, match, human);
  nameplates(ctx, match, names, at);
  sparks(ctx, match, at);
  projectiles(ctx, match, at);
  floatingTexts(ctx, match, at, human);
  banner(ctx, w, h, match);

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

/** A red flash at the edges of the screen when a player's fighter takes a blow from the computer; deeper for a crit. */
function hurtFlash(ctx: CanvasRenderingContext2D, w: number, h: number, match: Match, human: [boolean, boolean]): void {
  let strength = 0;
  for (const text of match.texts) {
    if (text.t > 14 || !human[text.side] || human[text.from]) continue;
    if (text.kind !== 'damage' && text.kind !== 'crit') continue;
    strength = Math.max(strength, (text.kind === 'crit' ? 0.55 : 0.3) * (1 - text.t / 14));
  }
  if (strength <= 0) return;
  const glow = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85);
  glow.addColorStop(0, 'rgba(200, 0, 0, 0)');
  glow.addColorStop(1, `rgba(200, 0, 0, ${strength})`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

/** Sparks where a blow landed: yellow hit, orange crit, blue-white block, silver parry, violet spell. */
function sparks(ctx: CanvasRenderingContext2D, match: Match, at: (p: readonly [number, number, number]) => [number, number] | undefined): void {
  for (const spark of match.sparks) {
    const p = at([spark.x, 0, spark.z]);
    if (!p) continue;
    const [sx, sy] = p;
    const life = Math.max(0, 1 - spark.t / Math.max(1, spark.life));
    const colour = { hit: '255, 220, 90', crit: '255, 120, 40', block: '140, 200, 255', parry: '230, 230, 240', spell: '190, 120, 255', dot: '170, 90, 255' }[spark.kind];
    if (spark.kind === 'dot') {
      // A dot's tick: motes drifting up off the body.
      ctx.fillStyle = `rgba(${colour}, ${life})`;
      for (let m = 0; m < 5; m++) {
        const angle = m * 1.3 + spark.t * 0.05;
        ctx.beginPath();
        ctx.arc(sx + Math.cos(angle) * (10 + m * 4), sy - spark.t * 2.5 + Math.sin(angle) * 6, 3 * life + 1, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    ctx.strokeStyle = `rgba(${colour}, ${life})`;
    ctx.lineWidth = (spark.kind === 'crit' ? 5 : 3.5) * life + 1;
    const rays = spark.kind === 'block' || spark.kind === 'parry' ? 6 : spark.kind === 'crit' ? 14 : 10;
    const reach = (spark.kind === 'crit' ? 34 : 24) + spark.t * (spark.kind === 'crit' ? 6 : 4);
    // A flash at the point of impact on the first frames.
    if (spark.t < 4 && spark.kind !== 'block' && spark.kind !== 'parry') {
      const flash = ctx.createRadialGradient(sx, sy, 0, sx, sy, spark.kind === 'crit' ? 60 : 36);
      flash.addColorStop(0, `rgba(255, 250, 230, ${0.8 * (1 - spark.t / 4)})`);
      flash.addColorStop(1, `rgba(${colour}, 0)`);
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(sx, sy, spark.kind === 'crit' ? 60 : 36, 0, Math.PI * 2);
      ctx.fill();
    }
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
      const radius = 30 - trail * 4;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      glow.addColorStop(0, `rgba(255, 255, 230, ${trail === 0 ? 1 : 0.3})`);
      glow.addColorStop(0.35, `rgba(140, 210, 255, ${trail === 0 ? 0.85 : 0.2})`);
      glow.addColorStop(1, 'rgba(60, 120, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The words of the hit table and the status effects, in white small caps; a crit in yellow. */
const WHITE = '#f4f1e6';
const RED = '#ff3b3b';

interface TextStyle {
  size: number;
  colour: string;
  font: string;
  /** A word, drawn in the serif small caps; a number in the heavy face. */
  word: boolean;
}

/**
 * How a floating text looks: numbers are white when dealt by a player's fighter, red when a
 * player's fighter takes them from the computer, yellow and large for a crit; words are white.
 */
function styleOf(text: FloatingText, human: [boolean, boolean]): TextStyle {
  const incoming = human[text.side] && !human[text.from];
  switch (text.kind) {
    case 'damage':
      return { size: 26, colour: incoming ? RED : WHITE, font: HEAVY, word: false };
    case 'crit':
      return { size: 40, colour: incoming ? RED : GOLD, font: HEAVY, word: false };
    case 'dot':
      return { size: 18, colour: incoming ? RED : WHITE, font: HEAVY, word: false };
    case 'heal':
      return { size: 26, colour: '#7bd88f', font: HEAVY, word: false };
    case 'absorb':
    case 'block':
      return { size: 18, colour: WHITE, font: SERIF, word: true };
    case 'miss':
    case 'dodge':
    case 'parry':
    case 'immune':
      return { size: 19, colour: WHITE, font: SERIF, word: true };
    case 'status':
      return { size: 18, colour: '#ffb347', font: SERIF, word: true };
    case 'info':
      return { size: 13, colour: '#ff8a8a', font: SERIF, word: true };
  }
}

/**
 * Numbers and words rise off the head of the fighter they concern, above the nameplate, fanning a
 * little left and right so hits that land together do not overlap, and fade over 1.2 s. A crit
 * arrives large and bounces into place.
 */
function floatingTexts(ctx: CanvasRenderingContext2D, match: Match, at: (p: readonly [number, number, number]) => [number, number] | undefined, human: [boolean, boolean]): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Texts born on the same frame over the same fighter stack up instead of overlapping.
  const stack: Record<string, number> = {};
  for (const text of match.texts) {
    // The refusals (NOT ENOUGH RAGE, OUT OF RANGE) are the DOM layer's to show, from the view's `notice`.
    if (text.kind === 'info') continue;
    const style = styleOf(text, human);
    const key = `${text.side}:${text.t}`;
    const slot = stack[key] ?? 0;
    stack[key] = slot + 1;
    const p = at([text.x, 0, text.z]);
    if (!p) continue;
    const born = match.frame - text.t;
    // The fan: each text takes a lane from -2 to 2 by its birth frame, so a stream of hits spreads out.
    const lane = ((born * 7 + slot * 3) % 5) - 2;
    const rise = text.t * 0.85;
    const x = p[0] + lane * 16;
    const y = p[1] - 30 - rise - slot * 22;
    const fade = Math.min(1, (text.life - text.t) / 18);
    let scale = 1;
    if (text.kind === 'crit') {
      // Arrives at 1.7×, lands by frame 5, dips to 0.9× and settles by frame 10.
      scale = text.t < 5 ? 1.7 - 0.14 * text.t : text.t < 10 ? 1 - 0.1 * Math.sin(((text.t - 5) / 5) * Math.PI) : 1;
    } else if (text.kind === 'damage' || text.kind === 'heal') {
      scale = text.t < 4 ? 1.25 - 0.0625 * text.t : 1;
    }
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.font = style.word ? `700 ${style.size}px ${style.font}` : `${style.size}px ${style.font}`;
    ctx.lineWidth = style.size > 30 ? 6 : 4;
    ctx.strokeStyle = 'rgba(20, 5, 5, 0.9)';
    ctx.strokeText(text.text, 0, 0);
    ctx.fillStyle = style.colour;
    ctx.fillText(text.text, 0, 0);
    ctx.restore();
  }
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
