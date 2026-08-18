import { CharacterLabApp } from './characterLab/CharacterLabApp.js';

try {
	const app = new CharacterLabApp(document.getElementById('labViewport'));
	await app.init();
	window.characterLab = app;
} catch (error) {
	const target = document.getElementById('labError');
	target.hidden = false;
	target.textContent = `No se pudo iniciar el laboratorio: ${error.message}`;
	document.querySelector('#engineBadge span').textContent = 'Error de inicialización';
	console.error(error);
}
