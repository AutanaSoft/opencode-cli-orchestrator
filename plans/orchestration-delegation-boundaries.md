# Plan: aislamiento de restricciones delegadas y verificación del orquestador

## Estado y autorización

- **Objetivo:** evitar que restricciones de una delegación se conviertan indebidamente en políticas persistentes o se
  apliquen después a otros agentes, preservando la arquitectura de orquestación híbrida de OpenCode V2.
- **Problema identificado:** un `worker` sustituyó una responsabilidad permanente de coordinación y verificación por
  restricciones de su propio encargo; posteriormente AutanaSoft interpretó esas restricciones como aplicables al agente
  principal.
- **Fecha:** 2026-10-19.
- **Alcance autorizado actualmente:** implementación de las reglas acordadas en los tres archivos de orquestación y
  actualización del seguimiento de este documento, con las verificaciones previstas.
- **Estado:** verificado en el alcance autorizado; revisión independiente sin defectos. `pnpm check` sigue fallando por
  formato preexistente fuera del alcance, sin declarar éxito global ni validación runtime de agentes.
- **Autorización de implementación:** el usuario aprobó explícitamente este plan el 2026-10-19 y autorizó su
  implementación completa, sin commits ni push y sin modificar archivos fuera del alcance.
- **Restricción explícita:** modificar únicamente los tres archivos de orquestación autorizados y este documento para
  seguimiento. No extender la autorización a otros planes ni a configuración global.
- **Responsable de coordinación y verificación:** AutanaSoft.
- **Ejecución futura:** directa o delegada según complejidad, riesgo, especialización, coste de coordinación y consumo
  de contexto, manteniendo un único escritor activo en el workspace.
- **Ajuste acordado:** AutanaSoft debe obtener la autorización necesaria para una desviación; no puede aprobar
  unilateralmente cambios que requieren autorización del usuario.

## Reglas de seguimiento

- Estados de seguimiento: **Pendiente**, **En curso**, **Bloqueado**, **En revisión** y **Verificado**. La
  implementación permanece pendiente hasta obtener aprobación explícita del usuario.
- Marcar una tarea solo cuando exista evidencia suficiente de su cumplimiento; registrar cambios, comandos, resultados y
  límites de verificación. Una prueba omitida o una intención no acredita cumplimiento.
- Las listas de implementación y las comprobaciones documentales son registros separados. Validar este documento no
  completa tareas de implementación ni demuestra comportamiento runtime.
- Registrar bloqueos, desviaciones y autorizaciones con su contexto. AutanaSoft evalúa la desviación, determina qué
  autorización requiere y consulta al usuario cuando corresponda antes de efectuar el cambio.
- Este documento podrá actualizarse para registrar el avance de su propia implementación cuando esté autorizada. No
  autoriza cambios en otros planes.
- Las restricciones de un encargo delegado conservan su destinatario, alcance y vigencia; no modifican las
  responsabilidades generales de coordinación y verificación establecidas aquí.
- Si una corrección invalida evidencia anterior, reabrir la tarea afectada y repetir las comprobaciones pertinentes.

## Diagnóstico y causa raíz

### 1. Promoción incorrecta de restricciones del Worker

El encargo contenía restricciones válidas para el ejecutor: no subdelegar y ser el único escritor durante la tarea.
También permitía actualizar un documento de planificación para registrar aprobaciones, decisiones y resultados.

Según el incidente descrito por el usuario, el `worker` sustituyó:

```text
Responsable de coordinación y verificación: agente principal.
Asignar ejecutores al iniciar cada fase, sin escritores simultáneos
en el mismo workspace.
```

por:

```text
Responsable: este ejecutor es el único escritor; no delegar.
```

Confundió el permiso para editar el documento con autorización para cambiar las responsabilidades que este registraba.
La restricción del encargo se convirtió indebidamente en una regla persistente sin conservar destinatario ni vigencia.

### 2. Interpretación posterior por AutanaSoft

AutanaSoft interpretó la restricción documentada como una prohibición vigente para el agente principal, sin reconstruir
su destinatario y contexto. También confundió exclusividad temporal de escritura con prohibición general de delegación.
Un único escritor limita la concurrencia: permite delegar y cambiar secuencialmente de escritor cuando el anterior haya
terminado.

### 3. Falta de detección en la revisión delegada

La revisión del resultado no detectó que se había sustituido una responsabilidad permanente del orquestador sin
autorización. Aceptar el informe de finalización sin contrastar el contenido modificado permitió que la restricción
persistida se utilizara posteriormente como autoridad.

### Protecciones existentes y precisión necesaria

- `src/AGENTS.md`, en `Scope and Applicable Instructions`, ya exige consultar instrucciones aplicables y aclarar
  conflictos materiales. Falta explicitar destinatario, alcance y vigencia, así como separar decisiones persistentes de
  información histórica.
- `src/AGENTS.md`, en `Conversation Scope and Authorization` y `Changes and Verification`, ya exige aprobación y
  consulta ante desviaciones materiales. No hace falta otro mecanismo de autorización: debe quedar claro que alterar
  autoridad en documentación también puede constituir una desviación.
- `src/agents/worker.md`, en `Restrictions` y `Delegated Contract Rules`, ya limita el alcance, impide subdelegar y
  exige devolver el control ante decisiones arquitectónicas pendientes. Necesita una salvaguarda explícita para
  preservar decisiones y responsabilidades al actualizar documentos.
- `src/agents/AutanaSoft.md` ya conserva la responsabilidad final, exige revisar resultados y limita la escritura
  simultánea. Necesita concretar la revisión de cambios de autoridad y la distinción entre concurrencia y delegación.

Los errores no estaban autorizados por las reglas existentes; la corrección reduce ambigüedad, no reemplaza los
controles de autorización.

### Evidencia y límites del diagnóstico

La inspección de solo lectura confirmó la frase problemática en `plans/engram-sidebar-plugin-v2.md:18`. Ya figuraba en
HEAD y no fue introducida por los cambios pendientes observados durante el análisis. La atribución al `worker` y la
secuencia posterior proceden del incidente descrito por el usuario; no se reconstruyeron independientemente. Ese plan se
utiliza únicamente como evidencia y no se modificará en esta implementación.

## Alcance de implementación

Los cambios futuros de instrucciones se limitan exclusivamente a:

1. `src/AGENTS.md`: aplicabilidad contextual y prohibición de promover restricciones de un encargo.
2. `src/agents/worker.md`: preservación documental de decisiones y responsabilidades, y devolución del control para
   obtener autorización.
3. `src/agents/AutanaSoft.md`: responsabilidad sobre artefactos, distinción entre concurrencia y delegación, y revisión
   de cambios de autoridad.

Quedan fuera de alcance:

- `plans/engram-sidebar-plugin-v2.md` y los demás documentos de `plans/`, salvo el seguimiento de este propio plan.
- `src/agents/explore.md` y `src/agents/review.md`.
- `src/templates/`.
- El código del plugin Engram y los demás archivos de `plugins/`.
- El instalador y los scripts.
- Configuraciones MCP y globales, incluido `src/opencode.jsonc`.
- Dependencias y lockfiles.
- Cambios de modelos, niveles de razonamiento o permisos efectivos.

### Mínimo alcance y ausencia de redundancias

La regla general define cómo interpretar restricciones; Worker la aplica a la escritura documental; AutanaSoft revisa el
contenido y conserva responsabilidad por los resultados. No se duplicará la interpretación contextual en cada rol.

Explore y Review ya tienen contratos acotados, sin escritura ni subdelegación. Las seis plantillas ya delimitan alcance,
restricciones y devolución de resultados; las de corrección y síntesis preservan decisiones y la de artefactos exige
validar rutas y contenido. Son opcionales: cambiarlas únicamente a ellas no cubriría encargos sin plantilla.

No se añaden nuevos contratos, metadatos, formatos, validaciones documentales universales ni revisores obligatorios para
toda tarea. La revisión independiente prevista aquí está acotada a esta corrección.

## Modificaciones propuestas

Las siguientes reglas son contenido previsto para una implementación posterior. No son instrucciones para aplicarlas
durante la elaboración de este documento.

### A. `src/AGENTS.md`

En `Scope and Applicable Instructions`, antes de la regla existente sobre conflictos, añadir:

```markdown
- Interpret instructions by their source, intended recipient, scope, and period of applicability. Distinguish standing
  rules and approved persistent decisions from task-specific constraints, temporary executor restrictions, and
  historical records. An approved persistent decision does not expire merely because it appears in an older document.
- Recording a task or executor restriction in an artifact does not make it project policy or extend it to other agents
  or later tasks. Do not promote or broaden that restriction without explicit authorization; when recording it as
  history, preserve its original context.
```

### B. `src/agents/worker.md`

En `Delegated Contract Rules`, después de la regla de aceptación de contratos, añadir:

```markdown
- When updating documentation, preserve approved decisions and established responsibilities, including AutanaSoft's
  coordination and verification role, unless the delegated scope explicitly authorizes those changes. Permission to
  update status, approvals, or implementation results is not permission to change architecture, authority, or
  permissions.
- Keep your execution restrictions scoped to their intended recipient and task; do not present your own limitations as
  restrictions on other agents. If the requested update requires an unauthorized change to established decisions,
  responsibilities, or permissions, stop that change, report the deviation, and return control to AutanaSoft to obtain
  the necessary authorization.
```

### C. `src/agents/AutanaSoft.md`

En `Responsibilities`, sustituir:

```markdown
- Retain responsibility for decisions and the final result, even when delegating.
```

por:

```markdown
- Retain responsibility for decisions, delegated artifacts, and the final result, even when delegating.
```

En `Concurrency and Changes`, ampliar la regla del único escritor:

```markdown
- Keep **only one agent writing** in the workspace at a time, including yourself. Do not start simultaneous changes to
  the same working state. This limits concurrent writes; it does not prohibit delegation or sequential changes of
  writer.
```

Se conserva la regla posterior que exige confirmar la finalización del escritor anterior antes de iniciar otra tarea con
escritura.

En `Verification and Failures`, sustituir la primera regla por:

```markdown
- Inspect delegated changes against the authorized scope, approved decisions, and acceptance criteria; do not accept
  completion claims alone. Check for unauthorized changes to responsibilities, authority, permissions, or the scope and
  duration of restrictions, including in documentation. Do not accept those changes as approved decisions or governing
  instructions; report them and handle any correction under the existing authorization rules.
```

## Escenarios y criterios de aceptación

Los resultados del contraste semántico de estos escenarios se registrarán en las evidencias de implementación. No
equivalen a pruebas de comportamiento runtime.

### A. Worker actualiza un plan

El encargo prohíbe subdelegar y establece un único escritor. Worker respeta ambas restricciones durante su ejecución,
preserva la coordinación y verificación de AutanaSoft y no convierte sus restricciones en políticas generales. Si las
registra como historia, conserva el contexto del encargo.

### B. AutanaSoft consulta un plan histórico

AutanaSoft distingue destinatario, alcance y vigencia; no hereda restricciones de un ejecutor anterior ni pierde su
capacidad de delegación. Conserva decisiones persistentes válidas y solicita aclaración si hay ambigüedad material.

### C. Revisión de un resultado delegado

Ante una modificación no autorizada de responsabilidades, AutanaSoft inspecciona el cambio, informa del hallazgo y no lo
acepta como decisión aprobada ni instrucción vigente. Cualquier corrección respeta las reglas de autorización
existentes.

### D. Delegación legítima

Con un plan aprobado, AutanaSoft puede asignar una implementación a Worker según las reglas híbridas. Mientras Worker
escribe, ningún otro agente escribe en el workspace. Antes de cambiar de escritor, se confirma que la tarea anterior ha
terminado; un timeout o una respuesta parcial no bastan.

### E. Cambio de autoridad necesario

Si una tarea requiere alterar responsabilidades o permisos establecidos sin autorización suficiente, Worker detiene ese
cambio y devuelve el control. AutanaSoft evalúa la desviación, determina la autorización necesaria y consulta al usuario
cuando corresponda antes de efectuarla.

### Comprobaciones complementarias

- Las decisiones arquitectónicas aprobadas no pierden vigencia automáticamente por su antigüedad.
- La prohibición de subdelegar del Worker permanece vigente por su contrato de rol, no porque haya quedado registrada en
  un documento histórico.

Los escenarios no autorizan modificar planes reales ni ejecutar implementaciones para probarlos. Su comprobación debe
contrastar las reglas y ejemplos acotados, dejando explícito qué comportamiento no se haya verificado.

## Checklist de implementación

Implementación autorizada explícitamente el 2026-10-19. Las casillas reflejan únicamente trabajo realizado con
evidencia:

- [x] Inspeccionar el estado inicial y preservar los cambios existentes.
- [x] Actualizar `src/AGENTS.md` con la redacción acordada.
- [x] Actualizar `src/agents/worker.md` con la redacción acordada y el ajuste de autorización.
- [x] Actualizar `src/agents/AutanaSoft.md` con las tres modificaciones acordadas.
- [x] Comprobar coherencia entre reglas, sin duplicaciones ni contradicciones de autorización.
- [x] Comprobar los escenarios A–E y las dos comprobaciones complementarias, registrando evidencia y límites.
- [x] Verificar que modelos, niveles de razonamiento, permisos, separación de roles y delegación híbrida permanecen
      intactos, incluidos los idiomas de conversación y delegación y la protección de cambios preexistentes.
- [x] Aplicar Prettier y después Markdownlint a los tres archivos de instrucciones.
- [x] Ejecutar `pnpm check` y registrar resultados y limitaciones.
- [x] Realizar una revisión independiente de solo lectura, acotada a los cambios y criterios de este plan.
- [x] Revisar el diff y comprobar que los cambios respetan el alcance autorizado.
- [x] Presentar resultados finales, evidencias, riesgos y trabajo pendiente.

## Verificación prevista

Durante la futura implementación autorizada se ejecutarán:

```bash
pnpm exec prettier --write src/AGENTS.md src/agents/worker.md src/agents/AutanaSoft.md

pnpm exec markdownlint-cli2 src/AGENTS.md src/agents/worker.md src/agents/AutanaSoft.md

pnpm check

git diff --check

git diff -- src/AGENTS.md src/agents/worker.md src/agents/AutanaSoft.md

git status --short
```

Se revisarán previamente los efectos y requisitos de los comandos. El `package.json` actual define `pnpm check` como
verificación de formato y Markdown seguida de `node --test`, aunque la guía raíz indica que no hay scripts de pruebas.
Resolver esa discrepancia queda fuera de alcance. No se repararán fallos ajenos a esta corrección sin autorización.

Las validaciones de formato y las pruebas automatizadas no demuestran por sí mismas el comportamiento de los agentes. Se
necesita revisión semántica del diff, contraste con los escenarios y revisión independiente. No debe declararse validado
el comportamiento runtime sin evidencia específica.

### Comprobaciones documentales de elaboración

Esta sección registra únicamente la validación de este documento; no completa el checklist de implementación.

- Estado inicial inspeccionado: había cambios preexistentes en el plan de Engram y el README de su plugin, y archivos
  sin seguimiento en su directorio de validación. Deben conservarse intactos.
- Prettier ejecutado exclusivamente sobre este documento con
  `pnpm exec prettier --write plans/orchestration-delegation-boundaries.md`: correcto.
- Markdownlint ejecutado exclusivamente sobre este documento con
  `pnpm exec markdownlint-cli2 plans/orchestration-delegation-boundaries.md`: cero problemas.
- Se compararon los seis bloques Markdown con la redacción inglesa acordada: coinciden al normalizar únicamente los
  espacios y saltos de línea ajustados por Prettier. El primer cotejo literal detectó esos cambios de formato; el cotejo
  posterior confirmó que no hay diferencias de redacción. El ajuste de autorización está incorporado.
- Un chequeo de solo lectura confirmó doce tareas de implementación sin marcar y ninguna tarea completada.
- Se revisaron `git status`, `git diff --check` y el diff del archivo nuevo contra `/dev/null`. La huella SHA-256 del
  diff de archivos ya versionados y las de los tres archivos preexistentes sin seguimiento permanecieron iguales al
  estado inicial. El único archivo añadido por esta solicitud es este documento.
- No se han implementado reglas ni ejecutado pruebas de implementación o runtime durante la elaboración del plan.

## Riesgos y limitaciones

- **Confundir decisiones antiguas válidas con instrucciones caducadas:** distinguir antigüedad de vigencia y conservar
  decisiones persistentes aprobadas.
- **Generar aprobaciones innecesarias:** aplicar el control a cambios no autorizados de decisiones, autoridad o
  permisos, no a cualquier actualización documental dentro del alcance acordado.
- **Interpretar restricciones históricas como vigentes:** reconstruir destinatario, alcance y contexto; aclarar
  ambigüedades materiales sin adoptar automáticamente esas restricciones.
- **Reducir accidentalmente la delegación híbrida:** mantener sus criterios y separar el único escritor activo de una
  prohibición de delegar.
- **Confiar exclusivamente en las instrucciones:** los prompts reducen ambigüedad, pero no son un control técnico
  infalible; inspeccionar resultados y evidencias.
- **Modificar automáticamente planes históricos fuera del alcance:** este plan no autoriza reparar el documento de
  Engram ni otros planes; cualquier corrección requiere una solicitud independiente.

## Condición para iniciar la implementación

Condición cumplida: el usuario aprobó explícitamente la implementación completa de este plan el 2026-10-19. La
autorización previa para crear el documento no se utilizó como autorización de implementación. Cualquier desviación
material requiere consulta antes de continuar.

## Evidencias de implementación

- **Estado inicial:** los tres archivos de instrucciones no tenían modificaciones pendientes. Se conservaron los cambios
  preexistentes del plan de Engram, del README de su plugin y de sus tres archivos de validación sin seguimiento.
- **Control de alcance:** huella SHA-256 inicial del contenido y las rutas de archivos versionados y sin seguimiento
  fuera de los cuatro archivos autorizados: `1dc05f5c289f911659faf6b24a0e8c9e09fb422016653600f49790d02cf55b9f`.
- **Ejecución:** cambios mecánicos realizados directamente por AutanaSoft; revisión independiente de solo lectura
  prevista. La elección de ejecución directa no modifica la estrategia híbrida ni las responsabilidades permanentes.
- **Cambios aplicados:** dos reglas generales de aplicabilidad y persistencia; dos reglas del Worker para preservar
  decisiones y obtener autorización; tres modificaciones de AutanaSoft sobre artefactos, concurrencia y revisión.
- **Coincidencia con el plan:** un chequeo de solo lectura comparó los bloques ingleses del documento con los archivos
  aplicados, normalizando únicamente espacios. Al deshacer en memoria las inserciones y sustituciones previstas, los
  tres archivos coinciden con HEAD; no hay cambios adicionales de contenido. Los frontmatters de los agentes son
  idénticos a HEAD, incluidos modelos, niveles de razonamiento y permisos.
- **Formato dirigido:** Prettier y después Markdownlint ejecutados sobre los tres archivos de instrucciones y este
  documento; sin problemas.
- **Verificación global:** `pnpm check` ejecutado; falló con código 1 en Prettier por
  `plugins/autana-engram-integration/validation/runtime.mjs`, archivo preexistente fuera del alcance. No se modificó ese
  archivo ni se debilitó la verificación. La casilla acredita ejecución y registro, no un resultado global
  satisfactorio.
- **Comprobaciones separadas:** `pnpm lint:md` aprobado; `pnpm test` aprobado con 58/58 pruebas, cero fallos y cero
  omisiones. Estas ejecuciones completan la información que el fallo temprano de `pnpm check` impidió obtener.
- **Diff y preservación:** `git diff --check` correcto, diff de los tres archivos y `git status --short` revisados. La
  huella conjunta fuera del alcance sigue siendo `1dc05f5c289f911659faf6b24a0e8c9e09fb422016653600f49790d02cf55b9f`; el
  plan de Engram y los demás archivos ajenos permanecen intactos.
- **Revisión independiente:** completada por `review`, sesión `ses_eacc8a4eeffe0R6pc4cCTCX008`, sin modificar archivos.
  No encontró defectos en las reglas ni inconsistencias de autorización, checklist o evidencias; confirmó la cobertura
  semántica A–E y las dos comprobaciones complementarias. No ejecutó pruebas y distinguió la evidencia reportada por el
  principal de su propia inspección. AutanaSoft contrastó el resultado con el diff y las comprobaciones anteriores.
- **Informe final:** cambios, verificaciones, riesgos y pendientes se presentan en esta sección y en el informe de
  entrega al usuario. No se han creado commits ni realizado push.

### Resultado y pendientes

Las reglas aprobadas están implementadas exclusivamente en los tres archivos autorizados; este documento registra el
seguimiento y las evidencias. No surgieron desviaciones materiales ni se modificaron archivos fuera del alcance.

No quedan cambios de implementación pendientes dentro de este plan. Permanece el fallo de formato global preexistente en
`plugins/autana-engram-integration/validation/runtime.mjs`: resolverlo requiere autorización independiente. El éxito de
las 58 pruebas no acredita por sí solo el comportamiento runtime de agentes, que no se ha verificado ni se declara
garantizado. Los riesgos de interpretación y la necesidad de revisar resultados futuros siguen vigentes.

### Contraste semántico de criterios de aceptación

Se revisaron las reglas aplicadas frente a cada escenario, sin ejecutar tareas de agentes que modificaran artefactos de
prueba ni afirmar validación runtime:

| Criterio            | Evidencia en las reglas aplicadas                                                                                   | Resultado de revisión semántica                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A                   | AGENTS impide promover restricciones; Worker preserva responsabilidades y distingue actualización de autoridad.     | Cubierto.                                                         |
| B                   | AGENTS exige interpretar fuente, destinatario, alcance y vigencia, y conservar contexto histórico.                  | Cubierto sin invalidar decisiones antiguas.                       |
| C                   | AutanaSoft inspecciona cambios de autoridad, permisos y duración, y no los acepta como instrucciones aprobadas.     | Cubierto.                                                         |
| D                   | AutanaSoft conserva Hybrid Execution y aclara que escritor único permite delegación y cambios secuenciales.         | Cubierto; sigue exigiendo confirmar el fin del escritor anterior. |
| E                   | Worker devuelve el control para obtener la autorización necesaria; permanecen las reglas de aprobación del usuario. | Cubierto sin atribuir aprobación unilateral a AutanaSoft.         |
| Decisiones antiguas | AGENTS establece que una decisión persistente aprobada no caduca por aparecer en un documento antiguo.              | Cubierto.                                                         |
| Subdelegación       | Worker conserva `Do not create subagents` y la denegación efectiva de subagentes en su frontmatter.                 | Cubierto por el contrato de rol.                                  |

Las responsabilidades de Explore y Review, los idiomas de conversación y delegación, la protección de cambios
preexistentes y los criterios híbridos no se modificaron. Persiste el límite de que las instrucciones no garantizan por
sí solas el comportamiento de todos los modelos y ejecuciones futuras.
