# Wonderful Lists · Desktop

App de escritorio para listas y tareas **100% local, gratuita y sin publicidad**.

Tus datos se guardan en tu ordenador: no hay cuenta, nube, Supabase,
sincronización, anuncios ni módulos de monetización.

**Descargas:** [GitHub Releases](https://github.com/wikialf11/wonderful-lists-desktop/releases/latest)

```
wonderful-lists-desktop/
├── src/main/        Electron: ventana, SQLite, archivos, recordatorios
├── src/preload/     Puente seguro (contextBridge)
├── src/renderer/    React + Vite (la app)
├── build/           Iconos
└── finance/         Análisis histórico (no forma parte de la app)
```

## 1. Requisitos

- Node.js 22 o superior (probado con Node 24).
- macOS 12+ o Windows 10+.
- Ningún servicio externo para usar la app.

## 2. Desarrollo

```bash
npm install
npm run dev
```

La app abre directamente en tus listas. No hay login ni configuración inicial.

## 3. Dónde se guardan los datos

- **macOS:** `~/Library/Application Support/Wonderful Lists/`
- **Windows:** `%APPDATA%\Wonderful Lists\`

Dentro:

- `wonderful-lists.db` → base de datos SQLite con listas, tareas, carpetas y campos.
- `attachments/` → imágenes y archivos adjuntos.
- `backups/` → copia diaria automática de la base de datos (últimas 7).

Actualizar o reinstalar la app **no borra esta carpeta**. En **Ajustes** tienes:

- **Abrir carpeta de datos**.
- **Exportar copia de seguridad** (copia completa a Descargas).

Si usas un limpiador externo que elimine Application Support, usa la exportación
para conservar una copia fuera.

## 4. Funciones

- Listas ilimitadas, colores y descripción.
- Tareas con descripción, fecha/hora, enlace y completables.
- **Segmentar tarea**: checklist de subtareas con barra de progreso de 0 a 100%.
- **Archivos**: varios archivos por tarea, cualquier extensión, guardados en tu equipo.
- **Tabla**: cuadrante editable que se ve directamente en la tarjeta.
- Repeticiones semanales, cada N días, **cada mes** y **cada año**, gestionadas
  en **Repeticiones** (la plantilla no ocupa un item en la lista). Las reglas
  mensuales/anuales ajustan el día al último del mes cuando hace falta: el 31
  cae en 30/28/29 y un cumpleaños del 29 de febrero se celebra el 28 en los
  años no bisiestos.
- Recordatorios con notificación local en la fecha y hora que elijas.
- Carpetas y subcarpetas con arrastrar y soltar.
- Calendario, búsqueda y panel de completadas.
- Campos personalizados: texto, número, fecha, rango, checkbox, contador,
  color, email, teléfono, URL, imagen y archivo.
- Todo funciona sin conexión.

No hay cuentas, invitaciones, miembros, comentarios, valoraciones ni enlaces
para compartir. Es una app de un solo usuario y un solo ordenador.

## 5. Recordatorios

- Elige **Recordatorio** al crear o editar una tarea.
- La app debe estar **abierta** para avisar a la hora exacta. Si estaba cerrada,
  el aviso aparece la próxima vez que la abras.
- Si macOS/Windows bloquea la notificación nativa, verás siempre un aviso
  dentro de la app. En **Ajustes → Probar notificación** puedes comprobarlo.

## 6. Compilar instaladores

```bash
npm run build
npm run package:mac    # .dmg arm64 + x64
npm run package:win    # .exe x64
```

Salen en `release/`.

> No añadas `win` como argumento extra. `npm run package:win` ya compila para
> Windows. `npx electron-builder --win win` da el error `Unsupported arch win`.

### Builds sin firmar

`electron-builder.yml` tiene `identity: null` y no hay certificado de Windows:

- **macOS:** clic derecho → Abrir la primera vez, o
  `xattr -dr com.apple.quarantine "/Applications/Wonderful Lists.app"`.
- **Windows:** SmartScreen → Más información → Ejecutar de todas formas.

Para distribución masiva conviene firmar (Apple Developer 99 $/año; certificado
Windows).

## 7. Privacidad

- No hay telemetría, analítica externa ni cookies.
- No hay publicidad ni SDK de monetización.
- La base de datos y los adjuntos nunca salen del equipo.

`#/privacy` y `#/terms` lo explican en detalle.

## 8. Limitaciones conocidas

- **Sin sincronización entre dispositivos.** Es una app local.
- **Sin copia en la nube.** Usa la exportación de Ajustes.
- **Auto-actualización** no incluida todavía.

## 9. Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Desarrollo con HMR |
| `npm run build` | Compila main, preload y renderer |
| `npm run typecheck` | TypeScript estricto |
| `npm run package:mac` | DMG arm64 + x64 |
| `npm run package:win` | Instalador NSIS x64 |

## 10. Licencia

Copyright (C) 2026 wikialf11.

Este proyecto se publica bajo la **GNU Affero General Public License v3.0
(AGPL-3.0-only)**. El texto completo está en [`LICENSE`](LICENSE).

La licencia cubre el código. El nombre “Wonderful Lists” y el icono no se ceden
como marca: si publicas una versión modificada, no la presentes como la oficial.

El código fuente está en:
<https://github.com/wikialf11/wonderful-lists-desktop>
