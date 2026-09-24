import './style.css';
import './operations.css';
import './responsive.css';
import './field-command.css';
import { FrontlinesApp } from './app/FrontlinesApp';

const canvas = document.querySelector<HTMLCanvasElement>('#battlefield');
if (!canvas) throw new Error('Battlefield canvas is missing.');

new FrontlinesApp(canvas);
