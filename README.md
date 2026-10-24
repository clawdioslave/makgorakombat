# MAK'GORA KOMBAT

BLOOD. HONOR. FATALITY.

A one-on-one fighting game played with World of Warcraft characters, in your browser, drawn from the game files already on your computer. No account, no server: drop your World of Warcraft folder on the page and the fighters, their gear and their animations are read from your own install and never leave your machine.

Play: https://realworldbuilder.github.io/makgorakombat/

## How it plays

1. Drag your `World of Warcraft` folder onto the page (it is in `Applications` on a Mac). Chrome on a Mac is what it is made for.
2. **CHOOSE YOUR CHAMPION.** Every race the game lets you create is on the grid, in the game's own portraits; your own characters, as captured by the [Mogshot addon](https://github.com/realworldbuilder/mogshot/tree/main/addon/Mogshot), are in the row above with their real gear. Both players' cursors are on the grid at once. Resting on a tile summons that champion full size on your side; choosing makes them roar.
3. The **VS** screen: pick a stage from the game's loading screens.
4. Best of three rounds, sixty seconds each. Take the other champion's health to nothing and they are dazed: **FINISH THE MAK'GORA!** A heavy blow then is **DISHONOR!**; a round won untouched is **HONOR RESTORED**.

Every move is one of the character's own animations: Ready stances by weapon, Attack and Special swings, the directed spell cast, battle roars, cheers, combat wounds, knockdowns and deaths, as the game plays them.

### Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move | A / D | ← / → |
| Jump | W | ↑ |
| Light attack | J | , or Numpad 1 |
| Heavy attack | K | . or Numpad 2 |
| Spell | L | / or Numpad 3 |
| Block (hold) | U | Right Shift or Numpad 0 |

On the roster: WASD / arrows move the cursor, J or , choose, H or M go back, U or Right Shift switch sex, K L or . / cycle the class. **Tab** switches player 2 between the keyboard, a gamepad and the computer. **Enter** rematches, **Esc** goes back, **F3** shows frame times.

## Running it yourself

```
git clone --recurse-submodules https://github.com/realworldbuilder/makgorakombat.git
cd makgorakombat
pnpm install
pnpm dev
```

The engine (CASC reader, model and animation parsers, skinning, WebGL renderer, the worker that reads the folder) is [Mogshot](https://github.com/realworldbuilder/mogshot), brought in as the submodule `vendor/mogshot`. To work on both at once, point the game at a checkout of Mogshot: `MOGSHOT_SRC=../mogshot/src pnpm dev`.

`pnpm test` runs the engine's tests (the fight itself is deterministic and runs without a browser). `pnpm build` makes the static site in `dist/`; a push to `main` deploys it to GitHub Pages.

## A fan game

World of Warcraft and its art are Blizzard Entertainment's, and are only ever read from your own copy of the game. Mortal Kombat is NetherRealm's and Warner Bros.'; this borrows the shape of its fights and nothing of its assets. Not affiliated with either.
