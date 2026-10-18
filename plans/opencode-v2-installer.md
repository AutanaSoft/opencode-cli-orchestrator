# Plan: instalador de configuración para OpenCode V2

## Estado y autorización

- **Estado:** implementación y correcciones completadas y verificadas por el principal, incluidas resolución automática,
  respuestas abreviadas y comando estable de Codegraph. La suite actual tiene 44 pruebas aprobadas.
- **Objetivo:** ofrecer un instalador local y conservador para los recursos distribuibles de `src/`, con vista previa,
  fusiones explícitas, copias de seguridad y pruebas aisladas.
- **Autorización:** el usuario aprobó iniciar la implementación con «comienza la implementación» y proporcionó los
  requisitos de alcance y seguridad detallados en el encargo de implementación.
- **Alcance de este documento:** registrar decisiones ratificadas, avance, criterios de aceptación, evidencia y límites.
  La implementación no instala ni ejecuta OpenCode ni servidores MCP reales.

## Alcance previsto

El instalador futuro configuraría un destino global de OpenCode V2 a partir de los recursos de este repositorio. Los 13
recursos distribuidos identificados son:

- `src/AGENTS.md` y `src/opencode.jsonc`.
- Los cuatro agentes en `src/agents/`: `AutanaSoft.md`, `explore.md`, `worker.md` y `review.md`.
- Las seis plantillas en `src/templates/`: `design-artifact-task.md`, `correction-task.md`, `synthesis-task.md`,
  `review-task.md`, `exploration-task.md` y `execution-task.md`.
- `src/instructions/engram.md`, sujeto a la condición de Engram descrita más abajo.

Las seis plantillas se instalan siempre; su uso posterior por agentes es opcional. La instrucción de Engram se
instalaría solo si se verifican todas sus precondiciones. Los cambios de rutas y comandos se hacen en la copia de
destino, nunca en `src/`.

### Fuera de alcance

- Ejecutar o instalar OpenCode, MCP, Codegraph o Engram; iniciar servidores, conectarse a Context7 o generar índices.
- Modificar archivos globales durante el desarrollo o las pruebas, ejecutar `opencode mcp list` automáticamente o
  afirmar que una detección de ejecutable garantiza una conexión operativa.
- Resolver silenciosamente conflictos, eliminar recursos no gestionados, combinar arrays sensibles a ciegas o asumir que
  el archivo JSON tiene precedencia sobre JSONC.
- Cambiar agentes, plantillas, políticas, permisos o el diseño de configuración fuente como parte de la implementación
  del instalador.
- Ofrecer `--force` o `--with-templates`.

## Registro inicial y seguimiento

La lista detallada de tareas de cada fase es la fuente de verdad para el avance. Esta tabla resume hitos y evidencia.

| Hito                                              | Estado actual | Evidencia / condición de cierre                                                                                                                                    |
| ------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0. Investigación y delimitación                  | Completo      | Revisión inicial de instrucciones, paquete, formato, configuración y 13 recursos fuente; al inicio el único cambio sin seguimiento era este documento en `plans/`. |
| P1. Ratificación del diseño                       | Completo      | Aprobación explícita recibida; alcance, opciones CLI, dependencia, fusión dual y límites MCP ratificados en el encargo de implementación.                          |
| P2. CLI, destino y modo de vista previa           | Completo      | Precedencia automática, validación de rutas, fuente del destino en vista previa y `--dry-run` probados (T17, T18, T21, T25, T30, T35, T40–T41).                    |
| P3. Lectura, fusión y consolidación JSON/JSONC    | Completo      | Elecciones reflejadas en texto/valor, servidores MCP atómicos, backups duales, formato y claves duplicadas probados (T02–T08, T31–T33, T37, T39).                  |
| P4. Resolución de MCP y adaptación de rutas       | Completo      | PATH/fallback, estados no operativos, V2 `disabled: true` y servidores preexistentes probados (T09–T13, T27–T29, T36).                                             |
| P5. Recursos, manifiesto y transacción            | Completo      | Gestión, adopción, idempotencia, backups, rollback seguro ante symlink, concurrencia y deduplicación probados (T01, T14–T16, T19–T21, T23, T33–T35, T38).          |
| P6. Pruebas, scripts, dependencia y documentación | Completo      | 44 pruebas Node.js; scripts, `jsonc-parser` y documentación de resolución automática, respuestas abreviadas y Codegraph estable.                                   |
| P7. Revisión y validación final                   | Completo      | Principal revisó resolver, pruebas y documentación; ejecutó 41/41 pruebas, verificaciones de calidad y simulación real sin argumentos de ruta.                     |

### Evidencia registrada para este plan

- **2026-10-18 — investigación y documentación:** se confirmó que el paquete es ESM, requiere Node.js `>=22`, usa pnpm,
  no define actualmente scripts de build o test y ofrece `pnpm check`. El README describe como destino global
  predeterminado `~/.config/opencode/`, advierte no asumir que `XDG_CONFIG_HOME` cambia esa ruta y recomienda confirmar
  la ruta efectiva cuando el entorno difiere. `src/opencode.jsonc` contiene Context7 remoto, Codegraph local, Engram
  local y `./instructions/engram.md`. No se ejecutaron pruebas de instalador: todavía no existe.
- **Validación de este documento:** Prettier, Markdownlint del archivo y `pnpm check` se ejecutaron correctamente; los
  comandos y resultados se registran al final. La validación global se repetirá tras futuras modificaciones autorizadas.
- **2026-10-18 — corrección de destino automático, evidencia comunicada por el principal:** `opencode debug paths`
  mostró efectos de escritura en fixtures temporales con OpenCode 2.0.32, incluso con `--log-level none`; no se usa como
  detección del instalador. La matriz aislada comunicada (`/tmp/opencode/paths-matrix-6WhDkL`, `HOME` y XDG temporales)
  observó sin variables `HOME/.config/opencode`, con `XDG_CONFIG_HOME` el sufijo `/opencode`, con `OPENCODE_CONFIG_DIR`
  la ruta exacta (y precedencia sobre XDG), y con solo `OPENCODE_CONFIG` el directorio predeterminado. Esta evidencia
  motivó sustituir el bloqueo conservador por la precedencia determinista autorizada abajo; no es una afirmación de que
  la precedencia esté documentada para todas las versiones.

## Decisiones ratificadas para implementar

1. **Forma del instalador:** un punto de entrada `scripts/install.mjs`, Node.js nativo, funciones pequeñas y sin
   framework ni paso de build. Una dependencia de ejecución: `jsonc-parser` `^3.3.1`. Pruebas con `node:test` y
   `node:assert`, sin dependencias de prueba nuevas.
2. **Comandos:** `pnpm install:opencode` y `pnpm install:opencode:check` (este último equivale a `--dry-run`), más
   `pnpm test`. Se implementan en `package.json` y el lockfile.
3. **Argumentos:** `--config-dir <ruta>`, `--dry-run` y `--yes`. No se ofrecerán `--force` ni `--with-templates`.
   `--yes` confirma operaciones seguras no conflictivas, pero nunca elige una resolución de conflicto.
4. **Destino — decisión corregida:** resolución determinista, igual para instalación y `--dry-run`: `--config-dir` >
   `OPENCODE_CONFIG_DIR` (ruta exacta) > `XDG_CONFIG_HOME/opencode` > `HOME/.config/opencode`. Las variables vacías son
   no definidas; una variable seleccionada con ruta relativa falla en lugar de usar una prioridad inferior. Un
   `OPENCODE_CONFIG` no selecciona directorio: solo produce una advertencia sin imprimir su valor. Esta decisión
   sustituye la política inicial de exigir `--config-dir` ante variables de entorno; el principal la autorizó tras
   pruebas aisladas con OpenCode 2.0.32. El instalador no ejecuta OpenCode para resolver rutas.
5. **Configuración dual:** si existen `opencode.json` y `opencode.jsonc`, proponer consolidarlos en JSONC usando el
   JSONC existente como base de comentarios y formato. No inferir precedencia de OpenCode entre ambos. Exigir
   confirmación de consolidación y decisión por cada conflicto; respaldar ambos archivos y retirar el JSON activo solo
   después de validar el JSONC nuevo. Debe haber rollback ante fallo recuperable.
6. **Conflictos:** vista previa completa antes de escribir y decisiones explícitas. En TTY, ofrecer conservar el valor
   existente, reemplazarlo por el propuesto o cancelar, según el tipo de recurso. En modo no interactivo o con `--yes`,
   los conflictos sin resolver cancelan el plan completo sin escrituras. La vista previa no debe revelar secretos.
7. **Estado de MCP:** representar por separado detección, compatibilidad y operatividad; la presencia de un binario no
   demuestra que el servidor conecte o que sus herramientas estén disponibles. No realizar verificaciones de red ni
   lanzar MCP reales.
8. **Manifiesto/transacción:** archivo de propiedad en el destino, respaldos privados y aplicación escalonada con
   rollback de fallos ordinarios. No afirmar atomicidad entre varios archivos ni recuperación automática tras corte
   abrupto.

Las decisiones se registraron en este documento durante el cierre de implementación; la autorización y las restricciones
detalladas del usuario estaban disponibles antes de modificar código. No se introdujo una decisión arquitectónica
adicional sin aprobación.

## Diseño funcional propuesto

### CLI, destino y vista previa

- Validar argumentos desconocidos, duplicados, falta de valor de `--config-dir` y combinaciones inválidas antes de leer
  o escribir recursos. Normalizar la ruta explícita y mostrar cuál destino se usará.
- Resolver el destino sin subprocesos y con la misma precedencia en instalación y vista previa: `--config-dir` >
  `OPENCODE_CONFIG_DIR` > `XDG_CONFIG_HOME/opencode` > `HOME/.config/opencode`. Las rutas de entorno seleccionadas deben
  ser absolutas; las variables vacías se ignoran y una ruta relativa seleccionada causa error sin fallback.
  `OPENCODE_CONFIG` identifica un archivo, no un directorio, por lo que solo se advierte sin revelar su valor.
- `--dry-run` debe ser estrictamente de solo lectura: no crear directorios, archivos temporales, respaldos, manifiestos,
  logs ni procesos secundarios. Mostrar operaciones previstas y conflictos, sin interacción ni elección implícita.
- Construir el plan completo en memoria y presentar una vista previa final que refleje las decisiones de recursos y
  configuración. Si hay operaciones y no se proporcionó `--yes`, solicitar una confirmación final (`yes`/`no`/`cancel`)
  antes de escribir; sin TTY o adapter, abortar. `--yes` omite solo esa confirmación final de operaciones sin conflicto;
  no resuelve conflictos ni confirma la consolidación. Una ejecución sin operaciones no pregunta.
- Volver a comprobar los archivos leídos antes de aplicar.
- En cualquier conflicto no resuelto, abortar el plan completo antes de escribir, incluso con `--yes` o sin TTY.
- El prompt acepta palabras completas o iniciales únicas sin distinguir mayúsculas: `Y(es)/N(o)/C(ancel)`,
  `K(eep)/R(eplace)/C(ancel)` y `K(eep-jsonc)/T(ake-json)/C(ancel)`. Una inicial ambigua, respuesta vacía o inválida no
  elige una opción automáticamente.

### Configuración JSON/JSONC y reglas de merge

- Descubrir explícitamente los dos nombres de configuración. Si no existe ninguno, crear `opencode.jsonc`; si existe
  solo uno, modificar ese archivo; si existen ambos, usar el flujo de consolidación que requiere confirmación.
- Analizar con `jsonc-parser` (`parseTree`/`modify`/`applyEdits` o APIs equivalentes de la versión elegida), comprobar
  errores del parser, rechazar raíz que no sea objeto y detectar/rechazar claves duplicadas antes de planificar cambios.
- Editar rangos puntuales del documento para preservar comentarios, formato, saltos de línea y propiedades desconocidas.
  Validar el resultado completo antes de escribir. No serializar todo con `JSON.stringify` ni ejecutar Prettier sobre la
  configuración del usuario.
- Gestionar únicamente `$schema`, `default_agent`, `mcp.servers` e `instructions` que correspondan a la configuración
  propia. Preservar propiedades y entradas ajenas, incluidas otras instrucciones, proveedores, modelos, plugins,
  permisos y servidores MCP.
- Propiedad ausente: proponer agregarla. Valor equivalente: no-op. Valor distinto: conflicto, preservar hasta decisión.
  Tratar cada definición MCP como una unidad; no combinar parcialmente identidad, comando, argumentos ni credenciales.
  Durante merge dual, cada `mcp.servers.<nombre>` diferente es un conflicto unitario, incluso si el servidor es ajeno:
  tomar JSON reemplaza exactamente el objeto y conservar JSONC no importa ninguna de sus claves. Los arrays que
  contengan configuración ajena no se concatenan a ciegas. Para las rutas de instrucción propias, agregar sin duplicar y
  conservar el orden existente.
- Si se conserva un servidor `engram` conflictivo, no asumir que corresponde al ejecutable detectado. Si se conserva un
  `AutanaSoft` distinto, revisar su relación con `default_agent` antes de proponer este último. No añadir la instrucción
  de Engram ni cambiar el default automáticamente si no se cumplen las precondiciones del recurso correspondiente.
- Durante consolidación, tomar JSONC como base de edición y comentarios; incorporar claves exclusivas de ambos archivos
  y conservar una sola copia de las claves iguales. Los valores diferentes son conflictos. No concatenar arrays
  sensibles ni decidir prioridad por el orden de los archivos. Respaldar los bytes originales de JSON y JSONC, aunque el
  JSONC resultante sea idéntico; validar el resultado JSONC antes de retirar el JSON. Incluir retirada y respaldo dentro
  del plan de rollback.

### Detección MCP y adaptación local

- **Context7:** mantener como remoto `https://mcp.context7.com/mcp`; no necesita ejecutable local. No comprobar
  conectividad desde el instalador.
- **Codegraph:** detectar `codegraph` en `PATH`. No instalarlo, crear índices ni iniciar `codegraph serve --mcp`. Si la
  detección es segura, conservar el objeto de configuración fuente y su comando `["codegraph", "serve", "--mcp"]`, sin
  sustituirlo por el realpath de una versión. Si no se detecta, omitir su nueva configuración e informar al usuario. No
  eliminar ni modificar por este motivo un servidor previamente configurado. El proceso OpenCode necesita resolver
  `codegraph` en su `PATH`; la detección no verifica su entorno futuro.
- **Engram:** buscar `engram` en `PATH` y luego `~/.local/bin/engram`. Si está disponible, adaptar `command` a la ruta
  absoluta detectada, nunca a una ruta personal fija heredada de otro entorno. No instalarlo ni invocar `engram mcp`.
- Añadir `src/instructions/engram.md` y su ruta absoluta en `instructions` únicamente si el ejecutable está detectado,
  la configuración Engram final fue aceptada y no está deshabilitada (`disabled: true` en V2, o conservadoramente
  `enabled: false` si existe) ni tiene incompatibilidad conocida, y el archivo queda instalado. Si Engram se conserva
  por conflicto y no se confirma que sea el mismo servidor, no afirmar que se cumplen las precondiciones ni añadir el
  protocolo.
- Si hay configuración previa que referencia un servidor o instrucción no disponible, no borrarla; advertir que la
  dependencia puede estar rota. Distinguir estados **detectado**, **compatible**, **desconocido** y **operatividad no
  comprobada**. Si incluso una consulta de ayuda pudiera tener efectos no descartables, no ejecutar el binario y
  comunicar compatibilidad desconocida. Ese estado no equivale a incompatibilidad conocida ni a servidor operativo; la
  activación de instrucciones sigue las precondiciones explícitas anteriores.

### Recursos, propiedad y protección contra pérdida

- Instalar siempre `AGENTS.md`, los cuatro agentes y las seis plantillas. Instalar el archivo de instrucción de Engram
  solo bajo las precondiciones anteriores.
- Crear `.autanasoft-install.json` dentro del destino para registrar versión del esquema, rutas allowlist, hashes de los
  archivos instalados y hashes de los valores JSON gestionados. No guardar valores de configuración, credenciales ni
  secretos en claro; no registrar timestamps en una ejecución sin cambios.
- Actualizar automáticamente un archivo administrado solo si su hash actual coincide con el último hash registrado. En
  primera adopción, archivo existente idéntico al distribuido es no-op; diferente o modificado es conflicto, incluso si
  el nombre coincide. Para Markdown no intentar merge: permitir conservar, reemplazar con decisión explícita o cancelar.
  No borrar recursos obsoletos automáticamente.
- Tratar el manifiesto previo como entrada no confiable: validar versión, rutas contra allowlist estricta, tipos y
  hashes. Rechazar rutas fuera del destino, traversal, enlaces simbólicos y entradas desconocidas; no usar valores del
  manifiesto para formar rutas arbitrarias.
- Antes de escribir, crear un directorio de respaldo por ejecución con permisos `0700` y archivos/copias temporales y
  journal con permisos `0600` en POSIX. Conservar bytes exactos de originales, incluidos ambos JSON/JSONC si hay
  consolidación. Documentar los límites de permisos y renombrados atómicos en otras plataformas; no afirmar garantías no
  verificadas.
- Aplicar cada archivo mediante temporal en el mismo directorio y rename; validar configuración antes de sustituirla y
  escribir el manifiesto al final. Si falla una operación ordinaria, intentar rollback desde copias. Antes de restaurar,
  comprobar que el archivo aún coincide con la versión escrita por esta ejecución; no sobrescribir cambios concurrentes.
  Si rollback falla, informar archivos y respaldos necesarios para recuperación manual.
- Un journal sencillo debe identificar operaciones y respaldos para guiar recuperación manual tras interrupción del
  proceso. No prometer atomicidad multiarchivo ni rollback automático después de un corte abrupto.

## Fases y listas de trabajo

### P0 — Investigación y documentación del alcance

- [x] P0.1 Revisar instrucciones del repositorio y su flujo de calidad documental.
- [x] P0.2 Identificar requisitos Node/pnpm, scripts existentes y ausencia de scripts actuales de test/build.
- [x] P0.3 Enumerar los 13 recursos distribuibles y revisar la configuración MCP fuente.
- [x] P0.4 Registrar restricciones, correcciones del usuario y alcance no autorizado para esta entrega.

### P1 — Resolver decisiones y fijar contratos

**Dependencia:** autorización explícita recibida en el encargo de implementación.

- [x] P1.0 Obtener aprobación explícita: el usuario indicó «comienza la implementación».
- [x] P1.1 Ratificar CLI, scripts, `jsonc-parser`, manifiesto y reglas de seguridad mediante el encargo autorizado.
- [x] P1.2 Ratificar conflictos TTY/no TTY y confirmación de consolidación; `--yes` no resuelve conflictos ni confirma
      consolidación.
- [x] P1.3 Ratificar inicialmente el destino predeterminado y parada conservadora ante variables ambiguas; esta decisión
      fue reemplazada por la precedencia automática aprobada en la corrección posterior.
- [x] P1.4 Registrar decisiones y límites en este plan. El encargo con decisiones ya estaba presente antes de los
      cambios; la actualización persistente de este documento se hizo durante el cierre, no antes de editar código.

### P2 — Núcleo CLI, resolución del destino y `--dry-run`

**Dependencias:** P1 completo. No escribir fuera de fixtures temporales en las pruebas.

- [x] P2.1 Implementar el entry point ESM y validación estricta de argumentos.
- [x] P2.2 Resolver destino explícito o automático por precedencia, mostrar su fuente y validar rutas seleccionadas y
      enlaces simbólicos en el directorio de configuración y componentes relevantes.
- [x] P2.3 Modelar plan y vista previa sin cambios en disco; `--dry-run` no puede crear ni siquiera el directorio
      destino.
- [x] P2.4 Asegurar que conflictos no resueltos abortan el conjunto completo antes de la primera escritura.
- [x] P2.5 Comprobar fingerprints antes de aplicar y en cada operación; la prueba concurrente demuestra que rollback no
      pisa el cambio externo.
- [x] P2.6 Resolver automáticamente destino y fuente conforme a precedencia, rechazar solo rutas seleccionadas
      relativas, tratar `OPENCODE_CONFIG` como archivo y mantener `--dry-run` sin escrituras (T25, T40–T41).
- [x] P2.7 Aceptar y mostrar iniciales únicas sin distinguir mayúsculas para confirmaciones y conflictos; mantener
      cancelación segura para respuestas vacías, inválidas o ambiguas (T42–T43).

### P3 — Parser, merge y consolidación JSON/JSONC

**Dependencias:** P2. Requiere decisiones ratificadas para conflictos; no asumir precedencia OpenCode.

- [x] P3.1 Añadir `jsonc-parser` `^3.3.1` como dependencia de ejecución y actualizar lockfile; verificar API
      `parseTree`, `modify` y `applyEdits` en los tipos incluidos.
- [x] P3.2 Implementar parseo con detección de errores, raíz inválida, propiedades duplicadas y formato existente.
- [x] P3.3 Aplicar cambios puntuales preservando comentarios y propiedades desconocidas; validar la salida antes de
      instalarla.
- [x] P3.4 Implementar decisiones por propiedad y por unidad MCP; proteger el acoplamiento entre servidor Engram,
      instrucción y default agent.
- [x] P3.5 Implementar detección de cero/uno/ambos archivos; crear JSONC nuevo solo cuando no exista ninguno.
- [x] P3.6 Implementar consolidación confirmada con JSONC base, conflictos visibles, respaldos de ambos y retirada del
      JSON solo después de validar el resultado. Probar reversión ante error.

### P4 — MCP, binarios y rutas específicas del destino

**Dependencias:** P3. No acceder a la red ni iniciar servidores en pruebas o instalación.

- [x] P4.1 Implementar detección controlada de ejecutables PATH y fallback local de Engram, incluyendo estados
      desconocidos y errores de permisos.
- [x] P4.2 Conservar el comando fuente estable de Codegraph; adaptar solo Engram a la ruta detectada. No instalar rutas
      personales fijas heredadas de la fuente.
- [x] P4.3 Adaptar la ruta de instrucción relativa de la fuente a la ubicación absoluta de destino y deduplicarla sin
      reordenar entradas ajenas.
- [x] P4.4 Aplicar las precondiciones Engram; no instalar instrucción ni habilitar el servidor cuando la aceptación o
      disponibilidad falten o exista incompatibilidad conocida. Informar por separado la compatibilidad desconocida.
- [x] P4.5 Mostrar límites entre detección, compatibilidad y operatividad; reservar la comprobación con
      `opencode mcp list` para el usuario y la documentación.

### P5 — Recursos, manifiesto, backups y recuperación

**Dependencias:** P2–P4. La operación completa se planifica antes de escribir.

- [x] P5.1 Planificar siempre `AGENTS.md`, cuatro agentes y seis plantillas; tratar uso opcional de plantillas como
      asunto independiente de su instalación obligatoria.
- [x] P5.2 Implementar detección de adopción, hashes, conflictos de recursos existentes y protección de archivos
      modificados desde la instalación previa.
- [x] P5.3 Validar manifiesto como entrada no confiable con esquema/versionado y allowlist; omitir secretos y valores
      config en claro.
- [x] P5.4 Implementar backups exactos, temporales privados, journal, permisos previstos y aplicación por rename.
- [x] P5.5 Probar rollback de fallos ordinarios y no sobrescritura de escrituras concurrentes durante recuperación.
- [x] P5.6 Redactar mensajes de recuperación manual para interrupciones abruptas o rollback fallido; no declarar
      atomicidad global.

### P6 — Pruebas automatizadas, integración de paquete y documentación

**Dependencias:** P2–P5. Las pruebas deben usar directorios temporales, ejecutables falsos o adaptadores inyectados.

- [x] P6.1 Añadir pruebas `node:test` sin MCP, red, procesos reales ni escrituras globales.
- [x] P6.2 Añadir scripts propuestos a `package.json` y actualizar lockfile solo si la dependencia o instalación lo
      requieren.
- [x] P6.3 Documentar en README requisitos, destino, override explícito, modo check/dry-run, conflictos, respaldos,
      consolidación, resolución automática, estados MCP, verificación manual y recuperación.
- [x] P6.4 Reemplazar las instrucciones manuales de copia por la guía del instalador.
- [x] P6.5 Aclarar en documentación que las seis plantillas siempre se instalan aunque su uso sea opcional.

### P7 — Revisión final y criterios de cierre

**Dependencias:** P6.

- [x] P7.1 Ejecutar `pnpm test` y registrar el resultado real para esta corrección.
- [x] P7.2 Ejecutar `pnpm check` y registrar el resultado real para esta corrección.
- [x] P7.3 Revisión del principal de la resolución automática, pruebas y documentación; comprobó precedencia, selección
      de rutas y ausencia de consultas a ejecutables desde el instalador.
- [x] P7.4 Verificar que `--dry-run` comparte la resolución de destino con instalación y no crea el destino (T25, T40).
- [x] P7.5 Evaluación final de esta corrección completada: 41/41 pruebas, calidad, sintaxis y simulación real correctas.
      No se ejecutó instalación sobre el destino global ni se modificaron sus archivos.

## Matriz de pruebas ejecutada

Las pruebas usan fixtures bajo `/tmp/opencode`, binarios MCP falsos que nunca se invocan y un repositorio fuente copiado
para probar updates. No leen ni escriben la configuración global real. T01–T44 cubren los casos enumerados a
continuación; la cantidad de pruebas no implica cobertura de plataformas o interacciones que no se ejecutaron.

| ID  | Caso                                                           | Aserción principal                                                                                                                   |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| T01 | Instalación nueva en destino temporal                          | Recursos obligatorios instalados y configuración válida; instrucción Engram sujeta a precondiciones.                                 |
| T02 | Configuración existente compatible                             | Conserva propiedades, servidores e instrucciones ajenas.                                                                             |
| T03 | Config existente JSON únicamente                               | Edita JSON y preserva datos ajenos.                                                                                                  |
| T04 | Config existente JSONC únicamente                              | Preserva comentarios, saltos de línea y formato razonable.                                                                           |
| T05 | No existe JSON ni JSONC                                        | Crea JSONC.                                                                                                                          |
| T06 | Existen ambos, claves exclusivas o iguales                     | Consolida tras confirmación y mantiene una copia de valores iguales.                                                                 |
| T07 | Existen ambos con diferencias y arrays sensibles               | Informa conflictos; no concatena arrays ni escribe hasta resolver todo.                                                              |
| T08 | Ambos archivos y fallo al retirar JSON                         | Restaura ambos originales o informa claramente el fallo de rollback.                                                                 |
| T09 | Conflicto de definición MCP                                    | Trata el servidor como unidad, sin hibridar comando, identidad ni secretos.                                                          |
| T10 | Engram no encontrado                                           | No instala instrucción ni afirma operatividad.                                                                                       |
| T11 | Engram encontrado por PATH/fallback                            | Usa ruta absoluta detectada solo si la configuración final es aceptada.                                                              |
| T12 | Engram preexistente conservado por conflicto                   | No atribuye al ejecutable detectado la configuración conservada ni añade instrucción sin precondiciones.                             |
| T13 | Codegraph/Context7                                             | No inicia Codegraph ni accede a Context7; deja la operatividad sin comprobar.                                                        |
| T14 | Archivo administrado ausente / igual / modificado              | Crea, no-op o informa conflicto según proceda.                                                                                       |
| T15 | Repetición sin cambios                                         | Es idempotente; no cambia timestamps, backups ni manifiesto.                                                                         |
| T16 | Archivo previo de nombre coincidente pero ajeno                | No sobrescribe automáticamente, incluso en primera adopción.                                                                         |
| T17 | `--dry-run` fresh y con conflictos                             | No escribe, crea temporales ni lanza subprocesos; expone el plan/conflicto.                                                          |
| T18 | `--yes` o no TTY con conflicto                                 | Aborta sin escrituras; `--yes` no elige por el usuario.                                                                              |
| T19 | Fallo inyectado a mitad de aplicación                          | Hace rollback de operaciones anteriores y conserva backups verificables.                                                             |
| T20 | Cambio concurrente tras preflight                              | No restaura encima del cambio concurrente; informa recuperación.                                                                     |
| T21 | Enlaces simbólicos en destino, archivos o ancestros relevantes | Rechaza el plan antes de escribir.                                                                                                   |
| T22 | Config inválida, raíz no objeto o claves duplicadas            | Falla con diagnóstico antes de cualquier escritura.                                                                                  |
| T23 | Manifiesto manipulado, ruta traversal o versión desconocida    | Rechaza entradas y nunca escribe fuera del destino.                                                                                  |
| T24 | Vista previa con secretos en configuración existente           | No muestra credenciales ni valores sensibles.                                                                                        |
| T25 | Resolución automática HOME/XDG                                 | Sin binario OpenCode, `--dry-run` y la instalación eligen la misma ruta aislada; el check no escribe.                                |
| T26 | Garantía de no modificación global                             | Verifica el scope de escrituras con instrumentación/fixtures, sin leer ni copiar secretos globales reales.                           |
| T27 | Instrucciones y recursos                                       | Deduplica instrucción propia, conserva otras y siempre instala seis plantillas.                                                      |
| T28 | Ambos ejecutables presentes, uno ausente o ambos ausentes      | Solo añade los MCP locales disponibles; conserva los previos y comunica cada omisión.                                                |
| T29 | Engram deshabilitado o incompatibilidad conocida               | No activa el protocolo obligatorio; no sobrescribe la configuración previa.                                                          |
| T30 | Argumentos duplicados, desconocidos y combinaciones inválidas  | Falla antes de leer/escribir; valida `--config-dir` y `--help`.                                                                      |
| T31 | Elección `take-json` con clave y MCP administrado              | El valor y JSONC coinciden con la decisión; el manifiesto registra el hash de la definición aceptada.                                |
| T32 | Conflicto dual en servidor MCP desconocido                     | Cada definición se conserva o reemplaza como unidad, sin hibridar credenciales; otros servidores siguen.                             |
| T33 | Consolidación equivalente de archivos previamente instalados   | Se respaldan los bytes originales de JSON y JSONC y el journal identifica ambas copias.                                              |
| T34 | Duplicados de instrucciones en ambos órdenes                   | Mantiene la primera posición, normaliza una sola ruta y conserva instrucciones ajenas.                                               |
| T35 | Confirmación final y plan actualizado                          | No/Cancel/no TTY no escriben; no-op no pregunta; el plan muestra decisiones finales de recursos.                                     |
| T36 | Engram V2 deshabilitado y MCP deshabilitados preexistentes     | No instala/posee la instrucción Engram; Codegraph/Context7 se conservan tras decisión explícita.                                     |
| T37 | Detección de indentación y EOL existentes                      | Inserta usando cuatro espacios o tabs y conserva comentarios, propiedades desconocidas y CRLF.                                       |
| T38 | Symlink de ancestro sustituido durante rollback                | No sigue el enlace; conserva contenido externo y backup, y journal marca recuperación manual.                                        |
| T39 | Claves vacías duplicadas                                       | Rechaza duplicados raíz/anidados y en manifiesto antes de escribir; permite una clave vacía única.                                   |
| T40 | Precedencia automática y `OPENCODE_CONFIG`                     | Dir vence XDG; override explícito vence valores inválidos; `OPENCODE_CONFIG` solo advierte sin revelar valor.                        |
| T41 | Variables de ruta relativas                                    | Rechaza la variable seleccionada y no crea destino ni hace fallback a una ruta inferior.                                             |
| T42 | Respuestas abreviadas del adaptador terminal                   | Acepta iniciales únicas y palabras completas en mayúsculas/minúsculas; muestra aliases, no acepta iniciales ambiguas.                |
| T43 | Confirmación y cancelación abreviadas                          | `Y` confirma; `N`, `C`, entrada inválida o vacía cancelan sin crear el destino.                                                      |
| T44 | Actualización del ejecutable Codegraph                         | Al cambiar el destino versionado del enlace en PATH conserva el comando fuente, sin reescribir configuración ni ejecutar el binario. |

### Control de avance de pruebas

- [x] T01–T09: instalación y fusión, incluida consolidación con conflictos y recuperación.
- [x] T10–T13, T28–T29: detección y estados MCP, incluyendo ausencia de ejecutables y Engram deshabilitado.
- [x] T14–T18: propiedad de archivos, repetición, simulación y confirmaciones.
- [x] T19–T26: fallos, concurrencia, seguridad y aislamiento del destino real.
- [x] T27: rutas de instrucciones y seis plantillas obligatorias.
- [x] T30: validación estricta de argumentos.
- [x] T31–T37: regresiones para consistencia dual, merge MCP atómico, backups, deduplicación, confirmación, estado V2 y
      formato JSONC.
- [x] T38–T39: regresiones de ancestros symlink durante rollback y duplicados con clave vacía en
      configuración/manifiesto.
- [x] T40–T41: precedencia automática, destino de vista previa coherente con instalación, advertencia de archivo
      override y rechazo de rutas de entorno relativas.
- [x] T42–T44: respuestas de una letra, confirmación/cancelación y comando estable ante cambios de versión Codegraph.

Al completar cada caso, registrar su ID, comando y resultado en el historial. Marcar un grupo únicamente cuando todos
sus casos estén implementados y hayan pasado; una prueba omitida o fallida permanece pendiente. Los 44 casos pasaron con
`pnpm test` en la ejecución del principal tras las últimas correcciones.

## Riesgos, límites y preguntas a resolver

- **Ruta global distinta a la predeterminada:** la resolución varía según entorno/versión y no se debe asumir una
  variable universal documentada. La precedencia implementada es explícita y fue corroborada con OpenCode 2.0.32 en
  fixtures aislados: `--config-dir` > `OPENCODE_CONFIG_DIR` > `XDG_CONFIG_HOME/opencode` > `HOME/.config/opencode`.
  `OPENCODE_CONFIG` se trata como archivo y no altera el directorio. Otras versiones/plataformas podrían diferir; el
  instalador no ejecuta `opencode debug paths` porque esa consulta mostró efectos de escritura en 2.0.32.
- **Prioridad de JSON frente a JSONC:** no está establecida por este plan. No inventar precedencia: consolidar solo con
  confirmación, preservar ambos en backup y validar rollback antes de retirar JSON.
- **Fusión de configuración:** comentarios, claves duplicadas, arrays y objetos MCP pueden tener semántica propia.
  Limitar merge a propiedades aprobadas, identificar conflictos y cancelar de forma conservadora.
- **Comandos MCP:** ruta hallada no equivale a versión compatible, conexión ni herramientas disponibles. No lanzar
  procesos o red para aparentar verificación. El comando Codegraph permanece simbólico como en la fuente; OpenCode debe
  tener el ejecutable en su entorno `PATH` al arrancarlo.
- **Transacción de varios archivos:** renames individuales no hacen atómica la instalación entera; una caída abrupta
  puede requerir recuperación manual. El rollback revalida ancestros contra symlinks antes de acceder a archivos y
  journal, pero eso no elimina toda ventana TOCTOU. No se probó un corte abrupto real ni debe prometerse garantía más
  amplia que la implementada y probada.
- **Plataformas:** permisos POSIX, enlaces, rename y locks difieren fuera de POSIX. Precisar soporte y limitaciones
  fuera de POSIX. La evidencia actual es solo Linux; Windows/macOS y Node.js `>=22` (mínimo del repositorio) no se
  probaron en esta sesión.
- **TTY:** las decisiones interactivas se verificaron mediante el adaptador inyectado de pruebas; no se ejercitó una
  terminal interactiva real.
- **Manifiesto:** es dato externo manipulable. Validar schema, hashes y allowlist antes de decidir propiedad o ruta; no
  registrar secretos ni eliminar recursos ajenos/obsoletos.
- **Riesgo de scope:** se modificaron únicamente `scripts/install.mjs`, `tests/install.test.mjs`, `package.json`,
  `pnpm-lock.yaml`, `README.md` y este plan. `src/` y la configuración global real no se modificaron.

## Referencias aplicadas

Se usaron como contexto de implementación las referencias OpenCode V2 previamente investigadas y la API disponible en
`jsonc-parser` 3.3.1. Ninguna referencia implica que OpenCode o los MCP se hayan ejecutado.

- Repositorio: `README.md`, `package.json`, `.editorconfig`, `.prettierrc`, `.markdownlint-cli2.jsonc` y recursos bajo
  `src/`.
- OpenCode V2: [configuración](https://opencode.ai/v2/docs/config),
  [instrucciones](https://opencode.ai/v2/docs/instructions), [agentes](https://opencode.ai/v2/docs/agents),
  [servidores MCP](https://opencode.ai/v2/docs/mcp-servers) y [CLI](https://opencode.ai/v2/docs/cli).
- Parser: [microsoft/node-jsonc-parser](https://github.com/microsoft/node-jsonc-parser), versión fijada por el lockfile.

## Historial de ejecución del plan

| Fecha      | Actividad                                     | Resultado comprobado                                                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-18 | Investigación, creación y validación inicial  | Revisiones P0; Prettier, Markdownlint del plan y `pnpm check` pasaron antes de la autorización de implementación.                                                                                                                                                     |
| 2026-10-18 | Implementación inicial                        | T01–T30 y `pnpm check` pasaron en la primera entrega; la revisión posterior identificó siete hallazgos que motivaron la corrección acotada.                                                                                                                           |
| 2026-10-18 | Primera revisión principal                    | Confirmó los siete fixes previos; ejecutó independientemente `pnpm test` 37/37, `pnpm check` y `git diff --check` correctamente, y autorizó dos correcciones adicionales.                                                                                             |
| 2026-10-18 | Segunda corrección y validación               | T01–T39, `pnpm check`, Prettier scoped, Markdownlint dirigido y `git diff --check` pasaron; P7 sigue pendiente de evaluación final del principal. Solo Linux/Node 26.12.0 probado.                                                                                    |
| 2026-10-18 | Revisión principal de versión T39 (histórica) | Para esa versión, confirmó correcciones y revisión independiente sin bloqueantes; ejecutó `pnpm test` (39/39), `pnpm check`, `node --check scripts/install.mjs` y `git diff --check` correctamente. Esta aprobación no cubre T40–T41.                                 |
| 2026-10-18 | Resolución automática del destino             | T25, T40–T41 y suite completa; validaciones locales pasaron. Evaluación del principal de este cambio aún pendiente. Comportamiento de rutas basado en OpenCode 2.0.32 probado en fixtures por el principal.                                                           |
| 2026-10-18 | Verificación principal de destino automático  | `pnpm test` 41/41, `pnpm check`, sintaxis y `git diff --check` correctos. `pnpm install:opencode:check` sin argumentos detectó el destino desde XDG y terminó con salida 0; informó consolidación dual pendiente y un conflicto MCP, sin aplicar cambios. P7 cerrado. |
| 2026-10-18 | Respuestas abreviadas y Codegraph estable     | Por solicitud del usuario se aceptan iniciales y palabras completas case-insensitive y se respeta el comando fuente de Codegraph. T42–T44 y suite completa 44/44 aprobadas; no se modificó configuración global.                                                      |

### Comandos y evidencia de implementación

- `pnpm add jsonc-parser --ignore-scripts` — correcto; dependencia `^3.3.1` y lockfile actualizados sin ejecutar Husky.
- `pnpm test` — 44 pruebas aprobadas, 0 fallidas (T01–T44), en Linux con Node.js 26.12.0.
- `pnpm check` — correcto; Prettier comprobó todos los archivos coincidentes y Markdownlint procesó 15 archivos, con 0
  issues.
- `pnpm exec prettier --write scripts/install.mjs tests/install.test.mjs README.md plans/opencode-v2-installer.md` —
  correcto, limitado a las rutas autorizadas de esta corrección.
- `node --check scripts/install.mjs` — correcto.
- `git diff --check` — correcto, sin errores.
- `pnpm install:opencode:check --config-dir /tmp/opencode/installer-check-xuTGUA/not-created` — exit 0; el destino
  siguió ausente. Se detectaron rutas locales de Codegraph/Engram, pero no se invocaron.
- `pnpm exec prettier --write scripts/install.mjs tests/install.test.mjs package.json README.md plans/opencode-v2-installer.md`
  — correcto; limitado a rutas autorizadas.
- No se ejecutaron OpenCode, Codegraph, Engram ni MCP reales; no hubo conexiones a servidores MCP ni mutación de
  configuración global. La descarga de la dependencia es independiente de estas comprobaciones.
