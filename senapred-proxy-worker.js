/**
 * Senapred Proxy Worker — Descarga el Excel de Puntos Críticos evitando anti-bot
 * Se ejecuta en Cloudflare Workers con egress IP clean (no marcada como bot)
 */

const SENAPRED_URLS = [
  'https://web.senapred.cl/wp-content/uploads/2026/04/Puntos_Criticos_INV_2026.xlsx',
  'https://senapred.cl/wp-content/uploads/2026/04/Puntos_Criticos_INV_2026.xlsx',
  'https://www.senapred.cl/wp-content/uploads/2026/04/Puntos_Criticos_INV_2026.xlsx',
];

const FALLBACK_URL = 'https://raw.githubusercontent.com/psarricolea/puntos-criticos-chile/main/Puntos_Criticos_INV_2026.xlsx';

// Headers que simulan navegador real
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

async function descargarDesde(url) {
  console.log(`Intentando: ${url}`);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: BROWSER_HEADERS,
      cf: {
        // Configuración de Cloudflare para evitar bloqueos
        cacheTtl: 0,
        cacheEverything: false,
      },
      redirect: 'follow',
    });

    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }

    const contentType = resp.headers.get('content-type') || '';
    const data = await resp.arrayBuffer();

    // Validar que sea un Excel válido (PK = ZIP magic bytes)
    const bytes = new Uint8Array(data);
    if (bytes.length > 2 && bytes[0] === 0x50 && bytes[1] === 0x4B) {
      return { 
        success: true, 
        data: data,
        size: data.byteLength,
        source: url,
        contentType: contentType,
      };
    }

    return { success: false, error: 'No es Excel válido' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export default {
  async fetch(request, env, ctx) {
    // Solo aceptar GET
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log de acceso
    console.log(`Worker llamado desde: ${request.headers.get('cf-connecting-ip')}`);

    // 1. Probar URLs oficiales de SENAPRED
    for (const url of SENAPRED_URLS) {
      const result = await descargarDesde(url);
      if (result.success) {
        return new Response(result.data, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Length': String(result.size),
            'X-Source': 'SENAPRED-Oficial',
            'X-Original-URL': url,
            'X-Worker': 'senapred-proxy-v1',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          }
        });
      }
      console.log(`  ❌ ${url}: ${result.error}`);
    }

    // 2. Fallback al mirror de GitHub
    console.log('Problema con URLs oficiales, usando fallback...');
    const fallback = await descargarDesde(FALLBACK_URL);
    
    if (fallback.success) {
      return new Response(fallback.data, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Length': String(fallback.size),
          'X-Source': 'GitHub-Fallback',
          'X-Original-URL': FALLBACK_URL,
          'X-Worker': 'senapred-proxy-v1',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
    }

    // 3. Todo falló
    return new Response(JSON.stringify({
      error: 'No se pudo descargar el Excel',
      intentos: SENAPRED_URLS.length + 1,
      timestamp: new Date().toISOString(),
    }), { 
      status: 503,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
};
