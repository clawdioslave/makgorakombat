import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ClassEntry, Race } from '@mogshot/character/appearance';
import type { Image } from '@mogshot/formats/blp';
import type { LoadingScreen } from '@mogshot/worker/api';
import { DataClient } from '@mogshot/worker/client';
import { Fight } from './Fight';
import { type BuiltFighter, Fighters } from './fighters';
import { messageOf, useFolder } from './folder';
import { pictureUrl } from './pixels';
import { LEGENDS, legendTiles, type Tile } from './roster';
import { Select, type Source } from './Select';
import { Title } from './Title';
import { FightUi } from './ui/FightUi';
import { type Stage, stagesFor, type Ground } from './stages';
import { Versus } from './Versus';

/*
 * The screens: the title with the folder drop, CHOOSE YOUR CHAMPION, the VS screen with the
 * stage pick, and the fight. Everything the game knows about the open folder is loaded once
 * here and handed down.
 */

type Screen =
  | { kind: 'select' }
  | { kind: 'versus'; fighters: [BuiltFighter, BuiltFighter] }
  | { kind: 'fight'; fighters: [BuiltFighter, BuiltFighter]; stage: Ground };

interface Loaded {
  races: Race[];
  classes: ClassEntry[];
  portraits: { races: Map<string, string>; classes: Map<string, string> };
  screens: LoadingScreen[];
  /** The stages in the world this install can draw. */
  stages: Stage[];
  legends: Tile[];
  fighters: Fighters;
}

export function Game() {
  const client = useRef<DataClient>(null);
  client.current ??= new DataClient();
  const { phase, dragging, onPick } = useFolder(client.current);
  const [loaded, setLoaded] = useState<Loaded>();
  const [loadError, setLoadError] = useState<string>();
  const [screen, setScreen] = useState<Screen>({ kind: 'select' });
  const [p2, setP2] = useState<Source>('cpu');

  const openKey = phase.kind === 'ready' ? phase.opened.info.buildKey + phase.opened.info.product : undefined;
  useEffect(() => {
    setLoaded(undefined);
    setLoadError(undefined);
    setScreen({ kind: 'select' });
    if (openKey === undefined) return;
    let stale = false;
    const data = client.current!;
    const product = phase.kind === 'ready' ? phase.opened.info.product : '';
    void (async () => {
      try {
        const [races, classes, portraits, screens, looks, maps] = await Promise.all([
          data.races(),
          data.classList(),
          data.portraits().catch((cause: unknown) => {
            console.warn('The game\'s portraits could not be read:', cause);
            return { races: {}, classes: {}, problems: [] };
          }),
          data.backdrops().catch(() => [] as LoadingScreen[]),
          // The legends this folder can draw; a folder whose creature tables cannot be read just has none.
          data.creatureDisplays(LEGENDS.flatMap((legend) => legend.displays)).catch((cause: unknown) => {
            console.warn('The legends could not be looked up:', cause);
            return [];
          }),
          // Which maps are on disk, for the stages; an install whose map table cannot be read fights on loading screens.
          data.maps().catch((cause: unknown) => {
            console.warn('The maps could not be listed:', cause);
            return [];
          }),
        ]);
        if (stale) return;
        if (portraits.problems.length > 0) console.warn('Portraits:', portraits.problems.join('; '));
        const urls = (images: Record<string, Image>) => new Map(Object.entries(images).map(([key, image]) => [key, pictureUrl(image)]));
        setLoaded({
          races,
          classes,
          portraits: { races: urls(portraits.races), classes: urls(portraits.classes) },
          screens,
          stages: stagesFor(maps.map((map) => map.id), product),
          legends: legendTiles(LEGENDS, looks, races),
          fighters: new Fighters(data, classes),
        });
      } catch (cause) {
        if (!stale) setLoadError(messageOf(cause));
      }
    })();
    return () => {
      stale = true;
    };
  }, [openKey]);

  const records = useMemo(() => (phase.kind === 'ready' ? phase.records : []), [phase]);

  useEffect(() => {
    document.body.classList.toggle('ingame', phase.kind === 'ready' && loaded !== undefined);
  }, [phase.kind, loaded]);

  if (phase.kind !== 'ready') return <Title phase={phase} dragging={dragging} onPick={onPick} />;
  if (loadError) return <Title phase={{ kind: 'error', message: loadError }} dragging={false} onPick={onPick} />;
  if (!loaded) return <Title phase={{ kind: 'opening', message: 'Summoning the roster…' }} dragging={false} onPick={onPick} />;

  switch (screen.kind) {
    case 'select':
      return (
        <Select
          races={loaded.races}
          classes={loaded.classes}
          records={records}
          legends={loaded.legends}
          portraits={loaded.portraits}
          fighters={loaded.fighters}
          p2={p2}
          onP2={setP2}
          onReady={(fighters) => setScreen({ kind: 'versus', fighters })}
          onBack={() => location.reload()}
        />
      );
    case 'versus':
      return (
        <Versus
          client={client.current}
          fighters={screen.fighters}
          stages={loaded.stages}
          screens={loaded.screens}
          onFight={(ground) => setScreen({ kind: 'fight', fighters: screen.fighters, stage: ground })}
          onBack={() => setScreen({ kind: 'select' })}
        />
      );
    case 'fight':
      return (
        <>
          <Fight fighters={screen.fighters} stage={screen.stage} p2={p2} onBack={() => setScreen({ kind: 'select' })} />
          <FightUi fighters={screen.fighters} p2={p2} assets={{ client: client.current, races: loaded.races, portraits: loaded.portraits }} />
        </>
      );
  }
}
