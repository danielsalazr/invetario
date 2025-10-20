(() => {
  const config = window.ubicacionesConfig || {};
  const ubicacionesEndpoint =
    config.endpoints?.ubicaciones || "/inventario/ubicaciones/api/";

  const mapaWrapper = document.querySelector("#mapaFisico");
  const emptyState = document.querySelector("#mapaEmptyState");
  const selectorBodega = document.querySelector("#selectorBodega");
  const mapaResumen = document.querySelector("#mapaResumen");
  const viewButtons = Array.from(
    document.querySelectorAll(".map-view-button"),
  );
  const offcanvas = document.querySelector("#detalleInventario");
  const offcanvasPanel = document.querySelector("#detalleInventarioPanel");
  const offcanvasBody = document.querySelector("#detalleInventarioBody");
  const offcanvasTitle = document.querySelector("#detalleInventarioTitle");
  const offcanvasSubtitle = document.querySelector("#detalleInventarioSubtitle");
  const offcanvasEmpty = document.querySelector("#detalleInventarioEmpty");
  const offcanvasDefaultTitle =
    offcanvasTitle?.textContent || "Detalle de inventario";
  const offcanvasDefaultSubtitle =
    offcanvasSubtitle?.textContent ||
    "Selecciona un estante o estiba para ver los artículos registrados en sus ubicaciones.";

  if (!mapaWrapper) {
    return;
  }

  const state = {
    bodegasCatalogo: new Map(),
    bodegasAgrupadas: new Map(),
    seleccionada: null,
    viewMode: "detallada",
    detalleSeleccionadoId: null,
    detalleCache: new Map(),
    detalleRequestToken: 0,
  };

  const BULLET = " \u00B7 ";

  const TIPOS_BASE = new Set(["ESTANTE", "ESTIBA"]);

  const numberFormatter = new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  function esTipoNivelBase(tipo) {
    return TIPOS_BASE.has(tipo);
  }

  function actualizarViewButtons() {
    if (!viewButtons.length) return;
    viewButtons.forEach((button) => {
      const objetivo = button.dataset.view || "";
      const activo = objetivo === state.viewMode;
      button.classList.toggle("is-active", activo);
      button.setAttribute("aria-pressed", activo ? "true" : "false");
    });
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

  function resolverDetalleUrl(ubicacionId) {
    const base = config.endpoints?.inventarioDetalle;
    if (!base) {
      return null;
    }
    const idStr = String(ubicacionId);
    try {
      const url = new URL(base, window.location.origin);
      url.pathname = url.pathname.replace(
        /\/0(?=\/inventario\/detalle\/?$)/,
        `/${idStr}`,
      );
      return url.toString();
    } catch (error) {
      if (base.includes("/0/")) {
        return base.replace("/0/", `/${idStr}/`);
      }
      if (base.endsWith("/0")) {
        return `${base.slice(0, -2)}/${idStr}`;
      }
      return `${base}${idStr}/`;
    }
  }

  function formatearCantidad(valor) {
    const numero = Number(valor) || 0;
    return numberFormatter.format(numero);
  }

  function marcarSeleccionCard(id) {
    if (!mapaWrapper) return;
    const tarjetas = mapaWrapper.querySelectorAll(".estante-card.is-interactive");
    tarjetas.forEach((card) => {
      const cardId = normalizarId(card.dataset.id);
      const seleccionado = id != null && cardId === id;
      card.classList.toggle("is-selected", seleccionado);
      if (seleccionado) {
        card.setAttribute("aria-pressed", "true");
      } else {
        card.removeAttribute("aria-pressed");
      }
    });
  }

  function toggleOffcanvas(mostrar) {
    if (!offcanvas) return;
    offcanvas.classList.toggle("is-visible", mostrar);
    offcanvas.setAttribute("aria-hidden", mostrar ? "false" : "true");
    if (mostrar) {
      document.body.classList.add("offcanvas-open");
      offcanvasPanel?.focus?.();
    } else {
      document.body.classList.remove("offcanvas-open");
    }
  }

  function mostrarDetalleMensaje(texto) {
    if (!offcanvasBody) return;
    offcanvasBody.innerHTML = "";
    const mensaje = document.createElement("div");
    mensaje.className = "offcanvas-empty";
    mensaje.textContent = texto;
    offcanvasBody.appendChild(mensaje);
  }

  function cerrarDetalle() {
    state.detalleSeleccionadoId = null;
    marcarSeleccionCard(null);
    if (offcanvasTitle) {
      offcanvasTitle.textContent = offcanvasDefaultTitle;
    }
    if (offcanvasSubtitle) {
      offcanvasSubtitle.textContent = offcanvasDefaultSubtitle;
    }
    if (offcanvasBody) {
      offcanvasBody.innerHTML = "";
      if (offcanvasEmpty) {
        const clone = offcanvasEmpty.cloneNode(true);
        clone.id = "";
        offcanvasBody.appendChild(clone);
      } else {
        mostrarDetalleMensaje(offcanvasDefaultSubtitle);
      }
    }
    toggleOffcanvas(false);
  }

  function crearPill(contenido) {
    const pill = document.createElement("span");
    pill.className = "offcanvas-pill";
    pill.textContent = contenido;
    return pill;
  }

  function renderDetalleInventario(data) {
    if (!offcanvasBody) return;
    if (!data || typeof data !== "object") {
      mostrarDetalleMensaje("No hay información disponible para esta ubicación.");
      return;
    }

    const { ubicacion, totales, alcance, items } = data;
    const nombre = ubicacion?.nombre || "Ubicación";
    const ruta = ubicacion?.ruta || "";
    const bodegaNombre = ubicacion?.bodega?.nombre || "";

    if (offcanvasTitle) {
      offcanvasTitle.textContent = nombre;
    }

    if (offcanvasSubtitle) {
      const partes = [];
      if (bodegaNombre) {
        partes.push(`Bodega ${bodegaNombre}`);
      }
      if (ruta && ruta !== nombre) {
        partes.push(ruta);
      }
      offcanvasSubtitle.textContent = partes.length
        ? partes.join(BULLET)
        : offcanvasDefaultSubtitle;
    }

    offcanvasBody.innerHTML = "";

    const resumen = document.createElement("div");
    resumen.className = "offcanvas-summary";
    const lista = document.createElement("div");
    lista.className = "offcanvas-summary-list";
    lista.appendChild(
      crearPill(
        `${alcance?.ubicaciones ?? 1} ${Number(alcance?.ubicaciones ?? 1) === 1 ? "ubicación" : "ubicaciones"}`,
      ),
    );
    lista.appendChild(
      crearPill(
        `${totales?.registros ?? 0} ${Number(totales?.registros ?? 0) === 1 ? "registro" : "registros"}`,
      ),
    );

    const totalesUnidad = Array.isArray(totales?.por_unidad)
      ? totales.por_unidad
      : [];
    totalesUnidad.forEach((detalle) => {
      const cantidad = formatearCantidad(detalle?.cantidad ?? 0);
      const unidad = detalle?.unidad || "Sin unidad";
      lista.appendChild(crearPill(`${cantidad} ${unidad}`));
    });

    resumen.appendChild(lista);
    offcanvasBody.appendChild(resumen);

    if (!items || !items.length) {
      const mensaje = document.createElement("div");
      mensaje.className = "offcanvas-empty";
      mensaje.textContent =
        "No hay inventario registrado en esta ubicación ni en sus descendientes.";
      offcanvasBody.appendChild(mensaje);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "offcanvas-table-wrapper";
    const tabla = document.createElement("table");
    tabla.className = "offcanvas-table";
    tabla.innerHTML = `
      <thead>
        <tr>
          <th>Ubicación</th>
          <th>Nomenclatura</th>
          <th>Artículo</th>
          <th>Cantidad</th>
          <th>Unidad</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement("tbody");

    items.forEach((item) => {
      const fila = document.createElement("tr");
      const ubicacionItem = item?.ubicacion || {};
      const articulo = item?.articulo || {};
      const nombreUbicacion = escaparHtml(ubicacionItem.nombre || "Ubicación");
      const tipoUbicacion =
        ubicacionItem.tipo_display || ubicacionItem.tipo || "";
      const detalleUbicacion = escaparHtml(tipoUbicacion);
      const nomenclatura = escaparHtml(ubicacionItem.nomenclatura || "-");
      const articuloNombre = escaparHtml(
        articulo.descripcion || "Artículo sin descripción",
      );
      const articuloMarca = escaparHtml(articulo.marca || "");
      const cantidad = formatearCantidad(item?.cantidad ?? 0);
      const unidad = escaparHtml(item?.unidad || "Sin unidad");

      fila.innerHTML = `
        <td>
          ${nombreUbicacion}
          ${
            detalleUbicacion
              ? `<small>${detalleUbicacion}</small>`
              : ""
          }
        </td>
        <td>${nomenclatura}</td>
        <td>
          ${articuloNombre}
          ${
            articuloMarca
              ? `<small>${articuloMarca}</small>`
              : ""
          }
        </td>
        <td class="offcanvas-highlight">${cantidad}</td>
        <td>${unidad}</td>
      `;
      tbody.appendChild(fila);
    });

    tabla.appendChild(tbody);
    wrapper.appendChild(tabla);
    offcanvasBody.appendChild(wrapper);
  }

  async function mostrarDetalleUbicacion(nodo) {
    if (!nodo) return;
    const ubicacionId = normalizarId(nodo.id);
    if (ubicacionId == null) {
      return;
    }
    state.detalleSeleccionadoId = ubicacionId;
    marcarSeleccionCard(ubicacionId);
    toggleOffcanvas(true);
    mostrarDetalleMensaje("Cargando inventario de la ubicación seleccionada...");

    const cache = state.detalleCache.get(ubicacionId);
    if (cache) {
      renderDetalleInventario(cache);
      return;
    }

    const url = resolverDetalleUrl(ubicacionId);
    if (!url) {
      mostrarDetalleMensaje(
        "No se encontró la ruta para consultar el inventario de esta ubicación.",
      );
      return;
    }

    state.detalleRequestToken += 1;
    const requestToken = state.detalleRequestToken;

    try {
      const respuesta = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!respuesta.ok) {
        throw new Error("No fue posible obtener la información de inventario.");
      }
      const data = await respuesta.json();
      if (state.detalleRequestToken !== requestToken) {
        return;
      }
      state.detalleCache.set(ubicacionId, data);
      renderDetalleInventario(data);
    } catch (error) {
      console.error(error);
      if (state.detalleRequestToken !== requestToken) {
        return;
      }
      mostrarDetalleMensaje(
        error.message ||
          "No fue posible cargar la información de inventario de la ubicación seleccionada.",
      );
    }
  }

  function transformarNodo(nodo, padreId = null) {
    if (!nodo || typeof nodo !== "object") {
      return null;
    }
    const hijos = Array.isArray(nodo.hijos) ? nodo.hijos : [];
    const id = normalizarId(nodo.id);
    const bodegaId = normalizarId(nodo.bodega);
    return {
      ...nodo,
      id,
      bodega: bodegaId,
      padre: padreId,
      hijos: hijos
        .map((hijo) => transformarNodo(hijo, id))
        .filter(Boolean),
    };
  }

  function recolectarEstantes(nodos) {
    const estantes = [];
    const recorrer = (lista) => {
      lista.forEach((nodo) => {
        if (!nodo) return;
        if (esTipoNivelBase(nodo.tipo)) {
          estantes.push(nodo);
        }
        if (Array.isArray(nodo.hijos) && nodo.hijos.length) {
          recorrer(nodo.hijos);
        }
      });
    };
    recorrer(nodos);
    return estantes;
  }

  function agruparPorBodega(estantes) {
    const map = new Map();
    estantes.forEach((estante) => {
      const bodegaId = normalizarId(estante.bodega);
      const nombre =
        estante.bodega_nombre ||
        state.bodegasCatalogo.get(bodegaId) ||
        "Bodega sin nombre";
      if (!map.has(bodegaId)) {
        map.set(bodegaId, {
          id: bodegaId,
          nombre,
          estantes: [],
        });
      }
      map.get(bodegaId).estantes.push(estante);
    });
    return map;
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

    contenedores.slice().sort(ordenarUbicaciones).forEach((contenedor) => {
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
    titulo.innerHTML = `<span>${nombre}</span><span>${escaparHtml(
      String(codigo),
    )}</span>`;

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
    if (tipo) {
      level.classList.add(`shelf-level--${String(tipo).toLowerCase()}`);
    }

    const board = document.createElement("div");
    board.className = "shelf-board";
    if (tipo) {
      board.classList.add(`shelf-board--${String(tipo).toLowerCase()}`);
    }

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
    } else {
      if (!body.childElementCount && !body.textContent.trim()) {
        body.classList.add("shelf-level-body--empty");
        body.textContent = "Sin contenedores registrados.";
      }
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
  const etiqueta =
    panel.numero != null ? String(panel.numero) : "Nivel";

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

  function prepararCardInteraccion(card, nodo) {
    if (!card || !nodo) {
      return card;
    }
    const id = normalizarId(nodo.id);
    if (id == null) {
      return card;
    }
    card.dataset.id = String(id);
    card.dataset.tipo = nodo.tipo || "";
    card.classList.add("is-interactive");
    if (!card.hasAttribute("role")) {
      card.setAttribute("role", "button");
    }
    card.tabIndex = 0;
    if (state.detalleSeleccionadoId === id) {
      card.classList.add("is-selected");
      card.setAttribute("aria-pressed", "true");
    }

    const activar = (event) => {
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      mostrarDetalleUbicacion(nodo);
    };

    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea")) {
        return;
      }
      activar(event);
    });

    card.addEventListener("keydown", activar);
    return card;
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
    return prepararCardInteraccion(card, estiba);
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
        contenedoresEnPaneles += filtrarPorTipo(
          division,
          "CONTENEDOR",
        ).length;
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
    titulo.innerHTML = `${escaparHtml(nombreBase)} <small>${escaparHtml(
      codigo,
    )}</small>`;

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
    return prepararCardInteraccion(card, estiba);
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
    return prepararCardInteraccion(card, estante);
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

    return prepararCardInteraccion(card, estante);
  }

  function dividirEnFilas(lista, tamano = 10) {
    const filas = [];
    for (let i = 0; i < lista.length; i += tamano) {
      filas.push(lista.slice(i, i + tamano));
    }
    return filas;
  }

  function construirBodegaVista(bodega, viewMode = "detallada") {
    const card = document.createElement("article");
    card.className = "bodega-card";

    const header = document.createElement("header");
    const titulo = document.createElement("h2");
    titulo.textContent = bodega.nombre || "Bodega";
    const resumen = document.createElement("span");
    resumen.textContent = `${bodega.estantes.length} ${
      bodega.estantes.length === 1 ? "estante/estiba" : "estantes/estibas"
    }`;
    header.appendChild(titulo);
    header.appendChild(resumen);
    card.appendChild(header);

    const contenido = document.createElement("div");
    contenido.className = "bodega-content";

    const estantesOrdenados = bodega.estantes
      .slice()
      .sort(ordenarUbicaciones);

    if (!estantesOrdenados.length) {
      const vacio = document.createElement("div");
      vacio.className = "shelf-empty";
      vacio.textContent = "Esta bodega no tiene ubicaciones de nivel 1 configuradas todavia.";
      contenido.appendChild(vacio);
    } else {
      const grid = document.createElement("div");
      grid.className = "estante-grid";
      grid.dataset.view = viewMode;
      const construirEstantePorVista =
        viewMode === "general" ? construirEstanteGeneral : construirEstante;
      const filas = dividirEnFilas(estantesOrdenados, 10);
      filas.forEach((fila) => {
        const row = document.createElement("div");
        row.className = "estante-row";
        row.dataset.columns = String(Math.min(fila.length, 10));
        fila.forEach((estante) => {
          row.appendChild(construirEstantePorVista(estante));
        });
        grid.appendChild(row);
      });
      contenido.appendChild(grid);
    }

    card.appendChild(contenido);
    return card;
  }

  function actualizarResumen(bodega) {
    if (!mapaResumen) return;
    if (!bodega) {
      mapaResumen.style.display = "none";
      mapaResumen.textContent = "";
      return;
    }

    let panelesTotal = 0;
    let divisionesTotal = 0;
    let contenedoresTotal = 0;

    bodega.estantes.forEach((estante) => {
      const datos = calcularResumenEstante(estante);
      panelesTotal += datos.panelesCantidad;
      divisionesTotal += datos.divisionesCantidad;
      contenedoresTotal += datos.contenedoresCantidad;
    });

    mapaResumen.innerHTML = `
      <strong>${escaparHtml(bodega.nombre || "Bodega")}</strong>${BULLET}
      ${bodega.estantes.length} ${
        bodega.estantes.length === 1 ? "estante/estiba" : "estantes/estibas"
      }${BULLET}
      ${panelesTotal} ${panelesTotal === 1 ? "panel" : "paneles"}${BULLET}
      ${divisionesTotal} ${
        divisionesTotal === 1 ? "division" : "divisiones"
      }${BULLET}
      ${contenedoresTotal} ${
        contenedoresTotal === 1 ? "contenedor" : "contenedores"
      }
    `;
    mapaResumen.style.display = "flex";
  }

  function mostrarEmptyState(mensaje) {
    mapaWrapper.innerHTML = "";
    mapaWrapper.dataset.view = state.viewMode;
    if (emptyState) {
      emptyState.textContent = mensaje;
      emptyState.style.display = "block";
      mapaWrapper.appendChild(emptyState);
    }
    if (mapaResumen) {
      mapaResumen.style.display = "none";
      mapaResumen.textContent = "";
    }
  }

  function renderSeleccion() {
    if (!state.seleccionada || !state.bodegasAgrupadas.has(state.seleccionada)) {
      mostrarEmptyState("Selecciona una bodega para visualizar sus ubicaciones de nivel 1.");
      if (state.detalleSeleccionadoId != null) {
        cerrarDetalle();
      }
      return;
    }

    const bodega = state.bodegasAgrupadas.get(state.seleccionada);
    mapaWrapper.innerHTML = "";
    if (emptyState) {
      emptyState.style.display = "none";
    }
    mapaWrapper.dataset.view = state.viewMode;
    mapaWrapper.appendChild(construirBodegaVista(bodega, state.viewMode));
    actualizarResumen(bodega);

    if (state.detalleSeleccionadoId != null) {
      const selector = `.estante-card.is-interactive[data-id="${String(
        state.detalleSeleccionadoId,
      )}"]`;
      const cardSeleccionada = mapaWrapper.querySelector(selector);
      if (cardSeleccionada) {
        marcarSeleccionCard(state.detalleSeleccionadoId);
      } else {
        cerrarDetalle();
      }
    } else {
      marcarSeleccionCard(null);
    }
  }

  function poblarSelector(bodegasLista) {
    if (!selectorBodega) return;
    selectorBodega.innerHTML =
      '<option value="">Selecciona una bodega...</option>';
    bodegasLista.forEach((bodega) => {
      const option = document.createElement("option");
      option.value = bodega.id ?? "";
      option.textContent = `${bodega.nombre} (${bodega.estantes.length})`;
      selectorBodega.appendChild(option);
    });
  }

  if (selectorBodega) {
    selectorBodega.addEventListener("change", (event) => {
      const valor = event.target.value;
      state.seleccionada = valor ? normalizarId(valor) : null;
      state.detalleCache.clear();
      if (state.detalleSeleccionadoId != null) {
        cerrarDetalle();
      }
      renderSeleccion();
    });
  }

  if (viewButtons.length) {
    viewButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const objetivo = button.dataset.view;
        if (!objetivo || objetivo === state.viewMode) {
          return;
        }
        state.viewMode = objetivo;
        actualizarViewButtons();
        renderSeleccion();
      });
    });
  }

  async function cargarMapa() {
    mostrarEmptyState("Cargando mapa de ubicaciones fisicas...");
    state.detalleCache.clear();
    if (state.detalleSeleccionadoId != null) {
      cerrarDetalle();
    }
    try {
      const respuesta = await fetch(ubicacionesEndpoint, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!respuesta.ok) {
        throw new Error("No fue posible obtener las ubicaciones.");
      }
      const data = await respuesta.json();
      const bodegas = Array.isArray(data.bodegas) ? data.bodegas : [];
      state.bodegasCatalogo = new Map(
        bodegas.map((item) => [normalizarId(item.id), item.nombre]),
      );

      const ubicaciones = Array.isArray(data.ubicaciones)
        ? data.ubicaciones.map((nodo) => transformarNodo(nodo)).filter(Boolean)
        : [];

      const estantes = recolectarEstantes(ubicaciones);
      state.bodegasAgrupadas = agruparPorBodega(estantes);

      const listaOrdenada = Array.from(state.bodegasAgrupadas.values()).sort(
        (a, b) => (a.nombre || "").localeCompare(b.nombre || ""),
      );
      poblarSelector(listaOrdenada);

      if (listaOrdenada.length === 1) {
        const unico = listaOrdenada[0];
        state.seleccionada = normalizarId(unico.id);
        if (selectorBodega) {
          selectorBodega.value = unico.id ?? "";
        }
      }

      renderSeleccion();
    } catch (error) {
      console.error(error);
      mostrarEmptyState(
        "No fue posible cargar el mapa de ubicaciones fisicas.",
      );
    }
  }

  if (offcanvas) {
    offcanvas.addEventListener("click", (event) => {
      const accionCerrar = event.target.closest("[data-action='close']");
      if (accionCerrar) {
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

  actualizarViewButtons();
  cargarMapa();
})();







