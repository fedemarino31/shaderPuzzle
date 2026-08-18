# ShadersPuzzle — compatibilidad WebXR y diagnóstico de pantalla negra

**Estado:** correcciones VR y AR incorporadas  
**Área:** juego XR (`game.html`)  
**Renderer compatible:** `THREE.WebGLRenderer`  
**Entorno de prueba de escritorio:** Immersive Web Emulator para Chrome

---

## 1. Síntoma observado

Al iniciar el puzzle mediante una sesión `immersive-vr`, la escena tridimensional no se veía. La salida permanecía prácticamente negra y sólo aparecía un círculo blanco al mirar hacia el piso.

El círculo no pertenecía al puzzle: era una ayuda visual o retículo proporcionado por el entorno de emulación. Su presencia indicaba que la sesión XR había comenzado, pero no que el framebuffer de Three.js estuviera siendo presentado correctamente.

## 2. Causa de compatibilidad

El juego utilizaba:

```js
new THREE.WebGPURenderer({ antialias: true, forceWebGL: true });
```

Aunque `forceWebGL` hace que `WebGPURenderer` emplee un backend WebGL, no lo convierte en el `WebGLRenderer` clásico. Ambos renderers poseen integraciones XR y rutas de framebuffer diferentes.

Immersive Web Emulator intercepta y emula principalmente la ruta WebXR WebGL estándar. La combinación del emulador con el backend WebGL de `WebGPURenderer` podía crear una sesión activa sin presentar el contenido renderizado. Esto explica que tampoco aparecieran objetos de diagnóstico con `MeshBasicMaterial`: el problema ocurría antes del shader y del contenido de la escena.

Además, el soporte de **WebXR Layers API** del emulador no debe asumirse equivalente al de un visor real. La documentación del emulador indica que Layers funciona mediante un polyfill adicional. Por este motivo, el juego no debe depender obligatoriamente de `XRProjectionLayer` ni modificar indicadores privados de Three.js para forzar una ruta específica.

## 3. Correcciones incorporadas

### 3.1 Renderer WebGL nativo

El juego XR ahora importa Three.js desde `three` y crea:

```js
new THREE.WebGLRenderer({ antialias: true, alpha: true });
```

También configura `SRGBColorSpace` y WebXR. VR usa `local-floor`; AR usa `local`, que evita convertir el soporte de piso en un requisito para iniciar el passthrough. El canal alfa es obligatorio para que el compositor AR pueda mostrar la cámara o el entorno real detrás de la geometría virtual.

Esta decisión se limita al juego XR. Los editores que necesitan TSL o WebGPU pueden conservar sus renderers actuales de forma independiente.

### 3.2 Negociación estándar de la capa XR

Se eliminó la escritura sobre la propiedad privada:

```js
renderer.xr._supportsLayers
```

Three.js debe decidir si usa `XRProjectionLayer` o `XRWebGLLayer` según las capacidades anunciadas por el navegador, el visor o el emulador. No se debe depender de propiedades internas, porque pueden cambiar entre versiones y porque forzar una ruta puede dejar el framebuffer sin composición.

Las sesiones solicitan `layers` únicamente como característica opcional. VR conserva el baseline anterior:

```js
{
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['bounded-floor', 'hand-tracking', 'layers']
}
```

La ausencia de Layers no debe impedir el inicio de la experiencia.

AR solicita `immersive-ar` con `hand-tracking`, `hit-test`, `local-floor` y `layers` como características opcionales. Ninguna de ellas bloquea el inicio; la interacción utiliza controladores cuando existen y pinch mediante hand tracking en visores compatibles.

### 3.3 Materiales PBR del puzzle compatibles con WebGL

El juego usa `MeshStandardMaterial` y personaliza su color procedural mediante `onBeforeCompile`. De esta manera conserva el pipeline PBR estándar de Three.js —iluminación, environment map, metalness y roughness— sin depender de los materiales TSL de `WebGPURenderer`.

Los seis campos procedurales del editor tienen implementaciones GLSL equivalentes para el juego:

- Spherical Waves;
- Directional Stripes;
- 3D Grid;
- Repeated Spheres;
- Repeated Boxes;
- Pulse Wave Train.

Todos usan el atributo `_uvw` compartido por las piezas y pueden seleccionarse desde el panel **Shader > Material**. Sus parámetros están definidos directamente en `src/game/GameMaterials.js`; el menú del juego no expone uniforms editables.

Los valores PBR iniciales son `metalness = 0.9`, `roughness = 0.16` y `envMapIntensity = 2.2`. Esta modificación no afecta el editor de shaders; sólo evita que el juego XR dependa del pipeline de nodos de `WebGPURenderer`.

### 3.4 Tren de ondas UVW y trigger XR

`Pulse Wave Train` usa el atributo global `_uvw` de cada pieza para representar un pulso como si el puzzle estuviera ensamblado, incluso cuando sus piezas se encuentran dispersas. El shader del editor sigue implementado con TSL, mientras que el juego mantiene una versión GLSL dentro de `MeshStandardMaterial.onBeforeCompile`.

Al presionar el trigger de cualquiera de los dos controladores se lanza un raycast exclusivamente contra las piezas. El punto de impacto se transforma al espacio local del triángulo y `_uvw` se interpola con coordenadas baricéntricas. Ese valor pasa a `uPuzzlePulseOrigin` y el reloj independiente `uPuzzlePulseTime` vuelve a cero, produciendo un frente intenso de forma inmediata. Grip y pinch permanecen reservados para agarrar.

El perfil cromado utiliza mapas provisionales de normal, roughness y entorno en `models/Maps`. Los GLB existentes no requieren UV convencionales: el juego los genera en memoria desde `_uvw`. Si el environment map no carga, se conserva `RoomEnvironment`; ningún fallo de asset debe impedir el inicio de VR o AR.

### 3.5 Recentrado inicial del espacio de juego

Una referencia `local-floor` puede heredar un origen de guardian o área física alejado del visor. Al iniciar cada sesión se reinician:

- `worldOffset`;
- `worldYRotation`;
- el estado pendiente de alineación inicial.

Cuando llega la primera pose válida del visor, se ajusta el desplazamiento horizontal para colocar al usuario en `X/Z = 0`, frente al volumen del puzzle, cuyo centro está aproximadamente en `Z = -2.05 m`.

En VR la altura no se fuerza: se conserva la coordenada vertical entregada por `local-floor`.

En AR se usa el espacio garantizado `local`. La primera pose se transforma una sola vez para ubicar al visor a la altura de presentación del puzzle. Después se mantiene estable respecto del mundo real: se desactivan vuelo y snap-turn, y el desplazamiento debe realizarse físicamente.

### 3.6 Diagnóstico visual

Se eliminó completamente el fog de la escena para que no pueda ocultar geometría distante o mal posicionada.

La esfera wireframe de diagnóstico fue retirada una vez estabilizada la ruta WebGL XR. El grid se conserva en escritorio y VR, pero se oculta en AR para no cubrir el piso real. En AR la escena utiliza `background = null` y `clearAlpha = 0`; al terminar la sesión se restauran el fondo opaco y el grid.

Si no aparece ninguna geometría, se debe probar temporalmente un `MeshBasicMaterial` pequeño frente al visor y revisar sesión, framebuffer, renderer o configuración del emulador antes de atribuir el fallo al shader del puzzle.

## 4. Procedimiento de prueba con Immersive Web Emulator

1. Abrir las herramientas de desarrollo de Chrome y habilitar el dispositivo en el panel WebXR del emulador.
2. Cargar `game.html` desde el servidor HTTPS de Vite.
3. Antes de repetir una prueba después de cambiar el renderer, terminar la sesión XR existente.
4. Realizar una recarga completa con `Ctrl+Shift+R`. El renderer y el contexto WebGL anteriores permanecen activos mientras viva la página.
5. Probar **ENTER VR** y **ENTER AR** en sesiones independientes.
6. En VR, confirmar la aparición del grid y de las piezas. En AR, confirmar que el fondo sea transparente, que el grid esté oculto y que las piezas se compongan sobre el entorno.
7. Verificar que el stick permita vuelo únicamente en VR y que controladores o pinch puedan agarrar piezas en ambos modos cuando el dispositivo anuncie esos inputs.
8. Seleccionar **Pulse Wave Train**, apuntar a distintas piezas y confirmar que ambos triggers reubiquen el origen sin interferir con grip o pinch.

Conviene probar también una muestra WebXR básica del propio ecosistema Immersive Web. Si esa muestra tampoco presenta geometría, el problema pertenece a la extensión, a sus permisos o a la configuración de Chrome y no a ShadersPuzzle.

## 5. Matriz de compatibilidad esperada

| Entorno | Ruta recomendada | Observación |
| --- | --- | --- |
| Immersive Web Emulator | `WebGLRenderer` + negociación automática | Es la configuración principal para desarrollo de escritorio. |
| Meta Quest Browser VR | `immersive-vr` + `local-floor` | Evita depender de capacidades experimentales de WebGPU XR. |
| Meta Quest Browser passthrough | `immersive-ar` + framebuffer alfa + `local` | Requiere probar composición e interacción en hardware real. |
| Navegador sin WebXR | render WebGL de escritorio | El juego funciona como espectador, sin sesión inmersiva. |
| WebGPU XR experimental | no requerido | No forma parte del baseline compatible del juego. |

## 6. Reglas para cambios futuros

- No reemplazar `WebGLRenderer` en el juego XR sin validar VR y AR en IWE y en un visor real.
- No acceder ni modificar propiedades privadas de `renderer.xr`.
- Mantener `layers` como opcional mientras no exista una necesidad funcional concreta.
- Probar primero con un material básico si reaparece una pantalla negra.
- Mantener el framebuffer con alfa y el fondo transparente durante `immersive-ar`.
- Validar siempre una sesión nueva después de modificar renderer, contexto o características de `requestSession()`.

## 7. Verificación realizada

Después de las correcciones:

- los 16 tests automatizados del proyecto pasan;
- el build de Vite finaliza correctamente;
- `dist/` se regenera con el juego basado en `WebGLRenderer`.

La comprobación visual final debe realizarse tanto en Immersive Web Emulator como en un visor físico, porque el emulador valida la lógica WebXR pero no reproduce necesariamente todas las características de composición del navegador de un headset.
