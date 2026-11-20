import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout title="Términos de uso" updated="19 de noviembre de 2026">
      <LegalSection title="1. El servicio">
        <p>
          Wonderful Lists Desktop es una aplicación gratuita para organizar listas y tareas en tu
          ordenador. No hay cuentas, anuncios, planes de pago, funciones bloqueadas ni módulos de
          monetización. Al usarla aceptas estos términos.
        </p>
      </LegalSection>

      <LegalSection title="2. Tus datos">
        <p>
          Todos los datos se guardan en tu equipo. No tenemos acceso a ellos y no podemos
          recuperarlos si se pierden. Tú eres responsable de las copias de seguridad.
        </p>
      </LegalSection>

      <LegalSection title="3. Uso aceptable">
        <p>No está permitido:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Usar la app para actividades ilegales o para dañar a terceros.</li>
          <li>Redistribuir una versión modificada que se presente como oficial.</li>
          <li>Intentar eludir las protecciones técnicas de la app.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Disponibilidad y garantías">
        <p>
          La app se ofrece «tal cual» y «según disponibilidad». Hacemos lo posible por mantenerla,
          pero no garantizamos que esté libre de errores. No es un sistema de copias de seguridad:
          no la uses como único lugar para información crítica.
        </p>
      </LegalSection>

      <LegalSection title="5. Limitación de responsabilidad">
        <p>
          En la medida permitida por la ley, no respondemos de daños indirectos, pérdida de datos o
          lucro cesante derivados del uso de la app. Nada en estos términos limita los derechos que
          la ley reconoce a los consumidores.
        </p>
      </LegalSection>

      <LegalSection title="6. Cambios">
        <p>
          Podemos actualizar estos términos para reflejar cambios legales o técnicos. Si el cambio
          es relevante, lo mostraremos en la app antes de que surta efecto.
        </p>
      </LegalSection>

      <LegalSection title="7. Ley aplicable">
        <p>
          Estos términos se rigen por la legislación española. Para consumidores, cualquier
          controversia se someterá a los juzgados de su domicilio.
        </p>
      </LegalSection>

      <LegalSection title="8. Contacto">
        <p>
          Dudas sobre estos términos: <strong>hola@wonderfullists.life</strong>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
