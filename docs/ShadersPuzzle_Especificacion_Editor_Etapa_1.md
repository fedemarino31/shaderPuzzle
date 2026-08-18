# ShadersPuzzle

## Especificación conceptual y técnica — Etapa 1: editor y generador de piezas

**Estado:** primera especificación implementable  
**Prioridad actual:** editor de piezas  
**Tecnología de referencia:** TypeScript, Three.js, Tweakpane  
**Aplicación futura:** videojuego de rompecabezas 3D para realidad virtual mediante WebXR

---

## 1. Propósito del proyecto

ShadersPuzzle será un rompecabezas tridimensional en realidad virtual. El objeto completo estará dividido en piezas volumétricas irregulares que el jugador podrá tomar, trasladar y rotar con los controles de VR.

La pista principal para reconstruir el objeto no será una textura bidimensional convencional. Todas las piezas compartirán un mismo campo procedural tridimensional y animado. Este campo podrá producir ondas, anillos, líneas, brillos, pulsos, gradientes u otros patrones. Cada fragmento mostrará la porción del campo que corresponde a su posición dentro del objeto ensamblado, incluso después de ser separado y rotado.

El proyecto se divide inicialmente en dos aplicaciones:

1. **Editor y generador de piezas:** construye un volumen basado en celdas, permite deformarlo, lo divide en piezas y exporta el resultado.
2. **Juego VR:** importa el resultado, dispersa las piezas y permite ensamblarlas mediante continuidad visual y un sistema de encastre automático.

Esta especificación registra el concepto completo, pero define con especial detalle la primera aplicación. Las reglas finales de juego, progresión, dificultad, físicas y presentación se precisarán en una etapa posterior.

---

## 2. Objetivo de la etapa 1

Construir una herramienta visual de escritorio, ejecutada en el navegador, que permita:

1. Crear un volumen cúbico dividido en celdas.
2. Definir un hueco cúbico centrado dentro del volumen.
3. Deformar de manera interactiva la grilla global de vértices compartidos.
4. Impedir o señalar deformaciones geométricamente inválidas.
5. Dividir semiautomáticamente todas las celdas ocupadas en piezas conexas.
6. Visualizar, inspeccionar y regenerar la partición.
7. Examinar el interior mediante distintos modos de renderizado y una vista explotada.
8. Generar una malla independiente por pieza.
9. Asignar a cada vértice una coordenada tridimensional fija para el shader procedural.
10. Exportar la geometría y los metadatos necesarios para el juego.
11. Guardar y restaurar el proyecto editable del generador.

El editor no necesita incluir VR en esta etapa. La interacción se realizará con mouse y teclado.

---

## 3. Decisiones conceptuales ya establecidas

### 3.1. No se utilizará una fractura geométrica convencional

Las piezas se construirán agrupando celdas de una grilla volumétrica. Inicialmente las celdas son cubos regulares, pero dejan de serlo después de deformar la grilla. Topológicamente continúan siendo celdas hexaédricas con ocho esquinas y seis caras.

Este enfoque permite controlar la forma y el tamaño de las piezas y garantiza que dos piezas vecinas tengan superficies de contacto coincidentes.

### 3.2. La deformación ocurre antes de la partición

El flujo es:

```text
volumen y hueco → deformación de la grilla → partición en piezas → extracción de mallas
```

El hueco se define antes de deformar. Por lo tanto, las paredes que delimitan la cavidad se deforman junto con el resto de la grilla.

### 3.3. Los vértices pertenecen a una única grilla global

Las celdas vecinas no poseen copias independientes de sus esquinas durante la edición. Todas consultan los mismos puntos de la grilla global:

```text
p'(i,j,k) = p(i,j,k) + desplazamiento(i,j,k)
```

Mover un punto modifica simultáneamente todas las celdas incidentes. Esto evita grietas, diferencias de borde y solapamientos entre celdas que deberían continuar unidas.

### 3.4. El shader utilizará coordenadas tridimensionales fijas

Aunque coloquialmente se las pueda llamar “UV”, técnicamente serán coordenadas tridimensionales `UVW`, porque el patrón existe en un espacio volumétrico.

Cada vértice exportado tendrá como mínimo:

- `position`: posición local usada para renderizar la pieza.
- `uvw`: ubicación fija del vértice dentro del volumen completo ensamblado.

El atributo `uvw` no cambia cuando una pieza se mueve o rota en el juego. Puede normalizarse dentro de los límites del objeto:

```text
uvw = (restPosition - objectBoundsMin) / (objectBoundsMax - objectBoundsMin)
```

Una única coordenada `uvw` por vértice es suficiente para los patrones procedurales planteados. No es necesario conservar simultáneamente dos espacios distintos de textura, como una grilla regular y otra deformada.

### 3.5. Las piezas conectadas conservarán su identidad

En el juego no será obligatorio fusionar geometrías. Varias piezas encastradas podrán pertenecer a un mismo grupo rígido y manipularse como una unidad, manteniendo sus identificadores, conexiones y atributos propios.

---

## 4. Terminología

| Término | Definición |
| --- | --- |
| Punto o vértice de grilla | Punto compartido por una o más celdas. |
| Celda | Elemento volumétrico de la grilla. Inicialmente cúbico; hexaedro deformado después de la edición. |
| Celda ocupada | Celda que contiene materia y debe pertenecer a una pieza. |
| Celda vacía | Celda excluida del sólido, por ejemplo dentro del hueco central. |
| Pieza | Conjunto de una o más celdas ocupadas, conectado por caras. |
| Grilla lógica | Índices enteros y relaciones de vecindad, independientes de la deformación visual. |
| Posición de reposo | Posición deformada de un punto dentro del objeto ensamblado. |
| `uvw` | Coordenada tridimensional fija empleada por el shader procedural. |
| Partición | Asignación de cada celda ocupada a exactamente una pieza. |
| Vista explotada | Separación visual reversible de las piezas, sin modificar su tamaño, forma ni orientación. |

Si el cubo posee `N` celdas por lado, necesita `N + 1` puntos de grilla por eje:

```text
8 × 8 × 8 celdas → 9 × 9 × 9 puntos
```

---

## 5. Flujo principal del editor

El editor se organiza como una secuencia de etapas, aunque el usuario puede regresar a una etapa anterior con confirmación cuando la operación invalide resultados posteriores.

### Etapa A — Configuración del volumen

- Elegir la cantidad de celdas por lado.
- Elegir el tamaño del hueco cúbico interno.
- Crear la grilla lógica, su ocupación y los puntos compartidos.

### Etapa B — Deformación

- Seleccionar uno o varios puntos.
- Configurar una selección dura o suave.
- Desplazar el conjunto con `TransformControls`.
- Validar la geometría en tiempo real.
- Deshacer o rehacer operaciones.

### Etapa C — Partición

- Configurar tamaño mínimo y máximo de pieza.
- Elegir semilla y preferencia de formas.
- Generar regiones conexas.
- Corregir residuos y validar cobertura total.

### Etapa D — Inspección y exportación

- Colorear las piezas.
- Alternar entre render sólido, translúcido y alámbrico.
- Explorar el interior mediante la vista explotada.
- Generar mallas finales y coordenadas `uvw`.
- Guardar el proyecto editable o exportar el paquete para el juego.

---

## 6. Interfaz general

### 6.1. Disposición

- **Viewport 3D:** ocupa la mayor parte de la pantalla.
- **Panel Tweakpane:** ubicado arriba a la derecha.
- **Indicador de etapa:** muestra Volumen, Deformación, Partición o Inspección.
- **Barra de estado:** informa selección, cantidad de celdas y piezas, validación y advertencias.
- **Ayuda contextual breve:** muestra los controles relevantes para la herramienta activa.

El panel debe agrupar controles en carpetas plegables y mostrar solamente las opciones pertinentes para la etapa actual.

### 6.2. Navegación 3D

- `OrbitControls` para orbitar, desplazar y acercar la cámara.
- Botón para encuadrar el objeto completo.
- Botón para encuadrar la selección.
- Vistas predefinidas: perspectiva, frente, lateral y superior.
- Posibilidad de alternar proyección perspectiva y ortográfica si resulta útil para editar filas y columnas.

Cuando `TransformControls` está siendo arrastrado, `OrbitControls` debe quedar temporalmente desactivado para evitar conflictos.

### 6.3. Selección

- Click sobre un punto para establecer el centro de selección.
- `Esc` para limpiar la selección.
- El punto principal debe distinguirse de los puntos influidos.
- Los puntos influidos deben visualizar su peso mediante tamaño, color u opacidad.
- La selección se calcula a partir del estado actual de los parámetros; no debe deformar nada hasta iniciar el arrastre.

---

## 7. Etapa A — Creación del volumen y el hueco

### 7.1. Parámetros iniciales

Para el primer prototipo se utilizará un cubo con igual cantidad de celdas en X, Y y Z:

```ts
gridSize: number
innerVoidSize: number
cellSize: number
```

- `gridSize`: cantidad de celdas por lado del cubo exterior.
- `innerVoidSize`: cantidad de celdas por lado del cubo vacío interior.
- `cellSize`: medida inicial de cada celda en unidades del mundo.

La interfaz debe hablar de **tamaño exterior** y **tamaño del hueco**, no de radio, porque ambos volúmenes son cúbicos.

### 7.2. Reglas del hueco

- El hueco es un cubo centrado.
- Una celda dentro del rango del hueco se marca como vacía.
- Todas las demás celdas se marcan como ocupadas.
- El hueco puede tener tamaño `0`, lo que representa un sólido macizo.
- `innerVoidSize` siempre debe ser menor que `gridSize`.
- Para el MVP, el tamaño exterior y el hueco deben tener la misma paridad. Esto evita un hueco desplazado medio voxel respecto del centro.
- Si posteriormente se admite paridad diferente, la regla de centrado y redondeo deberá ser explícita.

Ejemplo:

```text
gridSize = 8
innerVoidSize = 4

Volumen exterior: 8 × 8 × 8 celdas
Hueco interior:    4 × 4 × 4 celdas vacías centradas
```

### 7.3. Regeneración

Cambiar `gridSize`, `innerVoidSize` o `cellSize` reconstruye la grilla. Si ya existen deformaciones o una partición, el editor debe pedir confirmación, porque esos datos se perderán.

### 7.4. Estructuras mínimas

```ts
type GridVertex = {
  id: number;
  index: [number, number, number];
  originalPosition: [number, number, number];
  restPosition: [number, number, number];
};

type Cell = {
  id: number;
  index: [number, number, number];
  vertexIds: [number, number, number, number, number, number, number, number];
  occupied: boolean;
  pieceId: number | null;
};
```

`originalPosition` puede conservarse en el archivo editable para restablecer la grilla y calcular desplazamientos, aunque el juego no necesite exportarla como atributo de vértice.

---

## 8. Etapa B — Edición y deformación de la grilla

### 8.1. Principio de funcionamiento

El usuario modifica puntos de la grilla global. Cada arrastre produce un vector `delta`. Los puntos seleccionados se desplazan según su peso:

```text
newPosition(i) = dragStartPosition(i) + weight(i) × delta
```

El punto central tiene peso `1`. Los demás pueden tener peso `1` en selección dura o un peso entre `0` y `1` en selección suave.

### 8.2. Modos de selección requeridos

#### Punto individual

Selecciona solamente el punto elegido.

#### Línea, fila o columna

Selecciona puntos alineados con el punto principal sobre un eje lógico:

- Eje X.
- Eje Y.
- Eje Z.

Debe poder elegirse toda la línea o un rango limitado hacia ambos lados del punto principal.

#### Rango duro

Selecciona una cantidad discreta de puntos con frontera definida. Debe permitir configurar extensiones independientes por eje; por ejemplo, tres puntos hacia arriba y tres hacia abajo, o un bloque local alrededor del centro.

Todos los puntos incluidos reciben peso `1`.

#### Selección suave esférica

Selecciona los puntos dentro de un radio alrededor del punto principal. La distancia debe evaluarse en el espacio de reposo actual o, como opción futura, en la grilla lógica.

Parámetros:

- Radio de influencia.
- Intensidad global.
- Curva de caída.
- Restricción de ejes afectados.

Una función inicial posible es:

```text
t = clamp(1 - distance / radius, 0, 1)
weight = t ^ exponent
```

El exponente controla si la influencia es amplia o se concentra cerca del centro. Más adelante pueden agregarse curvas Smoothstep, lineal, campana y curvas personalizadas.

#### Selección aleatoria estructurada

Herramienta auxiliar que elige aleatoriamente:

- Un punto.
- Una línea.
- Un rango dentro de una línea.
- Un centro para selección suave.

La herramienta prepara la selección, pero no aplica automáticamente una deformación. El usuario conserva el control del movimiento mediante `TransformControls`.

### 8.3. TransformControls

Para el MVP se requiere traslación. El gizmo aparece en el punto principal o en el centro ponderado de la selección.

Opciones:

- Movimiento en X, Y o Z.
- Movimiento en un plano XY, XZ o YZ.
- Bloqueo explícito de ejes desde Tweakpane.
- Sensibilidad o paso de ajuste opcional.

Rotar o escalar la selección no es necesario para la primera versión, porque ambos pueden complicar la validación y no forman parte del concepto original.

### 8.4. Herramientas auxiliares

- Restablecer la selección actual a la posición que tenía al iniciar el arrastre.
- Restablecer toda la grilla a su forma regular.
- Mostrar u ocultar puntos.
- Mostrar u ocultar aristas.
- Mostrar u ocultar las celdas ocupadas.
- Mostrar u ocultar el hueco o sus paredes.
- Ajustar tamaño visual de puntos y grosor aparente de aristas.

### 8.5. Undo y redo

- `Ctrl+Z`: deshacer.
- `Ctrl+Shift+Z` o `Ctrl+Y`: rehacer.
- Cada arrastre completo debe registrarse como una única operación, no como cientos de pasos intermedios.
- El historial debe guardar las posiciones anteriores y posteriores de los puntos afectados.
- Una nueva operación después de deshacer elimina la rama de redo.
- Cambios estructurales, como regenerar la grilla o reemplazar el hueco, pueden utilizar una instantánea completa o requerir confirmación.

---

## 9. Validación geométrica de la deformación

Aunque el usuario tenga control manual, el editor no debe depender solamente de su apreciación visual. Una celda puede invertirse o degenerarse sin que resulte evidente.

### 9.1. Condiciones inválidas

El editor debe detectar, como mínimo:

- Volumen de celda nulo o negativo.
- Inversión de orientación.
- Aristas por debajo de una longitud mínima.
- Triángulos de cara con área casi nula.
- Caras o triángulos severamente degenerados.
- Auto-intersecciones locales evidentes.

Como validación más robusta, puede evaluarse el signo del jacobiano del hexaedro en sus esquinas y en puntos interiores, o descomponerse la celda de manera consistente en tetraedros y verificar sus volúmenes orientados. La elección exacta debe documentarse en la implementación y usarse de manera coherente.

### 9.2. Comportamiento durante el arrastre

El comportamiento preferido es:

1. Calcular la posición candidata de todos los puntos afectados.
2. Validar únicamente las celdas incidentes a esos puntos.
3. Si el estado es válido, aceptar el paso.
4. Si es inválido, limitar el desplazamiento a la última posición válida.
5. Resaltar temporalmente en rojo o naranja las celdas que imponen el límite.

Para obtener un límite suave, se puede realizar una búsqueda binaria entre el último `delta` válido y el `delta` inválido.

El editor no debe confirmar una deformación inválida ni permitir avanzar a la partición mientras haya errores.

### 9.3. Advertencias de calidad

Además de errores estrictos, pueden existir advertencias:

- Relación de aspecto extrema.
- Ángulos demasiado agudos.
- Cara muy alabeada.
- Pieza potencialmente incómoda de manipular.

Las advertencias no necesariamente bloquean el flujo, pero deben mostrarse en la barra de estado y en la geometría afectada.

---

## 10. Etapa C — Partición semiautomática

### 10.1. Modelo lógico

La partición trabaja sobre las celdas ocupadas. La deformación modifica la geometría, pero no la conectividad lógica de la grilla.

Dos celdas son vecinas para el algoritmo solamente si comparten una cara completa. Compartir una arista o un punto no es suficiente.

### 10.2. Parámetros

```ts
minCellsPerPiece: number
maxCellsPerPiece: number
seed: string | number
shapePreference: "balanced" | "compact" | "elongated" | "irregular"
```

- **Mínimo:** objetivo inferior de cantidad de celdas por pieza.
- **Máximo:** límite u objetivo superior.
- **Semilla:** permite reproducir exactamente una partición.
- **Preferencia de forma:** modifica cómo crecen las regiones.

Inicialmente, mínimo y máximo pueden tratarse como restricciones preferentes. Si el algoritmo no consigue respetarlos, debe advertirlo claramente.

### 10.3. Resultado obligatorio

- Toda celda ocupada pertenece a exactamente una pieza.
- Ninguna celda vacía pertenece a una pieza.
- No puede quedar ninguna celda ocupada sin asignar.
- Ninguna celda puede pertenecer a dos piezas.
- Cada pieza debe ser conexa por caras.
- La unión de todas las piezas debe reconstruir exactamente el volumen ocupado.

### 10.4. Algoritmo inicial sugerido

Una implementación inicial puede utilizar crecimiento de regiones:

1. Crear el conjunto de celdas ocupadas sin asignar.
2. Elegir una celda semilla.
3. Crear una nueva pieza.
4. Agregar iterativamente celdas vecinas disponibles.
5. Puntuar los candidatos según la preferencia de forma.
6. Detener el crecimiento al alcanzar un tamaño elegido entre mínimo y máximo.
7. Repetir hasta asignar todas las celdas.
8. Reparar residuos y validar el resultado.

Posibles heurísticas:

- **Compacta:** favorecer celdas cercanas al centro de la pieza y con varias caras adyacentes al grupo.
- **Alargada:** favorecer continuidad en una dirección dominante.
- **Irregular:** introducir cambios de dirección y fronteras menos uniformes.
- **Equilibrada:** combinar compacidad, variedad y azar controlado.

### 10.5. Tratamiento de residuos

Un residuo no debe convertirse automáticamente en una pieza adicional si eso contradice el mínimo configurado. El algoritmo debe intentar, en este orden:

1. Incorporar las celdas residuales a piezas vecinas que no excedan el máximo.
2. Redistribuir celdas entre las últimas regiones sin romper conectividad.
3. Reintentar la generación con un orden distinto derivado de la misma semilla.
4. Si no existe solución dentro de un número limitado de intentos, aceptar una excepción y mostrarla.

La interfaz debe informar qué piezas quedaron fuera del rango esperado.

### 10.6. Regeneración

El usuario debe poder:

- Regenerar con la misma semilla y obtener el mismo resultado.
- Cambiar la semilla y generar una alternativa.
- Cambiar reglas sin perder la grilla deformada.
- Volver a la etapa de deformación; al modificar la geometría, puede conservarse la asignación lógica mientras no cambie la ocupación, aunque las mallas derivadas deberán reconstruirse.

### 10.7. Validaciones adicionales

- Cantidad total de piezas.
- Distribución de tamaños.
- Piezas de una sola celda.
- Cuellos de una sola celda.
- Piezas con ramas delgadas.
- Piezas demasiado similares entre sí.

Estas últimas propiedades son métricas de calidad, no necesariamente errores. En una versión posterior podrían convertirse en reglas configurables.

No es requisito de esta etapa garantizar una secuencia físicamente posible para extraer o insertar las piezas sin atravesar otras. El juego puede permitir aproximarlas desde cualquier dirección y resolver el último tramo mediante snap. Si posteriormente se desea un rompecabezas físicamente desmontable, será necesario un validador específico.

---

## 11. Generación de las mallas de las piezas

### 11.1. Extracción de superficie

No se renderizará cada celda como un objeto independiente en el resultado final. Para cada pieza se recorren sus celdas y se generan sólo las caras necesarias:

| Celda vecina | Acción |
| --- | --- |
| Pertenece a la misma pieza | Omitir la cara interna. |
| Pertenece a otra pieza | Conservar una copia de la cara para cada pieza y registrar la conexión. |
| Es una celda vacía | Conservar la cara como pared visible de la cavidad. |
| Está fuera de la grilla | Conservar la cara como superficie exterior. |

Las superficies de contacto entre piezas deben existir en ambas mallas porque estarán visibles cuando las piezas se encuentren separadas.

### 11.2. Triangulación consistente

Después de deformar una celda, sus caras de cuatro puntos pueden dejar de ser planas. Todas las caras se triangulan.

La diagonal de una cara global debe elegirse una sola vez de manera determinista y reutilizarse en las dos piezas vecinas. Las dos copias deben tener:

- Los mismos puntos de reposo.
- La misma diagonal.
- Los mismos valores `uvw`.
- Normales con sentidos opuestos cuando corresponda.

Esto evita separaciones geométricas y diferencias de interpolación del patrón.

### 11.3. Coordenadas locales y pivote

Cada pieza puede exportarse con sus vértices centrados alrededor de un pivote propio. En ese caso debe incluir una transformación de ensamblado que la devuelva a su ubicación correcta. Alternativamente, el MVP puede conservar todas las posiciones en el sistema del objeto completo y usar identidad como transformación inicial.

La opción recomendada para el juego es:

- Geometría centrada en un pivote estable de la pieza.
- `assembledTransform` por pieza.
- `uvw` calculado antes de recentrar, a partir de la posición dentro del objeto completo.

El pivote puede ubicarse en el centroide geométrico o en el centro promedio de las celdas que componen la pieza. Debe utilizarse una regla única y reproducible.

### 11.4. Normales y sombreado

- Las caras deben disponer de normales válidas después de la deformación.
- Las superficies de contacto pueden utilizar sombreado plano para conservar legibilidad.
- Si se generan normales suavizadas, no deben suavizarse accidentalmente bordes que representan quiebres entre caras.
- El patrón procedural depende de `uvw`, no de las normales, aunque el material puede combinarlas con iluminación.

### 11.5. Caras superpuestas al ensamblar

Cuando dos piezas están en la posición final, sus caras de contacto coinciden y pueden producir `z-fighting`.

El editor sólo necesita poder inspeccionarlas correctamente. El juego deberá adoptar una estrategia posterior, por ejemplo:

- Ocultar las caras correspondientes a conexiones ya resueltas.
- Descartarlas mediante datos de conexión y shader.
- Mantenerlas únicamente mientras las piezas están separadas.

No se recomienda separar físicamente las caras de contacto, porque dejarían de encajar con exactitud.

---

## 12. Etapa D — Inspección visual

### 12.1. Colores de partición

Después de generar la partición, cada pieza recibe un color claramente distinguible. Los colores son de inspección y no forman parte necesariamente del material final del juego.

- La paleta debe evitar colores consecutivos demasiado parecidos.
- La selección activa debe destacarse sin perder el color de identidad.
- Las piezas con advertencias deben tener una señal adicional, no depender solamente del color.

### 12.2. Modos de renderizado

El editor debe ofrecer como mínimo:

#### Sólido

- Superficies completamente opacas.
- Color diferente por pieza.
- Iluminación que permita leer volumen y deformaciones.

#### Superficies translúcidas con aristas

- Caras con opacidad regulable.
- Aristas o wireframe superpuesto.
- Permite observar la estructura interna y las piezas posteriores.
- Debe considerar el orden de transparencia de Three.js; la visualización es diagnóstica y no necesita ser físicamente perfecta.

#### Wireframe

- Sólo aristas o líneas de triangulación.
- Color por pieza o color uniforme configurable.
- Opción de mostrar únicamente bordes de celda y ocultar diagonales, si se conserva esa información topológica.

Controles complementarios:

- Opacidad.
- Mostrar/ocultar puntos de la grilla.
- Mostrar/ocultar límites de las celdas.
- Mostrar/ocultar caras externas, internas o de conexión.
- Aislar la pieza seleccionada.
- Ocultar temporalmente piezas seleccionadas.
- Restablecer visibilidad.

### 12.3. Vista explotada

La vista explotada sirve para ver la estructura interna sin modificar los datos reales del rompecabezas.

Debe conservar para cada pieza:

- Tamaño.
- Geometría.
- Rotación.
- Orientación relativa.
- Asignación de celdas.
- Transformación de ensamblado.

Sólo se agrega una traslación visual reversible.

Sea:

- `C`: centro del objeto completo.
- `Pi`: centro de la pieza `i` en su posición ensamblada.
- `explosionFactor`: factor de separación.

El centro visual de la pieza será:

```text
Pi_exploded = C + explosionFactor × (Pi - C)
```

La traslación adicional aplicada a la pieza es:

```text
offset_i = (explosionFactor - 1) × (Pi - C)
```

Por lo tanto:

- Factor `1`: objeto ensamblado, sin separación.
- Factor `2`: los centros ocupan posiciones equivalentes a una distribución escalada al doble desde el centro, pero las piezas no cambian de tamaño.
- Factores intermedios: transición continua.

El factor debe controlarse con un slider y actualizarse en tiempo real. Un rango inicial razonable es `1` a `3`, con valor sugerido `2` para inspección.

El centro de cada pieza debe calcularse con una regla estable. Para respetar la geometría deformada, se recomienda el centro promedio de sus celdas o el centro de sus límites en posición de reposo.

La vista explotada debe implementarse en un nivel de transformación de visualización separado. Nunca debe:

- Modificar los vértices.
- Cambiar `uvw`.
- Alterar `assembledTransform`.
- Guardarse por error como nueva posición de ensamblado.
- Influir en la detección de vecindades.

Opciones útiles:

- Animar el cambio de factor.
- Seleccionar una pieza aun estando explotada.
- Dibujar líneas tenues entre piezas vecinas.
- Mostrar identificadores de pieza.
- Restablecer instantáneamente el factor a `1`.

---

## 13. Conectividad que debe producir el editor

Aunque la lógica de snap pertenece al juego, el editor debe exportar información suficiente para no tener que redescubrir vecindades en tiempo de ejecución.

Para cada par de piezas vecinas debe registrarse:

- Identificador de ambas piezas.
- Caras globales compartidas.
- Celdas situadas a cada lado.
- Vértices de cada cara.
- Centro y normal de referencia de la conexión.
- Transformación relativa correcta entre las piezas o información suficiente para derivarla.

Una conexión puede abarcar varias caras contiguas si dos piezas comparten una región mayor que una cara.

El editor debe agrupar esas caras por par de piezas y, opcionalmente, por componente conexa de superficie.

---

## 14. Guardado del proyecto editable

El formato de proyecto debe preservar todo lo necesario para continuar editando:

- Versión del formato.
- Tamaño exterior, tamaño del hueco y tamaño de celda.
- Posiciones regulares y deformadas de los puntos.
- Ocupación de todas las celdas.
- Asignación de celdas a piezas.
- Parámetros y semilla de partición.
- Preferencias de visualización que resulte útil restaurar.
- Historial de undo/redo, opcional en la primera versión.

Formato sugerido: JSON con números redondeados sólo al guardar, sin perder precisión relevante.

```ts
type EditorProject = {
  format: "shaders-puzzle-editor";
  version: 1;
  volume: {
    gridSize: number;
    innerVoidSize: number;
    cellSize: number;
  };
  vertices: GridVertex[];
  cells: Cell[];
  partition: {
    seed: string;
    minCellsPerPiece: number;
    maxCellsPerPiece: number;
    shapePreference: string;
    pieces: Array<{ id: number; cellIds: number[] }>;
  } | null;
  view?: {
    renderMode: "solid" | "transparent" | "wireframe";
    explosionFactor: number;
  };
};
```

La carga debe validar versión, índices, cantidades, ocupación y conectividad antes de reconstruir la escena.

---

## 15. Exportación para el juego

El paquete exportado puede consistir en:

- Un archivo glTF/GLB con una malla por pieza y el atributo `uvw`, si el pipeline elegido conserva atributos personalizados.
- Un JSON complementario con piezas, conexiones y transformaciones.

Si glTF no conserva `uvw` con el nombre deseado en la implementación utilizada, debe emplearse un atributo personalizado compatible, una extensión propia o un formato binario complementario. Esto debe verificarse mediante una prueba de ida y vuelta antes de fijar el formato definitivo.

Contenido mínimo:

```ts
type GamePuzzleData = {
  version: 1;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  pieces: Array<{
    id: string;
    meshRef: string;
    cellIds: number[];
    assembledTransform: {
      position: [number, number, number];
      quaternion: [number, number, number, number];
      scale: [number, number, number];
    };
    connectionIds: string[];
  }>;
  connections: Array<{
    id: string;
    pieceA: string;
    pieceB: string;
    sharedFaceIds: string[];
    relativeTransform: {
      position: [number, number, number];
      quaternion: [number, number, number, number];
    };
  }>;
};
```

La exportación no debe incluir el offset de la vista explotada.

---

## 16. Arquitectura de software sugerida

La implementación debería separar datos, algoritmos y representación visual.

```text
EditorState
├── VolumeModel
│   ├── GridVertex[]
│   ├── Cell[]
│   └── Occupancy
├── SelectionModel
├── DeformationHistory
├── GeometryValidator
├── PartitionModel
├── PieceMeshBuilder
├── ConnectivityBuilder
├── ViewState
└── ExportModel
```

Módulos sugeridos:

- `GridBuilder`: crea índices, puntos y celdas.
- `OccupancyBuilder`: aplica el patrón del hueco.
- `SelectionController`: calcula puntos y pesos.
- `DeformationController`: aplica deltas y gestiona transacciones de arrastre.
- `GeometryValidator`: valida únicamente la región afectada cuando sea posible.
- `HistoryManager`: undo/redo.
- `PartitionGenerator`: genera y repara regiones.
- `PartitionValidator`: comprueba cobertura, exclusividad y conectividad.
- `PieceMeshBuilder`: extrae y triangula superficies.
- `ConnectivityBuilder`: crea conexiones entre piezas.
- `PieceView`: mantiene objetos Three.js y modos de material.
- `ExplosionController`: aplica offsets de inspección sin tocar el modelo.
- `ProjectSerializer`: guarda y carga proyectos editables.
- `GameExporter`: genera el paquete del juego.

La escena de Three.js no debe ser la fuente de verdad. Los `Object3D`, `BufferGeometry` y materiales deben reconstruirse a partir del modelo de datos cuando sea necesario.

---

## 17. Estados e invalidaciones

Las operaciones deben invalidar sólo los resultados derivados necesarios:

| Cambio | Consecuencia |
| --- | --- |
| Tamaño exterior o hueco | Reconstruye ocupación, elimina deformación y partición. |
| Posición de un punto | Mantiene ocupación y asignación lógica; invalida validación y mallas. |
| Parámetros de partición | Mantiene grilla y deformación; regenera asignaciones y mallas. |
| Color o modo de render | No modifica ningún dato geométrico. |
| Factor de explosión | Sólo modifica transformaciones de vista. |
| Triangulación | Reconstruye mallas y conexiones geométricas, no la partición lógica. |

Antes de una operación destructiva, el editor debe informar qué datos se perderán.

---

## 18. Rendimiento y límites iniciales

Los límites exactos se medirán durante el prototipo. Debe recordarse que:

- Cantidad de celdas: `N³`.
- Cantidad de puntos: `(N + 1)³`.
- La validación durante un arrastre debe limitarse a las celdas incidentes a la selección.
- Las mallas no necesitan reconstruirse en cada evento de puntero si puede actualizarse una previsualización y reconstruirse al finalizar el arrastre.
- La partición opera sobre un grafo regular de hasta seis vecinos por celda.
- El wireframe completo puede resultar costoso y visualmente saturado en grillas grandes.

El panel debe mostrar conteos estimados antes de crear una grilla y advertir si el tamaño elegido supera el rango probado.

---

## 19. Criterios de aceptación de la etapa 1

La etapa se considera funcional cuando se cumplen, como mínimo, los siguientes casos:

### Volumen

- Crear un cubo de `N³` celdas y `(N+1)³` puntos.
- Crear un hueco cúbico centrado con paridad válida.
- Confirmar que las paredes del hueco se deforman al mover puntos compartidos.

### Deformación

- Seleccionar un punto, una línea, un rango duro y una selección suave.
- Visualizar correctamente pesos de selección.
- Mover la selección con `TransformControls`.
- Restringir el movimiento por eje.
- Impedir una inversión o colapso de celda.
- Deshacer y rehacer un arrastre como una operación única.

### Partición

- Generar piezas conexas entre mínimo y máximo siempre que sea posible.
- Repetir exactamente el resultado con la misma semilla.
- Asignar toda celda ocupada una sola vez.
- Excluir todas las celdas vacías.
- Detectar y señalar excepciones de tamaño.
- Regenerar sin perder la deformación.

### Inspección

- Mostrar colores distintos por pieza.
- Alternar sólido, translúcido con aristas y wireframe.
- Aislar u ocultar piezas.
- Variar la explosión continuamente entre factor `1` y al menos `2`.
- Confirmar que las piezas no escalan ni rotan durante la explosión.
- Volver a factor `1` y recuperar exactamente el ensamblado.

### Mallas y exportación

- Eliminar caras entre celdas de una misma pieza.
- Conservar caras entre piezas diferentes.
- Conservar paredes exteriores y del hueco.
- Triangular una cara compartida de forma idéntica en ambos lados.
- Exportar `uvw` continuo y coincidente entre las dos copias de una cara.
- Exportar identificadores, transformaciones de ensamblado y conexiones.
- Guardar y cargar un proyecto sin alterar la grilla ni la partición.

---

## 20. Pruebas recomendadas

### Casos pequeños deterministas

- `2³` sin hueco: inspección manual completa.
- `3³` con hueco de `1³`: prueba de cavidad.
- `4³` con piezas de tamaños muy restringidos: prueba de residuos.
- Grilla sin deformación: referencia geométrica exacta.
- Un solo punto deformado cerca del límite: prueba de validación.

### Invariantes automatizables

- La suma de celdas de las piezas coincide con la cantidad de celdas ocupadas.
- La intersección entre los conjuntos de celdas de dos piezas es vacía.
- Cada pieza tiene una sola componente conexa por caras.
- Toda cara compartida tiene la misma triangulación y los mismos `uvw` en ambos lados.
- Guardar y cargar produce el mismo estado lógico.
- Explosión `1` produce matrices de visualización idénticas a las de ensamblado.
- La misma semilla y parámetros producen la misma partición.

### Pruebas visuales

- Shader procedural de prueba con anillos y gradiente direccional.
- Comparación de continuidad sobre piezas separadas y ensambladas.
- Revisión de paredes del hueco.
- Revisión de transparencia y orden de render.
- Revisión de caras degeneradas bajo deformaciones extremas.

---

## 21. Orden de implementación recomendado

### Hito 1 — Modelo de grilla

- Grilla cúbica.
- Hueco cúbico.
- Visualización de puntos, aristas y celdas.

### Hito 2 — Deformación interactiva

- Selección individual y por línea.
- Selección dura y suave.
- `TransformControls`.
- Undo/redo.
- Validación geométrica incremental.

### Hito 3 — Partición

- Grafo de celdas ocupadas.
- Crecimiento de regiones con semilla.
- Reglas de tamaño y forma.
- Reparación de residuos.
- Validación y colores.

### Hito 4 — Inspección

- Modos sólido, translúcido y wireframe.
- Aislamiento y visibilidad.
- Vista explotada paramétrica.

### Hito 5 — Mallas y datos

- Extracción de superficies.
- Triangulación global consistente.
- `uvw`.
- Conectividad.

### Hito 6 — Persistencia y exportación

- Guardar/cargar proyecto.
- Exportar mallas y metadatos.
- Prueba de importación en una escena separada.

---

## 22. Concepto del juego registrado para etapas posteriores

Esta sección conserva las decisiones ya conversadas, pero no pretende cerrar todavía el diseño del juego.

### 22.1. Manipulación

- Aplicación de realidad virtual mediante WebXR.
- Piezas dispersas en el espacio.
- Traslación y rotación mediante controladores VR.
- Las piezas ensambladas forman bloques manipulables como una sola unidad.

### 22.2. Pista visual

- Campo procedural 3D animado común a todas las piezas.
- Patrones posibles: círculos, ondas, líneas, brillos, pulsos, gradientes y eventos localizados.
- El patrón se evalúa con el `uvw` fijo, no con la posición actual de la pieza.
- Las caras internas de conexión también muestran el patrón, porque son una pista importante.
- Conviene combinar señales periódicas y no periódicas para evitar ambigüedades.
- Puede resultar útil pausar o ralentizar la animación.

### 22.3. Detección de encastre

No bastará con medir distancia entre caras. Una unión válida debe comprobar:

1. Que las piezas o bloques sean vecinos conocidos.
2. Que la posición relativa esté dentro de una tolerancia.
3. Que la orientación relativa esté dentro de una tolerancia angular.
4. Que no exista una interpenetración incompatible.
5. Que se cumpla la condición de confirmación definida, por ejemplo al soltar.

Al entrar en la zona de captura, el juego podrá intensificar o sincronizar el patrón. El snap puede incluir:

- Alineación suave y breve.
- Relajación temporal de colisiones durante el ajuste final.
- Sonido de confirmación.
- Vibración háptica.
- Brillo localizado en la unión.

### 22.4. Crecimiento de bloques

```text
pieza + pieza → bloque de 2
bloque + pieza → bloque mayor
bloque + bloque → bloque mayor
```

Al unir dos bloques, uno se alinea según una conexión válida y todos sus integrantes pasan a compartir un grupo rígido. No es necesario fusionar las mallas.

### 22.5. Riesgos de diseño todavía abiertos

- Conseguir que los patrones den pistas suficientes sin volver trivial el juego.
- Evitar patrones simétricos o repetitivos que generen falsos indicios.
- Definir tolerancias de snap cómodas para VR.
- Resolver colisiones durante el encastre.
- Ocultar o tratar las caras de contacto para evitar `z-fighting`.
- Decidir si existe una secuencia físicamente válida de armado o si se permite atravesar temporalmente otras piezas.
- Definir dificultad, ayudas, número de piezas y progresión.
- Evaluar cómo influyen los huecos cerrados y las caras inaccesibles en la solución.

---

## 23. Decisiones pendientes que no bloquean el primer prototipo

- Valores máximos de `gridSize` soportados con buen rendimiento.
- Fórmula definitiva de validación de hexaedros.
- Curvas exactas de selección suave.
- Conjunto final de heurísticas de forma.
- Si mínimo y máximo serán estrictos o preferentes en la versión final.
- Regla definitiva de pivote por pieza.
- Formato final de exportación y conservación del atributo `uvw`.
- Edición manual posterior de la partición: fusionar, separar o reasignar celdas.
- Nuevos patrones de vacío: esfera, túneles, cruces o cavidades múltiples.
- Herramientas de deformación adicionales: ruido suave, torsión, curvatura o desplazamientos automáticos.
- Editor o previsualizador de shaders dentro del generador.
- Reglas completas del juego VR.

---

## 24. Resumen del alcance

La etapa 1 entregará un editor capaz de construir una grilla cúbica con un hueco interno, deformarla mediante puntos compartidos sin destruir su validez, dividir todas las celdas ocupadas en piezas conexas y revisar el resultado mediante colores, transparencia, wireframe y una vista explotada reversible.

El producto exportado conservará mallas coincidentes, conectividad y una coordenada `uvw` tridimensional fija por vértice. Con esos datos, la etapa posterior podrá implementar el shader procedural común, la manipulación en WebXR y el ensamblado incremental mediante snap.
