# Puzzle connection sound

The game currently uses the preferred generated sound from:

- `audios/bonus1.mp3`

Vite bundles the MP3 with the game. It is played at the center of the joined contact faces using WebAudio spatialization. If loading fails, the game uses a short synthesized fallback sound.
