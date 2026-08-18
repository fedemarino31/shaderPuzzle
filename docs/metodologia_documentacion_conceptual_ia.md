# Metodología para documentación conceptual viva de proyectos de software con IA

## 1. Objetivo

Diseñar un sistema de documentación que permita que una IA ---por
ejemplo Codex trabajando dentro de Visual Studio Code--- pueda
comprender el **modelo mental actual de un proyecto** sin tener que
releer y reconstruir todo el repositorio cada vez.

La idea central es separar dos problemas distintos:

1.  **Documentar lo que el código hace.**
2.  **Documentar qué es el sistema, por qué está diseñado de esa manera,
    cuáles son sus decisiones conceptuales y hacia dónde se dirige.**

La segunda categoría es especialmente importante para proyectos vivos y
complejos, porque mucha información relevante no está explícita en el
código.

El sistema se plantea en dos fases:

-   **Fase 1 --- Reconstrucción inicial del conocimiento del proyecto.**
-   **Fase 2 --- Mantenimiento incremental mediante un skill/agente.**

------------------------------------------------------------------------

# 2. Dos tipos de documentación que no deben confundirse

## 2.1. Documentación de referencia

Es la documentación estrechamente vinculada con el código.

Responde principalmente:

> **¿Qué hace esta pieza y cómo se usa?**

Ejemplos:

-   clases;
-   métodos;
-   funciones;
-   parámetros;
-   tipos;
-   eventos;
-   interfaces;
-   módulos;
-   dependencias;
-   API pública;
-   ejemplos de llamadas.

En JavaScript/TypeScript puede generarse parcial o totalmente a partir
del código mediante JSDoc, TypeDoc u otras herramientas.

### Características

-   Está cerca de la implementación.
-   Puede regenerarse automáticamente.
-   Es relativamente objetiva.
-   Cambia cuando cambia el código.
-   Es útil para programar y consultar APIs.

No conviene duplicar manualmente información que pueda regenerarse de
forma fiable desde el código.

------------------------------------------------------------------------

## 2.2. Documentación conceptual / conocimiento del proyecto

Responde preguntas diferentes:

> **¿Qué es este sistema?**

> **¿Qué problema intenta resolver?**

> **¿Cómo encajan sus partes?**

> **¿Por qué está diseñado de esta manera?**

> **¿Qué decisiones importantes se tomaron?**

> **¿Qué alternativas se descartaron y por qué?**

> **¿Cuál es la intención detrás de determinadas partes del sistema?**

Aquí aparecen elementos que normalmente no pueden reconstruirse de forma
completa mirando una función o una clase.

Ejemplos:

-   visión general;
-   objetivos;
-   modelo conceptual;
-   arquitectura;
-   responsabilidades de los subsistemas;
-   flujos principales;
-   decisiones de diseño;
-   restricciones;
-   supuestos;
-   convenciones;
-   terminología propia del proyecto;
-   decisiones históricas relevantes;
-   problemas conocidos;
-   dirección futura;
-   ideas deliberadamente descartadas.

Esta documentación debe ser tratada como **conocimiento vivo del
proyecto**, no como un subproducto automático del código.

------------------------------------------------------------------------

# 3. Un tercer nivel: intención

Puede resultar útil distinguir tres niveles:

### Reference

Información que puede derivarse directamente del código.

### Knowledge

Información conceptual que una IA puede reconstruir razonablemente
combinando código, estructura del repositorio y documentación existente.

### Intent

Información que **no necesariamente puede inferirse del repositorio**
porque pertenece a la intención de quien diseñó el sistema.

Ejemplos:

-   "Esta arquitectura es provisoria."
-   "Este módulo existe porque en el futuro deberá funcionar en VR."
-   "No queremos resolver este problema mediante física realista."
-   "La prioridad de esta aplicación es experimentar, no producir música
    terminada."
-   "Esta parte aparentemente redundante se mantiene porque después se
    convertirá en una herramienta de edición."

Cuando la IA encuentra un vacío de este tipo, debe **preguntar al humano
en lugar de inventar una explicación**.

------------------------------------------------------------------------

# 4. Principios generales

## 4.1. Reconstruir el modelo mental, no describir archivos

El objetivo no es producir algo como:

> `Renderer.js` contiene la clase Renderer.

El objetivo es poder explicar:

> El Renderer constituye la capa responsable de convertir el estado
> generado por X en la representación visual utilizada por Y. Se
> mantiene separado de Z porque...

La documentación debe permitir que alguien comprenda el sistema **sin
recorrer primero todo el código**.

------------------------------------------------------------------------

## 4.2. Documentar decisiones, no repetir implementación

Si algo puede descubrirse fácilmente leyendo el código o generando
documentación de API, no debería repetirse extensamente en la
documentación conceptual.

La documentación conceptual debe concentrarse en el **por qué**, las
relaciones, responsabilidades y decisiones.

------------------------------------------------------------------------

## 4.3. No inventar conocimiento

Debe distinguirse explícitamente entre:

-   hechos comprobados;
-   inferencias fuertes;
-   hipótesis;
-   información desconocida.

Ante una duda conceptual importante, la IA debe formular una pregunta.

------------------------------------------------------------------------

## 4.4. Mantener documentos pequeños y especializados

Evitar un único `README.md` gigantesco que intente explicar todo.

Es preferible una jerarquía de documentos relacionados.

Ejemplo:

``` text
/docs
    /concept
        overview.md
        goals.md
        terminology.md
        architecture.md
        workflows.md
        decisions.md
        constraints.md

        /systems
            viewer.md
            builder.md
            audio.md
            interaction.md

        /decisions
            ADR-001-...
            ADR-002-...
```

La estructura concreta debe adaptarse al proyecto.

------------------------------------------------------------------------

## 4.5. La estructura documental puede reflejar la arquitectura

Los documentos pueden formar una especie de **grafo de conocimiento
liviano**.

Un documento de bajo nivel explica un subsistema.

Otro documento superior sintetiza cómo varios subsistemas colaboran.

Cuando cambia algo local, se actualiza primero el documento local y
**solo se propaga hacia arriba si el cambio afecta realmente la
comprensión global**.

Esto evita regenerar toda la documentación después de cada modificación.

------------------------------------------------------------------------

# 5. Fase 1 --- Reconstrucción inicial del conocimiento

Esta fase se utiliza cuando:

-   el proyecto ya existe;
-   la documentación conceptual es inexistente, incompleta o
    desactualizada;
-   queremos crear una base sincronizada con el estado actual.

El objetivo no es simplemente "documentar el repositorio".

El objetivo es:

> **Reconstruir el modelo mental del proyecto a partir de todas las
> evidencias disponibles.**

------------------------------------------------------------------------

# 6. Estrategia de exploración inicial

La IA debería trabajar de forma progresiva.

## Paso 1 --- Cartografiar el repositorio

Primero identificar:

-   estructura de carpetas;
-   archivos principales;
-   puntos de entrada;
-   configuración;
-   paquetes;
-   subsistemas;
-   documentación existente;
-   assets relevantes;
-   herramientas de build;
-   tests;
-   scripts.

No hace falta comprender cada línea todavía.

El objetivo es construir un **mapa del territorio**.

------------------------------------------------------------------------

## Paso 2 --- Identificar subsistemas

Agrupar archivos según responsabilidades conceptuales.

Por ejemplo:

``` text
Aplicación
 ├── generación
 ├── visualización
 ├── audio
 ├── interacción
 ├── persistencia
 └── interfaz
```

La estructura conceptual no necesariamente tiene que coincidir
exactamente con las carpetas físicas.

------------------------------------------------------------------------

## Paso 3 --- Reconstrucción bottom-up

Aprovechar la documentación existente en:

-   funciones;
-   clases;
-   módulos;
-   tipos;
-   comentarios;
-   tests.

Sintetizar progresivamente:

``` text
funciones
    ↓
clases
    ↓
módulos
    ↓
subsistemas
    ↓
arquitectura
    ↓
modelo conceptual del proyecto
```

Esto permite utilizar la información técnica existente sin convertir el
resultado final en mera documentación de API.

------------------------------------------------------------------------

## Paso 4 --- Reconstrucción top-down

Luego realizar el proceso inverso:

-   ¿Cuál parece ser el objetivo de la aplicación?
-   ¿Cuáles son sus conceptos centrales?
-   ¿Qué flujo sigue el usuario?
-   ¿Qué flujo siguen los datos?
-   ¿Qué responsabilidades tiene cada subsistema?
-   ¿Qué decisiones arquitectónicas parecen deliberadas?

Comparar esa interpretación global con lo observado en el código.

------------------------------------------------------------------------

## Paso 5 --- Detectar gaps

Crear explícitamente una lista de cosas que no pueden determinarse con
seguridad.

Ejemplo:

``` markdown
## Preguntas abiertas

1. ¿El Builder está pensado únicamente como herramienta de desarrollo
   o eventualmente será parte de la aplicación final?

2. ¿La separación entre Viewer y Builder responde a una decisión
   arquitectónica permanente?

3. ¿El sistema debe poder ejecutarse eventualmente en WebXR?

4. ¿Cuál es la prioridad entre fidelidad visual y rendimiento?
```

------------------------------------------------------------------------

# 7. Entrevista con el responsable del proyecto

Después del primer barrido, la IA debería realizar una **entrevista
dirigida**.

No conviene preguntar cosas que ya pueden inferirse claramente del
código.

Las preguntas deben concentrarse en los gaps de **Intent**.

### Buenas preguntas

-   ¿Por qué existe esta separación?
-   ¿Esto es una solución definitiva o provisoria?
-   ¿Qué parte considerás central al proyecto?
-   ¿Qué comportamiento querés preservar aunque la implementación
    cambie?
-   ¿Hay una dirección futura que todavía no aparece en el código?
-   ¿Qué alternativas ya probaste y descartaste?
-   ¿Qué restricciones son importantes?
-   ¿Qué cosas parecen accidentales en el código pero en realidad son
    deliberadas?

Las respuestas deben incorporarse a la documentación conceptual
correspondiente.

------------------------------------------------------------------------

# 8. Prompt base para la Fase 1

El siguiente prompt puede utilizarse como punto de partida con Codex.

``` text
Quiero que reconstruyas el modelo mental de este proyecto.

No quiero una mera documentación del código ni una enumeración de
archivos, clases y métodos.

Actuá como un arquitecto de software que se incorpora hoy al proyecto
y necesita comprender:

- qué es el sistema;
- qué problema resuelve;
- cuáles son sus conceptos centrales;
- cómo está dividido;
- qué responsabilidad tiene cada subsistema;
- cómo se relacionan esos subsistemas;
- cuáles son los principales flujos de datos y control;
- qué decisiones de arquitectura y diseño pueden identificarse;
- qué restricciones o supuestos existen;
- qué partes parecen provisorias o destinadas a evolucionar.

Usá el código, la estructura del repositorio, comentarios, tests,
documentación existente y configuración como evidencia.

Diferenciá siempre:

1. hechos verificables en el repositorio;
2. inferencias razonablemente seguras;
3. hipótesis;
4. información que no puede determinarse.

No inventes intención.

Cuando una decisión conceptual no pueda inferirse de manera confiable,
registrala como una pregunta para el responsable del proyecto.

Proponé una estructura jerárquica de documentación conceptual dentro
de /docs/concept (o una ubicación equivalente adecuada al proyecto).

Evitá duplicar documentación de API que pueda generarse automáticamente
desde el código.

La documentación resultante debe permitir que otra IA o un desarrollador
comprenda el proyecto sin tener que releer todo el repositorio.

Al terminar el primer análisis:

1. presentá el mapa conceptual que inferiste;
2. indicá qué documentos proponés crear;
3. enumerá las dudas y gaps detectados;
4. realizame una entrevista breve y priorizada para completar la
   información que solo puede provenir de intención humana.

No completes los gaps inventando respuestas.
```

------------------------------------------------------------------------

# 9. Resultado esperado de la Fase 1

Al finalizar esta fase debería existir una base documental que esté
sincronizada con el proyecto.

Por ejemplo:

``` text
docs/
└── concept/
    ├── overview.md
    ├── goals.md
    ├── architecture.md
    ├── terminology.md
    ├── workflows.md
    ├── constraints.md
    ├── open-questions.md
    ├── decisions/
    └── systems/
```

No todos los proyectos necesitarán todos estos archivos.

La estructura debe emerger del proyecto y no imponerse mecánicamente.

------------------------------------------------------------------------

# 10. Fase 2 --- Mantenimiento incremental

Una vez creada y validada la base conceptual, **no debería volver a
reconstruirse el proyecto completo después de cada tarea**.

A partir de ese momento se pasa a mantenimiento incremental.

La idea es que Codex tenga una responsabilidad permanente:

> **Al terminar una tarea, realizar una auditoría conceptual del
> cambio.**

------------------------------------------------------------------------

# 11. Auditoría conceptual

Después de modificar código, el agente debe preguntarse:

### ¿Cambió solamente la implementación?

Ejemplos:

-   refactor interno;
-   rename;
-   optimización;
-   corrección de bug;
-   cambio local que no altera el comportamiento conceptual.

En ese caso:

> **No modificar la documentación conceptual.**

------------------------------------------------------------------------

### ¿Cambió el comportamiento relevante?

Entonces actualizar el documento del subsistema afectado.

------------------------------------------------------------------------

### ¿Cambió una decisión de diseño?

Actualizar:

-   documento del subsistema;
-   decisión arquitectónica correspondiente, si existe;
-   documentos superiores afectados.

------------------------------------------------------------------------

### ¿Cambió la arquitectura?

Actualizar los documentos de arquitectura y cualquier síntesis superior
que haya quedado incorrecta.

------------------------------------------------------------------------

### ¿Cambió la intención o el objetivo del producto?

Esto debe reflejarse explícitamente en los documentos de nivel superior.

------------------------------------------------------------------------

# 12. Propagación controlada

La actualización puede imaginarse como una propagación desde las hojas
hacia la raíz:

``` text
código modificado
      ↓
documento del módulo
      ↓
documento del subsistema
      ↓
arquitectura
      ↓
overview / visión
```

Pero la propagación **se detiene en cuanto el nivel superior sigue
siendo correcto**.

Ejemplo:

Si cambia internamente el algoritmo de traversal de un grafo pero la
responsabilidad del sistema sigue siendo exactamente la misma:

``` text
Código       → cambia
Referencia   → probablemente cambia
Conceptual   → posiblemente NO cambia
Arquitectura → NO cambia
Overview     → NO cambia
```

Este principio es fundamental para evitar ruido documental.

------------------------------------------------------------------------

# 13. Skill de mantenimiento conceptual

El comportamiento incremental puede implementarse como un skill
permanente para Codex.

Su responsabilidad no sería:

> "Actualizar siempre la documentación."

Sino:

> **"Determinar si la tarea produjo un cambio conceptual y actualizar
> únicamente el conocimiento afectado."**

------------------------------------------------------------------------

# 14. Prompt base para el skill incremental

``` text
Al finalizar cada tarea de desarrollo ejecutá una AUDITORÍA CONCEPTUAL.

El objetivo no es documentar cada cambio de código.

El objetivo es mantener sincronizado el conocimiento conceptual del
proyecto ubicado en /docs/concept (o la estructura equivalente).

Evaluá el cambio realizado y determiná si modificó alguno de estos niveles:

1. implementación interna;
2. comportamiento observable;
3. responsabilidad de un módulo o subsistema;
4. relaciones entre subsistemas;
5. arquitectura;
6. decisión de diseño;
7. restricciones o supuestos;
8. terminología;
9. objetivos o intención del proyecto.

Si el cambio es únicamente de implementación y la documentación
conceptual existente sigue siendo verdadera, NO la modifiques.

Si existe un cambio conceptual:

- identificá los documentos afectados;
- actualizá solamente esos documentos;
- preservá la información histórica que siga siendo relevante;
- no reescribas documentos completos innecesariamente;
- propagá el cambio hacia documentos de nivel superior únicamente si
  éstos dejaron de ser correctos.

No dupliques documentación de referencia que pueda derivarse del código.

Antes de editar documentación conceptual preguntate:

"¿Una persona o una IA que entendía correctamente el proyecto antes de
esta tarea tendría ahora un modelo mental incorrecto o incompleto?"

Si la respuesta es NO, no actualices la documentación conceptual.

Si la respuesta es SÍ, actualizá el mínimo conjunto de documentos
necesario para restaurar un modelo mental correcto.

Si detectás que el cambio implica una decisión cuya intención no puede
inferirse, no inventes la explicación: marcá la duda y preguntá al
responsable del proyecto.

Al terminar, informá brevemente:

- si hubo o no impacto conceptual;
- qué documentos conceptuales fueron modificados;
- qué decisión o cambio justificó cada modificación;
- si quedó alguna pregunta abierta.
```

------------------------------------------------------------------------

# 15. Verbos útiles para diferenciar ambos tipos de documentación

El lenguaje utilizado en los prompts ayuda a orientar al agente.

## Documentación de referencia

Verbos típicos:

-   enumerar;
-   listar;
-   describir;
-   definir;
-   especificar;
-   documentar parámetros;
-   mostrar firmas;
-   indicar tipos.

Ejemplo:

> "Enumerá los métodos públicos de esta clase y describí sus
> parámetros."

------------------------------------------------------------------------

## Documentación conceptual

Verbos más apropiados:

-   explicar;
-   sintetizar;
-   relacionar;
-   justificar;
-   interpretar;
-   contextualizar;
-   identificar decisiones;
-   reconstruir;
-   distinguir responsabilidades;
-   explicar consecuencias.

Ejemplo:

> "Explicá por qué este subsistema existe y cómo participa en el flujo
> general de la aplicación."

La elección deliberada de verbos ayuda a evitar que la IA caiga
automáticamente en documentación tipo API.

------------------------------------------------------------------------

# 16. Decisiones arquitectónicas

Para decisiones especialmente importantes puede utilizarse un formato
similar a los **Architecture Decision Records (ADR)**.

Ejemplo:

``` markdown
# ADR-004 — Separación entre Builder y Viewer

## Estado
Aceptada

## Contexto
...

## Decisión
...

## Motivo
...

## Alternativas consideradas
...

## Consecuencias
...

## Fecha / contexto histórico
...
```

No hace falta crear un ADR para cada decisión menor.

Deben reservarse para decisiones cuyo **por qué sería difícil
reconstruir en el futuro solamente mirando el código**.

------------------------------------------------------------------------

# 17. Uso del conocimiento para conversar con otras IAs

Uno de los objetivos principales de esta metodología es poder utilizar
el repositorio como **fuente de contexto transportable**.

En lugar de pedir:

> "Leé todo mi proyecto."

se puede proporcionar:

``` text
overview.md
architecture.md
systems/<sistema-relevante>.md
decisions/<decisiones-relevantes>.md
```

Esto permite mantener conversaciones de brainstorming de alto nivel sin
tener que transferir todo el código.

La documentación conceptual funciona así como una **interfaz entre el
proyecto y diferentes agentes de IA**.

------------------------------------------------------------------------

# 18. Posible archivo índice

Puede existir un archivo pequeño, por ejemplo:

``` text
docs/concept/README.md
```

que no intente explicar todo, sino actuar como mapa.

Ejemplo:

``` markdown
# Project Knowledge Map

## Visión
- overview.md
- goals.md

## Arquitectura
- architecture.md

## Subsistemas
- systems/builder.md
- systems/viewer.md
- systems/audio.md

## Decisiones
- decisions/

## Restricciones
- constraints.md

## Preguntas abiertas
- open-questions.md
```

Esto permite que un agente encuentre rápidamente el contexto relevante
sin cargar toda la documentación.

------------------------------------------------------------------------

# 19. Flujo completo recomendado

``` text
PROYECTO EXISTENTE
        │
        ▼
Relevamiento del repositorio
        │
        ▼
Reconstrucción bottom-up
        │
        ▼
Reconstrucción top-down
        │
        ▼
Detección de gaps
        │
        ▼
Entrevista con el responsable
        │
        ▼
Documentación conceptual inicial
        │
        ▼
Validación humana
        │
        ▼
────────────────────────────────
        │
        ▼
DESARROLLO NORMAL
        │
        ▼
Codex realiza una tarea
        │
        ▼
Auditoría conceptual
        │
        ├── No hubo cambio conceptual
        │          │
        │          └── No tocar documentación
        │
        └── Hubo cambio conceptual
                   │
                   ▼
          Actualizar documento local
                   │
                   ▼
          ¿Afecta nivel superior?
              │             │
             NO            SÍ
              │             │
           terminar     propagar
                            │
                            ▼
                    detener cuando
                    el nivel superior
                    siga siendo correcto
```

------------------------------------------------------------------------

# 20. Principios resumidos

1.  **La documentación de API y el conocimiento conceptual son cosas
    diferentes.**

2.  **No duplicar manualmente lo que pueda regenerarse desde el
    código.**

3.  **Documentar el modelo mental del sistema, no simplemente su
    estructura de archivos.**

4.  **Registrar el por qué de las decisiones importantes.**

5.  **Distinguir hechos, inferencias, hipótesis e intención
    desconocida.**

6.  **Cuando falte intención, preguntar; nunca inventarla.**

7.  **Mantener documentos pequeños, especializados y relacionados.**

8.  **Actualizar de manera incremental.**

9.  **No tocar documentación conceptual cuando solamente cambió la
    implementación.**

10. **Propagar los cambios hacia niveles superiores solo cuando sea
    necesario.**

11. **Utilizar una auditoría conceptual al cerrar cada tarea.**

12. **Pensar la documentación como conocimiento vivo y como interfaz
    entre el proyecto, los humanos y los agentes de IA.**

------------------------------------------------------------------------

# 21. Idea central

El objetivo final no es tener "más documentación".

El objetivo es mantener una representación compacta, fiable y
actualizada del **modelo mental del proyecto**.

El código debe seguir siendo la fuente de verdad sobre la
implementación.

La documentación de referencia debe explicar cómo utilizar esa
implementación.

La documentación conceptual debe preservar el conocimiento que el código
por sí solo no puede expresar completamente:

> **qué estamos construyendo, cómo pensamos el sistema, por qué tomamos
> determinadas decisiones y qué intención debe sobrevivir a futuras
> modificaciones.**

Con esa base, un agente como Codex puede trabajar sobre el proyecto y
mantener su conocimiento incrementalmente, mientras que otras IAs pueden
incorporarse a una conversación de alto nivel sin necesidad de
reconstruir el repositorio completo desde cero.
