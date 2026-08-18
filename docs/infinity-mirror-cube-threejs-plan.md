# Plan de implementación — Infinity Mirror Cube Shader (Three.js)

## 1. Objetivo

Implementar en Three.js un objeto cúbico con apariencia de **infinity mirror**, inspirado en estructuras físicas con espejos semirreflectantes y varillas luminosas internas.

La primera versión debe funcionar en desktop/web convencional, pero la arquitectura del shader debe diseñarse desde el inicio con **eficiencia suficiente para una futura adaptación a VR standalone**.

No es objetivo de esta etapa implementar WebXR ni lógica específica para VR.

La prioridad es:

1. Obtener una ilusión visual convincente de profundidad/reflexión infinita.
2. Evitar técnicas costosas que luego dificulten la migración a VR.
3. Mantener el shader simple, analítico y fácil de perfilar.
4. Separar claramente la estructura exterior real de la ilusión óptica interior.

---

# 2. Idea visual

El objeto tendrá:

- un cubo visible;
- 12 aristas exteriores negras y opacas;
- una superficie óptica en las caras;
- 12 varillas luminosas virtuales cercanas a las aristas interiores;
- repetición aparente de esas varillas hacia el interior;
- atenuación progresiva con la profundidad;
- glow alrededor de las líneas luminosas;
- posibilidad de variar colores e intensidad.

El objetivo visual no es simular físicamente un espejo perfecto.

Se busca reproducir perceptualmente la idea de:

> una estructura exterior finita que contiene un espacio luminoso aparentemente infinito.

---

# 3. Decisión técnica principal

## 3.1 No usar raymarching como solución principal

La primera implementación **no debe utilizar raymarching SDF generalista** para resolver las múltiples reflexiones.

Tampoco debe:

- renderizar copias reales del cubo;
- usar cámaras recursivas;
- usar render targets recursivos;
- usar cubemaps dinámicos;
- calcular decenas de rebotes con `reflect()` por fragmento;
- ejecutar loops largos de raymarching.

La escena interior inicial es extremadamente regular, por lo que conviene utilizar una solución matemática especializada.

---

# 4. Espacio reflectante desplegado

Las reflexiones sucesivas entre planos paralelos pueden interpretarse como un espacio infinito compuesto por copias espejadas del cubo.

En lugar de pensar:

```text
rayo
→ pared
→ reflexión
→ pared
→ reflexión
→ ...
```

se debe pensar:

```text
rayo recto
→ celda 0
→ celda 1 espejada
→ celda 2
→ celda 3 espejada
→ ...
```

El rayo puede considerarse recto en un espacio periódico.

Cada celda representa una copia virtual del cubo.

Esto evita simular explícitamente cada reflexión.

---

# 5. Arquitectura general del objeto

Crear un componente/clase conceptual:

```text
InfinityMirrorCube
│
├── FrameMesh
│
└── OpticalCube
```

## 5.1 `FrameMesh`

Representa las 12 aristas negras exteriores.

Debe utilizar:

- geometría real;
- material opaco;
- color negro;
- preferentemente una única geometría combinada;
- preferentemente una única draw call.

No debe participar de la ilusión de reflexión.

---

## 5.2 `OpticalCube`

Representa las superficies ópticas.

Debe utilizar:

```javascript
THREE.ShaderMaterial
```

o:

```javascript
THREE.RawShaderMaterial
```

si se decide trabajar directamente con GLSL 3.

Este shader será responsable de:

- reconstruir el rayo de visión;
- trabajar en coordenadas locales;
- representar matemáticamente el patrón infinito;
- calcular las líneas luminosas;
- aplicar profundidad;
- aplicar atenuación;
- aplicar antialiasing;
- aplicar glow.

---

# 6. Separación entre geometría real y virtual

Geometría real:

```text
- marco exterior
- caras del cubo necesarias para rasterizar el shader
```

Geometría virtual:

```text
- barras luminosas interiores
- copias reflejadas
- profundidad aparente
- glow
```

Las barras interiores NO deben crearse inicialmente como meshes.

Deben existir solamente como una función matemática dentro del fragment shader.

---

# 7. Sistema de coordenadas

Toda la lógica óptica debe ejecutarse en **object/local space**.

Usar conceptualmente un cubo normalizado:

```text
x ∈ [-1, +1]
y ∈ [-1, +1]
z ∈ [-1, +1]
```

o mediante:

```glsl
uniform vec3 uBoxHalfSize;
```

El shader no debe depender de que el cubo se encuentre:

- en el origen del mundo;
- sin rotación;
- con escala 1.

Mover o rotar el objeto Three.js no debe requerir modificar la lógica interna.

---

# 8. Vertex shader

El vertex shader deberá proporcionar al fragment shader al menos:

```glsl
varying vec3 vLocalPosition;
```

Debe conservarse la posición local original del vértice.

Ejemplo conceptual:

```glsl
varying vec3 vLocalPosition;

void main() {

    vLocalPosition = position;

    gl_Position =
        projectionMatrix *
        modelViewMatrix *
        vec4(position, 1.0);
}
```

---

# 9. Posición local de cámara

El fragment shader necesita la posición de la cámara transformada a object space.

Puede calcularse desde JavaScript:

```javascript
cameraLocal.copy(camera.position);
cube.worldToLocal(cameraLocal);
```

y enviarse como:

```glsl
uniform vec3 uCameraLocal;
```

Esta solución es suficiente para la versión desktop inicial.

La arquitectura debe mantener esta parte aislada para poder sustituirla posteriormente por una solución adecuada para render estéreo/WebXR.

---

# 10. Rayo por fragmento

Para cada fragmento:

```glsl
vec3 ro = uCameraLocal;

vec3 rd =
    normalize(vLocalPosition - uCameraLocal);
```

Donde:

```text
ro = ray origin
rd = ray direction
```

La posición de la superficie visible del cubo actúa como punto de entrada al sistema óptico.

---

# 11. Punto inicial dentro del volumen

Debe evitarse que el rayo se evalúe exactamente sobre la superficie.

Usar:

```glsl
const float EPSILON = 0.0005;
```

y:

```glsl
vec3 rayStart =
    vLocalPosition +
    rd * EPSILON;
```

El valor deberá ajustarse de acuerdo con la escala interna utilizada.

---

# 12. Representación del espacio periódico

Definir el tamaño completo de una celda:

```glsl
vec3 cellSize =
    uBoxHalfSize * 2.0;
```

Una posición arbitraria `p` del espacio desplegado puede mapearse a una celda mediante:

```glsl
vec3 cell =
    floor((p + uBoxHalfSize) / cellSize);
```

Luego calcular una posición normalizada dentro de la celda.

La función debe terminar devolviendo una coordenada equivalente dentro del cubo base.

---

# 13. Folding / mirror repeat

Implementar una función central:

```glsl
vec3 mirrorRepeat(vec3 p);
```

Objetivo:

convertir cualquier posición del espacio periódico en una posición dentro del cubo original, aplicando inversión alternada según la paridad de cada celda.

Versión conceptual:

```glsl
vec3 mirrorRepeat(vec3 p) {

    vec3 size = uBoxHalfSize * 2.0;

    vec3 cell =
        floor((p + uBoxHalfSize) / size);

    vec3 q =
        fract((p + uBoxHalfSize) / size);

    vec3 parity =
        mod(cell, 2.0);

    q = mix(
        q,
        1.0 - q,
        parity
    );

    return
        q * size -
        uBoxHalfSize;
}
```

La implementación final debe intentar evitar branches.

Preferir:

```text
floor
fract
abs
mod
mix
min
max
dot
```

frente a múltiples `if`.

---

# 14. Patrón luminoso base

En el cubo base deben existir 12 varillas virtuales ubicadas junto a sus aristas interiores.

Sin embargo, no conviene evaluar explícitamente 12 cápsulas/SDF en cada muestra si puede evitarse.

La geometría tiene una estructura muy regular.

Una arista del cubo se produce cuando **dos coordenadas están cerca de los límites del cubo**.

Por ejemplo, una línea paralela a X existe cuando:

```text
|y| ≈ halfSize.y
y
|z| ≈ halfSize.z
```

Lo mismo para Y y Z.

---

# 15. Distancia analítica a las aristas

Para una posición local `p`, calcular distancia a las paredes:

```glsl
vec3 edgeDistance =
    uBoxHalfSize - abs(p);
```

Para líneas paralelas al eje X:

```glsl
float dx =
    length(vec2(
        edgeDistance.y,
        edgeDistance.z
    ));
```

Para líneas paralelas al eje Y:

```glsl
float dy =
    length(vec2(
        edgeDistance.x,
        edgeDistance.z
    ));
```

Para líneas paralelas al eje Z:

```glsl
float dz =
    length(vec2(
        edgeDistance.x,
        edgeDistance.y
    ));
```

La distancia a la estructura completa es:

```glsl
float d =
    min(dx, min(dy, dz));
```

Esto representa las 12 aristas con muy pocas operaciones.

No hace falta evaluar doce objetos independientes.

---

# 16. Grosor de la barra

Definir:

```glsl
uniform float uRodRadius;
```

La barra central puede construirse mediante:

```glsl
float rod =
    1.0 -
    smoothstep(
        uRodRadius - aa,
        uRodRadius + aa,
        d
    );
```

---

# 17. Antialiasing obligatorio

Las reflexiones profundas producirán líneas subpíxel.

Sin antialiasing analítico pueden aparecer:

- shimmering;
- moiré;
- ruido temporal;
- popping al mover la cámara.

Esto sería especialmente problemático en una futura versión VR.

Usar:

```glsl
float aa =
    max(fwidth(d), 0.0001);
```

y utilizar `aa` dentro del `smoothstep`.

No utilizar:

```glsl
step(...)
```

para dibujar las líneas.

---

# 18. Glow analítico

No usar bloom multipass en la primera versión.

El glow debe calcularse directamente alrededor de la varilla.

Separar:

```text
core
halo
```

Ejemplo:

```glsl
float core =
    1.0 -
    smoothstep(
        uRodRadius - aa,
        uRodRadius + aa,
        d
    );

float halo =
    exp(
        -d * uGlowFalloff
    );
```

Resultado:

```glsl
float emission =
    core * uCoreIntensity +
    halo * uGlowIntensity;
```

Esto debe permitir obtener apariencia luminosa sin postprocesado.

---

# 19. Color

Definir inicialmente:

```glsl
uniform vec3 uColorX;
uniform vec3 uColorY;
uniform vec3 uColorZ;
```

La línea más cercana puede determinar qué eje domina.

Conceptualmente:

```glsl
if (dx <= dy && dx <= dz)
    color = uColorX;

else if (dy <= dz)
    color = uColorY;

else
    color = uColorZ;
```

Posteriormente conviene evaluar una versión branchless.

También debe existir un modo:

```text
singleColor
```

para todas las barras.

---

# 20. Profundidad aparente

El espacio periódico por sí solo genera repetición matemática, pero la ilusión necesita una noción de distancia.

Definir una distancia recorrida sobre el rayo:

```glsl
float t;
```

y aplicar atenuación:

```glsl
float attenuation =
    exp(
        -t * uAbsorption
    );
```

También puede utilizarse:

```glsl
pow(
    uReflectivity,
    virtualBounceCount
);
```

pero la primera opción puede resultar más continua y económica.

---

# 21. Número virtual de reflexión

Puede estimarse a partir de la celda del espacio desplegado.

Por ejemplo:

```glsl
float virtualBounceCount =
    abs(cell.x) +
    abs(cell.y) +
    abs(cell.z);
```

No necesita representar exactamente el número físico de rebotes.

Puede utilizarse únicamente como parámetro artístico:

```glsl
float fade =
    pow(
        uReflectivity,
        virtualBounceCount
    );
```

---

# 22. Muestreo del rayo

Aunque no se utilizará raymarching SDF tradicional, todavía debe decidirse cómo obtener el patrón visible a lo largo del rayo.

La primera versión debe implementar un **muestreo muy limitado y controlado**.

Objetivo:

```text
NO:
64 / 128 / 256 pasos

SÍ:
pocas muestras estratégicas
```

Por ejemplo:

```text
8
12
16
```

muestras máximas.

Cada muestra:

```glsl
vec3 p =
    rayStart +
    rd * t;

vec3 q =
    mirrorRepeat(p);

float d =
    edgePatternDistance(q);
```

Acumular emisión.

---

# 23. Distribución de muestras

No distribuir necesariamente las muestras de forma lineal.

Se recomienda probar una distribución que aumente la distancia rápidamente.

Ejemplo:

```glsl
float fi =
    float(i) /
    float(MAX_SAMPLES - 1);

float t =
    mix(
        uNearDistance,
        uFarDistance,
        fi * fi
    );
```

o una progresión exponencial.

Esto permite cubrir una profundidad aparente grande con pocas muestras.

---

# 24. Alternativa futura: intersecciones analíticas

El programador debe mantener separadas:

```glsl
mirrorRepeat()
```

y:

```glsl
edgePatternDistance()
```

porque una optimización posterior puede eliminar incluso estas pocas muestras y calcular directamente intersecciones del rayo con el entramado periódico.

No es requisito de la primera implementación.

---

# 25. Límite máximo de muestras

Usar una constante de compilación:

```glsl
#define MAX_SAMPLES 16
```

y:

```glsl
uniform int uSampleCount;
```

con loop fijo:

```glsl
for (
    int i = 0;
    i < MAX_SAMPLES;
    i++
) {

    if (i >= uSampleCount)
        break;

    ...
}
```

Valores sugeridos:

```text
4
8
12
16
```

La configuración inicial recomendada es:

```text
8 muestras
```

---

# 26. Acumulación

Inicialmente:

```glsl
vec3 accumulated =
    vec3(0.0);
```

Para cada muestra:

```glsl
accumulated +=
    rodColor *
    emission *
    attenuation;
```

Debe evitarse que valores altos saturen inmediatamente.

Puede utilizarse una compresión sencilla:

```glsl
color =
    1.0 -
    exp(-accumulated * uExposure);
```

---

# 27. Evitar overdraw innecesario

Las caras ópticas deben renderizar solamente los fragmentos necesarios.

Evaluar:

```javascript
side: THREE.FrontSide
```

para cámara exterior.

No utilizar:

```javascript
DoubleSide
```

salvo que sea estrictamente necesario.

---

# 28. Marco negro

La estructura negra exterior debe ocultar:

- bordes de las caras;
- uniones;
- errores numéricos;
- pequeñas discontinuidades.

Debe tener un grosor visual suficiente para que las superficies ópticas queden claramente enmarcadas.

---

# 29. Superficie óptica

La primera versión puede tratar la superficie como prácticamente transparente y mostrar principalmente el contenido virtual.

Posteriormente se podrá agregar:

- Fresnel;
- reflejo superficial;
- tint;
- absorción;
- transparencia parcial.

No implementar estos elementos hasta tener estable el efecto infinito.

---

# 30. Fresnel opcional

Cuando el efecto básico funcione:

```glsl
float fresnel =
    pow(
        1.0 -
        abs(dot(viewDir, normal)),
        uFresnelPower
    );
```

Puede utilizarse para:

- oscurecer ligeramente el interior en ángulos rasantes;
- simular una capa de vidrio;
- aumentar una reflexión superficial falsa.

Debe poder desactivarse.

---

# 31. Uniforms mínimos

El shader deberá exponer inicialmente:

```javascript
{
    uCameraLocal,

    uBoxHalfSize,

    uTime,

    uSampleCount,

    uNearDistance,

    uFarDistance,

    uRodRadius,

    uCoreIntensity,

    uGlowIntensity,

    uGlowFalloff,

    uAbsorption,

    uReflectivity,

    uExposure,

    uColorX,

    uColorY,

    uColorZ
}
```

---

# 32. Parámetros sugeridos iniciales

Valores orientativos:

```javascript
uBoxHalfSize = [1, 1, 1];

uSampleCount = 8;

uNearDistance = 0.02;
uFarDistance = 20.0;

uRodRadius = 0.025;

uCoreIntensity = 1.5;
uGlowIntensity = 0.5;
uGlowFalloff = 15.0;

uAbsorption = 0.12;
uReflectivity = 0.9;

uExposure = 1.0;
```

Son únicamente valores iniciales de prueba.

---

# 33. Estructura sugerida de archivos

```text
src/
│
├── infinityMirror/
│   │
│   ├── InfinityMirrorCube.js
│   │
│   ├── InfinityMirrorMaterial.js
│   │
│   ├── shaders/
│   │   ├── infinityMirror.vert.glsl
│   │   └── infinityMirror.frag.glsl
│   │
│   └── debug/
│       └── InfinityMirrorDebug.js
```

Si el proyecto utiliza TypeScript:

```text
InfinityMirrorCube.ts
InfinityMirrorMaterial.ts
```

---

# 34. Responsabilidad de `InfinityMirrorCube`

Debe encargarse de:

- crear geometría;
- crear marco;
- crear superficie óptica;
- contener ambos objetos;
- actualizar posición local de cámara;
- actualizar `uTime`;
- exponer parámetros visuales.

API conceptual:

```javascript
const cube =
    new InfinityMirrorCube({
        size: 2,
        frameThickness: 0.08
    });

scene.add(cube);
```

Update:

```javascript
cube.update({
    camera,
    time,
    delta
});
```

---

# 35. Responsabilidad de `InfinityMirrorMaterial`

Debe:

- crear `ShaderMaterial`;
- declarar uniforms;
- cargar shaders;
- exponer setters;
- no depender directamente de la escena.

Ejemplo:

```javascript
material.reflectivity = 0.92;
material.sampleCount = 8;
material.glowIntensity = 0.7;
```

---

# 36. Debug modes

Agregar desde el inicio:

```glsl
uniform int uDebugMode;
```

Modos recomendados:

```text
0 = final
1 = local position
2 = mirrorRepeat coordinates
3 = edge distance
4 = core only
5 = halo only
6 = attenuation
7 = virtual cell index
```

Esto facilitará mucho el desarrollo del shader.

---

# 37. GUI de desarrollo

Durante desarrollo se recomienda usar:

```text
lil-gui
```

o herramienta equivalente.

Controles:

```text
sampleCount
farDistance
rodRadius
coreIntensity
glowIntensity
glowFalloff
absorption
reflectivity
exposure
colors
debugMode
```

La GUI no forma parte del componente final.

---

# 38. Performance HUD

Agregar durante desarrollo un pequeño panel que muestre:

```text
FPS
frame time
renderer.info.render.calls
renderer.info.render.triangles
```

Opcionalmente utilizar:

```text
stats.js
```

El objetivo no es solamente mantener FPS alto en desktop.

También debe evitarse introducir una arquitectura cuya complejidad crezca demasiado al pasar posteriormente a render estéreo.

---

# 39. Reglas de performance

La implementación deberá respetar estas reglas:

### Permitido

```text
1 shader óptico
1 marco combinado
loops pequeños
fwidth()
fract()
floor()
abs()
min()
max()
mix()
dot()
exp()
```

### Evitar

```text
raymarching genérico
SDF scene loops
reflection cameras
recursive rendering
dynamic cube maps
muchas draw calls
muchas transparencias superpuestas
postprocesado obligatorio
loops > 16 inicialmente
```

---

# 40. Cantidad objetivo de draw calls

Para un único Infinity Mirror Cube:

```text
1 draw call:
marco

1 draw call:
superficie óptica
```

Objetivo:

```text
≈ 2 draw calls
```

No es obligatorio alcanzar exactamente 2 durante el primer prototipo, pero la arquitectura debe permitirlo.

---

# 41. Fases de implementación

## Fase 1 — Cubo base

Crear:

- cubo;
- cámara orbitable;
- iluminación simple;
- marco negro;
- superficie con `ShaderMaterial`.

Verificar transformaciones.

---

## Fase 2 — Coordenadas locales

Mostrar:

```glsl
vLocalPosition
```

como RGB.

Verificar que:

- rotar el cubo no rompe el shader;
- trasladar el cubo no rompe el shader.

---

## Fase 3 — Ray direction

Implementar:

```glsl
ro
rd
```

y crear un debug visual de dirección.

---

## Fase 4 — `mirrorRepeat()`

Implementar el espacio periódico espejado.

Crear un patrón de prueba sencillo:

```text
checker
gradient
axis colors
```

y comprobar que se repite correctamente.

---

## Fase 5 — Patrón de aristas

Implementar:

```glsl
edgePatternDistance()
```

usando:

```text
dx
dy
dz
```

Comprobar que aparecen exactamente las 12 aristas del cubo base.

---

## Fase 6 — Core + glow

Agregar:

- grosor;
- `fwidth`;
- core;
- halo.

No agregar profundidad todavía.

---

## Fase 7 — Muestreo en profundidad

Agregar pocas muestras a lo largo del rayo:

```text
4
8
12
16
```

Comprobar que comienza a aparecer la sensación de túnel.

---

## Fase 8 — Atenuación

Agregar:

```text
distance fade
reflectivity
exposure
```

Ajustar hasta obtener una profundidad convincente.

---

## Fase 9 — Color

Agregar:

```text
color X
color Y
color Z
```

y posteriormente colores animados.

---

## Fase 10 — Marco final

Ajustar:

- grosor;
- posicionamiento;
- separación con la superficie óptica.

Las barras exteriores negras deben ocultar las uniones entre caras.

---

## Fase 11 — Perfilado

Medir:

```text
4 samples
8 samples
12 samples
16 samples
```

Registrar:

```text
FPS
GPU/frame time si está disponible
draw calls
resolución
GPU utilizada
```

La configuración recomendada final debe elegirse en base a coste real.

---

# 42. Criterios de aceptación visual

El prototipo deberá:

- mostrar un cubo claramente delimitado;
- tener 12 bordes exteriores negros;
- mostrar líneas luminosas inmediatamente detrás de esos bordes;
- generar repetición aparente hacia el interior;
- cambiar correctamente con el punto de vista;
- producir sensación de profundidad;
- mantener continuidad entre caras;
- no mostrar aliasing excesivo al mover la cámara;
- permitir ajustar la profundidad visual;
- permitir ajustar intensidad y glow;
- permitir rotar el objeto libremente.

---

# 43. Criterios de aceptación técnica

La primera versión deberá:

- utilizar un custom shader;
- operar en object space;
- no usar reflexión recursiva;
- no usar render-to-texture para los espejos;
- no usar cubemaps dinámicos;
- no usar raymarching SDF generalista;
- no crear copias geométricas de las reflexiones;
- utilizar `fwidth()` para líneas finas;
- funcionar con una cantidad pequeña y configurable de muestras;
- mantener separado el cálculo visual del código Three.js;
- poder perfilar fácilmente el coste.

---

# 44. Preparación para futura VR

No implementar WebXR en esta etapa.

Sin embargo, evitar decisiones que dificulten esa migración.

Particularmente:

- no asumir que siempre existe una única cámara global;
- mantener encapsulado el cálculo de `uCameraLocal`;
- evitar postprocesado pesado;
- minimizar draw calls;
- evitar loops grandes;
- evitar dependencias de resolución fija;
- usar antialiasing analítico;
- evitar transparencias innecesarias;
- mantener el shader compatible con GPU móvil en la medida de lo posible.

---

# 45. Cosas explícitamente fuera de alcance

No implementar todavía:

- WebXR;
- controles VR;
- hand tracking;
- interacción;
- SDF complejos;
- objetos arbitrarios dentro del espejo;
- reflejo físicamente correcto;
- refracción;
- dispersion;
- bloom multipass;
- depth of field;
- motion blur;
- cube maps dinámicos;
- ray tracing.

---

# 46. Extensiones futuras posibles

Una vez validado el shader base:

## A. Animación cromática

```text
RGB flowing edges
gradientes
paletas
pulsos
```

## B. Objetos internos simples

Agregar primitivas analíticas económicas.

## C. SDF híbrido

Sólo para algunos elementos especiales.

## D. Fresnel superficial

Para reforzar la presencia del vidrio.

## E. Entorno reflejado

Reflexión superficial de baja frecuencia mediante environment map estático.

## F. Modo VR

Adaptar la obtención del rayo para cada ojo y realizar profiling específico en headset.

---

# 47. Prioridad conceptual

La implementación debe optimizarse para este caso específico.

No intentar construir un sistema genérico de espejos.

No intentar construir un ray tracer general.

No intentar construir un motor SDF.

La función deseada es específica:

```text
view ray
→ espacio periódico espejado
→ patrón analítico de aristas luminosas
→ atenuación
→ glow
→ color final
```

Cuanto más especializada sea la solución, menor será el coste y más viable será su uso futuro en VR.

---

# 48. Resultado esperado de la primera entrega

La primera entrega del programador debería consistir en una escena Three.js mínima donde:

1. exista un único Infinity Mirror Cube;
2. pueda orbitarse la cámara alrededor;
3. el marco sea negro;
4. las caras muestren el efecto de profundidad;
5. las líneas internas parezcan repetirse muchas veces;
6. el shader sea configurable mediante GUI;
7. existan debug modes;
8. se pueda cambiar dinámicamente entre 4, 8, 12 y 16 muestras;
9. se muestre FPS/draw calls;
10. el código quede preparado para una futura integración dentro del proyecto principal.

La prioridad de esta entrega es validar simultáneamente:

```text
apariencia
+
estabilidad
+
coste
```

antes de agregar cualquier complejidad adicional.
