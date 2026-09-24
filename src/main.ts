import './style.css';
import './ui/menu.css';
import './ui/hud.css';
import './ui/map.css';
import { FrontlinesApp } from './app/FrontlinesApp';

const canvas = document.querySelector<HTMLCanvasElement>('#battlefield');
if (!canvas) throw new Error('Battlefield canvas is missing.');

new FrontlinesApp(canvas);
document.getElementById('boot-status')?.remove();
