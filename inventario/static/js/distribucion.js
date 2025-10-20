(() => {
  const config = window.distribucionConfig || {};
  const endpoints = config.endpoints || {};

  const selectorBodega = document.querySelector("#selectorBodega");
  const guardarBtn = document.querySelector("#guardarDistribucion");
  const columnasInput = document.querySelector("#columnasInput");
  const filasInput = document.querySelector("#filasInput");
  const tamanoCeldaInput = document.querySelector("#tamanoCelda");
  const gridInner = document.querySelector("#gridInner");
  const canvasGrid = document.querySelector("#canvasGrid");
  const resumenDistribucion = document.querySelector("#resumenDistribucion");
  const offcanvas = document.querySelector("#detalleDistribucion");
  const offcanvasPanel = document.querySelector("#detalleDistribucionPanel");
  const offcanvasBody = document.querySelector("#detalleDistribucionBody");
  const offcanvasTitle = document.querySelector("#detalleDistribucionTitle");
  const offcanvasSubtitle = document.querySelector("#detalleDistribucionSubtitle");
  const offcanvasEmpty = document.querySelector("#detalleDistribucionEmpty");
  const detalleDefaultTitle = offcanvasTitle?.textContent || "Detalle de ubicación";
  const detalleDefaultSubtitle =
    offcanvasSubtitle?.textContent ||
    "Selecciona un estante o estiba para ver su estructura.";
  const bodyElement = document.body;

  if (!selectorBodega || !gridInner) {
    return;
  }

  const agregarPasilloBtn = document.querySelector("#agregarPasillo");

  const state = {
    bodegaId: null,
    bodegaNombre: "",
    items: [],
    canvas: {
      cols: Number.parseInt(columnasInput?.value || "8", 10),
      rows: Number.parseInt(filasInput?.value || "6", 10),
      cellSize: Number.parseInt(tamanoCeldaInput?.value || "120", 10),
    },
    detalleSeleccionadoId: null,
    detalleCache: new Map(),
    draggingId: null,
    justDraggedId: null,
    cargando: false,
    pasilloCounter: 1,
  };

  const BULLET = " \u00B7 ";

  function getCookie(name) {
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    if (match) {
      return decodeURIComponent(match[2]);
    }
    return null;
  }

  function setCanvasVariables() {
    if (!gridInner) return;
    gridInner.style.setProperty("--cols", state.canvas.cols);
    gridInner.style.setProperty("--cell-size", `${state.canvas.cellSize}px`);
    canvasGrid?.style.setProperty("--cell-size", `${state.canvas.cellSize}px`);
  }

  function rowColToIndex(row, col) {
    return (row - 1) * state.canvas.cols + (col - 1);
  }

  function indexToRowCol(index) {
    const fila = Math.floor(index / state.canvas.cols) + 1;
    const columna = (index % state.canvas.cols) + 1;
    return { fila, columna };
  }

  function totalCeldas(cols = state.canvas.cols, rows = state.canvas.rows) {
    return rows * cols;
  }

  function ajustarItemDentroDeCanvas(item) {
    if (!item) return;
    item.ancho = Math.max(1, Number.parseInt(item.ancho, 10) || 1);
    item.alto = Math.max(1, Number.parseInt(item.alto, 10) || 1);
    item.ancho = Math.min(item.ancho, state.canvas.cols);
    item.alto = Math.min(item.alto, state.canvas.rows);
    item.fila = Math.max(1, Number.parseInt(item.fila, 10) || 1);
    item.columna = Math.max(1, Number.parseInt(item.columna, 10) || 1);
    const maxCol = Math.max(1, state.canvas.cols - item.ancho + 1);
    const maxRow = Math.max(1, state.canvas.rows - item.alto + 1);
    item.columna = Math.min(item.columna, maxCol);
    item.fila = Math.min(item.fila, maxRow);
  }

  function obtenerSeparacionCeldas() {
    if (!gridInner) {
      return { column: 0, row: 0 };
    }
    const estilos = window.getComputedStyle(gridInner);
    const parseGap = (valor) => {
      if (!valor) return 0;
      const numero = Number.parseFloat(valor);
      return Number.isNaN(numero) ? 0 : numero;
    };
    const columnGap =
      parseGap(estilos.getPropertyValue("column-gap")) ||
      parseGap(estilos.getPropertyValue("grid-column-gap"));
    const rowGap =
      parseGap(estilos.getPropertyValue("row-gap")) ||
      parseGap(estilos.getPropertyValue("grid-row-gap"));
    const generalGap = parseGap(estilos.getPropertyValue("gap"));
    return {
      column: columnGap || generalGap,
      row: rowGap || generalGap,
    };
  }

  function aplicarDimensionesPasillo(nodo, item, gaps) {
    if (!nodo || !item?.es_pasillo) return;
    const spanCols = Math.max(1, Number.parseInt(item.ancho, 10) || 1);
    const spanRows = Math.max(1, Number.parseInt(item.alto, 10) || 1);
    const cellSize = state.canvas.cellSize;
    const gapCol = gaps?.column ?? 0;
    const gapRow = gaps?.row ?? 0;
    nodo.dataset.spanCols = String(spanCols);
    nodo.dataset.spanRows = String(spanRows);

    if (spanCols === 1 && spanRows === 1) {
      nodo.classList.remove("grid-item--span");
      nodo.style.removeProperty("width");
      nodo.style.removeProperty("height");
      nodo.style.removeProperty("right");
      nodo.style.removeProperty("bottom");
      nodo.style.removeProperty("left");
      nodo.style.removeProperty("top");
      nodo.style.zIndex = "3";
      return;
    }

    nodo.classList.add("grid-item--span");
    const totalWidth = spanCols * cellSize + (spanCols - 1) * gapCol;
    const totalHeight = spanRows * cellSize + (spanRows - 1) * gapRow;
    nodo.style.left = "6px";
    nodo.style.top = "6px";
    nodo.style.width = `${Math.max(0, totalWidth - 12)}px`;
    nodo.style.height = `${Math.max(0, totalHeight - 12)}px`;
    nodo.style.right = "auto";
    nodo.style.bottom = "auto";
    nodo.style.zIndex = "5";
  }

  function normalizarId(valor) {
    if (valor === null || valor === undefined) {
      return null;
    }
    if (valor === "null" || valor === "None" || valor === "undefined") {
      return null;
    }
    const numero = Number(valor);
    return Number.isNaN(numero) ? valor : numero;
  }

  function escaparHtml(valor) {
    if (valor === null || valor === undefined) {
      return "";
    }
    return String(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ordenarUbicaciones(a, b) {
    const numeroA = Number.parseInt(a?.numero, 10);
    const numeroB = Number.parseInt(b?.numero, 10);
    const valorA = Number.isNaN(numeroA) ? Number.MAX_SAFE_INTEGER : numeroA;
    const valorB = Number.isNaN(numeroB) ? Number.MAX_SAFE_INTEGER : numeroB;
    if (valorA !== valorB) {
      return valorA - valorB;
    }
    const nombreA = (a?.nombre || "").toLowerCase();
    const nombreB = (b?.nombre || "").toLowerCase();
    return nombreA.localeCompare(nombreB);
  }

  function normalizarNodo(nodo, padreId = null, mapa) {
    if (!nodo || typeof nodo !== "object") {
      return null;
    }
    const hijos = Array.isArray(nodo.hijos) ? nodo.hijos : [];
    const id = normalizarId(nodo.id);
    const bodegaId = normalizarId(nodo.bodega);
    const resultado = {
      ...nodo,
      id,
      bodega: bodegaId,
      padre: padreId,
      hijos: [],
    };
    mapa.set(id, resultado);
    resultado.hijos = hijos
      .map((hijo) => normalizarNodo(hijo, id, mapa))
      .filter(Boolean);
    return resultado;
  }

  function filtrarPorTipo(nodo, tipo) {
    if (!nodo || !Array.isArray(nodo.hijos)) {
      return [];
    }
    return nodo.hijos.filter((hijo) => hijo.tipo === tipo);
  }

  function construirContenedores(contenedores) {
    const wrap = document.createElement("div");
    wrap.className = "contenedores-wrap";

    if (!contenedores || !contenedores.length) {
      const chip = document.createElement("div");
      chip.className = "contenedor-chip";
      chip.textContent = "Sin contenedores";
      wrap.appendChild(chip);
      return wrap;
    }

    contenedores
      .slice()
      .sort(ordenarUbicaciones)
      .forEach((contenedor) => {
        const chip = document.createElement("div");
        chip.className = "contenedor-chip";
        const nombre = document.createElement("span");
        nombre.textContent = escaparHtml(contenedor.nombre || "Contenedor");
        const etiqueta = document.createElement("span");
        const identificador =
          contenedor.nomenclatura && contenedor.nomenclatura !== ""
            ? contenedor.nomenclatura
            : contenedor.numero != null
              ? contenedor.numero
              : "";
        etiqueta.textContent = escaparHtml(String(identificador));
        chip.appendChild(nombre);
        chip.appendChild(etiqueta);
        wrap.appendChild(chip);
      });
    return wrap;
  }

  function construirDivision(division) {
    const card = document.createElement("div");
    card.className = "division-card";

    const titulo = document.createElement("div");
    titulo.className = "division-title";
    const nombre = escaparHtml(division.nombre || "Division");
    const codigo =
      division.nomenclatura && division.nomenclatura !== ""
        ? division.nomenclatura
        : division.numero != null
          ? division.numero
          : "";
    titulo.innerHTML = `<span>${nombre}</span><span>${escaparHtml(String(codigo))}</span>`;

    card.appendChild(titulo);
    card.appendChild(construirContenedores(filtrarPorTipo(division, "CONTENEDOR")));
    return card;
  }

  function crearNivel({
    nombre,
    codigo,
    etiqueta,
    etiquetaTipo = "numero",
    contenido,
    tipo = "panel",
  }) {
    const level = document.createElement("div");
    level.className = "shelf-level";
    level.dataset.tipo = tipo;

    const board = document.createElement("div");
    board.className = `shelf-board shelf-board--${tipo}`;

    if (nombre || codigo) {
      const header = document.createElement("div");
      header.className = "shelf-level-header";
      if (nombre) {
        const nombreSpan = document.createElement("span");
        nombreSpan.className = "shelf-level-name";
        nombreSpan.textContent = nombre;
        header.appendChild(nombreSpan);
      }
      if (codigo) {
        const codigoSpan = document.createElement("span");
        codigoSpan.className = "shelf-level-code";
        codigoSpan.textContent = codigo;
        header.appendChild(codigoSpan);
      }
      board.appendChild(header);
    }

    const body = document.createElement("div");
    body.className = "shelf-level-body";

    if (Array.isArray(contenido)) {
      contenido.forEach((child) => {
        if (child) {
          body.appendChild(child);
        }
      });
    } else if (
      contenido &&
      typeof contenido === "object" &&
      "nodeType" in contenido
    ) {
      body.appendChild(contenido);
    } else if (typeof contenido === "string" && contenido.trim().length) {
      body.innerHTML = contenido;
    }

    let contenidoNodo = body;

    if (tipo === "panel") {
      const panelBody = document.createElement("div");
      panelBody.className = "shelf-panel-body";
      while (body.firstChild) {
        panelBody.appendChild(body.firstChild);
      }
      if (!panelBody.childElementCount && !panelBody.textContent.trim()) {
        panelBody.classList.add("shelf-level-body--empty");
        panelBody.textContent = "Sin contenedores registrados.";
      }
      contenidoNodo = panelBody;
    } else if (!body.childElementCount && !body.textContent.trim()) {
      body.classList.add("shelf-level-body--empty");
      body.textContent = "Sin contenedores registrados.";
    }

    board.appendChild(contenidoNodo);
    level.appendChild(board);

    if (etiqueta) {
      const index = document.createElement("div");
      index.className = `shelf-level-index shelf-level-index--${etiquetaTipo}`;
      index.textContent = etiqueta;
      level.appendChild(index);
    }

    return level;
  }

  function construirNivelPanel(panel) {
    const divisiones = filtrarPorTipo(panel, "DIVISION")
      .slice()
      .sort(ordenarUbicaciones);
    let contenido;

    if (divisiones.length) {
      const grid = document.createElement("div");
      grid.className = "divisiones-grid";
      divisiones.forEach((division) => {
        grid.appendChild(construirDivision(division));
      });
      contenido = grid;
    } else {
      const contenedores = filtrarPorTipo(panel, "CONTENEDOR");
      contenido = construirContenedores(contenedores);
    }

    const codigo =
      panel.nomenclatura && panel.nomenclatura !== ""
        ? panel.nomenclatura
        : panel.numero != null
          ? `#${panel.numero}`
          : "";
    const etiqueta = panel.numero != null ? String(panel.numero) : "Nivel";

    return crearNivel({
      nombre: panel.nombre || "Panel",
      codigo,
      etiqueta,
      contenido,
      tipo: "panel",
    });
  }

  function construirNivelBase(estante, contenedores) {
    const codigo =
      estante.nomenclatura && estante.nomenclatura !== ""
        ? estante.nomenclatura
        : estante.numero != null
          ? `#${estante.numero}`
          : "";
    return crearNivel({
      nombre: "Nivel base",
      codigo,
      etiqueta: "Base",
      etiquetaTipo: "base",
      contenido: construirContenedores(contenedores),
      tipo: "base",
    });
  }

  function calcularResumenEstante(estante) {
    const paneles = filtrarPorTipo(estante, "PANEL");
    let divisiones = 0;
    let contenedoresEnPaneles = 0;

    paneles.forEach((panel) => {
      const divisionesPanel = filtrarPorTipo(panel, "DIVISION");
      divisiones += divisionesPanel.length;
      contenedoresEnPaneles += filtrarPorTipo(panel, "CONTENEDOR").length;
      divisionesPanel.forEach((division) => {
        contenedoresEnPaneles += filtrarPorTipo(division, "CONTENEDOR").length;
      });
    });

    const contenedoresDirectos = filtrarPorTipo(estante, "CONTENEDOR").length;

    return {
      panelesCantidad: paneles.length,
      divisionesCantidad: divisiones,
      contenedoresCantidad: contenedoresDirectos + contenedoresEnPaneles,
      contenedoresDirectos,
      paneles,
    };
  }

  function crearEncabezadoEstante(estante, datos) {
    const header = document.createElement("div");
    header.className = "estante-header";

    const titulo = document.createElement("div");
    titulo.className = "estante-title";
    const codigo =
      estante.nomenclatura && estante.nomenclatura !== ""
        ? estante.nomenclatura
        : estante.numero != null
          ? `#${estante.numero}`
          : "";
    const nombreBase = estante.nombre || estante.tipo_display || "Ubicacion";
    titulo.innerHTML = `${escaparHtml(nombreBase)} <small>${escaparHtml(codigo)}</small>`;

    const resumen = document.createElement("div");
    resumen.className = "estante-summary";
    const partesResumen = [];
    if (estante.tipo !== "ESTIBA") {
      partesResumen.push(
        `${datos.panelesCantidad} ${
          datos.panelesCantidad === 1 ? "panel" : "paneles"
        }`,
      );
      partesResumen.push(
        `${datos.divisionesCantidad} ${
          datos.divisionesCantidad === 1 ? "division" : "divisiones"
        }`,
      );
    }
    partesResumen.push(
      `${datos.contenedoresCantidad} ${
        datos.contenedoresCantidad === 1 ? "contenedor" : "contenedores"
      }`,
    );
    resumen.textContent = partesResumen.join(BULLET).trim();

    header.appendChild(titulo);
    header.appendChild(resumen);
    return header;
  }

  function crearEstanteGeneralStat(valor, etiqueta) {
    const stat = document.createElement("div");
    stat.className = "estante-general-stat";

    const value = document.createElement("span");
    value.className = "estante-general-stat-value";
    value.textContent = String(valor);

    const label = document.createElement("span");
    label.className = "estante-general-stat-label";
    label.textContent = etiqueta;

    stat.appendChild(value);
    stat.appendChild(label);
    return stat;
  }

  function construirEstibaDetalle(estiba) {
    const card = document.createElement("div");
    card.className = "estante-card estante-card--estiba";

    const datos = calcularResumenEstante(estiba);
    const header = crearEncabezadoEstante(estiba, datos);
    card.appendChild(header);

    const frame = document.createElement("div");
    frame.className = "estiba-frame";

    const top = document.createElement("div");
    top.className = "estiba-top";
    for (let index = 0; index < 5; index += 1) {
      const plank = document.createElement("div");
      plank.className = "estiba-plank";
      top.appendChild(plank);
    }
    frame.appendChild(top);

    const center = document.createElement("div");
    center.className = "estiba-center";
    frame.appendChild(center);

    const base = document.createElement("div");
    base.className = "estiba-base";
    for (let index = 0; index < 3; index += 1) {
      const block = document.createElement("div");
      block.className = "estiba-block";
      base.appendChild(block);
    }
    frame.appendChild(base);

    card.appendChild(frame);

    const contenedores = filtrarPorTipo(estiba, "CONTENEDOR");
    const carga = document.createElement("div");
    carga.className = "estiba-load";

    if (contenedores.length) {
      const titulo = document.createElement("div");
      titulo.className = "estiba-load-title";
      titulo.textContent = "Contenedores asignados";
      const listado = construirContenedores(contenedores);
      listado.classList.add("estiba-load-grid");
      carga.appendChild(titulo);
      carga.appendChild(listado);
    } else {
      const vacio = document.createElement("div");
      vacio.className = "shelf-empty";
      vacio.textContent = "Sin contenedores registrados.";
      carga.appendChild(vacio);
    }

    card.appendChild(carga);
    return card;
  }

  function construirEstibaGeneral(estiba) {
    const card = document.createElement("div");
    card.className = "estante-card estante-card--general estante-card--estiba-general";

    const datos = calcularResumenEstante(estiba);
    const header = crearEncabezadoEstante(estiba, datos);
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "estiba-general-body";

    const icono = document.createElement("div");
    icono.className = "estiba-icon";
    for (let index = 0; index < 4; index += 1) {
      const liston = document.createElement("span");
      liston.className = "estiba-icon-plank";
      icono.appendChild(liston);
    }
    body.appendChild(icono);

    const statsWrap = document.createElement("div");
    statsWrap.className = "estiba-general-stats";
    statsWrap.appendChild(
      crearEstanteGeneralStat(
        datos.contenedoresCantidad,
        datos.contenedoresCantidad === 1 ? "Contenedor" : "Contenedores",
      ),
    );
    body.appendChild(statsWrap);

    card.appendChild(body);
    return card;
  }

  function construirEstante(estante) {
    if (estante.tipo === "ESTIBA") {
      return construirEstibaDetalle(estante);
    }

    const card = document.createElement("div");
    card.className = "estante-card";

    const datos = calcularResumenEstante(estante);

    const header = crearEncabezadoEstante(estante, datos);
    card.appendChild(header);

    const frame = document.createElement("div");
    frame.className = "shelf-frame";

    const railLeft = document.createElement("div");
    railLeft.className = "shelf-rail shelf-rail-left";
    const railRight = document.createElement("div");
    railRight.className = "shelf-rail shelf-rail-right";
    const crossTop = document.createElement("div");
    crossTop.className = "shelf-cross shelf-cross-top";
    const crossBottom = document.createElement("div");
    crossBottom.className = "shelf-cross shelf-cross-bottom";

    frame.appendChild(crossTop);
    frame.appendChild(crossBottom);
    frame.appendChild(railLeft);
    frame.appendChild(railRight);

    const footLeft = document.createElement("div");
    footLeft.className = "shelf-foot shelf-foot-left";
    const footRight = document.createElement("div");
    footRight.className = "shelf-foot shelf-foot-right";
    frame.appendChild(footLeft);
    frame.appendChild(footRight);

    const niveles = document.createElement("div");
    niveles.className = "shelf-level-stack";

    const contenedoresBase = filtrarPorTipo(estante, "CONTENEDOR");
    if (contenedoresBase.length) {
      niveles.appendChild(construirNivelBase(estante, contenedoresBase));
    }

    const panelesOrdenados = datos.paneles.slice().sort(ordenarUbicaciones);
    panelesOrdenados.forEach((panel, index) => {
      if (index > 0) {
        const separator = document.createElement("div");
        separator.className = "shelf-cross shelf-cross-bottom shelf-cross-middle";
        niveles.appendChild(separator);
      }
      niveles.appendChild(construirNivelPanel(panel));
    });

    if (niveles.childElementCount) {
      frame.appendChild(niveles);
    } else {
      const vacio = document.createElement("div");
      vacio.className = "shelf-empty";
      vacio.textContent =
        estante.tipo === "ESTIBA"
          ? "Sin contenedores registrados."
          : "Sin paneles ni contenedores registrados.";
      frame.appendChild(vacio);
    }

    card.appendChild(frame);
    return card;
  }

  function construirEstanteGeneral(estante) {
    if (estante.tipo === "ESTIBA") {
      return construirEstibaGeneral(estante);
    }

    const card = document.createElement("div");
    card.className = "estante-card estante-card--general";

    const datos = calcularResumenEstante(estante);
    const header = crearEncabezadoEstante(estante, datos);
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "estante-general-body";

    const icon = document.createElement("div");
    icon.className = "estante-general-icon";
    icon.appendChild(document.createElement("span"));

    const statsWrap = document.createElement("div");
    statsWrap.className = "estante-general-stats";

    if (estante.tipo !== "ESTIBA") {
      statsWrap.appendChild(
        crearEstanteGeneralStat(
          datos.panelesCantidad,
          datos.panelesCantidad === 1 ? "Panel" : "Paneles",
        ),
      );
      statsWrap.appendChild(
        crearEstanteGeneralStat(
          datos.divisionesCantidad,
          datos.divisionesCantidad === 1 ? "Division" : "Divisiones",
        ),
      );
    }
    statsWrap.appendChild(
      crearEstanteGeneralStat(
        datos.contenedoresCantidad,
        datos.contenedoresCantidad === 1 ? "Contenedor" : "Contenedores",
      ),
    );

    body.appendChild(icon);
    body.appendChild(statsWrap);
    card.appendChild(body);

    return card;
  }

  function construirRuta(nodo, mapa) {
    const partes = [];
    let actual = nodo;
    while (actual) {
      partes.push(actual.nombre || actual.tipo_display || "");
      const padreId = normalizarId(actual.padre);
      actual = padreId != null ? mapa.get(padreId) : null;
    }
    return partes.reverse().filter(Boolean).join(" / ");
  }

  function mostrarDetalleMensaje(texto) {
    if (!offcanvasBody) return;
    offcanvasBody.innerHTML = "";
    const mensaje = document.createElement("div");
    mensaje.className = "offcanvas-empty";
    mensaje.textContent = texto;
    offcanvasBody.appendChild(mensaje);
  }

  function renderDetalleUbicacion(nodo, mapa) {
    if (!offcanvasBody) {
      return;
    }
    const nombre = nodo.nombre || nodo.tipo_display || "Ubicacion";
    const tipoNombre =
      nodo.tipo_display || (nodo.tipo === "ESTIBA" ? "Estiba" : "Estante");
    const ruta = construirRuta(nodo, mapa);

    if (offcanvasTitle) {
      offcanvasTitle.textContent = nombre;
    }
    if (offcanvasSubtitle) {
      const partes = [];
      if (state.bodegaNombre) {
        partes.push(`Bodega ${state.bodegaNombre}`);
      }
      partes.push(tipoNombre);
      if (ruta) {
        partes.push(ruta);
      }
      offcanvasSubtitle.textContent = partes.join(BULLET);
    }

    offcanvasBody.innerHTML = "";
    offcanvasBody.appendChild(construirEstanteGeneral(nodo));
    offcanvasBody.appendChild(construirEstante(nodo));
  }

  async function cargarEstructuraBodega(bodegaId, { force = false } = {}) {
    if (!bodegaId) return null;
    if (!force && state.detalleCache.has(bodegaId)) {
      return state.detalleCache.get(bodegaId);
    }
    if (!endpoints.ubicaciones) {
      throw new Error("Endpoint de ubicaciones no configurado.");
    }
    const url = new URL(endpoints.ubicaciones, window.location.origin);
    url.searchParams.set("bodega", bodegaId);
    const respuesta = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!respuesta.ok) {
      throw new Error("No fue posible cargar la estructura de la bodega.");
    }
    const data = await respuesta.json();
    const mapa = new Map();
    const raices = Array.isArray(data?.ubicaciones)
      ? data.ubicaciones
          .map((nodo) => normalizarNodo(nodo, null, mapa))
          .filter(Boolean)
      : [];
    const payload = { raices, mapa };
    state.detalleCache.set(bodegaId, payload);
    return payload;
  }

  function marcarSeleccionPorId(id) {
    if (!gridInner) return;
    const anteriores = gridInner.querySelectorAll(".grid-item.is-selected");
    anteriores.forEach((elemento) => elemento.classList.remove("is-selected"));
    if (id == null) {
      return;
    }
    const objetivo = gridInner.querySelector(
      `.grid-item[data-id="${String(id)}"]`,
    );
    if (objetivo) {
      objetivo.classList.add("is-selected");
    }
  }

  async function mostrarDetalleUbicacion(item) {
    if (!item || item.es_pasillo || !state.bodegaId) return;
    const objetivoId = normalizarId(item.id);
    state.detalleSeleccionadoId = objetivoId;
    marcarSeleccionPorId(objetivoId);
    toggleOffcanvas(true);
    mostrarDetalleMensaje("Cargando estructura de la ubicación seleccionada...");
    try {
      const estructura = await cargarEstructuraBodega(state.bodegaId);
      const mapa = estructura?.mapa;
      const nodo = mapa?.get(objetivoId);
      if (!nodo) {
        mostrarDetalleMensaje(
          "No se encontró información estructural para esta ubicación.",
        );
        return;
      }
      if (state.detalleSeleccionadoId !== objetivoId) {
        return;
      }
      renderDetalleUbicacion(nodo, mapa);
    } catch (error) {
      console.error(error);
      mostrarDetalleMensaje(
        "No fue posible cargar la estructura de la ubicación seleccionada.",
      );
    }
  }

  function toggleOffcanvas(mostrar) {
    if (!offcanvas) return;
    offcanvas.classList.toggle("is-visible", mostrar);
    offcanvas.setAttribute("aria-hidden", mostrar ? "false" : "true");
    if (mostrar) {
      bodyElement?.classList.add("offcanvas-open");
    } else {
      bodyElement?.classList.remove("offcanvas-open");
    }
  }

  function cerrarDetalle() {
    if (state.detalleSeleccionadoId != null) {
      state.detalleSeleccionadoId = null;
      marcarSeleccionPorId(null);
    }
    if (offcanvasTitle) {
      offcanvasTitle.textContent = detalleDefaultTitle;
    }
    if (offcanvasSubtitle) {
      offcanvasSubtitle.textContent = detalleDefaultSubtitle;
    }
    if (offcanvasBody) {
      offcanvasBody.innerHTML = "";
      if (offcanvasEmpty) {
        const clone = offcanvasEmpty.cloneNode(true);
        clone.id = "";
        offcanvasBody.appendChild(clone);
      } else {
        mostrarDetalleMensaje(detalleDefaultSubtitle);
      }
    }
    toggleOffcanvas(false);
  }

  function ensureCapacityForIndex(index) {
    if (index < totalCeldas()) {
      return;
    }
    const requiredCells = index + 1;
    const requiredRows = Math.ceil(requiredCells / state.canvas.cols);
    if (requiredRows > state.canvas.rows) {
      state.canvas.rows = requiredRows;
      if (filasInput) {
        filasInput.value = String(state.canvas.rows);
      }
    }
  }

  function rowColToIndexWithCols(row, col, cols) {
    return (row - 1) * cols + (col - 1);
  }

  function obtenerMaxFila() {
    return state.items.reduce((max, item) => Math.max(max, item.fila), 1);
  }

  function findNextAvailableIndex(startIndex = 0, excludedId = null) {
    const occupied = new Set();
    state.items.forEach((item) => {
      if (excludedId && item.id === excludedId) return;
      const index = rowColToIndex(item.fila, item.columna);
      occupied.add(index);
    });
    let index = startIndex;
    while (occupied.has(index)) {
      index += 1;
    }
    ensureCapacityForIndex(index);
    return index;
  }

  function mapItemsByIndex(excludeId = null) {
    const map = new Map();
    state.items.forEach((item) => {
      if (excludeId && item.id === excludeId) return;
      const index = rowColToIndex(item.fila, item.columna);
      map.set(index, { ...item });
    });
    return map;
  }

  function shiftForward(map, index, element) {
    ensureCapacityForIndex(index);
    const existing = map.get(index);
    if (existing) {
      shiftForward(map, index + 1, existing);
    }
    map.set(index, element);
  }

  function regenerateItemsFromMap(map) {
    state.items = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([index, item]) => {
        const { fila, columna } = indexToRowCol(index);
        return { ...item, fila, columna };
      });
  }

  function reacomodarPorColumnas(prevCols) {
    const copia = state.items
      .slice()
      .sort(
        (a, b) =>
          rowColToIndexWithCols(a.fila, a.columna, prevCols) -
          rowColToIndexWithCols(b.fila, b.columna, prevCols),
      );
    state.items = copia.map((item, index) => {
      const { fila, columna } = indexToRowCol(index);
      return { ...item, fila, columna };
    });
  }

  function limpiarLienzo() {
    gridInner.innerHTML = "";
  }

  function crearElementoItem(item) {
    const nodo = document.createElement("div");
    nodo.className = "grid-item";
    nodo.draggable = true;
    nodo.dataset.id = item.id;
    nodo.dataset.tipo = item.tipo;
    nodo.dataset.fila = String(item.fila);
    nodo.dataset.columna = String(item.columna);
    nodo.dataset.ancho = String(item.ancho ?? 1);
    nodo.dataset.alto = String(item.alto ?? 1);
    if (item.es_pasillo) {
      nodo.classList.add("grid-item--pasillo");
    }
    nodo.innerHTML = `
      ${
        item.es_pasillo
          ? `<strong>${item.nombre || "Pasillo"}</strong><span>Pasillo</span>`
          : `<strong>${item.nombre}</strong><span>${
              item.tipo === "ESTIBA" ? "Estiba" : "Estante"
            }</span><span>${item.nomenclatura || ""}</span>`
      }
      ${
        item.es_pasillo
          ? '<button type="button" class="grid-item-remove" data-action="remove" aria-label="Eliminar pasillo">×</button>'
          : ""
      }
    `;

    nodo.addEventListener("dragstart", (event) => {
      state.draggingId = item.id;
      state.justDraggedId = null;
      event.dataTransfer?.setData("text/plain", String(item.id));
      event.dataTransfer?.setDragImage?.(nodo, 30, 30);
      nodo.classList.add("is-dragging");
    });

    nodo.addEventListener("dragend", () => {
      state.draggingId = null;
      state.justDraggedId = item.id;
      window.setTimeout(() => {
        if (state.justDraggedId === item.id) {
          state.justDraggedId = null;
        }
      }, 150);
      nodo.classList.remove("is-dragging");
      const activos = gridInner.querySelectorAll(".grid-cell[data-drop='true']");
      activos.forEach((celda) => {
        celda.removeAttribute("data-drop");
      });
    });

    nodo.addEventListener("dblclick", (event) => {
      if (!item.es_pasillo) return;
      event.preventDefault();
      editarPasillo(item.id);
    });

    nodo.addEventListener("click", (event) => {
      const boton = event.target.closest("[data-action='remove']");
      if (boton) {
        event.stopPropagation();
        eliminarPasillo(item.id);
        return;
      }
      if (item.es_pasillo) {
        return;
      }
      if (state.draggingId || state.justDraggedId === item.id) {
        return;
      }
      event.preventDefault();
      mostrarDetalleUbicacion(item);
    });

    return nodo;
  }

  function handleDrop(row, col) {
    if (!state.draggingId) {
      return;
    }

    const draggingItem = state.items.find((item) => item.id === state.draggingId);
    if (!draggingItem) {
      return;
    }

    const targetIndex = rowColToIndex(row, col);
    const map = mapItemsByIndex(state.draggingId);
    const elemento = { ...draggingItem };
    shiftForward(map, targetIndex, elemento);
    regenerateItemsFromMap(map);
    state.items.forEach(ajustarItemDentroDeCanvas);
    renderGrid();
  }

  function renderGrid() {
    limpiarLienzo();
    setCanvasVariables();
    state.items.forEach(ajustarItemDentroDeCanvas);

    const mapa = new Map();
    state.items.forEach((item) => {
      mapa.set(`${item.fila}-${item.columna}`, item);
    });
    const gaps = obtenerSeparacionCeldas();

    for (let fila = 1; fila <= state.canvas.rows; fila += 1) {
      for (let columna = 1; columna <= state.canvas.cols; columna += 1) {
        const celda = document.createElement("div");
        celda.className = "grid-cell";
        celda.dataset.row = String(fila);
        celda.dataset.col = String(columna);

        celda.addEventListener("dragover", (event) => {
          event.preventDefault();
          celda.dataset.drop = "true";
        });

        celda.addEventListener("dragleave", () => {
          celda.removeAttribute("data-drop");
        });

        celda.addEventListener("drop", (event) => {
          event.preventDefault();
          celda.removeAttribute("data-drop");
          const row = Number.parseInt(celda.dataset.row || "1", 10);
          const col = Number.parseInt(celda.dataset.col || "1", 10);
          handleDrop(row, col);
        });

        const item = mapa.get(`${fila}-${columna}`);
        if (item) {
          const elemento = crearElementoItem(item);
          celda.appendChild(elemento);
          if (item.es_pasillo) {
            aplicarDimensionesPasillo(elemento, item, gaps);
          }
        }
        gridInner.appendChild(celda);
      }
    }

    if (state.detalleSeleccionadoId != null) {
      marcarSeleccionPorId(state.detalleSeleccionadoId);
    }

    actualizarResumen();
    guardarBtn.disabled = !state.bodegaId;
  }

  function actualizarResumen() {
    if (!resumenDistribucion) return;
    const total = state.items.length;
    resumenDistribucion.innerHTML =
      `<div><strong>Bodega:</strong> ${state.bodegaNombre || "--"}</div>` +
      `<div><strong>Total elementos:</strong> ${total}</div>` +
      `<div><strong>Filas x columnas:</strong> ${state.canvas.rows} x ${state.canvas.cols}</div>`;
  }

  function setEstadoCargando(cargando) {
    state.cargando = cargando;
    canvasGrid?.classList.toggle("is-loading", cargando);
    guardarBtn.disabled = cargando || !state.bodegaId;
  }

  async function cargarDistribucion(bodegaId) {
    if (!bodegaId) return;
    setEstadoCargando(true);
    try {
      const url = new URL(endpoints.distribucion, window.location.origin);
      url.searchParams.set("bodega", bodegaId);
      const respuesta = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!respuesta.ok) {
        throw new Error("No fue posible cargar la distribucion.");
      }
      const data = await respuesta.json();
      state.bodegaId = data?.bodega?.id ?? null;
      state.bodegaNombre = data?.bodega?.nombre ?? "";
      state.canvas.cols = Number.parseInt(data?.canvas?.cols || state.canvas.cols, 10);
      state.canvas.rows = Number.parseInt(data?.canvas?.rows || state.canvas.rows, 10);
      state.canvas.cellSize = Number.parseInt(data?.canvas?.cell_size || state.canvas.cellSize, 10);

      if (columnasInput) {
        columnasInput.value = String(state.canvas.cols);
      }
      if (filasInput) {
        filasInput.value = String(state.canvas.rows);
      }
      if (tamanoCeldaInput) {
        tamanoCeldaInput.value = String(state.canvas.cellSize);
      }

      const items = Array.isArray(data?.items) ? data.items : [];
      state.items = items
        .map((item) => ({
          id: item.id,
          nombre: item.nombre,
          tipo: item.tipo || (item.es_pasillo ? "PASILLO" : "ESTANTE"),
          nomenclatura: item.nomenclatura,
          fila: Number.parseInt(item.fila || 1, 10),
          columna: Number.parseInt(item.columna || 1, 10),
          ancho: Math.max(1, Number.parseInt(item.ancho ?? 1, 10) || 1),
          alto: Math.max(1, Number.parseInt(item.alto ?? 1, 10) || 1),
          es_pasillo: Boolean(item.es_pasillo),
        }))
        .sort((a, b) => (a.fila === b.fila ? a.columna - b.columna : a.fila - b.fila));

      const totalPasillos = state.items.filter((item) => item.es_pasillo).length;
      state.pasilloCounter = Math.max(totalPasillos + 1, state.pasilloCounter);

      renderGrid();
    } catch (error) {
      console.error(error);
      if (typeof swalErr === "function") {
        swalErr("No fue posible cargar la distribución seleccionada.");
      }
    } finally {
      setEstadoCargando(false);
    }
  }

  async function guardarDistribucion() {
    if (!state.bodegaId) return;
    setEstadoCargando(true);
    try {
      const payloadItems = state.items.map((item) => {
        if (item.es_pasillo) {
          return {
            id: Number.isInteger(item.id) ? item.id : null,
            es_pasillo: true,
            nombre: item.nombre || "Pasillo",
            fila: item.fila,
            columna: item.columna,
            ancho: Math.max(1, Number.parseInt(item.ancho, 10) || 1),
            alto: Math.max(1, Number.parseInt(item.alto, 10) || 1),
          };
        }

        return {
          ubicacion: item.id,
          fila: item.fila,
          columna: item.columna,
          ancho: Math.max(1, Number.parseInt(item.ancho, 10) || 1),
          alto: Math.max(1, Number.parseInt(item.alto, 10) || 1),
        };
      });

      const payload = {
        bodega: state.bodegaId,
        canvas: {
          rows: state.canvas.rows,
          cols: state.canvas.cols,
          cell_size: state.canvas.cellSize,
        },
        items: payloadItems,
      };

      const respuesta = await fetch(endpoints.distribucion, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken") || "",
        },
        body: JSON.stringify(payload),
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.json().catch(() => null);
        const mensaje = detalle?.detail || "No fue posible guardar la distribucion.";
        throw new Error(mensaje);
      }

      if (typeof swalToast === "function") {
        swalToast("success", "Distribucion guardada correctamente");
      }
    } catch (error) {
      console.error(error);
      if (typeof swalErr === "function") {
        swalErr(error.message);
      }
    } finally {
      setEstadoCargando(false);
    }
  }

  function manejarCambioColumnas() {
    const valor = Number.parseInt(columnasInput.value || "1", 10);
    const previo = state.canvas.cols;
    state.canvas.cols = Math.max(1, valor);
    reacomodarPorColumnas(previo);
    renderGrid();
  }

  function manejarCambioFilas() {
    const valor = Number.parseInt(filasInput.value || "1", 10);
    const minimo = Math.max(obtenerMaxFila(), Math.ceil(state.items.length / state.canvas.cols) || 1);
    state.canvas.rows = Math.max(minimo, valor);
    renderGrid();
  }

  function manejarCambioTamanoCelda() {
    const valor = Number.parseInt(tamanoCeldaInput.value || "120", 10);
    state.canvas.cellSize = Math.max(64, Math.min(240, valor));
    setCanvasVariables();
    renderGrid();
  }

  function eliminarPasillo(id) {
    const index = state.items.findIndex((item) => item.id === id && item.es_pasillo);
    if (index === -1) return;
    state.items.splice(index, 1);
    renderGrid();
  }

  async function editarPasillo(id) {
    const objetivo = state.items.find((item) => item.id === id && item.es_pasillo);
    if (!objetivo) return;
    const maxCols = Math.max(1, state.canvas.cols - objetivo.columna + 1);
    const maxRows = Math.max(1, state.canvas.rows - objetivo.fila + 1);

    if (typeof Swal === "undefined") {
      const anchoEntrada = window.prompt(
        "Indica el numero de columnas que debe ocupar el pasillo:",
        String(objetivo.ancho ?? 1),
      );
      if (anchoEntrada === null) return;
      const altoEntrada = window.prompt(
        "Indica el numero de filas que debe ocupar el pasillo:",
        String(objetivo.alto ?? 1),
      );
      if (altoEntrada === null) return;
      const nuevoAncho = Math.min(
        maxCols,
        Math.max(1, Number.parseInt(anchoEntrada, 10) || 1),
      );
      const nuevoAlto = Math.min(
        maxRows,
        Math.max(1, Number.parseInt(altoEntrada, 10) || 1),
      );
      objetivo.ancho = nuevoAncho;
      objetivo.alto = nuevoAlto;
      ajustarItemDentroDeCanvas(objetivo);
      renderGrid();
      return;
    }

    const { value } = await Swal.fire({
      title: `Ajustar ${objetivo.nombre || "pasillo"}`,
      html: `
        <div class="swal2-fieldset" style="display:flex;flex-direction:column;gap:0.5rem;">
          <label class="swal2-label" for="pasilloAncho">
            Ancho (columnas disponibles: ${maxCols})
          </label>
          <input
            id="pasilloAncho"
            class="swal2-input"
            type="number"
            min="1"
            max="${maxCols}"
            value="${objetivo.ancho ?? 1}"
          />
          <label class="swal2-label" for="pasilloAlto">
            Alto (filas disponibles: ${maxRows})
          </label>
          <input
            id="pasilloAlto"
            class="swal2-input"
            type="number"
            min="1"
            max="${maxRows}"
            value="${objetivo.alto ?? 1}"
          />
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Actualizar",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const anchoInput = document.getElementById("pasilloAncho");
        const altoInput = document.getElementById("pasilloAlto");
        const ancho = Number.parseInt(anchoInput?.value || "1", 10);
        const alto = Number.parseInt(altoInput?.value || "1", 10);
        if (Number.isNaN(ancho) || ancho < 1) {
          Swal.showValidationMessage("El ancho debe ser un entero positivo.");
          return false;
        }
        if (ancho > maxCols) {
          Swal.showValidationMessage(`El ancho maximo permitido es ${maxCols}.`);
          return false;
        }
        if (Number.isNaN(alto) || alto < 1) {
          Swal.showValidationMessage("El alto debe ser un entero positivo.");
          return false;
        }
        if (alto > maxRows) {
          Swal.showValidationMessage(`El alto maximo permitido es ${maxRows}.`);
          return false;
        }
        return { ancho, alto };
      },
    });

    if (!value) return;
    objetivo.ancho = value.ancho;
    objetivo.alto = value.alto;
    ajustarItemDentroDeCanvas(objetivo);
    renderGrid();
  }

  async function crearPasillo() {
    if (typeof Swal === "undefined") {
      const nombreManual = window.prompt("Nombre del pasillo:", `Pasillo ${state.pasilloCounter}`);
      if (!nombreManual) return;
      const anchoEntrada = window.prompt("Cuantas columnas debe ocupar el pasillo?", "1");
      if (anchoEntrada === null) return;
      const altoEntrada = window.prompt("Cuantas filas debe ocupar el pasillo?", "1");
      if (altoEntrada === null) return;
      agregarPasilloAlFinal(nombreManual, anchoEntrada, altoEntrada);
      return;
    }

    const maxColsCanvas = Math.max(1, state.canvas.cols);
    const maxRowsCanvas = Math.max(1, state.canvas.rows);

    const { value } = await Swal.fire({
      title: "Nuevo pasillo",
      html: `
        <div class="swal2-fieldset" style="display:flex;flex-direction:column;gap:0.5rem;">
          <label class="swal2-label" for="pasilloNombre">Nombre del pasillo</label>
          <input id="pasilloNombre" class="swal2-input" placeholder="Nombre del pasillo" value="Pasillo ${state.pasilloCounter}" />
          <label class="swal2-label" for="pasilloNuevoAncho">
            Ancho en columnas (maximo ${maxColsCanvas})
          </label>
          <input
            id="pasilloNuevoAncho"
            class="swal2-input"
            type="number"
            min="1"
            max="${maxColsCanvas}"
            value="1"
          />
          <label class="swal2-label" for="pasilloNuevoAlto">
            Alto en filas (maximo ${maxRowsCanvas})
          </label>
          <input
            id="pasilloNuevoAlto"
            class="swal2-input"
            type="number"
            min="1"
            max="${maxRowsCanvas}"
            value="1"
          />
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Crear",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const input = document.getElementById("pasilloNombre");
        const anchoInput = document.getElementById("pasilloNuevoAncho");
        const altoInput = document.getElementById("pasilloNuevoAlto");
        const nombre = input?.value?.trim() || "";
        if (!nombre) {
          Swal.showValidationMessage("Asigna un nombre al pasillo.");
          return false;
        }
        const ancho = Number.parseInt(anchoInput?.value || "1", 10);
        const alto = Number.parseInt(altoInput?.value || "1", 10);
        if (Number.isNaN(ancho) || ancho < 1) {
          Swal.showValidationMessage("El ancho debe ser un entero positivo.");
          return false;
        }
        if (ancho > maxColsCanvas) {
          Swal.showValidationMessage(`El ancho maximo permitido es ${maxColsCanvas}.`);
          return false;
        }
        if (Number.isNaN(alto) || alto < 1) {
          Swal.showValidationMessage("El alto debe ser un entero positivo.");
          return false;
        }
        if (alto > maxRowsCanvas) {
          Swal.showValidationMessage(`El alto maximo permitido es ${maxRowsCanvas}.`);
          return false;
        }
        return {
          nombre,
          ancho,
          alto,
        };
      },
    });

    if (!value) return;
    agregarPasilloAlFinal(value.nombre, value.ancho, value.alto);
  }

  function agregarPasilloAlFinal(nombre, ancho = 1, alto = 1) {
    const consecutivo = state.pasilloCounter;
    const tempId = `pasillo-temp-${Date.now()}-${consecutivo}`;
    state.pasilloCounter += 1;
    const index = findNextAvailableIndex(state.items.length);
    const { fila, columna } = indexToRowCol(index);
    const maxSpanCols = Math.max(1, state.canvas.cols - columna + 1);
    const maxSpanRows = Math.max(1, state.canvas.rows - fila + 1);
    const spanCols = Math.min(
      maxSpanCols,
      Math.max(1, Number.parseInt(ancho, 10) || 1),
    );
    const spanRows = Math.min(
      maxSpanRows,
      Math.max(1, Number.parseInt(alto, 10) || 1),
    );
    const nuevo = {
      id: tempId,
      nombre: nombre?.trim() || `Pasillo ${consecutivo}`,
      tipo: "PASILLO",
      fila,
      columna,
      ancho: spanCols,
      alto: spanRows,
      es_pasillo: true,
    };
    state.items.push(nuevo);
    ajustarItemDentroDeCanvas(nuevo);
    renderGrid();
  }

  selectorBodega.addEventListener("change", (event) => {
    const valor = event.target.value || "";
    cerrarDetalle();
    if (!valor) {
      state.bodegaId = null;
      state.items = [];
      renderGrid();
      guardarBtn.disabled = true;
      return;
    }
    cargarDistribucion(valor);
  });

  if (guardarBtn) {
    guardarBtn.addEventListener("click", guardarDistribucion);
  }
  if (columnasInput) {
    columnasInput.addEventListener("change", manejarCambioColumnas);
  }
  if (filasInput) {
    filasInput.addEventListener("change", manejarCambioFilas);
  }
  if (tamanoCeldaInput) {
    tamanoCeldaInput.addEventListener("input", manejarCambioTamanoCelda);
  }
  if (agregarPasilloBtn) {
    agregarPasilloBtn.addEventListener("click", crearPasillo);
  }
  if (offcanvas) {
    offcanvas.addEventListener("click", (event) => {
      const objetivo = event.target.closest("[data-action='close']");
      if (objetivo) {
        event.preventDefault();
        cerrarDetalle();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && offcanvas?.classList.contains("is-visible")) {
      cerrarDetalle();
    }
  });

  renderGrid();
})();
