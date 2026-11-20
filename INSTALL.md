# Instalación

Los instaladores están en
[GitHub Releases](https://github.com/wikialf11/wonderful-lists-desktop/releases/latest).

## macOS

- `Wonderful-Lists-0.7.0-arm64.dmg` → Apple Silicon (M1/M2/M3/M4)
- `Wonderful-Lists-0.7.0-x64.dmg` → Intel

1. Abre el `.dmg` y arrastra **Wonderful Lists** a Aplicaciones.
2. La build no está firmada. La primera vez:
   - clic derecho sobre la app → **Abrir** → **Abrir**, o
   - Terminal:
     ```bash
     xattr -dr com.apple.quarantine "/Applications/Wonderful Lists.app"
     ```
3. Si macOS pide permisos de notificaciones, acéptalos para los recordatorios.

## Windows

- `Wonderful-Lists-Setup-0.7.0-x64.exe`

1. Ejecuta el instalador.
2. SmartScreen mostrará “Editor desconocido”: **Más información** →
   **Ejecutar de todas formas**.
3. La build no está firmada.

## Datos

Se guardan solo en tu equipo:

- **macOS:** `~/Library/Application Support/Wonderful Lists/`
- **Windows:** `%APPDATA%\Wonderful Lists\`

Dentro: `wonderful-lists.db`, `attachments/` y `backups/`.

Actualizar o reinstalar no borra esa carpeta. En **Ajustes** puedes abrirla o
exportar una copia completa.

## Primer uso

No hay cuenta ni configuración: la app abre directamente en tus listas.
