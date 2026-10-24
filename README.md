# MAK'GORA KOMBAT

BLOOD. HONOR. FATALITY.

A one-on-one fighting game played with World of Warcraft characters, in your browser, drawn from the game files already on your computer. No account, no server: drop your World of Warcraft folder on the page and the fighters, their gear and their animations are read from your own install and never leave your machine.

Play: https://realworldbuilder.github.io/makgorakombat/

## How it plays

1. Drag your `World of Warcraft` folder onto the page (it is in `Applications` on a Mac). Chrome on a Mac is what it is made for.
2. **CHOOSE YOUR CHAMPION.** Every race the game lets you create is on the grid, in the game's own portraits; your own characters, as captured by the [Mogshot addon](https://github.com/realworldbuilder/mogshot/tree/main/addon/Mogshot), are in the row above with their real gear; above those, the **LEGENDS**: Tyrande, Thrall, Sylvanas, Malfurion, Illidan, Varian, Cairne and Vol'jin, drawn exactly as the game draws them (the NPC's own gear, face and painted body), as far as your install has them. Both players' cursors are on the grid at once. Resting on a tile summons that champion full size on your side; choosing makes them roar.
3. The **VS** screen: pick the ground. The stages are real places in the game world, read from the open folder's map files and raised around the fighters while they wait: Gurubashi Arena's pit, the ring of totems in the Valley of Trials, the Crossroads, the Valley of Heroes, Goldshire's lawn, Sentinel Hill, the gardens of Darnassus, Thunder Bluff's rise, and on a retail install Dalaran and the gate of Icecrown. The strip shows the stages the open install has maps for; past them are the game's loading screens, flat pictures behind the ring, for installs that lack a map.
4. Best of three rounds, sixty seconds each. Take the other champion's health to nothing and they are dazed: **FINISH THE MAK'GORA!** An ability that lands then is **DISHONOR!**; a round won untouched is **HONOR RESTORED**.

### The fight is World of Warcraft's

Hold the attack key and your champion **auto-attacks on the weapon's swing timer** whenever the other is in reach: every 2.0 s with a one-hander or bare hands, 3.4 s with a two-hander, and a bow, gun or crossbow shoots every 3.0 s from anywhere on the stage. A tap queues one swing. Every blow is rolled on the hit table: **miss**, **dodge** (the Dodge animation), **parry** (only from the front, and the parrier's next ability is a sure crit), **block** (a shield takes 40 % off), **crit** (double, the big yellow number) or a plain hit. Spells cannot be dodged or parried; a bolt in flight can still be jumped over.

Each class has **three abilities** on the action bar beside the auto-attack, on a 1.5 s global cooldown and their own cooldowns, paid for in the class's resource, shown under the health bar in its colour: rage (builds on swings and on being hit), energy and focus (regenerate fast), mana (regenerates slowly), runic power and fury (build on swings). Casts fill a bar over the caster's head and are cancelled by moving or by taking damage; an interrupt locks the caster out for two seconds. Stuns (stars over the head), slows, fears, damage over time (a tick every 3 s), heals and absorb shields all float off the fighters as numbers and words, in the game's colours: white for what you deal, red for what you take, yellow and large for a crit. A legend without a class fights as a **champion** with a warrior's kit, or a hunter's behind a bow.

| Class | 1 | 2 | 3 |
|---|---|---|---|
| Warrior (rage) | Charge: closes from afar, stuns 1 s, gives 20 rage | Mortal Strike: 30 rage, 18 damage, 6 s | Execute: 15 rage, 30 damage, only under 20 % health |
| Paladin (mana) | Crusader Strike: 14 damage, 4.5 s | Hammer of Justice: a 2 s stun, 20 s | Holy Light: 2 s cast, heals 35 |
| Hunter (focus) | Aimed Shot: 1.5 s aim, 22 damage | Disengage: leaps back, 15 s, no global cooldown | Kill Shot: 30 damage under 20 % |
| Rogue (energy) | Sinister Strike: 40 energy, 12 damage | Kidney Shot: a 2 s stun, 20 s | Evasion: dodge up for 8 s, 30 s, no global cooldown |
| Priest (mana) | Mind Blast: 1 s cast, 20 damage, 8 s | Shadow Word: Pain: 5 damage every 3 s, five times | Power Word: Shield: absorbs 25, 10 s |
| Death Knight (runic power) | Icy Touch: 10 damage, slows, 6 s | Death Strike: 16 damage and heals 10, 6 s | Death Coil: 40 power, 18 damage |
| Shaman (mana) | Lightning Bolt: 1.5 s cast, 16 damage | Earth Shock: 10 damage and interrupts, 6 s | Stormstrike: 16 damage, 8 s |
| Mage (mana) | Frostbolt: 1.5 s cast, 16 damage, slows 4 s | Fire Blast: 14 damage, instant, 8 s | Blink: 3.5 yards away, 15 s |
| Warlock (mana) | Shadow Bolt: 1.5 s cast, 18 damage | Corruption: 6 damage every 3 s, five times | Fear: 1 s cast, the target flees 2.5 s, 20 s |
| Monk (energy) | Tiger Palm: 25 energy, 10 damage | Rising Sun Kick: 18 damage, 8 s | Leg Sweep: a 2 s stun, 20 s |
| Druid (mana) | Wrath: 1.5 s cast, 14 damage | Moonfire: 8 damage and burns | Rake: 8 damage and bleeds |
| Demon Hunter (fury) | Chaos Strike: 40 fury, 20 damage | Fel Rush: dashes 4 yards, 10 damage, 10 s | Blade Dance: 16 damage on both sides, 9 s |
| Evoker (mana) | Living Flame: 1.5 s cast, 16 damage | Fire Breath: 20 damage and burns, 12 s | Hover: leaps back, 15 s |

Every move is one of the character's own animations: Ready stances by weapon, Attack swings with all their variations, the class's own casts (MagSpellCastBothFront, PriSpellCastBothUp, ShaSpellCastBothFront...), CombatChargeLoop and CombatChargeEnd, CombatExecute, Stormstrike, DeathStrike, FelRush, DHBladeDance, RisingSunKick, Dodge and Parry, battle roars, cheers, combat wounds, stuns, knockdowns and deaths, as the game plays them, with a plain strike or cast standing in where a model lacks one.

### Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move | A / D | ← / → |
| Jump | W | ↑ |
| Attack (hold to auto-attack, tap for one swing) | J | , or Numpad 0 |
| Ability 1 | K | . or Numpad 1 |
| Ability 2 | L | / or Numpad 2 |
| Ability 3 | U | Right Shift or Numpad 3 |

There is no block key: a shield blocks and a weapon parries on their own, as in the game. On a gamepad the abilities are A B X, the right trigger attacks, Y, a bumper or up jumps.

On the roster: WASD / arrows move the cursor, J or , choose, H or M go back, U or Right Shift switch sex, K L or . / cycle the class. **Tab** switches player 2 between the keyboard, a gamepad and the computer. **Enter** rematches, **Esc** goes back, **M** mutes, **F3** shows frame times.

The fight's sound is read from the game folder like everything else: weapon swings and impacts by the weapon's subclass, the race's own grunts, wounds, death cry and battle roar, a spell for the class (Fireball for a mage, Shadow Bolt for a warlock, Lightning Bolt for a shaman...), and a gong for each round. Browsers keep audio off until a key is pressed, so the first round may start quiet.

## Running it yourself

```
git clone --recurse-submodules https://github.com/realworldbuilder/makgorakombat.git
cd makgorakombat
pnpm install
pnpm dev
```

The engine (CASC reader, model and animation parsers, skinning, WebGL renderer, the worker that reads the folder) is [Mogshot](https://github.com/realworldbuilder/mogshot), brought in as the submodule `vendor/mogshot`. To work on both at once, point the game at a checkout of Mogshot: `MOGSHOT_SRC=../mogshot/src pnpm dev`.

`pnpm test` runs the engine's tests (the fight itself is deterministic and runs without a browser). `pnpm build` makes the static site in `dist/`; a push to `main` deploys it to GitHub Pages.

### Stages

A stage is a spot in the world in `src/game/stages.ts`: the map, the coordinates the game's `/mogshot spot` prints (x north, y west, in yards), a `facing` in degrees anticlockwise from north, and the `reach` in yards the world is drawn to. The fighters stand along the line through the spot that runs the way `facing` points, and the camera looks across it, toward `facing` + 90°, so the backdrop is whatever lies that way: pick the facing so the best view is across the line, not along it. The fight itself is flat; the floor along the line is read from the place once (`src/game/ground.ts`) and each fighter and their shadow is drawn that much higher or lower, so a leaning lawn still works, but a staircase does not. A `z` picks a storey where the highest surface is the wrong one (Dalaran's streets over its sewers).

To try a spot before adding it, render it through Mogshot's command line with the game's camera and look at the PNG:

```bash
pnpm mogshot render spot.json --wow "/Applications/World of Warcraft" --product wow
# spot.json: [{"out": "spot.png", "race": "Human", "sex": "male", "pose": "Ready", "size": {"width": 960, "height": 540, "tight": false},
#             "place": {"map": 0, "x": -13215, "y": 250, "facing": 0}, "camera": {"yaw": -90, "pitch": 7, "fov": 32, "zoom": 2.6}}]
```

A camera `pitch` of 80 and a `zoom` of 40 gives a map of the hundred yards around a spot, for finding the open ground. The thumbnails in `public/stages/<slug>.jpg` are the same render of the empty place (`"empty": true`), shrunk to 320 × 180.

### Legends

A legend is a creature display id in `src/game/roster.ts` (`LEGENDS`), built through the worker's `fighter` request with `npc` set, with a `classId` for the kit it fights with (Tyrande a priest, Thrall and Vol'jin shamans, Sylvanas a hunter, Malfurion a druid, Illidan a demon hunter, Varian and Cairne warriors) and its signature weapon by item id; when the open install lacks that item, the legend takes its class set's weapon rather than fight bare-handed. Only a display drawn on a player model works: the newer looks of most of these characters (Jaina since Mists, retail's Sylvanas and Anduin, the Lich King, Garrosh, Velen, Grommash) are unique models, which is why they are listed with a note and get no tile. Each legend lists its retail look first and its classic one after it; the game uses the first one the open folder has, so the row is shorter on the classic beta.

To check or add one, with Mogshot's command line pointed at an install (`--wow`, `--product`):

```bash
pnpm mogshot npcs Thrall          # the display ids the files name for a character
pnpm mogshot render spec.json     # {"npc": 19015} draws it; a look with a model of its own still draws, but cannot fight
```

The portraits in `public/legends/<slug>.png` are face crops rendered once with the same command (`"camera": {"zoom": 0.3, "panY": -2}` or so, tuned by eye for each model's height), since the browser has no portrait atlas for NPCs.

## A fan game

World of Warcraft and its art are Blizzard Entertainment's, and are only ever read from your own copy of the game. Mortal Kombat is NetherRealm's and Warner Bros.'; this borrows the shape of its fights and nothing of its assets. Not affiliated with either.
