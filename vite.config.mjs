import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
	plugins: [basicSsl({ name: 'ShadersPuzzle local development' })],
	server: {
		host: '0.0.0.0',
		port: 10001,
		strictPort: true,
		https: true,
	},
	preview: {
		host: '0.0.0.0',
		port: 10001,
		strictPort: true,
		https: true,
	},
	build: {
		outDir: 'dist',
		rollupOptions: {
			input: {
				launcher: resolve(import.meta.dirname, 'index.html'),
				pieceEditor: resolve(import.meta.dirname, 'piece-editor.html'),
				shaderEditor: resolve(import.meta.dirname, 'shader-editor.html'),
				game: resolve(import.meta.dirname, 'game.html'),
				infinityMirror: resolve(import.meta.dirname, 'infinity-mirror.html'),
				characterLab: resolve(import.meta.dirname, 'character-lab.html'),
			},
		},
	},
	base: './',
});
