(() => {
  const config = window.ubicacionesConfig || {};
  const ubicacionesEndpoint =
    config.endpoints?.ubicaciones || "/inventario/ubicaciones/api/";

  const mapaWrapper = document.querySelector("#mapaFisico");
  const emptyState = document.querySelector("#mapaEmptyState");
  const selectorBodega = document.querySelector("#selectorBodega");
  const mapaResumen = document.querySelector("#mapaResumen");

  if (!mapaWrapper) {
    return;
  }

  const state = {
    bodegasCatalogo: new Map(),
    bodegasAgrupadas: new Map(),
    seleccionada: null,
  };

  const BULLET = " \u00B7 ";

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
        if (nodo.tipo === "ESTANTE") {
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
  }) {
    const level = document.createElement("div");
    level.className = "shelf-level";

    const board = document.createElement("div");
    board.className = "shelf-board";

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

    if (!body.childElementCount && !body.textContent.trim()) {
      body.classList.add("shelf-level-body--empty");
      body.textContent = "Sin contenedores registrados.";
    }

    board.appendChild(body);
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

  function construirEstante(estante) {
    const card = document.createElement("div");
    card.className = "estante-card";

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
    titulo.innerHTML = `${escaparHtml(estante.nombre || "Estante")} <small>${escaparHtml(
      codigo,
    )}</small>`;

    const resumen = document.createElement("div");
    resumen.className = "estante-summary";
    const datos = calcularResumenEstante(estante);
    resumen.textContent = `${datos.panelesCantidad} ${
      datos.panelesCantidad === 1 ? "panel" : "paneles"
    }${BULLET}${datos.divisionesCantidad} ${
      datos.divisionesCantidad === 1 ? "division" : "divisiones"
    }${BULLET}${datos.contenedoresCantidad} ${
      datos.contenedoresCantidad === 1 ? "contenedor" : "contenedores"
    }`;

    header.appendChild(titulo);
    header.appendChild(resumen);
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

    const niveles = document.createElement("div");
    niveles.className = "shelf-level-stack";

    const contenedoresEstante = filtrarPorTipo(estante, "CONTENEDOR");
    if (contenedoresEstante.length) {
      niveles.appendChild(construirNivelBase(estante, contenedoresEstante));
    }

    const panelesOrdenados = datos.paneles.slice().sort(ordenarUbicaciones);
    panelesOrdenados.forEach((panel) => {
      niveles.appendChild(construirNivelPanel(panel));
    });

    if (niveles.childElementCount) {
      frame.appendChild(niveles);
    } else {
      const vacio = document.createElement("div");
      vacio.className = "shelf-empty";
      vacio.textContent = "Sin paneles ni contenedores registrados.";
      frame.appendChild(vacio);
    }

    card.appendChild(frame);
    return card;
  }

  function dividirEnFilas(lista, tamano = 10) {
    const filas = [];
    for (let i = 0; i < lista.length; i += tamano) {
      filas.push(lista.slice(i, i + tamano));
    }
    return filas;
  }

  function construirBodegaVista(bodega) {
    const card = document.createElement("article");
    card.className = "bodega-card";

    const header = document.createElement("header");
    const titulo = document.createElement("h2");
    titulo.textContent = bodega.nombre || "Bodega";
    const resumen = document.createElement("span");
    resumen.textContent = `${bodega.estantes.length} ${
      bodega.estantes.length === 1 ? "estante" : "estantes"
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
      vacio.textContent = "Esta bodega no tiene estanterias configuradas todavia.";
      contenido.appendChild(vacio);
    } else {
      const grid = document.createElement("div");
      grid.className = "estante-grid";
      const filas = dividirEnFilas(estantesOrdenados, 10);
      filas.forEach((fila) => {
        const row = document.createElement("div");
        row.className = "estante-row";
        row.dataset.columns = String(Math.min(fila.length, 10));
        fila.forEach((estante) => {
          row.appendChild(construirEstante(estante));
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
        bodega.estantes.length === 1 ? "estante" : "estantes"
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
      mostrarEmptyState("Selecciona una bodega para visualizar sus estanterias.");
      return;
    }

    const bodega = state.bodegasAgrupadas.get(state.seleccionada);
    mapaWrapper.innerHTML = "";
    if (emptyState) {
      emptyState.style.display = "none";
    }
    mapaWrapper.appendChild(construirBodegaVista(bodega));
    actualizarResumen(bodega);
  }

  function poblarSelector(bodegasLista) {
    if (!selectorBodega) return;
    selectorBodega.innerHTML =
      '<option value="">Selecciona una bodega…</option>';
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
      renderSeleccion();
    });
  }

  async function cargarMapa() {
    mostrarEmptyState("Cargando mapa de ubicaciones fisicas...");
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

  cargarMapa();
})();
