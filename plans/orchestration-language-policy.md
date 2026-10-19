# Plan: política de idioma de la orquestación

## Estado y autorización

- Fecha: 2026-10-19.
- Autorización inicial: crear y validar únicamente este documento.
- Autorización posterior: el usuario aprobó explícitamente este plan y solicitó implementarlo, verificarlo y mantener
  actualizadas sus evidencias y pendientes.
- Estado: implementación completada y verificada estáticamente; comprobación conductual en sesiones reales no realizada.
- Las redacciones aprobadas se aplicaron a los archivos fuente; este documento registra la propuesta y su ejecución, no
  sustituye las instrucciones distribuidas.
- La implementación de instrucciones se limita a `src/AGENTS.md` y `src/agents/AutanaSoft.md`, junto con la
  actualización autorizada de este plan.
- No incluye instalación, cambios en la configuración global, commits ni publicación.

## Objetivo

Separar tres ámbitos sin alterar sus responsabilidades:

| Ámbito                             | Idioma predeterminado                                  | Excepciones aplicables                                                            |
| ---------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Comunicación con el usuario        | Idioma actual de la conversación                       | Solicitud explícita del usuario; citas y traducciones según la regla existente    |
| Comunicación interna entre agentes | Inglés, tanto instrucciones como respuestas e informes | Solicitud explícita del usuario sobre esa comunicación interna                    |
| Artefactos técnicos                | Inglés                                                 | Solicitud explícita sobre el artefacto; en su ausencia, convenciones del proyecto |

El idioma de un ámbito no determina el de los otros. Un informe devuelto al orquestador es comunicación interna; un
documento técnico producido como entregable es un artefacto, aunque también sea un informe. Un agente puede crear un
documento en español y devolver su resumen de ejecución en inglés. El orquestador comunica después al usuario el
resultado en el idioma correspondiente, preservando la evidencia relevante.

## Diagnóstico

Referencias a la versión inspeccionada; las secciones y textos identifican los cambios aunque varíen las líneas.

1. `src/AGENTS.md:45-57`, sección `Communication`: la frase `Respond in the user's current language` no identifica al
   destinatario. Como las reglas generales se aplican a todos los agentes (`src/AGENTS.md:5`), permite interpretar que
   un subagente también debe responder en el idioma del usuario al orquestador. Es una ambigüedad textual verificada; no
   se ha ejecutado una reproducción conductual en esta tarea.
2. `src/AGENTS.md:59-67`, sección `Conversation and Artifact Language`: separa correctamente conversación y artefactos,
   pero no contempla expresamente la comunicación interna. Sus reglas de artefactos, excepciones y registro profesional
   ya satisfacen el objetivo y deben conservarse.
3. `src/agents/AutanaSoft.md:121`: el inglés predeterminado se exige únicamente para las instrucciones enviadas a los
   subagentes; no cubre sus respuestas ni informes.
4. `src/agents/AutanaSoft.md:126-128`: agrupa `artifacts and results` y aplica sin delimitar
   `Explicit user requests and project conventions`. Esto deja abierta la confusión entre idioma del entregable e idioma
   del informe interno, o la extensión de una convención documental a toda la comunicación entre agentes.
5. El registro actual ya es conciso, directo, profesional, técnico y neutral. `src/AGENTS.md:48-56` exige conservar
   evidencia, riesgos, decisiones e impedimentos y distinguir hechos de inferencias. `src/agents/AutanaSoft.md:122-125`
   añade precisión y preservación de requisitos, identificadores y términos exactos. No hace falta reescribir esas
   reglas ni añadir límites de longitud o formatos obligatorios.

### Otros archivos considerados

| Archivos                              | Resultado                                                                                     | Acción propuesta                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `src/agents/explore.md`               | Exige síntesis, evidencia y formato solicitado; no prescribe idioma (`19-27`, `43-45`)        | Sin cambios: aplica la regla general       |
| `src/agents/review.md`                | Define revisión y resultados, sin idioma específico                                           | Sin cambios                                |
| `src/agents/worker.md`                | Define ejecución, documentación y reporte de verificaciones, sin idioma específico            | Sin cambios                                |
| Los seis archivos de `src/templates/` | Definen contratos y resultados, sin un idioma obligatorio                                     | Sin cambios; no añadir campos obligatorios |
| `src/instructions/engram.md:152-168`  | Reconoce disparadores en cualquier idioma del usuario; no fija el idioma de informes internos | Sin cambios                                |
| `README.md` y `AGENTS.md` de la raíz  | Distinguen configuración distribuida y reglas de desarrollo del repositorio                   | Sin cambios                                |

La inspección de los archivos distribuibles no encontró una regla adicional que exija ampliar la implementación. No
corresponde modificar planes históricos, plugins, herramientas ni reglas globales instaladas para resolver esta
ambigüedad. Tampoco es necesario cambiar permisos, modelos o mecanismos de OpenCode V2: la propuesta trata únicamente la
redacción de instrucciones locales.

## Enfoque recomendado

Centralizar los tres ámbitos en `src/AGENTS.md` y hacer que la sección de idioma de AutanaSoft aplique esa política sin
repetirla. Así también quedan cubiertos los subagentes sin duplicar reglas en cada archivo.

La alternativa de repetir la política en cada agente o plantilla aumenta el mantenimiento y el riesgo de divergencia sin
resolver una necesidad adicional. No se recomienda. Tampoco se propone imponer inglés sin excepciones: el objetivo es un
valor predeterminado, no una prohibición de solicitudes explícitas para otro idioma.

## Modificaciones exactas propuestas

Los bloques en inglés conservan la propuesta aprobada, ya aplicada a los archivos fuente con el ajuste de líneas de
Prettier. Todo texto no identificado como reemplazo o adición permanece intacto.

### 1. `src/AGENTS.md`: delimitar la respuesta al usuario

En `Communication`, sustituir únicamente el primer punto:

```text
- Respond in the user's current language unless explicitly requested otherwise or quotation and translation require it.
```

Por:

```text
- For user-facing communication, respond in the user's current language unless explicitly requested otherwise or
  quotation and translation require it.
```

Conservar todos los demás puntos de `Communication`, incluidas las reglas de concisión, evidencia y preguntas.

### 2. `src/AGENTS.md`: separar los tres ámbitos y cubrir el intercambio interno

Renombrar `Conversation and Artifact Language` como:

```text
## Conversation, Inter-Agent, and Artifact Language
```

Sustituir su primer punto:

```text
- The conversation language is independent of the language used for technical artifacts.
```

Por estos dos puntos:

```text
- User-facing conversation, internal inter-agent communication, and technical artifacts have independent language
  rules.
- Use English by default for all internal inter-agent communication, including instructions, responses, and reports,
  unless the user explicitly requests another language for that communication. Do not infer an exception from the
  user's conversation language or a technical artifact's language.
```

Conservar sin cambios los cuatro puntos restantes: inglés para artefactos, prioridad de la solicitud explícita y
convenciones del repositorio, registro neutral y profesional, y comentarios públicos o contextuales.

### 3. `src/agents/AutanaSoft.md`: aplicar la política compartida sin mezclar resultados y artefactos

Reemplazar únicamente el contenido de `Delegation Language`. El encabezado permanece igual. Este es el bloque completo
propuesto:

```text
## Delegation Language

- Apply the shared inter-agent language rules in `AGENTS.md` to delegated instructions and returned responses and
  reports.
- Use a technical, neutral, precise register without unnecessarily reproducing the primary agent's conversational
  personality.
- Preserve the meaning of the user's requirements and constraints, and retain any supplied names, paths, identifiers,
  and exact terms unchanged.
- Explicitly state the expected artifact language when relevant, following the artifact-language rules in `AGENTS.md`;
  neither the conversation language nor the delegated prompt's language determines the artifact's language.
- Keep user-facing responses in the conversation language, in accordance with `AGENTS.md`.
```

Este reemplazo:

- Sustituye el valor predeterminado limitado a instrucciones por una referencia al intercambio interno completo.
- Conserva literalmente las reglas de registro técnico y preservación de requisitos y términos.
- Sustituye `artifacts and results` por una regla específica de artefactos, sin exigir declarar el idioma de cada
  informe cuando ya aplica el valor predeterminado compartido.
- Elimina la excepción genérica `Explicit user requests and project conventions take precedence over these defaults`.
  Las excepciones siguen disponibles, delimitadas en `AGENTS.md` por ámbito; las convenciones documentales no se
  convierten en excepciones implícitas para la comunicación interna.
- Conserva la referencia existente al idioma de comunicación con el usuario.

No cambiar otras secciones, frontmatter, responsabilidades, planificación, delegación operativa, autorizaciones,
concurrencia ni verificación.

## Criterios de aceptación

- [x] La regla de idioma del usuario se aplica expresamente a comunicación dirigida al usuario.
- [x] La regla general cubre instrucciones, respuestas e informes entre agentes, en inglés por defecto.
- [x] Conversar en español no justifica pedir un informe interno en español.
- [x] Una solicitud explícita sobre comunicación interna puede cambiar su idioma sin cambiar el de los artefactos.
- [x] Solicitar un artefacto en español no cambia el idioma del resumen interno de ejecución.
- [x] Las convenciones del proyecto siguen aplicándose a los artefactos, sin trasladarse implícitamente al intercambio
      interno.
- [x] Se conservan concisión, precisión, neutralidad, profesionalidad, evidencia, riesgos, decisiones e impedimentos.
- [x] No se añaden reglas redundantes en agentes o plantillas, ni nuevos formatos, permisos o requisitos de aprobación.
- [x] La implementación afecta exclusivamente las secciones identificadas de los dos archivos propuestos.

### Casos para revisar después de implementar

| Caso                                                                           | Comunicación interna esperada                                                                | Artefacto esperado                                       | Respuesta al usuario                   |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| Usuario conversa en español, sin excepciones                                   | Inglés en instrucciones e informes                                                           | Inglés si se produce uno y no existe convención distinta | Español                                |
| Usuario conversa en español y pide un plan en español                          | Inglés                                                                                       | Plan en español                                          | Español                                |
| Proyecto con documentación en español, sin petición sobre comunicación interna | Inglés                                                                                       | Documentación en español según convención                | Idioma de la conversación              |
| Usuario pide explícitamente informes internos en español                       | Informes internos en español; instrucciones en inglés salvo petición que también las abarque | Sigue su propia regla                                    | Idioma de la conversación              |
| Usuario conversa en español y solicita respuesta en inglés                     | Inglés por defecto                                                                           | Sigue su propia regla                                    | Inglés                                 |
| Informe interno cita un término o evidencia en español                         | Inglés, preservando la cita o término exacto                                                 | Sigue su propia regla                                    | Idioma solicitado o de la conversación |

Los criterios anteriores se comprobaron por revisión estática, incluida una revisión independiente de los seis casos. No
constituyen pruebas conductuales en sesiones reales ni un nuevo protocolo operativo.

## Checklist de implementación

- [x] Obtener aprobación explícita de esta propuesta antes de modificar las instrucciones.
- [x] Revisar el estado de trabajo y preservar todos los cambios ajenos.
- [x] Aplicar los reemplazos exactos de los apartados 1 y 2 en `src/AGENTS.md`.
- [x] Aplicar el reemplazo exacto del apartado 3 en `src/agents/AutanaSoft.md`.
- [x] Revisar el diff: solo las secciones autorizadas, sin cambios a las demás reglas.
- [x] Comprobar los criterios y casos anteriores por revisión semántica de las instrucciones resultantes.
- [x] Ejecutar Prettier solo sobre los archivos autorizados; después, Markdownlint.
- [x] Ejecutar `pnpm check` y distinguir fallos de la propuesta de fallos ajenos.
- [x] Informar archivos modificados, resultados reales, límites y cualquier verificación pendiente en este documento.

## Verificaciones previstas

### Documento de planificación: validación inicial

1. Formatear únicamente este documento: `pnpm exec prettier --write plans/orchestration-language-policy.md`.
2. Verificarlo con `pnpm exec prettier --check plans/orchestration-language-policy.md` y después
   `pnpm exec markdownlint-cli2 plans/orchestration-language-policy.md`.
3. Revisar redacciones, referencias, independencia de ámbitos y límites de autorización.
4. Ejecutar `pnpm check`, según la guía del repositorio, sin corregir archivos ajenos si falla.
5. Comprobar el estado final con Git: ningún archivo preexistente modificado por este encargo.

### Implementación: verificaciones aprobadas

```bash
pnpm exec prettier --write src/AGENTS.md src/agents/AutanaSoft.md
pnpm exec prettier --check src/AGENTS.md src/agents/AutanaSoft.md
pnpm exec markdownlint-cli2 src/AGENTS.md src/agents/AutanaSoft.md
git diff --check
git diff -- src/AGENTS.md src/agents/AutanaSoft.md
pnpm check
```

`package.json` define actualmente `pnpm check` como formato, Markdownlint y pruebas de Node.js. La guía raíz afirma que
todavía no existen scripts de pruebas; para seleccionar verificaciones se ha comprobado el manifiesto actual. No se
propone corregir esa discrepancia en este encargo.

La validación estática y las pruebas existentes no demuestran por sí solas el comportamiento de modelos en sesiones
reales. No se prevé instalar la configuración ni iniciar sesiones de prueba que cambien el entorno; cualquier validación
conductual adicional debe acordarse por separado.

## Evidencia de validación del documento

- Prettier aplicado únicamente a este documento; su comprobación posterior pasó.
- Markdownlint del documento pasó sin incidencias.
- Revisión semántica independiente del plan contra los dos archivos fuente: sin hallazgos sustantivos. Revisión
  estática, sin afirmar cumplimiento conductual de modelos.
- `pnpm check` falló en la fase de Prettier por `plans/engram-sidebar-plugin-v2.md`, archivo con cambios preexistentes
  ajenos a este encargo. No se corrigió. La cadena no llegó al Markdownlint global ni a las pruebas de Node.js.
- El estado inicial también incluía cambios ajenos en `plugins/autana-engram-integration/README.md` y archivos nuevos
  bajo `plugins/autana-engram-integration/test/` y `plugins/autana-engram-integration/validation/`. No forman parte de
  esta propuesta ni se modificaron durante su elaboración.
- Esta evidencia corresponde a la elaboración inicial del plan. La autorización posterior y los resultados de
  implementación se registran a continuación; el fallo global inicial no representa el resultado de la ejecución
  posterior.

## Evidencia de implementación

- Se aplicaron los reemplazos aprobados en `src/AGENTS.md` y `src/agents/AutanaSoft.md`, sin cambios semánticos
  adicionales. Prettier únicamente ajustó el salto de líneas del texto propuesto en `src/AGENTS.md`.
- El orquestador inspeccionó el diff de ambos archivos: solo cambian `Communication`, la sección de idioma compartida y
  `Delegation Language`. No cambian permisos, frontmatter ni las reglas de planificación, delegación operativa,
  autorización, concurrencia o verificación.
- Revisión independiente de las redacciones y los seis casos: sin hallazgos. El revisor no dispuso de Git, por lo que la
  comprobación del diff y de su alcance corresponde al orquestador. No se ejecutaron pruebas conductuales.
- Prettier aplicado únicamente a los archivos autorizados; comprobación de formato y Markdownlint específicos sin
  errores.
- `git diff --check`: sin errores.
- `pnpm check`: satisfactorio en esta ejecución, incluidos Prettier global, Markdownlint global y las pruebas de
  Node.js: **61 pruebas aprobadas, 0 fallidas, 0 omitidas**. No fue necesario corregir archivos ajenos.
- No se instaló la configuración, no se modificó la configuración global y no se crearon commits ni se publicó
  contenido.

### Pendientes y límites

- Sin pendientes de implementación dentro del alcance aprobado.
- No se ha comprobado el comportamiento de modelos en sesiones reales; la revisión semántica y las pruebas existentes no
  garantizan cumplimiento conductual. Cualquier validación adicional de ese tipo debe acordarse por separado.
- La configuración distribuible queda actualizada en el repositorio, no desplegada en el entorno global del usuario.
