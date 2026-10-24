import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ClassEntry, Race } from '@mogshot/character/appearance';
import type { Image } from '@mogshot/formats/blp';
import type { LoadingScreen } from '@mogshot/worker/api';
import { DataClient } from '@mogshot/worker/client';
import { Fight } from './Fight';
import { type BuiltFighter, Fighters } from './fighters';
import { messageOf, useFolder } from './folder';
import { pictureUrl } from './pixels';
import { Select, type Source } from './Select';
import { Title } from './Title';
import { Versus } from './Versus';

/*
 * The screens: the title with the folder drop, CHOOSE YOUR CHAMPION, the VS screen with the
 * stage pick, and the fight. Everything the game knows about the open folder is loaded once
 * here and handed down.
 */

type Screen =
  | { kind: 'select' }
  | { kind: 'versus'; fighters: [BuiltFighter, BuiltFighter] }
  | { kind: 'fight'; fighters: [BuiltFighter, BuiltFighter]; stage: { screen: LoadingScreen | undefined; image: Image | undefined } };

interface Loaded {
  races: Race[];
  classes: ClassEntry[];
  portraits: { races: Map<string, string>; classes: Map<string, string> };
  screens: LoadingScreen[];
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
    void (async () => {
      try {
        const [races, classes, portraits, screens] = await Promise.all([
          data.races(),
          data.classList(),
          data.portraits().catch((cause: unknown) => {
            console.warn('The game\'s portraits could not be read:', cause);
            return { races: {}, classes: {}, problems: [] };
          }),
          data.backdrops().catch(() => [] as LoadingScreen[]),
        ]);
        if (stale) return;
        if (portraits.problems.length > 0) console.warn('Portraits:', portraits.problems.join('; '));
        const urls = (images: Record<string, Image>) => new Map(Object.entries(images).map(([key, image]) => [key, pictureUrl(image)]));
        setLoaded({
          races,
          classes,
          portraits: { races: urls(portraits.races), classes: urls(portraits.classes) },
          screens,
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
          screens={loaded.screens}
          onFight={(stageScreen, image) => setScreen({ kind: 'fight', fighters: screen.fighters, stage: { screen: stageScreen, image } })}
          onBack={() => setScreen({ kind: 'select' })}
        />
      );
    case 'fight':
      return <Fight fighters={screen.fighters} stage={screen.stage} p2={p2} onBack={() => setScreen({ kind: 'select' })} />;
  }
}
