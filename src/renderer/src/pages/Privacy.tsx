import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Privacidad" updated="19 de noviembre de 2026">
      <LegalSection title="1. Resumen">
        <p>
          Wonderful Lists Desktop es una aplicación <strong>100% local</strong>. Tus listas,
          tareas y archivos se guardan únicamente en este ordenador. No hay cuenta, no hay
          servidores propios, no se envía tu contenido a ninguna nube y la app no incluye
          publicidad, rastreadores, analítica externa ni módulos de monetización.
        </p>
      </LegalSection>

      <LegalSection title="2. Dónde están tus datos">
        <p>Todo se guarda en la carpeta de datos de la aplicación:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>macOS:</strong> <code>~/Library/Application Support/Wonderful Lists/</code>
          </li>
          <li>
            <strong>Windows:</strong> <code>%APPDATA%\Wonderful Lists\</code>
          </li>
        </ul>
        <p>
          Dentro encontrarás <code>wonderful-lists.db</code> (la base de datos SQLite), la carpeta{" "}
          <code>attachments/</code> (imágenes y archivos que adjuntes) y <code>backups/</code>{" "}
          (copias automáticas de la base de datos). Si borras esa carpeta, borras todos tus datos.
        </p>
      </LegalSection>

      <LegalSection title="3. Qué datos se tratan">
        <ul className="list-disc pl-5 space-y-1">
          <li>El contenido que creas: listas, tareas, fechas, notas, campos personalizados y archivos.</li>
          <li>Preferencias locales: colores, última lista abierta y estado de la ventana.</li>
          <li>Nada más. No hay email, contraseña, identificador de cuenta ni telemetría.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Copias de seguridad">
        <p>
          No hay copia en la nube. La app guarda una copia diaria de la base de datos en{" "}
          <code>backups/</code> (últimas 7) y puedes exportar una copia completa desde{" "}
          <strong>Ajustes → Exportar copia de seguridad</strong>. Si el disco falla, se pierde la
          información; tú eres responsable de guardar esa copia en un disco externo o servicio de
          copias.
        </p>
      </LegalSection>

      <LegalSection title="5. Tus derechos">
        <p>
          Como los datos no salen de tu ordenador, puedes acceder, modificar o eliminar todo
          directamente desde la app o borrando la carpeta de datos. Para cualquier duda escribe a{" "}
          <strong>privacidad@wonderfullists.life</strong>.
        </p>
      </LegalSection>

      <LegalSection title="6. Menores">
        <p>La app no está dirigida a menores de 16 años.</p>
      </LegalSection>

      <LegalSection title="7. Cookies">
        <p>
          No usamos cookies. Solo almacenamiento local del equipo para preferencias y la propia
          base de datos de la app.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
