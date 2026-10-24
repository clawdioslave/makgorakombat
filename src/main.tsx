import { render } from 'preact';
import { Game } from './game/Game';
import { restoreGameFonts } from './game/ui/fonts';
import './style.css';
import './game/ui/wow.css';

// The game's fonts from an earlier visit, so the title screen is in them before a folder is opened.
restoreGameFonts();

render(<Game />, document.querySelector('#app')!);
