# DynamicMenu — librería

Componente de menú dinámico (React) renderizable en **DOM** y en **`<canvas>`**
(este último apto para usarse como textura en Three.js / WebGL / VR).

El CSS (subset propio de Bootstrap + tipografía **Roboto Mono** embebida en
base64) se inyecta inline al montar: **no hay que copiar Bootstrap, ni
archivos de fuentes, ni imágenes**. El único asset externo opcional es
FontAwesome, y sólo si usás iconos en las solapas.

## Características

- API imperativa simple: `createMenu()` → `addTab()` → `addItem()`.
- Controles incluidos: **slider**, **select**, **switch**, **button** (uno o
  varios por fila), **treeList** (árbol anidado), **separator** y **folder**
  (grupo colapsable).
- Enlace bidireccional opcional a propiedades de un objeto (`sync()` + `listen()`).
- **Navegación por foco independiente del dispositivo** (D-pad en pantalla,
  teclado, gamepad o joystick VR) mediante métodos — sin acoplar a hardware.
- Render alternativo a `<canvas>` con `CanvasRenderer`, con hit-testing y
  entrada por puntero/UV pensada para superficies 3D/VR.
- Estilo autocontenido: una sola etiqueta `<script>`, sin dependencias de CSS.

## Contenido de este paquete

| Archivo | Qué es |
|---------|--------|
| `dynamicMenu_createMenu.js` (+ `.map`) | Bundle ES del menú. Expone `createMenu()`. |
| `dynamicMenu_CanvasRenderer.js` (+ `.map`) | Renderizador del menú a `<canvas>`. Expone `CanvasRenderer`. |
| `dynamicMenu_protocol_<hash>.js` (+ `.map`) | Chunk compartido por los dos anteriores (versión del contrato). **Obligatorio**: copialo junto a ellos. |
| `dynamicMenu-API.md` | Referencia completa de la API (generada de los JSDoc). |
| `dynamicMenu-readme.md` | Este documento. |
| `css/fontawesome.css`, `css/solid.css` | FontAwesome Free (iconos de las solapas). |
| `webfonts/fa-solid-900.woff2` | Fuente de iconos de FontAwesome. |

## Uso mínimo

```html
<!-- Único requisito externo: FontAwesome, para los iconos de las solapas -->
<link rel="stylesheet" href="dist-lib/css/fontawesome.css" />
<link rel="stylesheet" href="dist-lib/css/solid.css" />

<div id="menu-root"></div>

<script type="module">
  import { createMenu } from './dist-lib/dynamicMenu_createMenu.js';

  const menu = await createMenu(document.getElementById('menu-root'));
  const tab = menu.addTab('Settings', 'fa-cog');
  tab.addItem({ type: 'slider', label: 'Volume', min: 0, max: 1, initialValue: 0.5 })
     .onChange((v) => console.log('volume:', v));
</script>
```

> El estilo del menú se inyecta solo (incluye la fuente Roboto Mono). Si no
> usás iconos de FontAwesome en las solapas podés omitir los dos `<link>`.

`createMenu()` devuelve una **promesa**: resuelve cuando el componente React ya
está montado y la API lista. Por eso conviene usar `await` (o `.then(menu => …)`).

## Opciones del constructor

`createMenu(container, options)` acepta un segundo argumento con la
configuración. Todas las opciones son opcionales:

| Opción | Tipo | Default | Qué hace |
|--------|------|---------|----------|
| `focusNavigation` | `boolean` | `false` | Habilita la navegación por foco (`moveUp/Down/Left/Right`, `activate`, `press/release`). Con `false` esos métodos son no-op. Ver [Navegación por foco](#navegación-por-foco-d-pad--teclado--vr). |
| `collapsibleFolders` | `boolean` | `true` | Si es `true`, las carpetas (`tab.addFolder()`) se pueden abrir/cerrar clickeando su encabezado. Con `false` quedan como grupos visuales siempre abiertos (evita resizes del canvas). |
| `enableTweening` | `boolean` | `false` | Activa por defecto la animación *tween* de los sliders. |
| `notifyOnMount` | `boolean` | `false` | Si es `true`, dispara `onUiChange` una vez apenas se monta, con el estado inicial de todos los controles. |
| `onUiChange` | `Function \| null` | `null` | Callback global que se llama ante cualquier cambio visual. Recibe `{ ts }` (sólo avisa "algo cambió"). Para saber QUÉ control cambió usá `item.onChange()`. Se puede reemplazar luego con `menu.onUiChange(cb)`. |

```js
const menu = await createMenu(menuRoot, {
  focusNavigation: true,      // queremos manejarlo con D-pad / teclado
  collapsibleFolders: true,
  notifyOnMount: true,
  onUiChange: () => repintarMiApp(),
});
```

## Tabs, controles y carpetas

### Agregar tabs

```js
const sizeTab  = menu.addTab('Tamaño', 'fa-ruler-combined');
const colorTab = menu.addTab('Color', 'fa-palette');
```

El segundo argumento de `addTab` es una clase de FontAwesome (`'fa-cog'`) o un
glifo Unicode directo. `addTab` devuelve un **TabHandler**.

### Agregar controles

`tab.addItem()` tiene dos firmas:

```js
// 1) Config suelto: vos manejás el valor en el onChange.
sizeTab.addItem({ type: 'slider', label: 'tamaño', min: 20, max: 200, step: 1, initialValue: 80 })
       .onChange((v) => { state.size = v; });

// 2) Enlazado a un objeto: el menú lee/escribe `obj.prop` solo.
const external = { level: 40 };
sizeTab.addItem(external, 'level', { type: 'slider', label: 'nivel', min: 0, max: 100, step: 1 })
       .onChange((v) => { state.level = v; })
       .listen(); // habilita que menu.sync() vuelva a leer el objeto
```

Si algo externo modifica el objeto enlazado, llamá `menu.sync()` para que el
control (marcado con `.listen()`) se reposicione.

**Campos de config por tipo de control:**

| type | requeridos | opcionales |
|------|------------|------------|
| `slider` | `label`, `min`, `max` | `step`, `easing`, `initialValue` |
| `select` | `label`, `options` (array o `{ clave: etiqueta }`) | `initialValue` |
| `switch` | `label` | `initialValue` (boolean) |
| `button` | `buttons` (array de strings) o `label` (botón único) | `rowLabel`, `action(idx, label)` |
| `treeList` | `label`, `tree` (objeto anidado o array) | `initialValue` (array de path) |
| `separator` | — | — |

```js
// select con array (el valor es el texto elegido)
colorTab.addItem({ type: 'select', label: 'forma', options: ['square', 'circle', 'triangle'] });

// select con mapa { clave: etiqueta } → el onChange recibe la CLAVE
colorTab.addItem({ type: 'select', label: 'mezcla', options: { normal: 'Normal', multiply: 'Multiplicar' } });

// fila de botones: action recibe (índice, etiqueta) del botón pulsado
colorTab.addItem({ type: 'button', rowLabel: 'paleta', buttons: ['Cálida', 'Fría', 'Neón'],
                   action: (idx, label) => aplicarPreset(label) });

// treeList anidado: el valor es el path completo hasta la hoja
animTab.addItem({ type: 'treeList', label: 'efecto',
                  tree: { Entrada: { Suave: ['fade', 'slide'] }, Salida: { Brusco: ['burst'] } },
                  initialValue: ['Entrada', 'Suave', 'fade'] });
```

### Carpetas (grupos colapsables)

```js
const deco = sizeTab.addFolder('Decoración', { collapsed: true });
deco.addItem({ type: 'slider', label: 'borde', min: 0, max: 20, step: 1 });
deco.addItem({ type: 'switch', label: 'sombra' });
```

`addFolder(label, opts)` devuelve un **FolderHandler** con la misma API que un
tab (`addItem` / `removeItem`). `opts.collapsed` arranca cerrada;
`opts.collapsible` decide si el encabezado responde al click (por defecto hereda
la opción `collapsibleFolders` del menú).

### Estructura dinámica

Podés agregar y quitar controles en cualquier momento con
`tab.addItem()` / `tab.removeItem(handler)`, y cambiar las opciones de un select
en vivo con `item.updateOptions([...])` (o `menu.updateSelectOptions(...)`).

## Navegación por foco (D-pad / teclado / VR)

### Ajuste continuo del slider enfocado

Con `focusNavigation: true`, una entrada analógica puede ajustar continuamente
el slider enfocado mediante deltas normalizados respecto de su rango completo:

```js
if (menu.beginFocusedValueAdjustment()) {
  menu.adjustFocusedValue(0.002);
  menu.adjustFocusedValue(0.004);
  menu.adjustFocusedValue(-0.001);
  menu.endFocusedValueAdjustment();
}
```

`adjustFocusedValue(0.01)` suma el 1% del rango completo. Los movimientos
menores que `step` se acumulan, cada cambio visible se publica como
`controlChange` y `endFocusedValueAdjustment()` emite un único
`controlCommit`. El slider queda fijado al iniciar la sesión aunque luego se
mueva el foco. Estas actualizaciones también se dibujan inmediatamente en
`CanvasRenderer` aunque esté configurado en modo `commitOnly`; el commit final
sigue emitiéndose una sola vez al terminar la sesión.

DynamicMenu no interpreta joysticks, dead zones, velocidades ni tiempo. El
consumidor debe convertir su entrada analógica y el tiempo transcurrido en el
`normalizedDelta` enviado en cada llamada.

La idea: el menú expone **métodos** para moverse y accionar, sin atarse a ningún
dispositivo. Vos decidís de dónde vienen los eventos (botones en pantalla,
teclado, gamepad, joystick VR…). Para usarlo, creá el menú con
`focusNavigation: true`.

Un **cursor** (recuadro ámbar) resalta la solapa, fila o sub-elemento enfocado,
tanto en el DOM como en el render por canvas.

El cursor comienza oculto aunque `focusNavigation` esté habilitado. La primera
llamada a `moveDown()` lo activa en la barra de solapas sobre el tab actual; la
siguiente continúa desde allí. Cualquier interacción por puntero dentro del
menú HTML o del `CanvasRenderer` lo oculta y resetea. También puede hacerse de
forma explícita con `menu.deactivateFocusNavigation()`.

### Modelo de navegación

- En la **barra de solapas**: `left/right` cambian de tab; `down` baja al primer
  control del tab.
- En el **panel** de controles: `up/down` cambian de fila; `up` desde la primera
  fila vuelve a las solapas.
- `left/right` sobre un control dependen del tipo: slider (−/+ valor), select
  (opción anterior/siguiente), fila de botones (mueve el sub-foco), switch
  (off/on), treeList (navega opciones/niveles).
- `activate` ejecuta: dispara el botón enfocado, togglea el switch, confirma el
  treeList, etc.

### Métodos

```js
if (menu.isFocusNavEnabled()) {
  menu.moveUp(); menu.moveDown(); menu.moveLeft(); menu.moveRight();
  menu.activate();
}
```

`isFocusNavEnabled()` devuelve si la navegación está habilitada en la
configuración, no si el cursor está visible (útil para mostrar u ocultar un
D-pad). Cada `move*` realiza **un paso** discreto una vez activado el cursor.

### Sostener (press / release)

Para no tener que hacer muchos clics, `press(dir)` / `release(dir)` permiten
**mantener apretado**: la acción se ejecuta una vez y luego se auto-repite
mientras esté sostenida (ideal para rampear el valor de un slider). `dir` es
`'up' | 'down' | 'left' | 'right' | 'activate'`. `'activate'` dispara una sola
vez (no se repite).

```js
// D-pad en pantalla: pointerdown = press, soltar/salir = release
btn.addEventListener('pointerdown', (e) => { e.preventDefault(); menu.press(dir); });
btn.addEventListener('pointerup',    () => menu.release(dir));
btn.addEventListener('pointerleave', () => menu.release(dir));

// Mismo destino, otro dispositivo: el teclado (ignorando el auto-repeat del SO)
const KEY = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'activate' };
window.addEventListener('keydown', (e) => {
  const dir = KEY[e.key];
  if (!dir || e.repeat) return;
  e.preventDefault();
  menu.press(dir);
});
window.addEventListener('keyup', (e) => {
  const dir = KEY[e.key];
  if (dir) menu.release(dir);
});
```

> Un controlador VR usaría exactamente lo mismo: `press('left')` al gatillar y
> `release('left')` al soltar. Ver el ejemplo completo en
> `pages/dynamicMenuExample.html`.

## Render en `<canvas>` / 3D / VR

`CanvasRenderer` dibuja un snapshot del menú en un `<canvas>` (dos capas
compuestas: estática y dinámica), apto como textura WebGL.

```js
import { CanvasRenderer } from './dist-lib/dynamicMenu_CanvasRenderer.js';

const renderer = new CanvasRenderer({ canvas, scale: 2 });
renderer.setState(menu.getMenuState());        // estado inicial
menu.subscribe((evt) => renderer.applyEvent(evt)); // mantenerlo sincronizado
```

Para que el canvas sea **interactivo**, reenviá los eventos de puntero (o el UV
de la intersección del rayo, en VR) y devolvé los comandos al menú:

```js
renderer.onCommand = (cmd) => menu.executeCommand(cmd);

// Puntero 2D normalizado [0,1] sobre el canvas:
canvas.addEventListener('mousedown', (e) => {
  const r = canvas.getBoundingClientRect();
  renderer.pointerDown((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
});

// En VR/3D: calcular el UV de la intersección rayo-plano y llamar a
// renderer.pointerEventUV('down' | 'move' | 'up', u, v).
```

## Eventos del menú

`menu.subscribe(listener)` recibe objetos `{ type, ... }`. Tipos:
`tabChange`, `structureChange`, `controlChange`, `controlCommit`,
`focusChange` y `visibilityChange`. Usá `menu.unsubscribe(listener)` para
desuscribirte. Estos eventos son los que consume internamente el
`CanvasRenderer`.

## API completa

Este README cubre el uso habitual. Para la referencia exhaustiva (todos los
métodos, parámetros y tipos) ver **`dynamicMenu-API.md`**, generado a partir de
los JSDoc del código.

## Licencias / créditos

- Subset de utilidades CSS inspirado en **Bootstrap 4** y el tema Bootswatch
  *Slate* — MIT License — © The Bootstrap Authors.
- **Roboto Mono** (embebida en el CSS) — Apache License 2.0 — © Google.
- **Font Awesome Free** — código MIT, fuentes SIL OFL 1.1, glifos CC BY 4.0.
  *Icons by Font Awesome (https://fontawesome.com) — licensed under CC BY 4.0.*
