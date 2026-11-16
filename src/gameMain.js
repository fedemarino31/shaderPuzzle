import { ARGameApp } from './game/ARGameApp.js';

const app = new ARGameApp({
	viewport: document.getElementById('gameViewport'),
	menu: document.getElementById('menu'),
	grid: document.getElementById('materialGrid'),
	enterButton: document.getElementById('enterAR'),
	status: document.getElementById('menuStatus'),
	error: document.getElementById('gameError'),
});
app.init();
