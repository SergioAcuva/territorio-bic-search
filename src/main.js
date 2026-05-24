import './styles.css';

const form = document.querySelector('#searchForm');
const input = document.querySelector('#lotCodigo');
const statusEl = document.querySelector('#status');
const resultEl = document.querySelector('#result');

const SUMMARY_SECTIONS = [
  {
    title: 'Identificación del lote seleccionado',
    fields: [
      ['Dirección principal', 'summary.lote.direccion', 'wide'],
      ['Código de lote', 'summary.lote.lotCodigo'],
      ['Nivel de intervención', 'summary.lote.nivelIntervencion']
    ]
  },
  {
    title: 'Unidad predial seleccionada',
    fields: [
      ['CHIP', 'summary.predio.chip', 'chip'],
      ['Dirección catastral', 'summary.predio.direccion', 'wide'],
      ['Número predial', 'summary.predio.numeroPredial'],
      ['Barrio', 'summary.predio.barrio'],
      ['Área terreno', 'summary.predio.areaTerreno'],
      ['Área construida', 'summary.predio.areaConstruida'],
      ['Tipo de propiedad', 'summary.predio.tipoPropiedad'],
      ['Destino', 'summary.predio.destino'],
      ['Clase / vetustez', 'summary.predio.claseVetustez']
    ]
  },
  {
    title: 'Localización territorial',
    fields: [
      ['Localidad', 'summary.territorio.localidad'],
      ['Unidad de Planeamiento Local', 'summary.territorio.upl'],
      ['Sector catastral', 'summary.territorio.sectorCatastral']
    ]
  },
  {
    title: 'Declaratoria y datos patrimoniales',
    fields: [
      ['Nombre BIC', 'summary.declaratoria.nombre', 'wide'],
      ['Número FIC', 'summary.declaratoria.numeroFicha'],
      ['Ámbito declaratorio', 'summary.declaratoria.ambito'],
      ['Categoría', 'summary.declaratoria.categoria'],
      ['Estado de conservación', 'summary.declaratoria.estadoConservacion'],
      ['Nivel anterior', 'summary.declaratoria.nivelAnterior']
    ]
  },
  {
    title: 'Acto administrativo y norma urbana',
    fields: [
      ['Acto administrativo', 'summary.acto.denominacion'],
      ['Número', 'summary.acto.numero'],
      ['Fecha', 'summary.acto.fecha'],
      ['Vigencia', 'summary.acto.vigencia'],
      ['PEMP', 'summary.norma.pemp'],
      ['Sector normativo', 'summary.norma.sector'],
      ['Tratamiento', 'summary.norma.tratamiento'],
      ['Área de actividad', 'summary.norma.areaActividad']
    ]
  }
];

const FLAGS = [
  ['Bien de Interés Cultural', 'summary.flags.esBic'],
  ['Área de protección del entorno patrimonial', 'summary.flags.esApep'],
  ['Sector de interés urbanístico', 'summary.flags.esSectorInteresUrbanistico'],
  ['Zona BIC nacional', 'summary.flags.esZonaBicNacional'],
  ['Colindante', 'summary.flags.esColindante'],
  ['PEMP / unidad de paisaje', 'summary.flags.esPempUnidadPaisaje']
];

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const lotCodigo = input.value.trim();
  if (!lotCodigo) return;

  setStatus('Consultando lote...', false);
  resultEl.hidden = true;
  resultEl.innerHTML = '';

  try {
    const response = await fetch(`/api/lote?lotCodigo=${encodeURIComponent(lotCodigo)}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'No se pudo consultar el lote.');
    }

    renderResult(data);
    setStatus(`Lote ${data.lotCodigo} encontrado.`, false);
  } catch (error) {
    setStatus(error.message, true);
  }
});

function renderResult(data) {
  resultEl.innerHTML = `
    <article class="summary">
      <header class="summary-header">
        <h2>Información del inmueble</h2>
        <button class="copy-button" type="button" data-copy-json>Copiar JSON</button>
      </header>
      <div class="summary-body">
        ${SUMMARY_SECTIONS.map((section) => renderSection(section, data)).join('')}
        ${renderFlags(data)}
        ${renderTechnicalTables(data)}
        ${renderRawJson(data.document)}
      </div>
    </article>
  `;

  resultEl.hidden = false;
  resultEl.querySelector('[data-copy-json]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify(data.document, null, 2));
    setStatus('JSON copiado al portapapeles.', false);
  });
}

function renderSection(section, data) {
  return `
    <section class="section">
      <h3 class="section-title">${escapeHtml(section.title)}</h3>
      <div class="grid">
        ${section.fields.map(([label, path, mode]) => renderField(label, valueAt(data, path), mode)).join('')}
      </div>
    </section>
  `;
}

function renderField(label, value, mode) {
  const text = noAplica(value);
  const className = ['field', mode === 'wide' ? 'wide' : '', isLong(text) ? 'full' : ''].filter(Boolean).join(' ');

  if (mode === 'chip') {
    return `
      <div class="${className}">
        <small>${escapeHtml(label)}</small>
        <span class="chip">${escapeHtml(text)}</span>
      </div>
    `;
  }

  if (isUrl(text)) {
    return `
      <div class="${className}">
        <small>${escapeHtml(label)}</small>
        <a class="value" href="${escapeAttribute(text)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>
      </div>
    `;
  }

  return `
    <div class="${className}">
      <small>${escapeHtml(label)}</small>
      ${isLong(text) ? `<pre class="long-value">${escapeHtml(text)}</pre>` : `<strong>${escapeHtml(text)}</strong>`}
    </div>
  `;
}

function renderFlags(data) {
  const siu = noAplica(valueAt(data, 'summary.meta.sectorInteresUrbanisticoNombre'));
  const siuTipo = noAplica(valueAt(data, 'summary.meta.sectorInteresUrbanisticoTipo'));

  return `
    <section class="section">
      <h3 class="section-title">Condiciones patrimoniales identificadas</h3>
      <div class="grid">
        <div class="flags">
          ${FLAGS.map(([label, path]) => `
            <div class="flag">
              <span>${escapeHtml(label)}</span>
              <strong>${valueAt(data, path) ? 'Sí' : 'No'}</strong>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="meta">
        <div class="grid">
          ${renderField('Sector de interés urbanístico asociado', `${siu}${siuTipo !== '----' ? ` (${siuTipo})` : ''}`, 'wide')}
          ${renderField('Multimedia asociado', valueAt(data, 'summary.meta.multimediaCount'))}
          ${renderField('Relaciones de colindancia', valueAt(data, 'summary.meta.colindanciaCount'))}
        </div>
      </div>
    </section>
  `;
}

function renderTechnicalTables(data) {
  const groups = data.technicalTables || [];
  if (!groups.length) return '';

  return `
    <section class="section">
      <h3 class="section-title">Información ampliada del inmueble</h3>
      ${groups.map((group, index) => `
        <details class="data-group" ${index === 0 ? 'open' : ''}>
          <summary>
            <span>
              ${escapeHtml(group.title)}
              <span class="data-group-name">${escapeHtml(group.name)}</span>
            </span>
            <span class="badge">${group.rows.length}</span>
          </summary>
          <div class="records">
            ${group.rows.length ? group.rows.map((row, rowIndex) => renderRecord(group.columns, row, rowIndex)).join('') : '<p class="empty">No hay registros para el lote seleccionado.</p>'}
          </div>
        </details>
      `).join('')}
    </section>
  `;
}

function renderRecord(columns, row, rowIndex) {
  const id = noAplica(row.Id || row._id || row.id);
  return `
    <div class="record">
      <div class="record-title">
        <span>Registro ${rowIndex + 1}</span>
        ${id !== '----' ? `<span class="badge">Id: ${escapeHtml(id)}</span>` : ''}
      </div>
      <div class="grid">
        ${columns.map((column) => renderField(column, stringifyValue(row[column]))).join('')}
      </div>
    </div>
  `;
}

function renderRawJson(document) {
  return `
    <section class="section">
      <h3 class="section-title">Documento MongoDB completo</h3>
      <pre class="long-value raw-json">${escapeHtml(JSON.stringify(document, null, 2))}</pre>
    </section>
  `;
}

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function valueAt(object, path) {
  return path.split('.').reduce((current, key) => current?.[key], object);
}

function noAplica(value) {
  if (value === null || value === undefined) return '----';
  const text = stringifyValue(value).trim();
  return !text || text.toLowerCase() === 'no aplica' ? '----' : text;
}

function stringifyValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function isLong(value) {
  const text = String(value || '');
  return text.length > 160 || text.trimStart().startsWith('{') || text.trimStart().startsWith('[');
}

function isUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
