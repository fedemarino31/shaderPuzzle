# MVP — Personaje físico dentro de una pieza de puzzle 3D

## 1. Objetivo

Construir un laboratorio aislado en Three.js para validar un personaje pequeño que “vive” dentro de una pieza transparente y reacciona de forma creíble y cómica a la gravedad, inclinaciones, rotaciones bruscas e impactos.

El objetivo del MVP **no es simular anatómicamente un humano**. Debe producir la ilusión de un personaje vivo que:

- intenta permanecer de pie;
- se adapta a inclinaciones moderadas;
- camina para recuperar una posición estable;
- pierde el equilibrio cuando la situación lo supera;
- resbala por superficies inclinadas;
- cae y se golpea;
- reacciona al impacto;
- vuelve a levantarse;
- reanuda su intención de mantenerse estable.

La física debe condicionar lo que ocurre, pero no controlar directamente cada articulación.

---

## 2. Contexto del proyecto final

El juego final es un rompecabezas tridimensional para VR. Un volumen voxelizado —por ejemplo un cubo de 4×4×4 vóxeles— está dividido en piezas tipo Tetris 3D. El jugador manipula y ensambla esas piezas para reconstruir el volumen.

Las piezas pueden tener comportamientos visuales imposibles en un puzzle físico: shaders volumétricos, humo, ondas que viven en un espacio canónico compartido, reflexiones infinitas, etc.

Una de esas familias de piezas contendrá pequeños personajes vivos. Cada pieza podrá contener un personaje diferente, con pequeñas variaciones de comportamiento o personalidad.

Este documento cubre solamente el primer laboratorio necesario para desarrollar y validar ese comportamiento.

---

## 3. Principio arquitectónico central

Separar estrictamente cuatro capas:

**Física → interpretación → animación → corrección procedural**

### 3.1 Física

Rapier calcula únicamente información física objetiva:

- orientación del contenedor;
- gravedad expresada en coordenadas locales;
- velocidad lineal;
- velocidad angular;
- aceleraciones;
- posición/velocidad del proxy físico del personaje;
- contactos;
- normales de contacto;
- impulsos o intensidad de impactos.

Rapier **no anima el esqueleto**.

### 3.2 Character Controller

Una capa lógica interpreta esos datos y determina qué está intentando hacer el personaje.

Ejemplos:

- mantenerse parado;
- recuperar equilibrio;
- dar un paso;
- caminar;
- deslizarse;
- caer;
- reaccionar a un golpe;
- levantarse.

Ésta es la capa que debe producir la sensación de voluntad.

### 3.3 Sistema de animación

Three.js representa las acciones mediante `AnimationMixer`, clips y blending.

Los clips representan comportamientos generales y reutilizables, no cada situación física posible.

### 3.4 Pose procedural

Después de evaluar las animaciones base se aplican pequeñas correcciones procedurales dependientes del estado físico:

- inclinación de torso;
- compensación de pelvis;
- flexión de rodillas;
- apertura de brazos;
- orientación de cabeza;
- reacción direccional a impactos;
- retraso/inercia visual de extremidades.

La animación base aporta legibilidad; la capa procedural hace que parezca conectada con lo que realmente está sucediendo.

---

# 4. Laboratorio inicial

## 4.1 Contenedor

No comenzar con una pieza voxel real.

Crear un contenedor rectangular transparente de proporciones aproximadas:

**2 × 1 × 1**

Debe sentirse como un pequeño pasillo o container.

Esto permite probar situaciones diferentes según la orientación:

- horizontal sobre el eje largo: el personaje tiene espacio para caminar;
- inclinado: debe compensar o desplazarse;
- muy inclinado: debe resbalar;
- vertical: termina contra uno de los extremos pequeños;
- rotación brusca: puede perder el equilibrio y golpearse contra una pared.

El sistema debe diseñarse desde el comienzo para que posteriormente el contenedor rectangular pueda reemplazarse por una pieza voxel arbitraria.

---

# 5. Herramientas de control del laboratorio

Crear una UI de debugging que permita manipular deliberadamente el contenedor.

Como mínimo:

- rotación eje X;
- rotación eje Z;
- controles instantáneos de orientación;
- velocidad de transición hacia una orientación;
- botón para aplicar una rotación brusca;
- botón para aplicar un impulso/golpe de prueba;
- reset.

Conviene permitir dos formas de manipulación:

### Modo continuo

El usuario cambia el ángulo lentamente mediante sliders.

Sirve para estudiar:

- equilibrio;
- inicio del desplazamiento;
- umbral de resbalamiento.

### Modo impulso

El contenedor cambia rápidamente de orientación.

Sirve para estudiar:

- pérdida de equilibrio;
- caídas;
- impactos;
- recuperación.

---

# 6. Visualización de debugging

Mostrar permanentemente:

- vector gravedad local;
- orientación del contenedor;
- velocidad angular;
- velocidad del proxy físico;
- superficie considerada actualmente “piso”;
- normal de contacto;
- intensidad del último impacto;
- estado actual del personaje;
- subestado, si existe;
- estabilidad estimada;
- tiempo transcurrido en el estado;
- thresholds relevantes.

Idealmente los vectores importantes deben poder visualizarse también dentro de la escena mediante flechas.

Esto es esencial para desarrollar con IA: el comportamiento debe ser observable y no solamente juzgable visualmente.

---

# 7. Representación física del personaje

## 7.1 Primera aproximación

Usar un **proxy físico simple** para representar el movimiento global del personaje.

Inicialmente puede ser una esfera o cápsula.

La envolvente debe ser considerablemente menor que el contenedor para permitir desplazamiento interno.

Rapier se ocupa de:

- gravedad;
- movimiento;
- contactos;
- colisiones;
- rebotes limitados;
- impactos.

El personaje visual sigue aproximadamente a este proxy, pero **no debe parecer una esfera disfrazada de humano**.

El proxy representa el centro físico global; el character controller interpreta su situación para decidir la pose.

## 7.2 Evolución posible

Si una esfera produce resultados demasiado flotantes, pasar a una cápsula.

No comenzar con un ragdoll articulado completo.

---

# 8. Esqueleto mínimo

Utilizar un personaje extremadamente simple construido con primitivas.

Jerarquía aproximada:

- root
  - pelvis
    - torso inferior
      - torso superior
        - cuello/cabeza
        - brazo superior izquierdo
          - antebrazo izquierdo
        - brazo superior derecho
          - antebrazo derecho
    - muslo izquierdo
      - pierna inferior izquierda
    - muslo derecho
      - pierna inferior derecha

No son necesarias inicialmente:

- manos articuladas;
- dedos;
- pies articulados;
- cara;
- animación facial.

Las articulaciones de codos y rodillas son importantes porque aportan mucha expresividad con muy poca complejidad.

El personaje puede visualizarse mediante:

- esferas en articulaciones;
- cilindros para extremidades;
- cajas/cápsulas para pelvis y torso;
- esfera para cabeza.

La prioridad es evaluar movimiento, no estética.

---

# 9. Principios de comportamiento

El personaje debe seguir unas pocas “leyes” universales.

## 9.1 Intención principal

**Siempre intenta estar de pie respecto de la gravedad.**

Esto significa que “arriba” y “abajo” no dependen de la orientación original del contenedor, sino del vector gravedad expresado en su espacio local.

## 9.2 Recuperación de estabilidad

Cuando la superficie se inclina ligeramente:

- desplaza centro de masa visual;
- inclina torso;
- flexiona rodillas;
- abre brazos;
- puede realizar pequeños pasos correctivos.

## 9.3 Desplazamiento

Si mantenerse quieto deja de ser estable pero todavía puede caminar:

- intenta desplazarse hacia una zona más baja/estable;
- aumenta la urgencia con la inclinación.

## 9.4 Resbalamiento

Superado cierto ángulo o aceleración:

- deja de poder compensar;
- comienza a deslizarse.

La transición debe ser progresiva, no un threshold visualmente rígido.

## 9.5 Caída

Ante inclinación excesiva, aceleración brusca o pérdida prolongada de estabilidad:

- abandona el intento de permanecer erguido;
- entra en caída;
- el proxy físico domina el desplazamiento global.

## 9.6 Impacto

Un contacto fuerte proporciona:

- intensidad;
- dirección;
- punto aproximado.

El character controller selecciona una reacción acorde.

No es necesario reproducir físicamente el impacto exacto sobre cada articulación.

## 9.7 Recuperación

Cuando vuelve a existir una superficie razonablemente estable:

1. termina la reacción al impacto;
2. identifica dónde está el piso;
3. adopta una pose de recuperación;
4. se levanta;
5. vuelve a equilibrio/idle.

---

# 10. Máquina de estados inicial

Estados mínimos recomendados:

### `IDLE`

Personaje estable.

Puede incluir pequeños movimientos secundarios.

### `BALANCING`

La inclinación o aceleración exige compensación.

Características:

- rodillas flexionadas;
- torso compensando;
- brazos abiertos;
- pequeños pasos.

### `WALKING`

Necesita desplazarse para recuperar estabilidad.

### `SLIDING`

Existe apoyo pero la pendiente supera su capacidad para permanecer estable.

Puede deslizar:

- de pie durante un instante;
- sentado;
- de costado;

según cómo haya entrado al estado.

### `FALLING`

Ha perdido apoyo/control.

### `IMPACT`

Reacción corta ante un golpe importante.

Debe recibir parámetros:

- intensidad;
- dirección.

### `DOWN`

Está en el piso después de una caída.

### `GETTING_UP`

Secuencia de recuperación.

Después vuelve a `BALANCING` o `IDLE`, según la situación actual.

---

# 11. No usar thresholds aislados

Evitar lógica del tipo:

```text
ángulo < 30° → balance
ángulo >= 30° → caída
```

Usar una medida continua de **estabilidad** que combine:

- inclinación;
- velocidad angular;
- aceleración;
- velocidad del personaje;
- existencia de apoyo;
- duración de la inestabilidad.

Conceptualmente:

```text
stability = f(
    support,
    slope,
    angularVelocity,
    acceleration,
    characterVelocity,
    timeUnstable
)
```

Los thresholds de cambio de estado pueden existir, pero deben incluir:

- histéresis;
- temporización;
- cooldowns.

Esto evita cambios frenéticos entre estados.

---

# 12. Clips de animación mínimos

No intentar crear decenas de animaciones.

Primera biblioteca:

1. `idle`
2. `balance`
3. `walk`
4. `slip`
5. `fall`
6. `impact`
7. `down`
8. `getUp`

Los clips pueden construirse programáticamente mediante `AnimationClip` y tracks sobre los huesos.

No hace falta mocap ni Blender para el MVP.

El objetivo inicial es deliberadamente estilizado.

---

# 13. Parametrización de clips

Los clips no deben considerarse secuencias rígidas.

Ejemplo:

`balance` recibe implícitamente variables como:

- dirección de caída;
- intensidad;
- velocidad angular.

La capa procedural modifica el resultado.

Así, un único clip `balance` puede representar cientos de situaciones.

Lo mismo para `impact`:

```text
impactDirection
impactStrength
```

pueden controlar:

- dirección de inclinación del torso;
- giro de cabeza;
- amplitud de brazos;
- flexión de piernas.

---

# 14. Blending

Usar `AnimationMixer` y crossfades.

Evitar cambios instantáneos entre clips salvo cuando la situación lo justifique.

Ejemplos:

```text
IDLE → BALANCING
BALANCING → WALKING
BALANCING → SLIDING
WALKING → FALLING
FALLING → IMPACT
IMPACT → DOWN
DOWN → GETTING_UP
GETTING_UP → BALANCING
```

Las duraciones de blending deben ser parámetros ajustables desde configuración.

---

# 15. Capa procedural

Ésta será probablemente la parte que más vida aporte al MVP.

## Torso

Inclinarse en dirección opuesta a la pérdida de equilibrio.

## Pelvis

Pequeña compensación respecto del torso.

## Rodillas

Flexión proporcional a:

- inestabilidad;
- aceleración;
- preparación ante caída.

## Brazos

Abrirse al perder estabilidad.

Agregar asimetría y un pequeño retraso temporal.

## Cabeza

Debe intentar conservar cierta orientación estable más tiempo que el torso.

Esto produce inmediatamente sensación de intención.

## Inercia secundaria

Brazos y cabeza pueden seguir cambios bruscos con cierto retraso mediante springs amortiguados.

No necesitan simulación física completa.

Esto aporta sensación de “muñeco blando” sin implementar ragdoll.

---

# 16. Caídas: enfoque híbrido

No implementar inicialmente un ragdoll completo.

Durante `FALLING`:

- el proxy físico controla la trayectoria global;
- la animación coloca al personaje en una pose de caída;
- la capa procedural orienta la pose aproximadamente según velocidad y gravedad.

Ante impacto:

- Rapier determina intensidad y dirección;
- se dispara `IMPACT`;
- la pose exagera el golpe;
- el personaje termina en `DOWN`.

Esto puede engañar visualmente muy bien con una fracción de la complejidad de un ragdoll real.

---

# 17. Cómo hacer que parezca vivo

La clave no será la precisión física sino la **anticipación y recuperación**.

Antes de caer:

- intenta compensar;
- abre brazos;
- da pasos;
- flexiona rodillas.

Después de caer:

- queda brevemente desorganizado;
- reacciona;
- intenta incorporarse;
- vuelve a buscar equilibrio.

La secuencia:

**intención → fracaso → reacción → recuperación**

es más importante que una simulación biomecánica precisa.

---

# 18. Personalidades

No implementar varias personalidades hasta que el personaje base funcione, pero diseñar desde el principio un objeto de parámetros.

Ejemplo conceptual:

```js
personality = {
  balanceSkill,
  panicThreshold,
  recoverySpeed,
  impactSensitivity,
  armExaggeration,
  movementEnergy,
  clumsiness
}
```

Esto permitirá posteriormente tener personajes como:

- hábil;
- torpe;
- miedoso;
- estoico;
- hiperactivo;
- lento.

No deberían requerir máquinas de estados diferentes: principalmente cambian parámetros.

---

# 19. Fases de implementación

## Fase 1 — Laboratorio físico

Implementar:

- escena Three.js;
- contenedor 2×1×1;
- Rapier;
- proxy esférico/cápsula;
- gravedad;
- colisiones;
- controles de rotación;
- impactos;
- debugging visual.

**Criterio de finalización:** se pueden reproducir de forma controlada inclinaciones, rotaciones bruscas, deslizamientos e impactos.

---

## Fase 2 — Sensores y modelo de estabilidad

Implementar un módulo que derive:

- superficie de apoyo;
- gravedad local;
- slope;
- velocidad angular;
- aceleración;
- intensidad de impactos;
- estabilidad;
- dirección probable de caída.

**Criterio de finalización:** todos estos valores pueden inspeccionarse en pantalla y responden coherentemente a escenarios conocidos.

---

## Fase 3 — Máquina de estados

Implementar los estados sin personaje articulado complejo.

Puede visualizarse el estado mediante texto/color/debug geometry.

**Criterio de finalización:** los escenarios físicos producen secuencias de estados razonables y reproducibles.

---

## Fase 4 — Esqueleto procedural

Crear el personaje de primitivas y jerarquía de huesos.

Sin animaciones complejas todavía.

Validar:

- pivotes;
- jerarquía;
- rangos articulares;
- orientación respecto de la gravedad.

---

## Fase 5 — Clips básicos

Crear programáticamente los clips mínimos.

Agregar:

- `AnimationMixer`;
- transiciones;
- crossfades;
- velocidades configurables.

---

## Fase 6 — Corrección procedural

Agregar:

- torso;
- pelvis;
- rodillas;
- brazos;
- cabeza;
- springs/inercia secundaria.

**Criterio de finalización:** una misma animación responde visiblemente de manera diferente según dirección e intensidad del estímulo.

---

## Fase 7 — Caída, impacto y recuperación

Completar el ciclo:

```text
equilibrio
→ pérdida de control
→ caída
→ impacto
→ personaje en el piso
→ levantarse
→ recuperar equilibrio
```

Éste es el milestone central del MVP.

---

## Fase 8 — Primera personalidad

Crear solamente dos presets para demostrar que la arquitectura funciona:

**Normal**
- comportamiento neutro.

**Torpe**
- pierde equilibrio antes;
- exagera brazos;
- recupera más lentamente;
- reacciona más a impactos.

No ampliar todavía la biblioteca.

---

# 20. Sistema de escenarios reproducibles

Para permitir desarrollo autónomo con IA, crear un **Scenario Runner**.

Cada escenario define una secuencia temporal determinista de transformaciones.

Ejemplo conceptual:

```js
{
  name: "slowTilt30",
  duration: 5,
  actions: [
    { time: 0, rotationX: 0 },
    { time: 5, rotationX: 30 }
  ]
}
```

Escenarios iniciales:

### A — Piso estable

0° durante varios segundos.

Esperado:

- `IDLE`;
- personaje erguido;
- sin caídas.

### B — Inclinación suave

0° → 15° lentamente.

Esperado:

- `BALANCING`;
- compensación;
- sin caída.

### C — Inclinación moderada

0° → 30–40° lentamente.

Esperado:

- balance;
- pasos correctivos;
- posible inicio de sliding según parámetros.

### D — Pendiente extrema

0° → 70–80°.

Esperado:

- pérdida de equilibrio;
- caída/resbalamiento;
- desplazamiento hacia la zona baja.

### E — Contenedor vertical

90°.

Esperado:

- personaje termina físicamente en el extremo inferior;
- intenta recuperar orientación;
- comportamiento limitado por el poco espacio disponible.

### F — Giro brusco

Cambio rápido de 0° a aproximadamente 90°.

Esperado:

- pérdida inmediata de estabilidad;
- caída;
- impacto;
- recuperación posterior.

### G — Sacudida

Secuencia corta de cambios de orientación.

Esperado:

- múltiples intentos de compensación;
- eventual caída si la energía supera su capacidad.

---

# 21. Evaluación automática

El sistema debe registrar un timeline:

```text
time
containerRotation
localGravity
characterPosition
characterVelocity
angularVelocity
support
stability
state
impactStrength
```

Al terminar cada escenario se calculan métricas.

Ejemplos:

### Piso estable

- porcentaje de tiempo en `IDLE`;
- cantidad de caídas inesperadas.

### Inclinación suave

- caída: penalización fuerte;
- tiempo en `BALANCING`;
- orientación media del torso respecto de vertical.

### Pendiente extrema

- debe existir desplazamiento hacia abajo;
- permanecer artificialmente de pie debe penalizarse.

### Giro brusco

Debe detectarse una secuencia aproximadamente equivalente a:

```text
BALANCING/FALLING
→ IMPACT
→ DOWN
→ GETTING_UP
```

### Recuperación

Medir:

- tiempo desde último impacto hasta `GETTING_UP`;
- tiempo hasta recuperar estado estable;
- loops o estados bloqueados.

---

# 22. Score de comportamiento

Crear un score por escenario, no necesariamente científico.

Por ejemplo:

```text
physicsConsistency
stateCorrectness
recoverySuccess
stabilityAppropriateness
animationContinuity
```

El score sirve para detectar regresiones y orientar iteraciones de IA.

No debe confundirse con una medida absoluta de “qué tan gracioso es”.

---

# 23. Validación visual automatizable

Además de métricas numéricas, agregar un modo de captura determinista.

Para cada escenario:

- cámara fija;
- seed fija;
- duración fija;
- screenshots en timestamps conocidos;
- opcionalmente captura de video.

Esto permite que un agente con capacidad visual compare iteraciones.

Conviene renderizar también una versión de debugging donde aparezcan:

- gravedad;
- estado;
- proxy;
- contactos;
- centro del personaje.

Así la IA puede distinguir entre un problema físico, lógico o puramente visual.

---

# 24. Loop de desarrollo con IA

El proyecto debería permitir este ciclo:

```text
1. modificar implementación/parámetros
2. ejecutar suite de escenarios
3. obtener métricas
4. obtener screenshots
5. comparar contra expectativas
6. identificar escenario peor puntuado
7. modificar código/parámetros
8. repetir
```

La suite debe poder ejecutarse sin interacción manual.

Idealmente:

```bash
npm run test:character
```

produce algo similar a:

```text
/results/
  summary.json
  slow-tilt/
    metrics.json
    01.png
    02.png
  hard-tilt/
    ...
  sudden-rotation/
    ...
```

---

# 25. Separación de configuración y código

Todos los valores subjetivos deben centralizarse.

Ejemplo:

```js
characterConfig = {
  maxComfortableSlope: ...,
  slideThreshold: ...,
  fallThreshold: ...,
  impactThreshold: ...,
  balanceResponse: ...,
  getUpDelay: ...,
  crossFadeDuration: ...,
  armResponse: ...,
  kneeResponse: ...
}
```

No dispersar números mágicos por el código.

Esto es especialmente importante para que una IA pueda iterar sobre parámetros sin modificar arquitectura.

---

# 26. Arquitectura sugerida

Una posible división:

```text
src/
  physics/
    PhysicsWorld.js
    CharacterProxy.js
    ContactSensor.js

  character/
    Character.js
    CharacterSkeleton.js
    CharacterController.js
    StabilityEstimator.js
    CharacterStateMachine.js
    Personality.js

  animation/
    AnimationController.js
    ProceduralPose.js
    SpringBone.js
    clips/
      idle.js
      balance.js
      walk.js
      slip.js
      fall.js
      impact.js
      down.js
      getUp.js

  container/
    TestContainer.js
    ContainerController.js

  debug/
    DebugPanel.js
    DebugVectors.js
    Telemetry.js

  scenarios/
    ScenarioRunner.js
    scenarios.js
    Evaluator.js

  main.js
```

No es obligatorio respetar exactamente estos archivos; lo importante es conservar la separación conceptual.

---

# 27. Qué NO hacer en el MVP

Evitar por ahora:

- ragdoll articulado completo;
- simulación muscular;
- IK compleja de cuerpo entero;
- manos/dedos;
- animación facial;
- navegación avanzada;
- personajes GLTF detallados;
- integración VR;
- integración con el puzzle real;
- geometrías voxel arbitrarias;
- múltiples personajes simultáneos;
- comportamiento social;
- audio/voz;
- decenas de personalidades.

Cada uno puede agregarse después si el prototipo demuestra que la idea funciona.

---

# 28. Criterio de éxito del MVP

El MVP está logrado si una persona que observa la prueba entiende inmediatamente que:

> “Hay un pequeño personaje atrapado dentro de un contenedor. Está intentando mantenerse parado, pero yo puedo inclinarlo, sacudirlo, hacerlo resbalar y tirarlo. Se golpea, se recompone y vuelve a intentar ponerse de pie.”

Debe sentirse **reactivo, torpe y vivo**, aunque al inspeccionarlo técnicamente la simulación sea deliberadamente simplificada.

La prioridad es:

**credibilidad perceptual > exactitud biomecánica.**

---

# 29. Decisión de arquitectura a preservar para el proyecto final

Cuando esto se integre al puzzle voxel:

- la geometría del contenedor cambiará;
- las colisiones serán más complejas;
- cada pieza podrá tener un personaje/personality diferente;
- la pieza será manipulada directamente por el jugador en VR.

Pero la arquitectura desarrollada aquí debe permanecer:

```text
movimiento de la pieza
        ↓
      Rapier
        ↓
sensores físicos
        ↓
estimador de estabilidad
        ↓
character controller / state machine
        ↓
animaciones Three.js
        +
corrección procedural
        ↓
personaje visible
```

Ésta es la decisión técnica principal del MVP y debe evitarse romperla durante las primeras iteraciones.
