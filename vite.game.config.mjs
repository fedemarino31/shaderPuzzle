import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Build de produccion SOLO del juego (game.html) para subir a un hosting.
// base './' => todas las rutas generadas son relativas (funciona en subcarpetas).
export default defineConfig({
	base: './',
	publicDir: false,
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		rollupOptions: {
			input: {
				game: resolve(import.meta.dirname, 'game.html'),
			},
		},
	},
});
