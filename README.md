# Consulta Territorio BIC

Sitio web independiente para consultar `idpcTerritorioBic.lotesBic` por `lotcodigo` sin exponer la cadena de conexión en el repositorio.

## Tecnología elegida

- **Frontend:** Vite con HTML, CSS y JavaScript plano.
- **Backend:** Vercel Functions con Node.js.
- **Base de datos:** MongoDB usando el driver oficial `mongodb`.
- **Despliegue:** Vercel Hobby.

GitHub Pages no es viable para este caso porque solo publica archivos estáticos. Si el navegador se conectara directamente a MongoDB, la cadena de conexión quedaría expuesta en el código público. Vercel permite tener una función backend en `/api/lote` y leer `MONGODB_URI` desde variables de entorno.

Se descartó Railway porque requiere tarjeta para el flujo indicado. Render puede funcionar en plan gratuito, pero sus servicios web duermen tras inactividad; para esta consulta simple, Vercel evita ese mantenimiento extra. Netlify Functions también sería viable, pero Vercel ofrece una ruta muy directa con funciones Node en `/api`.

Referencias oficiales consultadas:

- Vercel Hobby es gratuito e incluye Vercel Functions: https://vercel.com/docs/accounts/plans/hobby
- Vercel Functions con Node.js se crean en `/api`: https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/node-js
- Variables de entorno en Vercel: https://vercel.com/docs/environment-variables

## Estructura

```text
territorio-bic-search/
  api/
    lote.js              # backend serverless que consulta MongoDB
  src/
    main.js              # render de la búsqueda y resultados
    styles.css
  index.html
  package.json
  vercel.json
  .env.example
  .gitignore
```

## Variables de entorno

Crear un archivo local `.env` o `.env.local` con estos valores. No se debe subir al repositorio.

```bash
MONGODB_URI="mongodb://usuario:password-url-encoded@host:puerto/baseDeDatos?authSource=admin"
MONGODB_DB="idpcTerritorioBic"
MONGODB_COLLECTION="lotesBic"
```

Importante: si la contraseña tiene caracteres especiales, debe ir URL-encoded. Por ejemplo, `*` se escribe `%2A`.

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` usa `vercel dev`, que levanta el frontend y la función `/api/lote` juntos.

## Despliegue en Vercel

1. Crear un repositorio nuevo en GitHub con esta carpeta como proyecto independiente.
2. En Vercel, seleccionar **Add New Project** e importar el repositorio.
3. En **Settings > Environment Variables**, agregar:
   - `MONGODB_URI`
   - `MONGODB_DB`
   - `MONGODB_COLLECTION`
4. Marcar las variables para **Production**, **Preview** y **Development** si aplica.
5. Ejecutar el despliegue.

Si cambias una variable de entorno, Vercel la aplicará en el siguiente despliegue.

## API

```http
GET /api/lote?lotCodigo=CODIGO
```

Respuesta:

- `summary`: campos organizados como la vista `_TabInmueble.cshtml`.
- `technicalTables`: grupos ampliados similares a "Información ampliada del inmueble".
- `document`: documento completo de MongoDB normalizado a JSON para no perder ningún campo.

Opcionalmente se puede enviar `chip` para escoger una unidad predial específica:

```http
GET /api/lote?lotCodigo=CODIGO&chip=CHIP
```

## Seguridad

- El repositorio puede ser público porque `.env`, `.env.local` y `.vercel/` están ignorados.
- La cadena de conexión solo vive en variables de entorno del backend.
- La función no devuelve `MONGODB_URI` ni datos de configuración.
- Si una cadena real fue compartida accidentalmente en un chat, issue o commit, conviene rotar esa contraseña en MongoDB.
