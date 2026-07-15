export default function Insights() {
  return (
    <div className="insights">
      <div className="insight">
        <h3>⚠️ Riesgo Alto domina</h3>
        <p>
          El <b>52% de los puntos críticos</b> (8.147) tienen nivel de riesgo Alto o Muy Alto.
          Las regiones Metropolitana, Valparaíso y Biobío concentran la mayor cantidad,
          lo que exige priorización de recursos en esas zonas.
        </p>
      </div>
      <div className="insight">
        <h3>🏗️ Infraestructura es la clave</h3>
        <p>
          El <b>42% de los puntos</b> con solución definida requieren obras de infraestructura
          (defensas fluviales, colectores, muros de contención). La mantención preventiva
          cubre otro 35%, siendo la segunda categoría más relevante.
        </p>
      </div>
      <div className="insight">
        <h3>🌊 Causas predominantes</h3>
        <p>
          Las <b>inundaciones por anegamiento</b>, el <b>desborde de causes</b> y los
          <b> flujos de barro/detritos</b> representan más del 70% de las causas reportadas.
          La subsidencia y erosión de suelos completan el panorama crítico.
        </p>
      </div>
    </div>
  );
}
