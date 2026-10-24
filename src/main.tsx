import { render } from 'preact';
import { Game } from './game/Game';
import './style.css';

render(<Game />, document.querySelector('#app')!);
