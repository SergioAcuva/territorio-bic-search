import { MongoClient } from 'mongodb';

let clientPromise;

const TABLES = [
  ['lote', 'Lote BIC consolidado', ['_id', 'lotcodigo', 'properties']],
  ['predios', 'Predios del lote', ['predios']],
  ['divisionTerritorial', 'División territorial', ['divisionTerritorial']],
  ['declaratoria', 'Declaratoria patrimonial', ['declaratoria', 'inmuebleBic', 'grupoArquitectonico']],
  ['actosAdministrativos', 'Actos administrativos', ['actosAdministrativos', 'actoAdministrativo']],
  ['proteccion', 'Condiciones de protección', ['proteccion', 'flags']],
  ['zonaInfluenciaBicNacional', 'Zona de influencia BIC nacional', ['zonaInfluenciaBicNacional']],
  ['normaPemp', 'Norma PEMP', ['normaPemp']],
  ['sectorInteresUrbanistico', 'Sector de interés urbanístico', ['sectorInteresUrbanistico']],
  ['contextoPatrimonial', 'Contexto patrimonial', ['contextoPatrimonial']],
  ['contextoArqueologico', 'Contexto arqueológico', ['contextoArqueologico']],
  ['multimedia', 'Multimedia', ['multimedia']],
  ['colindancias', 'Colindancias', ['colindancias', 'colindancia']]
];

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, message: 'Método no permitido.' });
  }

  const lotCodigo = cleanText(request.query.lotCodigo);
  if (!lotCodigo) {
    return response.status(400).json({ success: false, message: 'Ingrese un código de lote para buscar.' });
  }

  if (!process.env.MONGODB_URI) {
    return response.status(500).json({ success: false, message: 'Falta configurar MONGODB_URI en el backend.' });
  }

  try {
    const db = await getDatabase();
    const collectionName = process.env.MONGODB_COLLECTION || 'lotesBic';
    const collection = db.collection(collectionName);
    const doc = await collection.findOne(buildLotFilter(lotCodigo));

    if (!doc) {
      return response.status(404).json({
        success: false,
        message: 'No se encontró un lote para el código ingresado.'
      });
    }

    const document = normalizeMongoValue(doc);
    const selectedPredio = selectPredio(document, request.query.chip);

    return response.status(200).json({
      success: true,
      lotCodigo: getLotCodigo(document) || lotCodigo,
      summary: buildSummary(document, selectedPredio),
      technicalTables: buildTechnicalTables(document),
      document
    });
  } catch (error) {
    console.error('Error consultando MongoDB', error);
    return response.status(500).json({
      success: false,
      message: 'No se pudo consultar la base de datos territorial.'
    });
  }
}

async function getDatabase() {
  if (!clientPromise) {
    clientPromise = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000
    }).connect();
  }

  const client = await clientPromise;
  const dbName = process.env.MONGODB_DB || databaseNameFromUri(process.env.MONGODB_URI) || 'idpcTerritorioBic';
  return client.db(dbName);
}

function databaseNameFromUri(uri) {
  try {
    return new URL(uri).pathname.replace(/^\/+/, '') || null;
  } catch {
    return null;
  }
}

function buildLotFilter(lotCodigo) {
  const trimmed = lotCodigo.trim();
  const upper = trimmed.toUpperCase();
  const exact = new RegExp(`^${escapeRegex(trimmed)}$`, 'i');

  return {
    $or: [
      { lotcodigo: trimmed },
      { lotcodigo: upper },
      { lotcodigo: exact },
      { 'properties.lotcodigo': trimmed },
      { 'properties.lotcodigo': upper },
      { 'properties.lotcodigo': exact },
      { 'properties.LOTCODIGO': trimmed },
      { 'properties.LOTCODIGO': upper },
      { 'properties.LOTCODIGO': exact }
    ]
  };
}

function buildSummary(doc, selectedPredio) {
  const props = asObject(doc.properties);
  const division = asObject(doc.divisionTerritorial);
  const declaratoria = firstObject(doc.declaratoria, doc.inmuebleBic, doc.grupoArquitectonico);
  const declaratoriaProps = firstObject(declaratoria?.properties, declaratoria);
  const acto = firstObject(doc.actosAdministrativos, doc.actoAdministrativo, declaratoriaProps);
  const norma = firstObject(doc.normaPemp);
  const proteccion = firstObject(doc.proteccion);
  const flags = asObject(doc.flags);
  const siu = firstObject(doc.sectorInteresUrbanistico);

  return {
    lote: {
      direccion: firstValue(props, ['direccion', 'DIRECCION'], doc, ['direccion', 'Direccion']),
      lotCodigo: getLotCodigo(doc),
      nivelIntervencion: firstValue(props, ['nivelintervencion_nombre', 'nivelintervencion', 'NIVELINTERVENCION'], declaratoriaProps, ['NIVELINTERVENCION', 'nivelintervencion'])
    },
    predio: {
      chip: firstValue(selectedPredio, ['prechip', 'PRECHIP', 'chip', 'CHIP']),
      direccion: firstValue(selectedPredio, ['predirecc', 'PREDIRECC', 'predsi', 'PREDSI']),
      numeroPredial: firstValue(selectedPredio, ['prenupre', 'PRENUPRE', 'numeroPredial']),
      barrio: firstValue(selectedPredio, ['prenbarrio', 'precbarrio', 'PRENBARRIO', 'PRECBARRIO']),
      areaTerreno: firstValue(selectedPredio, ['preaterre', 'PREATERRE', 'areaTerreno']),
      areaConstruida: firstValue(selectedPredio, ['preaconst', 'PREACONST', 'areaConstruida']),
      tipoPropiedad: firstValue(selectedPredio, ['pretippro_nombre', 'pretippro', 'tipoPropiedad']),
      destino: firstValue(selectedPredio, ['predestino_nombre', 'predestino', 'destino']),
      claseVetustez: joinValues(' / ', [
        firstValue(selectedPredio, ['preclase_nombre', 'preclase', 'clase']),
        firstValue(selectedPredio, ['prevetustz', 'PREVETUSTZ', 'vetustez'])
      ])
    },
    territorio: {
      localidad: nestedName(division.localidad) || firstValue(props, ['localidad']),
      upl: nestedName(division.upl),
      sectorCatastral: nestedName(division.sectorCatastral)
    },
    declaratoria: {
      nombre: firstValue(declaratoriaProps, ['NOMBRE', 'nombre', 'NombreBic']),
      numeroFicha: firstValue(declaratoriaProps, ['NUMERO_FIC', 'numero_fic', 'NumeroFic']),
      ambito: firstValue(declaratoriaProps, ['AMBITO', 'ambito', 'AmbitoDeclaratorio']),
      categoria: firstValue(declaratoriaProps, ['CATEGORIA', 'categoria', 'Categoria']),
      estadoConservacion: firstValue(declaratoriaProps, ['ESTADO_CONSERVACION', 'estadoConservacion']),
      nivelAnterior: firstValue(declaratoriaProps, ['NIVEL_INTERVENCION_ANTE', 'nivelIntervencionAnte'])
    },
    acto: {
      denominacion: firstValue(acto, ['denominacionActoAdmin', 'DenominacionActoAdmin', 'ACTO_ADMIN', 'acto_admin']),
      numero: firstValue(acto, ['numeroActoAdmin', 'NumeroActoAdmin', 'NUMERO_ACT', 'numero_act']),
      fecha: formatDate(firstValue(acto, ['fechaExpedicion', 'FechaExpedicion', 'FECHA_ACTO', 'fecha_acto'])),
      vigencia: firstValue(acto, ['vigencia', 'Vigencia'])
    },
    norma: {
      pemp: firstValue(norma, ['codigoPempNombre', 'codigoPemp', 'CodigoPemp']),
      sector: firstValue(norma, ['sectorNombre', 'sector', 'Sector']),
      tratamiento: firstValue(norma, ['tratamientoNombre', 'tratamiento', 'Tratamiento']),
      areaActividad: firstValue(norma, ['areaActividadNombre', 'areaActividad', 'AreaActividad'])
    },
    flags: {
      esBic: toBool(firstValue(flags, ['esBic'], proteccion, ['esBic'])) ?? true,
      esApep: toBool(firstValue(flags, ['esApep'], proteccion, ['esApep'])) ?? false,
      esSectorInteresUrbanistico: toBool(firstValue(flags, ['esSectorInteresUrbanistico'], proteccion, ['esSectorInteresUrbanistico'])) ?? false,
      esZonaBicNacional: toBool(firstValue(flags, ['esZonaBicNacional'], proteccion, ['esZonaBicNacional'])) ?? false,
      esColindante: toBool(firstValue(flags, ['esColindante'], proteccion, ['esColindante'])) ?? false,
      esPempUnidadPaisaje: Boolean(toBool(firstValue(flags, ['esPemp'], proteccion, ['esPemp'])) || toBool(firstValue(flags, ['esUnidadPaisaje'], proteccion, ['esUnidadPaisaje'])))
    },
    meta: {
      sectorInteresUrbanisticoNombre: firstValue(siu, ['nombre', 'Nombre']),
      sectorInteresUrbanisticoTipo: firstValue(siu, ['tipoNombre', 'tipoSector', 'TipoSector']),
      multimediaCount: toArray(doc.multimedia).length,
      colindanciaCount: toArray(doc.colindancias || doc.colindancia).length
    }
  };
}

function buildTechnicalTables(doc) {
  return TABLES.map(([name, title, paths]) => {
    const rows = paths.flatMap((path) => valuesAtPath(doc, path));
    const normalizedRows = rows.map((row) => asObject(row)).filter((row) => Object.keys(row).length > 0);
    return {
      name,
      title,
      columns: unique(normalizedRows.flatMap((row) => Object.keys(row))).filter((key) => key !== 'geometry'),
      rows: normalizedRows.map((row) => omit(row, ['geometry']))
    };
  });
}

function valuesAtPath(doc, path) {
  const value = path.split('.').reduce((current, key) => current?.[key], doc);
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function selectPredio(doc, chip) {
  const predios = toArray(doc.predios);
  const normalizedChip = cleanText(chip);
  if (!predios.length) return {};

  if (normalizedChip) {
    const found = predios.find((predio) => {
      const value = firstValue(predio, ['prechip', 'PRECHIP', 'chip', 'CHIP']);
      return cleanText(value).toLowerCase() === normalizedChip.toLowerCase();
    });
    if (found) return found;
  }

  return predios[0] || {};
}

function getLotCodigo(doc) {
  return firstValue(doc, ['lotcodigo'], doc.properties, ['lotcodigo', 'LOTCODIGO']);
}

function normalizeMongoValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeMongoValue);
  if (typeof value === 'object') {
    if (value._bsontype === 'ObjectId') return value.toString();
    if (value._bsontype === 'Decimal128') return value.toString();
    if (typeof value.toJSON === 'function' && value._bsontype) return value.toJSON();

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, normalizeMongoValue(nestedValue)])
    );
  }
  return value;
}

function firstObject(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const found = value.map(asObject).find((item) => Object.keys(item).length > 0);
      if (found) return found;
    }
    const object = asObject(value);
    if (Object.keys(object).length > 0) return object;
  }
  return {};
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function firstValue(...pairs) {
  for (let i = 0; i < pairs.length; i += 2) {
    const object = asObject(pairs[i]);
    const keys = pairs[i + 1] || [];
    for (const key of keys) {
      const value = object[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
  }
  return '';
}

function nestedName(value) {
  const object = asObject(value);
  return firstValue(object, ['nombre', 'Nombre', 'name']);
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes'].includes(text)) return true;
  if (['false', '0', 'no'].includes(text)) return false;
  return Boolean(value);
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC' }).format(date);
}

function joinValues(separator, values) {
  const cleanValues = values.filter((value) => value !== undefined && value !== null && String(value).trim());
  return cleanValues.join(separator);
}

function omit(object, keys) {
  const blocked = new Set(keys);
  return Object.fromEntries(Object.entries(object).filter(([key]) => !blocked.has(key)));
}

function unique(values) {
  return [...new Set(values)];
}

function cleanText(value) {
  return String(value || '').trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
