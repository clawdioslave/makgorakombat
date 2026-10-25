import { useEffect, useRef, useState } from 'preact/hooks';
import { meet, mismatch } from './net/handshake';
import { cleanCode, createRoom, Link, relayUrl, type Role } from './net/relay';

/*
 * PLAY ONLINE: two players, two machines, one room code. HOST makes a room on the relay and
 * shows its code to read out or paste; JOIN takes the code. The panel opens on the choice, so
 * a guest makes no room it does not need. Once both are in and their pages
 * agree on the game's version, the roster opens with the host as player 1 and the guest as
 * player 2. The same panel as the guide.
 */

/** Two pages that have met in a room and can fight. */
export interface Session {
  link: Link;
  role: Role;
  /** The host plays player 1, the guest player 2. */
  me: 0 | 1;
  code: string;
  /** The other install: 'wow', 'wow_classic' ... */
  theirProduct: string;
}

interface OnlineProps {
  /** This install's product, told to the other page. */
  product: string;
  onReady: (session: Session) => void;
  onClose: () => void;
}

type Tab = 'host' | 'join';

/** Waits for the other page in the room and the handshake's first step: both say their version, and a different one is refused. */
function meetPeer(link: Link, product: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let said = false;
    const say = () => {
      if (said || !link.peer) return;
      said = true;
      link.send(meet(product));
    };
    const off = link.listen((message) => {
      if (message.t === 'peer') say();
      else if (message.t === 'meet') {
        say();
        off();
        offClose();
        const wrong = mismatch(message);
        if (wrong) reject(new Error(wrong));
        else resolve(message.product);
      }
    });
    const offClose = link.onClose(() => {
      off();
      reject(new Error('The room closed before your opponent came in.'));
    });
    say();
  });
}

export function Online({ product, onReady, onClose }: OnlineProps) {
  const [tab, setTab] = useState<Tab>();
  const [code, setCode] = useState<string>();
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const link = useRef<Link>(null);
  const done = useRef(false);
  const field = useRef<HTMLInputElement>(null);

  /** Leaves whatever room this panel was in, unless the fight has it now. */
  const drop = () => {
    if (!done.current) link.current?.close();
    link.current = null;
  };

  const meetThen = async (opened: Link, role: Role, room: string) => {
    link.current = opened;
    setStatus(role === 'host' ? 'Waiting for your opponent…' : 'In the room. Meeting the host…');
    const theirProduct = await meetPeer(opened, product);
    done.current = true;
    onReady({ link: opened, role, me: role === 'host' ? 0 : 1, code: room, theirProduct });
  };

  // HOST makes a room as soon as its tab is open.
  useEffect(() => {
    if (tab !== 'host') return;
    let stale = false;
    setError(undefined);
    setStatus('Making a room…');
    void (async () => {
      try {
        const room = await createRoom();
        if (stale) return;
        setCode(room);
        const opened = await Link.open(room, 'host');
        if (stale) {
          opened.close();
          return;
        }
        await meetThen(opened, 'host', room);
      } catch (cause) {
        if (!stale) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setStatus(undefined);
        }
      }
    })();
    return () => {
      stale = true;
      drop();
      setCode(undefined);
      setStatus(undefined);
      setError(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === 'join') field.current?.focus();
  }, [tab]);

  // Leaving the panel without a fight leaves the room.
  useEffect(() => () => drop(), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.stopPropagation();
        onClose();
      } else if (tab === undefined && (event.code === 'KeyH' || event.code === 'KeyJ')) {
        // H or J on the choice; the letters typed into the code field are the field's.
        event.stopPropagation();
        event.preventDefault();
        setTab(event.code === 'KeyH' ? 'host' : 'join');
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, tab]);

  const join = async () => {
    const room = cleanCode(typed);
    if (room.length !== 6) {
      setError('A room code is six letters.');
      return;
    }
    drop();
    setError(undefined);
    setStatus('Joining…');
    try {
      await meetThen(await Link.open(room, 'guest'), 'guest', room);
    } catch (cause) {
      drop();
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus(undefined);
    }
  };

  const copy = () => {
    if (!code) return;
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div class="guide-backdrop" onClick={onClose}>
      <div class="guide online" onClick={(event) => event.stopPropagation()}>
        <nav class="tabs">
          <button class={tab === 'host' ? 'here' : ''} type="button" onClick={() => setTab('host')}>HOST</button>
          <button class={tab === 'join' ? 'here' : ''} type="button" onClick={() => setTab('join')}>JOIN</button>
          <button class="close" onClick={onClose} aria-label="Close" type="button">✕</button>
        </nav>
        {tab === undefined ? (
          <div class="body online-choose">
            <p class="dim">One of you hosts a room; the other joins it with its six letters.</p>
            <div class="choices">
              <button type="button" class="button" onClick={() => setTab('host')}>HOST · H</button>
              <button type="button" class="button" onClick={() => setTab('join')}>JOIN · J</button>
            </div>
            <p class="dim small">Each of you needs the game open with your own World of Warcraft folder. Through {relayUrl().replace(/^https?:\/\//, '')}.</p>
          </div>
        ) : tab === 'host' ? (
          <div class="body online-host">
            <p class="dim">Give your opponent this code. They choose PLAY ONLINE, then JOIN.</p>
            <div class="code" aria-live="polite">{code ?? '······'}</div>
            <button type="button" class="button" onClick={copy} disabled={!code}>
              {copied ? 'COPIED' : 'COPY THE CODE'}
            </button>
            {status && <p class="waiting">{status}</p>}
            {error && <p class="bad">{error}</p>}
            <p class="dim small">You are player 1 and pick the ground. Through {relayUrl().replace(/^https?:\/\//, '')}; SETTINGS can name another relay.</p>
          </div>
        ) : (
          <div class="body online-join">
            <p class="dim">The six letters the host reads out.</p>
            <input
              ref={field}
              class="code"
              value={typed}
              maxLength={6}
              spellcheck={false}
              autocomplete="off"
              placeholder="BCDFGH"
              onInput={(event) => setTyped(cleanCode(event.currentTarget.value))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void join();
                }
              }}
            />
            <button type="button" class="button" onClick={() => void join()} disabled={typed.length !== 6}>
              JOIN · ENTER
            </button>
            {status && <p class="waiting">{status}</p>}
            {error && <p class="bad">{error}</p>}
            <p class="dim small">You are player 2. Both of you need the game open with your own World of Warcraft folder.</p>
          </div>
        )}
      </div>
    </div>
  );
}
