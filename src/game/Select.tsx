import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ClassEntry, Race } from '@mogshot/character/appearance';
import type { ImportedRecord } from '@mogshot/import/record';
import { BRAND } from '../engine/brand';
import { type BuiltFighter, type Champion, type Fighters } from './fighters';
import { Preview } from './Preview';
import { championTiles, classesOf, cycleClass, factionOf, gridMove, randomTile, rosterTiles, sexFor, type Tile } from './roster';
import { Guide, type GuidePage } from './Guide';
import { LogoArt } from './Title';

/*
 * CHOOSE YOUR CHAMPION. Every race on a grid of the game's own portraits, the player's own
 * characters in a row above, the legends in a row above those, both players' cursors on it
 * at once, each champion drawn full size on its player's side as soon as the cursor rests
 * on it.
 */

export type Source = 'keyboard' | 'gamepad' | 'cpu';

interface SelectProps {
  races: Race[];
  classes: ClassEntry[];
  records: ImportedRecord[];
  /** The legends the open folder can draw, as roster.legendTiles picks them. */
  legends: Tile[];
  /** Race portraits by `${race.key}:${sex}` and class icons by class key, as data URLs. */
  portraits: { races: Map<string, string>; classes: Map<string, string> };
  fighters: Fighters;
  p2: Source;
  onP2: (source: Source) => void;
  onReady: (fighters: [BuiltFighter, BuiltFighter]) => void;
  onBack: () => void;
}

interface Cursor {
  zone: 'legends' | 'champions' | 'roster';
  index: number;
}

interface Player {
  cursor: Cursor;
  sex: number;
  classId: number | undefined;
  locked: boolean;
  champion: Champion | undefined;
  built: BuiltFighter | undefined;
  building: boolean;
  error: string | undefined;
}

const COLUMNS = 8;
const HOVER_MS = 200;

const KEYS: Record<number, Record<string, 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'sex' | 'classPrev' | 'classNext'>> = {
  0: { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', KeyJ: 'confirm', KeyH: 'back', KeyU: 'sex', KeyK: 'classPrev', KeyL: 'classNext' },
  1: {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Numpad1: 'confirm', Comma: 'confirm', Numpad4: 'back', KeyM: 'back',
    Numpad0: 'sex', ShiftRight: 'sex', Numpad2: 'classPrev', Period: 'classPrev', Numpad3: 'classNext', Slash: 'classNext',
  },
};

const freshPlayer = (sex: number): Player => ({
  cursor: { zone: 'roster', index: 0 },
  sex,
  classId: undefined,
  locked: false,
  champion: undefined,
  built: undefined,
  building: false,
  error: undefined,
});

/** The legends' portraits are rendered once through the Mogshot command line and shipped with the game, as the browser has no portrait atlas for NPCs. */
const legendPortrait = (slug: string) => `${import.meta.env.BASE_URL}legends/${slug}.png`;

export function Select({ races, classes, records, legends, portraits, fighters, p2, onP2, onReady, onBack }: SelectProps) {
  const roster = useMemo(() => rosterTiles(races), [races]);
  const champions = useMemo(() => championTiles(records, races), [records, races]);
  // The rows from the top, leaving out the empty ones; the cursor moves up and down through them.
  const zones = useMemo(() => {
    const rows: { zone: Cursor['zone']; tiles: Tile[] }[] = [];
    if (legends.length > 0) rows.push({ zone: 'legends', tiles: legends });
    if (champions.length > 0) rows.push({ zone: 'champions', tiles: champions });
    rows.push({ zone: 'roster', tiles: roster });
    return rows;
  }, [legends, champions, roster]);
  // The ring opens on Tyrande against Thrall when the folder has them; otherwise on the roster.
  const [guide, setGuide] = useState<GuidePage>();
  const [players, setPlayers] = useState<[Player, Player]>(() => {
    const opening = (slug: string, sex: number): Player => {
      const index = legends.findIndex((tile) => tile.kind === 'legend' && tile.legend.slug === slug);
      const player = freshPlayer(sex);
      return index >= 0 ? { ...player, cursor: { zone: 'legends', index } } : player;
    };
    return [opening('tyrande', 1), opening('thrall', 0)];
  });
  const playersRef = useRef(players);
  playersRef.current = players;
  const guideRef = useRef(guide);
  guideRef.current = guide;
  const p2Ref = useRef(p2);
  p2Ref.current = p2;
  // Each player's newest build request; older ones that finish late are dropped.
  const requests = useRef([0, 0]);
  const rng = useRef(Date.now() >>> 0);
  const draw = () => {
    rng.current = (Math.imul(rng.current, 1664525) + 1013904223) >>> 0;
    return rng.current / 4294967296;
  };

  const tilesOf = (zone: Cursor['zone']): Tile[] => (zone === 'legends' ? legends : zone === 'champions' ? champions : roster);
  const tileAt = (cursor: Cursor): Tile | undefined => tilesOf(cursor.zone)[cursor.index];

  const update = (who: 0 | 1, change: (player: Player) => Player) =>
    setPlayers((current) => {
      const next: [Player, Player] = [current[0], current[1]];
      next[who] = change(current[who]);
      return next;
    });

  /** Resolve the champion under a player's cursor and build it; the build is kept across hovers. */
  const summon = (who: 0 | 1, player: Player): Player => {
    const tile = tileAt(player.cursor);
    const id = ++requests.current[who]!;
    if (!tile || tile.kind === 'random') return { ...player, champion: undefined, built: undefined, building: false, error: undefined };
    const sex = tile.kind === 'record' ? tile.record.sex : tile.kind === 'legend' ? tile.sex : sexFor(tile.race, player.sex);
    const classId = tile.kind !== 'race' ? undefined : (classesOf(tile.race, classes).some((c) => c.id === player.classId) ? player.classId : cycleClass(tile.race, classes, undefined, 1));
    void fighters
      .champion(tile, sex, classId)
      .then(async (champion) => {
        if (!champion) return;
        if (requests.current[who] !== id) return;
        update(who, (p) => ({ ...p, champion }));
        const built = await fighters.get(champion);
        if (requests.current[who] !== id) return;
        update(who, (p) => ({ ...p, built, building: false, error: undefined }));
      })
      .catch((cause: unknown) => {
        if (requests.current[who] !== id) return;
        update(who, (p) => ({ ...p, building: false, error: cause instanceof Error ? cause.message : String(cause) }));
      });
    return { ...player, classId, building: true, error: undefined };
  };

  // A rest on a tile summons it after a moment, so sweeping across the grid does not build every race.
  useEffect(() => {
    const timers = players.map((player, who) => {
      if (player.locked || player.built?.champion.key === keyOf(tileAt(player.cursor), player)) return undefined;
      return setTimeout(() => update(who as 0 | 1, (p) => summon(who as 0 | 1, p)), HOVER_MS);
    });
    return () => timers.forEach((timer) => timer !== undefined && clearTimeout(timer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players[0].cursor, players[0].sex, players[0].classId, players[1].cursor, players[1].sex, players[1].classId]);

  const keyOf = (tile: Tile | undefined, player: Player) => {
    if (!tile || tile.kind === 'random') return undefined;
    if (tile.kind === 'record') return `record:${tile.record.key}`;
    if (tile.kind === 'legend') return `legend:${tile.legend.slug}:${tile.displayId}`;
    const classId = classesOf(tile.race, classes).some((c) => c.id === player.classId) ? player.classId : cycleClass(tile.race, classes, undefined, 1);
    return `race:${tile.race.id}:${sexFor(tile.race, player.sex)}:${classId ?? 0}`;
  };

  const move = (player: Player, dx: number, dy: number): Player => {
    const { cursor } = player;
    const at = zones.findIndex((row) => row.zone === cursor.zone);
    const into = (row: { zone: Cursor['zone']; tiles: Tile[] } | undefined, column: number): Player =>
      row ? { ...player, cursor: { zone: row.zone, index: Math.min(column, row.tiles.length - 1) } } : player;
    if (cursor.zone !== 'roster') {
      // A single row: left and right wrap along it, up and down step to the rows around it.
      const tiles = tilesOf(cursor.zone);
      if (dy > 0) return into(zones[at + 1], cursor.index);
      if (dy < 0) return into(zones[at - 1], cursor.index);
      return { ...player, cursor: { zone: cursor.zone, index: (cursor.index + dx + tiles.length) % tiles.length } };
    }
    const row = Math.floor(cursor.index / COLUMNS);
    if (dy < 0 && row === 0 && at > 0) return into(zones[at - 1], cursor.index % COLUMNS);
    return { ...player, cursor: { zone: 'roster', index: gridMove(cursor.index, roster.length, COLUMNS, dx, dy) } };
  };

  const confirm = (who: 0 | 1) =>
    update(who, (player) => {
      if (player.locked) return player;
      const tile = tileAt(player.cursor);
      if (tile?.kind === 'random') {
        const picked = randomTile(roster, draw);
        const index = picked ? roster.indexOf(picked) : 0;
        const allowed = picked?.kind === 'race' ? classesOf(picked.race, classes) : [];
        const classId = allowed.length > 0 ? allowed[Math.floor(draw() * allowed.length)]!.id : undefined;
        const sex = picked?.kind === 'race' ? sexFor(picked.race, draw() < 0.5 ? 0 : 1) : player.sex;
        // The pick lands first; the next confirm locks it.
        return summon(who, { ...player, cursor: { zone: 'roster', index }, sex, classId });
      }
      return { ...player, locked: true };
    });

  // Keys: both players on one keyboard.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (guideRef.current) return;
      if (event.code === 'Escape') {
        const [a, b] = playersRef.current;
        if (a.locked || b.locked) setPlayers([{ ...a, locked: false }, { ...b, locked: false }]);
        else onBack();
        return;
      }
      if (event.code === 'Tab') {
        event.preventDefault();
        const order: Source[] = ['keyboard', 'cpu', 'gamepad'];
        onP2(order[(order.indexOf(p2Ref.current) + 1) % order.length]!);
        return;
      }
      for (const who of [0, 1] as const) {
        const action = KEYS[who]![event.code];
        if (!action) continue;
        if (who === 1 && p2Ref.current === 'cpu') continue;
        event.preventDefault();
        if (action === 'confirm') confirm(who);
        else if (action === 'back') update(who, (p) => ({ ...p, locked: false }));
        else
          update(who, (player) => {
            if (player.locked) return player;
            const tile = tileAt(player.cursor);
            switch (action) {
              case 'up': return move(player, 0, -1);
              case 'down': return move(player, 0, 1);
              case 'left': return move(player, -1, 0);
              case 'right': return move(player, 1, 0);
              case 'sex': return { ...player, sex: player.sex === 0 ? 1 : 0 };
              case 'classPrev': return tile && tile.kind === 'race' ? { ...player, classId: cycleClass(tile.race, classes, player.classId, -1) } : player;
              case 'classNext': return tile && tile.kind === 'race' ? { ...player, classId: cycleClass(tile.race, classes, player.classId, 1) } : player;
            }
          });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, champions, legends, classes]);

  // The computer picks for itself once the player has locked in: a sweep across the grid, then a lock.
  useEffect(() => {
    if (p2 !== 'cpu' || !players[0].locked || players[1].locked) return;
    let steps = 6 + Math.floor(draw() * 6);
    const timer = setInterval(() => {
      if (steps-- > 0) {
        update(1, (player) => {
          const picked = randomTile(roster, draw);
          return { ...player, cursor: { zone: 'roster', index: picked ? roster.indexOf(picked) : 0 } };
        });
        return;
      }
      clearInterval(timer);
      update(1, (player) => {
        const tile = tileAt(player.cursor);
        if (tile?.kind !== 'race') return player;
        const allowed = classesOf(tile.race, classes);
        const classId = allowed.length > 0 ? allowed[Math.floor(draw() * allowed.length)]!.id : undefined;
        return summon(1, { ...player, sex: sexFor(tile.race, draw() < 0.5 ? 0 : 1), classId, locked: true });
      });
    }, 140);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p2, players[0].locked, players[1].locked]);

  // Both locked and both built: into the ring.
  useEffect(() => {
    const [a, b] = players;
    if (!(a.locked && b.locked && a.built && b.built)) return;
    if (a.built.champion.key !== keyOf(tileAt(a.cursor), a) || b.built.champion.key !== keyOf(tileAt(b.cursor), b)) return;
    const timer = setTimeout(() => onReady([a.built!, b.built!]), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  /**
   * The builder's problems that are files this install lacks. The rest (a texture the game data
   * names but the game draws without, a piece drawn another way) the builder recovers from, and
   * the plate says nothing of them; the full list stays in the status line's title.
   */
  const missingPieces = (problems: readonly string[]) => problems.filter((problem) => /is not installed|is not part of this build|^No painted body/.test(problem));

  const portraitOf = (tile: Tile, sex: number) => {
    if (tile.kind === 'random') return undefined;
    if (tile.kind === 'legend') return legendPortrait(tile.legend.slug);
    return portraits.races.get(`${tile.race.key}:${tile.kind === 'record' ? tile.record.sex : sexFor(tile.race, sex)}`);
  };
  const nameOf = (tile: Tile) => (tile.kind === 'random' ? 'RANDOM' : tile.kind === 'record' ? tile.record.name : tile.kind === 'legend' ? tile.legend.name : tile.race.name);

  const tileView = (tile: Tile, zone: Cursor['zone'], index: number) => {
    const here = players.map((player) => player.cursor.zone === zone && player.cursor.index === index);
    const classKey = tile.kind === 'record' ? classes.find((c) => c.id === tile.record.classId)?.key : undefined;
    return (
      <div
        key={tile.id}
        class={`tile ${tile.kind} ${factionOf(tile)} ${here[0] ? 'p1' : ''} ${here[1] ? 'p2' : ''} ${here[0] && players[0].locked ? 'locked1' : ''} ${here[1] && players[1].locked ? 'locked2' : ''}`}
        onClick={() => update(0, (p) => (p.locked ? p : { ...p, cursor: { zone, index } }))}
      >
        {tile.kind === 'random' ? (
          <span class="random">?</span>
        ) : tile.kind === 'legend' ? (
          <>
            <img src={legendPortrait(tile.legend.slug)} alt={tile.legend.name} title={`${tile.legend.name}, ${tile.legend.title}`} draggable={false} />
            {/* The first name alone: the strip has no room for "Tyrande Whisperwind", and the plate says the rest. */}
            <span class="name">{tile.legend.name.split(' ')[0]}</span>
          </>
        ) : (
          <>
            {/* Each player's sex shows on their own cursor; otherwise the race's first. */}
            {portraitOf(tile, here[0] ? players[0].sex : here[1] ? players[1].sex : tile.race.sexes[0] ?? 0) ? (
              <img src={portraitOf(tile, here[0] ? players[0].sex : here[1] ? players[1].sex : tile.race.sexes[0] ?? 0)} alt={tile.race.name} draggable={false} />
            ) : (
              <span class="noface">{tile.race.name}</span>
            )}
            {tile.kind === 'record' && (
              <span class="name">
                {classKey && portraits.classes.get(classKey) && <img class="class" src={portraits.classes.get(classKey)} alt="" />}
                {tile.record.name}
              </span>
            )}
          </>
        )}
      </div>
    );
  };

  const plate = (who: 0 | 1) => {
    const player = players[who];
    const tile = tileAt(player.cursor);
    const champion = player.champion;
    const classKey = classes.find((c) => c.id === (champion?.classId ?? player.classId))?.key;
    return (
      <div class={`plate ${who === 0 ? 'p1' : 'p2'} ${player.locked ? 'locked' : ''}`}>
        <div class="who">{who === 0 ? 'PLAYER 1' : p2 === 'cpu' ? 'COMPUTER' : p2 === 'gamepad' ? 'PLAYER 2 · PAD' : 'PLAYER 2'}</div>
        <div class="name">{champion?.name ?? (tile ? nameOf(tile).toUpperCase() : '')}</div>
        <div class="title">
          {classKey && portraits.classes.get(classKey) && <img class="class" src={portraits.classes.get(classKey)} alt="" />}
          {champion?.title ?? (tile?.kind === 'legend' ? tile.legend.title.toUpperCase() : '')}
          {tile?.kind === 'race' && <span class="sex">{sexFor(tile.race, player.sex) === 1 ? ' ♀' : ' ♂'}</span>}
        </div>
        {player.building && !player.built && <div class="status">{BRAND.summoning}</div>}
        {player.error && <div class="status bad">{player.error}</div>}
        {player.locked && <div class="stamp">{BRAND.chosen}</div>}
        {player.built && missingPieces(player.built.result.scene.problems).length > 0 && (
          <div class="status dim small" title={player.built.result.scene.problems.join('\n')}>
            {missingPieces(player.built.result.scene.problems).length} piece(s) not in this install: {missingPieces(player.built.result.scene.problems)[0]}
          </div>
        )}
      </div>
    );
  };

  return (
    <div class="screen select">
      <header>
        <LogoArt small />
        <h1>{BRAND.choose}</h1>
      </header>
      <div class="sides">
        <div class="side left">
          <Preview fighter={players[0].built} locked={players[0].locked} side="left" />
          {plate(0)}
        </div>
        <div class="grid">
          {legends.length > 0 && (
            <>
              <div class="label">LEGENDS</div>
              <div class="tiles legends">{legends.map((tile, i) => tileView(tile, 'legends', i))}</div>
            </>
          )}
          <div class="label">YOUR CHAMPIONS</div>
          <div class="tiles champions">
            {champions.map((tile, i) => tileView(tile, 'champions', i))}
            <button class="tile create" type="button" onClick={() => setGuide('champion')} title="How to get your own characters into the ring">
              <span class="plus">+</span>
              {champions.length > 0 ? 'ADD A CHAMPION' : 'CREATE YOUR CHAMPION'}
            </button>
          </div>
          <div class="label">THE RACES OF AZEROTH</div>
          <div class="tiles roster" style={{ gridTemplateColumns: `repeat(${COLUMNS}, 1fr)` }}>
            {roster.map((tile, i) => tileView(tile, 'roster', i))}
          </div>
        </div>
        <div class="side right">
          <Preview fighter={players[1].built} locked={players[1].locked} side="right" />
          {plate(1)}
        </div>
      </div>
      <footer class="controls">
        <span><b>P1</b> WASD move · J choose · H back · U ♂/♀ · K/L class</span>
        <span><b>P2</b> arrows · , or Num1 choose · M back · Right Shift ♂/♀ · . / class</span>
        <span><b>Tab</b> player 2: {p2} · <b>Esc</b> back</span>
      </footer>
      {guide && <Guide page={guide} onPage={setGuide} onClose={() => setGuide(undefined)} />}
    </div>
  );
}
