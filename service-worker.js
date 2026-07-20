
// service-worker.js
//
// Estratégia em duas camadas (mantém o comportamento "sempre fresco" do app e
// torna a navegação entre módulos instantânea):
//
//  1. CASCA (index.html, manifest, logos, raiz): NETWORK-FIRST — online, o
//     usuário sempre recebe o deploy mais novo; offline, cai no cache.
//  2. ASSETS COM HASH (assets/js, assets/css, assets/fonts): CACHE-FIRST — o
//     nome do arquivo muda quando o conteúdo muda (hash do Vite), então a
//     cópia em cache é imutável por definição. Trocar de tela nunca espera
//     rede para um chunk já visto.
//
// Os placeholders KRONOS_BUILD/KRONOS_PRECACHE (entre underscores duplos, no
// código abaixo) são preenchidos pelo plugin kronos-pos-build (vite.config.ts). O carimbo
// muda os bytes deste arquivo a cada build — é isso que faz o navegador
// detectar e ativar o SW novo (o esquema antigo, com timestamp calculado em
// runtime, gerava bytes idênticos entre deploys e o SW nunca se atualizava).
const BUILD = 'mrsp8ens';
const UPDATE_POLICY = 'always-current';
const SHELL_CACHE = 'kronos-shell-' + BUILD;
const ASSETS_CACHE = 'kronos-assets-v1'; // persistente entre deploys (conteúdo imutável por hash)

const APP_SHELL_URLS = [
  './',
  './index.html',
  './assets/manifest.json',
  './assets/img/KRONOS_ARQ.svg',
  './assets/img/logo_empresa.png',
  './assets/img/fundo.jpg'
];

// Lista completa dos assets hasheados do build (injetada em build-time).
// Se o placeholder não foi substituído (ex.: dev), fica vazia — sem precache
// e sem poda, comportamento seguro.
let PRECACHE_ASSETS = [];
try {
  const injetado = '["./assets/css/index.KpY_gOmR.css","./assets/fonts/fa-brands-400.D_cYUPeE.woff2","./assets/fonts/fa-regular-400.BjRzuEpd.woff2","./assets/fonts/fa-solid-900.CTAAxXor.woff2","./assets/fonts/fa-v4compatibility.C9RhG_FT.woff2","./assets/fonts/inter-latin-400-normal.C38fXH4l.woff2","./assets/fonts/inter-latin-500-normal.Cerq10X2.woff2","./assets/fonts/inter-latin-600-normal.LgqL8muc.woff2","./assets/fonts/inter-latin-700-normal.Yt3aPRUw.woff2","./assets/fonts/inter-latin-ext-400-normal.C1nco2VV.woff2","./assets/fonts/inter-latin-ext-500-normal.CV4jyFjo.woff2","./assets/fonts/inter-latin-ext-600-normal.D2bJ5OIk.woff2","./assets/fonts/inter-latin-ext-700-normal.Ca8adRJv.woff2","./assets/js/AnaliseGeral.BrK11Ets.js","./assets/js/AssistenteAdministrativo.DtYlg9m0.js","./assets/js/ComponentesChecklist.B9Zf_gHB.js","./assets/js/Dashboard_kronos.BwIBsACp.js","./assets/js/FeedNotificacoes.D1QAOD1f.js","./assets/js/firebase.eXFp_Vkb.js","./assets/js/firebaseBackend.C3IJHA-o.js","./assets/js/GraficoProducaoDiaSemana.BfxVngfS.js","./assets/js/index.Bc9esT4_.js","./assets/js/InsightIA.bFNZWmfy.js","./assets/js/jspdf.es.min.DgHMvf-h.js","./assets/js/jspdf.plugin.autotable.885OOO_b.js","./assets/js/kronosIA.BZ3KBUJG.js","./assets/js/LayoutPrincipal.D3bkpsc4.js","./assets/js/ModalEditarRegistro.DjJChRKR.js","./assets/js/ModalRelatorios.Bfi-F3l8.js","./assets/js/modulo-vazio-jspdf.BkiAkXrA.js","./assets/js/PainelComando.BLFIZQHE.js","./assets/js/PainelSetorExecutivo.D3VfY48l.js","./assets/js/pdfUtils.DLs7uM-m.js","./assets/js/react-vendor.CzQRoPzF.js","./assets/js/SeletorProjeto.Cp-x8mpH.js","./assets/js/TituloInterface.CvnkBCVu.js","./assets/js/tv.CGOUJ38X.js","./assets/js/VisualizacaoAgenda.Y_uJCYyu.js","./assets/js/VisualizacaoChecklists.BeSqx-gU.js","./assets/js/VisualizacaoConfiguracoes.BFl-YqOE.js","./assets/js/VisualizacaoContatos.DI0SQWXG.js","./assets/js/VisualizacaoDespesas.BcXmMnIp.js","./assets/js/VisualizacaoGerenciarCargos.CFtODrYb.js","./assets/js/VisualizacaoGerenciarClientes.B9CXEVC0.js","./assets/js/VisualizacaoGerenciarColaboradores.CmBlUOne.js","./assets/js/VisualizacaoGerenciarFornecedores.pRhMPI3S.js","./assets/js/VisualizacaoGerenciarProjetos.B6vqpwXS.js","./assets/js/VisualizacaoHistoricoGeral.DFf0E804.js","./assets/js/VisualizacaoMonitoramento.CpBX7BZx.js","./assets/js/VisualizacaoProjecaoAdmin.Yd4TeTBG.js","./assets/js/VisualizacaoProjecaoColaborador.BQgja-Sd.js","./assets/js/VisualizacaoStatusProjetos.DDLmDSkG.js"]';
  if (injetado.charAt(0) === '[') PRECACHE_ASSETS = JSON.parse(injetado);
} catch (e) { /* mantém vazio */ }

const ehAssetImutavel = (url) => /\/assets\/(js|css|fonts)\//.test(new URL(url).pathname);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      try { await shell.addAll(APP_SHELL_URLS); } catch (e) { /* offline no install: segue */ }

      // Precache dos assets do build: só baixa o que ainda não está no cache
      // persistente (arquivos com hash inalterado entre deploys não geram
      // nenhuma transferência). Falhas individuais não abortam a instalação.
      const assets = await caches.open(ASSETS_CACHE);
      await Promise.all(PRECACHE_ASSETS.map(async (url) => {
        const existente = await assets.match(url);
        if (existente) return;
        try {
          const resp = await fetch(url);
          if (resp && resp.status === 200) await assets.put(url, resp);
        } catch (e) { /* busca sob demanda depois */ }
      }));

      // UPDATE_POLICY=always-current: a página detecta o worker pronto e pede
      // explicitamente sua ativação. Não usamos skipWaiting automaticamente no
      // install: assim um worker recém-baixado nunca toma uma tela antiga sem
      // que ela própria tenha solicitado a atualização.
      void UPDATE_POLICY;
    })()
  );
});

// A página recém-carregada pede a ativação assim que detecta uma versão nova.
// O comando é propositalmente explícito para que o primeiro deploy com essa
// política não interrompa páginas muito antigas, que ainda não sabem recarregar
// quando o controller muda.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'KRONOS_ACTIVATE_UPDATE') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  event.waitUntil(
    (async () => {
      // Remove cascas de builds antigos.
      const nomes = await caches.keys();
      await Promise.all(nomes.map((nome) => {
        if (nome !== SHELL_CACHE && nome !== ASSETS_CACHE) return caches.delete(nome);
      }));

      // Poda do cache de assets: remove chunks de builds antigos (hash que não
      // existe mais no deploy atual). Só poda quando a lista foi injetada.
      if (PRECACHE_ASSETS.length > 0) {
        const validos = new Set(PRECACHE_ASSETS.map((u) => new URL(u, self.location.href).href));
        const assets = await caches.open(ASSETS_CACHE);
        const chaves = await assets.keys();
        await Promise.all(chaves.map((req) => {
          if (!validos.has(req.url)) return assets.delete(req);
        }));
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // CACHE-FIRST para assets imutáveis (js/css/fonts com hash no nome).
  if (ehAssetImutavel(event.request.url)) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const emCache = await cache.match(event.request);
        if (emCache) return emCache;
        const resp = await fetch(event.request);
        if (resp && resp.status === 200 && resp.type === 'basic') {
          cache.put(event.request, resp.clone());
        }
        return resp;
      })
    );
    return;
  }

  // NETWORK-FIRST para o restante (HTML, manifest, imagens não-hasheadas):
  // online sempre entrega a versão mais nova; offline cai no cache.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(SHELL_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return null;
        });
      })
  );
});
