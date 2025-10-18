(() => {
  const config = window.ubicacionesConfig || {};
  const endpoints = config.endpoints || {};
  const ubicacionesEndpoint =
    endpoints.ubicaciones || "/inventario/ubicaciones/api/";

  const treeWrapper = document.querySelector("#treeWrapper");
  const treeEmptyState = document.querySelector("#treeEmptyState");
  const treeElement = document.querySelector("#arbolUbicaciones");
  const buscarInput = document.querySelector("#buscarUbicacion");
  const limpiarBusquedaBtn = document.querySelector(
    "#limpiarBusquedaUbicacion",
  );
  const colapsarTodoBtn = document.querySelector("#colapsarTodoUbicaciones");
  const restaurarVistaBtn = document.querySelector(
    "#restaurarVistaUbicaciones",
  );

  const form = document.querySelector("#formUbicacion");
  const guardarBtn = document.querySelector("#guardarUbicacion");
  const limpiarBtn = document.querySelector("#limpiarFormulario");
  const bodegaSelect = document.querySelector("#bodega");
  const tipoSelect = document.querySelector("#tipo");
  const tipoHint = document.querySelector("#tipoHint");
  const padreInput = document.querySelector("#padre");
  const padreNombreInput = document.querySelector("#padreNombre");
  const padreHint = document.querySelector("#padreHint");
  const detallePanel = document.querySelector("#detalleUbicacion");

  const csrfToken =
    form.querySelector("[name=csrfmiddlewaretoken]")?.value ||
    document.querySelector("input[name=csrfmiddlewaretoken]")?.value ||
    "";

  const state = {
    arbol: [],
    tipos: [],
    tiposMap: {},
    bodegas: [],
    bodegasMap: new Map(),
    mapa: new Map(),
    seleccionado: null,
    filtro: "",
    expandedBodegas: new Set(),
    expandedEstantes: new Set(),
    previousExpansion: null,
    initialized: false,
  };

  const TIPOS_BASE = new Set(["ESTANTE", "ESTIBA"]);

  function esTipoNivelBase(tipo) {
    return TIPOS_BASE.has(tipo);
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

  function normalizarNodo(nodo, padreId = null) {
    const hijos = Array.isArray(nodo.hijos) ? nodo.hijos : [];
    const idNormalizado = normalizarId(nodo.id);
    const padreOrigen =
      nodo.padre !== undefined && nodo.padre !== null ? nodo.padre : padreId;
    const padreNormalizado =
      padreOrigen === null || padreOrigen === undefined
        ? null
        : normalizarId(padreOrigen);
    const bodegaNormalizada =
      nodo.bodega === null || nodo.bodega === undefined
        ? null
        : normalizarId(nodo.bodega);
    const normalizado = {
      ...nodo,
      id: idNormalizado,
      padre: padreNormalizado,
      bodega: bodegaNormalizada,
      hijos,
    };
    state.mapa.set(normalizado.id, normalizado);
    normalizado.hijos = hijos.map((hijo) =>
      normalizarNodo(hijo, normalizado.id),
    );
    return normalizado;
  }

  function reconstruirMapa(raices) {
    state.mapa.clear();
    return raices.map((nodo) => normalizarNodo(nodo));
  }

  function sincronizarExpansiones() {
    const bases = state.arbol.filter(
      (nodo) => nodo && esTipoNivelBase(nodo.tipo),
    );
    const baseIds = new Set(bases.map((nodo) => nodo.id));
    const bodegaIds = new Set(
      bases.map((nodo) => nodo.bodega).filter((id) => id !== undefined),
    );

    if (!state.initialized) {
      state.expandedEstantes = new Set(baseIds);
      state.expandedBodegas = new Set(bodegaIds);
      state.initialized = true;
      return;
    }

    const prevEstantes = new Set(state.expandedEstantes);
    state.expandedEstantes = new Set(
      [...prevEstantes].filter((id) => baseIds.has(id)),
    );
    if (!prevEstantes.size) {
      baseIds.forEach((id) => {
        state.expandedEstantes.add(id);
      });
    } else {
      baseIds.forEach((id) => {
        if (!prevEstantes.has(id)) {
          state.expandedEstantes.add(id);
        }
      });
    }

    const prevBodegas = new Set(state.expandedBodegas);
    state.expandedBodegas = new Set(
      [...prevBodegas].filter((id) => bodegaIds.has(id)),
    );
    if (!prevBodegas.size) {
      bodegaIds.forEach((id) => {
        state.expandedBodegas.add(id);
      });
    } else {
      bodegaIds.forEach((id) => {
        if (!prevBodegas.has(id)) {
          state.expandedBodegas.add(id);
        }
      });
    }
  }

  function actualizarBotonesColapso(totalEstantes = 0) {
    if (colapsarTodoBtn) {
      colapsarTodoBtn.disabled = totalEstantes === 0;
    }
    if (restaurarVistaBtn) {
      restaurarVistaBtn.disabled = !state.previousExpansion;
    }
  }

  function obtenerTipo(tipo) {
    return state.tiposMap[tipo] || null;
  }

  function esPadreValido(tipoSeleccionado, nodo) {
    if (!tipoSeleccionado) return false;
    const { padres_validos: padresValidos, permite_raiz: permiteRaiz } =
      tipoSeleccionado;

    if (!nodo) {
      return Boolean(permiteRaiz);
    }

    if (!padresValidos || !padresValidos.length) {
      return false;
    }

    return padresValidos.includes(nodo.tipo);
  }

  function construirHintTipo(tipoData) {
    if (!tipoData) {
      tipoHint.textContent = "";
      if (padreHint) {
        padreHint.textContent =
          "Los padres disponibles dependen del tipo seleccionado.";
      }
      return;
    }

    const { padres_validos: padresValidos, permite_raiz: permiteRaiz } =
      tipoData;

    if (!padresValidos.length && permiteRaiz) {
      tipoHint.textContent =
        "Este tipo solo se ubica en el nivel raíz de la bodega.";
      if (padreHint) {
        padreHint.textContent = "No necesitas seleccionar un padre.";
      }
      return;
    }

    if (!padresValidos.length) {
      tipoHint.textContent = "";
      if (padreHint) {
        padreHint.textContent =
          "Este tipo no admite padres disponibles actualmente.";
      }
      return;
    }

    const nombresPadres = padresValidos
      .map((codigo) => obtenerTipo(codigo)?.label || codigo.toLowerCase())
      .join(", ");

    const raizTexto = permiteRaiz ? " o sin padre" : "";
    tipoHint.textContent = `Debe pertenecer a: ${nombresPadres}${raizTexto}.`;
    if (padreHint) {
      padreHint.textContent = `Selecciona un nodo del árbol con tipo ${nombresPadres}${raizTexto}.`;
    }
  }

  function limpiarPadre() {
    padreInput.value = "";
    padreNombreInput.value = "";
  }

  function aplicarPadre(nodo) {
    const tipoSeleccionado = obtenerTipo(tipoSelect.value);
    if (!tipoSeleccionado) {
      padreHint.textContent =
        "Selecciona primero el tipo de ubicación para validar el padre.";
      return;
    }

    if (!nodo) {
      if (esPadreValido(tipoSeleccionado, null)) {
        limpiarPadre();
      } else {
        if (typeof swalErr === "function") {
          swalErr("El tipo seleccionado requiere un padre válido.");
        }
      }
      return;
    }

    if (!esPadreValido(tipoSeleccionado, nodo)) {
      if (typeof swalErr === "function") {
        swalErr(
          `El tipo "${tipoSeleccionado.label}" no puede pertenecer a "${nodo.tipo_display}".`,
        );
      }
      return;
    }

    padreInput.value = nodo.id;
    const codigo = nodo.nomenclatura || nodo.ruta || "";
    padreNombreInput.value = `${nodo.nombre} · ${codigo}`.trim();
  }

  function actualizarDetalle(nodo) {
    if (!detallePanel) return;

    if (!nodo) {
      detallePanel.innerHTML = `
        <div class="detail-empty">
          Selecciona una ubicación del árbol para ver sus detalles.
        </div>
      `;
      return;
    }

    const hijos = Array.isArray(nodo.hijos) ? nodo.hijos : [];
    const padre = nodo.padre ? state.mapa.get(nodo.padre) : null;
    const tipoSeleccionado = obtenerTipo(tipoSelect.value);
    const puedeSerPadre = esPadreValido(tipoSeleccionado, nodo);
    const nombreEscapado = escaparHtml(nodo.nombre);
    const numero = nodo.numero != null ? nodo.numero : "—";
    const tipoEscapado = escaparHtml(nodo.tipo_display);
    const nivel = nodo.nivel != null ? nodo.nivel : "—";
    const bodegaNombre = nodo.bodega_nombre || nodo.bodega || "";
    const bodegaEscapada = bodegaNombre ? escaparHtml(bodegaNombre) : "—";
    const rutaEscapada = nodo.ruta ? escaparHtml(nodo.ruta) : "—";
    const nomenclaturaEscapada =
      nodo.nomenclatura && nodo.nomenclatura !== ""
        ? escaparHtml(nodo.nomenclatura)
        : "—";
    const padreEscapado = padre ? escaparHtml(padre.nombre) : "—";
    const descripcionEscapada =
      nodo.descripcion && String(nodo.descripcion).trim().length
        ? escaparHtml(nodo.descripcion).replace(/\r?\n/g, "<br />")
        : "—";

    detallePanel.innerHTML = `
      <div class="detail-section">
        <div class="detail-row">
          <span>Nombre</span>
          <span><strong>${nombreEscapado}</strong></span>
        </div>
        <div class="detail-row">
          <span>Número</span>
          <span>${numero}</span>
        </div>
        <div class="detail-row">
          <span>Tipo</span>
          <span>${tipoEscapado}</span>
        </div>
        <div class="detail-row">
          <span>Nivel</span>
          <span>${nivel}</span>
        </div>
        <div class="detail-row">
          <span>Bodega</span>
          <span>${bodegaEscapada}</span>
        </div>
        <div class="detail-row">
          <span>Ruta</span>
          <span>${rutaEscapada}</span>
        </div>
        <div class="detail-row">
          <span>Nomenclatura</span>
          <span>${nomenclaturaEscapada}</span>
        </div>
        <div class="detail-row">
          <span>Padre</span>
          <span>${padreEscapado}</span>
        </div>
        <div class="detail-row">
          <span>Descripcion</span>
          <span>${descripcionEscapada}</span>
        </div>
        <div class="detail-row">
          <span>Hijos</span>
          <span>${hijos.length}</span>
        </div>
        <div class="detail-actions">
          ${
            puedeSerPadre
              ? `<button type="button" class="btn-secondary" id="usarComoPadre">
                   Usar como padre
                 </button>`
              : ""
          }
          <button type="button" class="btn-secondary" id="limpiarPadre">
            Quitar padre
          </button>
        </div>
      </div>
      <div class="physical-wrapper">
        <div class="physical-header">
          <span class="physical-title">Vista fisica</span>
          <span>Nivel 1 (Estante/Estiba) &gt; Panel &gt; Division &gt; Contenedor</span>
        </div>
        <div class="physical-canvas" id="vistaFisica"></div>
      </div>
    `;

    const usarComoPadreBtn =
      detallePanel.querySelector("#usarComoPadre");
    if (usarComoPadreBtn) {
      usarComoPadreBtn.addEventListener("click", () => aplicarPadre(nodo));
    }

    const limpiarPadreBtn =
      detallePanel.querySelector("#limpiarPadre");
    if (limpiarPadreBtn) {
      limpiarPadreBtn.addEventListener("click", () => limpiarPadre());
    }

    renderVistaFisica(nodo);
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

  function obtenerRutaIds(nodo) {
    const ids = new Set();
    let actual = nodo;
    while (actual) {
      ids.add(normalizarId(actual.id));
      if (!actual.padre) {
        break;
      }
      actual = state.mapa.get(normalizarId(actual.padre));
    }
    return ids;
  }

  function obtenerEstanteBase(nodo) {
    let actual = nodo;
    while (actual) {
      if (esTipoNivelBase(actual.tipo)) {
        return actual;
      }
      if (!actual.padre) {
        break;
      }
      actual = state.mapa.get(normalizarId(actual.padre));
    }
    return actual && esTipoNivelBase(actual.tipo) ? actual : null;
  }

  function construirContenedoresHtml(contenedores, rutaIds, seleccionadoId) {
    if (!contenedores || !contenedores.length) {
      return `<div class="physical-empty">Sin contenedores registrados.</div>`;
    }
    const ordenados = contenedores.slice().sort(ordenarUbicaciones);
    const html = ordenados
      .map((contenedor) => {
        const contId = normalizarId(contenedor.id);
        const esSeleccionado = contId === seleccionadoId;
        const enRuta = rutaIds.has(contId);
        const codigo =
          contenedor.nomenclatura && contenedor.nomenclatura !== ""
            ? contenedor.nomenclatura
            : contenedor.numero != null
              ? contenedor.numero
              : "";
        return `
          <div class="physical-container" data-selected="${esSeleccionado}" data-path="${enRuta}">
            <span>${escaparHtml(contenedor.nombre || "Contenedor")}</span>
            <span>${escaparHtml(codigo)}</span>
          </div>
        `;
      })
      .join("");
    return `<div class="physical-containers">${html}</div>`;
  }

  function renderVistaFisica(nodo) {
    const contenedor = detallePanel?.querySelector?.("#vistaFisica");
    if (!contenedor) return;

    if (!nodo) {
      contenedor.innerHTML = `
        <div class="physical-empty">
          Selecciona una ubicacion para visualizar su estructura fisica.
        </div>
      `;
      return;
    }

    const base = obtenerEstanteBase(nodo);
    if (!base) {
      contenedor.innerHTML = `
        <div class="physical-empty">
          Esta ubicacion no esta asociada a una ubicacion base (estante o estiba).
        </div>
      `;
      return;
    }

    const esEstibaBase = base.tipo === "ESTIBA";
    const etiquetaBase = esEstibaBase ? "estiba" : "estante";
    const articuloBase = esEstibaBase ? "La" : "El";
    const articuloBaseMin = esEstibaBase ? "la" : "el";

    const rutaIds = obtenerRutaIds(nodo);
    const seleccionadoId = normalizarId(nodo.id);
    const panelesFuente = Array.isArray(base.hijos)
      ? base.hijos.filter((hijo) => hijo.tipo === "PANEL")
      : [];
    const paneles = panelesFuente.slice().sort(ordenarUbicaciones);
    const contenedoresBase = Array.isArray(base.hijos)
      ? base.hijos.filter((hijo) => hijo.tipo === "CONTENEDOR")
      : [];

    let totalDivisiones = 0;
    let totalContenedores = contenedoresBase.length;

    const panelesOrdenados = paneles.slice().sort(ordenarUbicaciones).reverse();
    const panelesHtml = panelesOrdenados
      .map((panel) => {
        const panelId = normalizarId(panel.id);
        const esPanelSeleccionado = panelId === seleccionadoId;
        const panelEnRuta = rutaIds.has(panelId);
        const divisiones = Array.isArray(panel.hijos)
          ? panel.hijos.filter((hijo) => hijo.tipo === "DIVISION")
          : [];
        const contenedoresPanel = Array.isArray(panel.hijos)
          ? panel.hijos.filter((hijo) => hijo.tipo === "CONTENEDOR")
          : [];
        const divisionesOrdenadas = divisiones.slice().sort(ordenarUbicaciones);
        let divisionesHtml = "";
        totalDivisiones += divisionesOrdenadas.length;

        if (divisionesOrdenadas.length) {
          divisionesHtml = divisionesOrdenadas
            .map((division) => {
              const divisionId = normalizarId(division.id);
              const divisionSeleccionada = divisionId === seleccionadoId;
              const divisionEnRuta = rutaIds.has(divisionId);
              const contenedoresDivision = Array.isArray(division.hijos)
                ? division.hijos.filter((hijo) => hijo.tipo === "CONTENEDOR")
                : [];
              totalContenedores += contenedoresDivision.length;
              return `
                <div class="physical-division" data-selected="${divisionSeleccionada}" data-path="${divisionEnRuta}">
                  <div class="physical-division-title">
                    <span>${escaparHtml(division.nombre)}</span>
                    <span>${escaparHtml(division.nomenclatura || division.numero || "")}</span>
                  </div>
                  ${construirContenedoresHtml(contenedoresDivision, rutaIds, seleccionadoId)}
                </div>
              `;
            })
            .join("");
        }

        totalContenedores += contenedoresPanel.length;

        let cuerpoPanel = "";
        if (divisionesOrdenadas.length) {
          cuerpoPanel = `<div class="physical-divisions">${divisionesHtml}</div>`;
        } else if (contenedoresPanel.length) {
          cuerpoPanel = construirContenedoresHtml(
            contenedoresPanel,
            rutaIds,
            seleccionadoId,
          );
        } else {
          cuerpoPanel = `<div class="physical-empty">Sin divisiones ni contenedores registrados.</div>`;
        }

        return `
          <div class="physical-panel" data-selected="${esPanelSeleccionado}" data-path="${panelEnRuta}">
            <div class="physical-panel-title">
              <span>${escaparHtml(panel.nombre)}</span>
              <span>${escaparHtml(panel.nomenclatura || panel.numero || "")}</span>
            </div>
            ${cuerpoPanel}
          </div>
        `;
      })
      .join("");

    const totalPaneles = paneles.length;
    const resumenPartes = [];
    if (!esEstibaBase) {
      resumenPartes.push(
        `${totalPaneles} ${totalPaneles === 1 ? "panel" : "paneles"}`,
      );
      resumenPartes.push(
        `${totalDivisiones} ${totalDivisiones === 1 ? "division" : "divisiones"}`,
      );
    }
    resumenPartes.push(
      `${totalContenedores} ${totalContenedores === 1 ? "contenedor" : "contenedores"}`,
    );
    const resumen = `
      <div class="physical-summary">
        <strong>${escaparHtml(base.nombre)}</strong>
        <span>${resumenPartes.join(" &middot; ")}</span>
      </div>
    `;

    const directSection = contenedoresBase.length
      ? `<div class="physical-direct">
           <div class="physical-division-title">
             <span>Contenedores en ${articuloBaseMin} ${etiquetaBase}</span>
             <span>${escaparHtml(base.nomenclatura || base.numero || "")}</span>
           </div>
           ${construirContenedoresHtml(contenedoresBase, rutaIds, seleccionadoId)}
         </div>`
      : "";

    let contenidoPrincipal = "";
    if (paneles.length) {
      contenidoPrincipal = `<div class="physical-shelf">${panelesHtml}</div>${directSection}`;
    } else if (directSection) {
      contenidoPrincipal = directSection;
    } else {
      const mensajeBase = esEstibaBase
        ? `${articuloBase} ${etiquetaBase} aun no tiene contenedores asignados.`
        : `${articuloBase} ${etiquetaBase} aun no tiene paneles ni contenedores asignados.`;
      contenidoPrincipal = `<div class="physical-empty">
        ${mensajeBase}
      </div>`;
    }

    contenedor.innerHTML = resumen + contenidoPrincipal;
  }

  function obtenerNombreBodega(bodegaId, fallbackNombre = "") {
    if (bodegaId === null || bodegaId === undefined) {
      return fallbackNombre || "Sin bodega";
    }
    const clave = normalizarId(bodegaId);
    const registro = state.bodegasMap.get(clave);
    if (registro && registro.nombre) {
      return registro.nombre;
    }
    if (fallbackNombre) {
      return fallbackNombre;
    }
    return `Bodega ${clave}`;
  }

  function agruparRaicesPorBodega(nodos) {
    const mapa = new Map();
    nodos.forEach((nodo) => {
      if (!nodo) return;
      const clave =
        nodo.bodega === null || nodo.bodega === undefined
          ? null
          : nodo.bodega;
      if (!mapa.has(clave)) {
        const nombre = obtenerNombreBodega(clave, nodo.bodega_nombre);
        mapa.set(clave, { id: clave, nombre, nodos: [] });
      }
      mapa.get(clave).nodos.push(nodo);
    });
    return Array.from(mapa.values());
  }

  function crearNodoElemento(nodo, forceExpand = false) {
    const li = document.createElement("li");
    li.className = "tree-item";

    const nodeDiv = document.createElement("div");
    nodeDiv.className = "tree-node";
    nodeDiv.dataset.nodeId = nodo.id;
    const codigoLabel = nodo.nomenclatura || nodo.ruta || "";
    const numeroLabel =
      nodo.numero !== undefined && nodo.numero !== null && nodo.numero !== ""
        ? nodo.numero
        : "?";
    const hijosLabel = Array.isArray(nodo.hijos) ? nodo.hijos.length : 0;
    const esBase = esTipoNivelBase(nodo.tipo);
    const tieneHijos = hijosLabel > 0;
    const puedeContraer = esBase && tieneHijos;
    const estaExpandido =
      forceExpand || !puedeContraer || state.expandedEstantes.has(nodo.id);

    if (puedeContraer) {
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "tree-toggle";
      toggleBtn.textContent = estaExpandido ? "-" : "+";
      toggleBtn.setAttribute(
        "aria-label",
        `${estaExpandido ? "Colapsar" : "Expandir"} ${nodo.tipo_display} ${nodo.nombre}`,
      );
      toggleBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.expandedEstantes.has(nodo.id)) {
          state.expandedEstantes.delete(nodo.id);
        } else {
          state.expandedEstantes.add(nodo.id);
        }
        renderTree();
      });
      nodeDiv.appendChild(toggleBtn);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "tree-toggle-spacer";
      nodeDiv.appendChild(spacer);
    }

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent =
      nodo.nivel !== undefined && nodo.nivel !== null ? nodo.nivel : "-";
    nodeDiv.appendChild(badge);

    const infoContainer = document.createElement("div");
    infoContainer.className = "tree-node-info";

    const nombreStrong = document.createElement("strong");
    nombreStrong.textContent = `${numeroLabel} - ${nodo.nombre}`;
    infoContainer.appendChild(nombreStrong);

    const meta = document.createElement("div");
    meta.className = "tree-node-meta";
    meta.textContent = `${nodo.tipo_display} - ${codigoLabel}`;
    infoContainer.appendChild(meta);

    nodeDiv.appendChild(infoContainer);

    const hijosTexto = document.createElement("span");
    hijosTexto.className = "tag";
    const etiquetaHijos = hijosLabel === 1 ? "hijo" : "hijos";
    hijosTexto.textContent = `${hijosLabel} ${etiquetaHijos}`;
    nodeDiv.appendChild(hijosTexto);

    nodeDiv.dataset.expanded = estaExpandido ? "true" : "false";
    li.appendChild(nodeDiv);

    nodeDiv.addEventListener("click", () => {
      seleccionarNodo(nodo.id);
      const tipoSeleccionado = obtenerTipo(tipoSelect.value);
      if (tipoSeleccionado && esPadreValido(tipoSeleccionado, nodo)) {
        aplicarPadre(nodo);
      }
    });

    if (tieneHijos) {
      const hijosUl = document.createElement("ul");
      hijosUl.className = "tree tree-children";
      nodo.hijos.forEach((hijo) => {
        hijosUl.appendChild(crearNodoElemento(hijo, forceExpand));
      });
      if (!estaExpandido) {
        hijosUl.style.display = "none";
      }
      li.appendChild(hijosUl);
    }

    return li;
  }

  function crearBodegaElemento(grupo, forceExpand = false) {
    const li = document.createElement("li");
    li.className = "tree-bodega";

    const nodosGrupo = Array.isArray(grupo.nodos) ? grupo.nodos : [];
    const clave =
      grupo.id === null || grupo.id === undefined ? null : grupo.id;
    const estaExpandida =
      forceExpand || state.expandedBodegas.has(clave);

    const header = document.createElement("div");
    header.className = "tree-bodega-header";
    header.dataset.bodegaId = clave === null ? "null" : clave;
    header.dataset.expanded = estaExpandida ? "true" : "false";

    if (nodosGrupo.length) {
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "tree-toggle tree-toggle-bodega";
      toggleBtn.textContent = estaExpandida ? "-" : "+";
      toggleBtn.setAttribute(
        "aria-label",
        `${estaExpandida ? "Colapsar" : "Expandir"} bodega ${grupo.nombre}`,
      );
      toggleBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.expandedBodegas.has(clave)) {
          state.expandedBodegas.delete(clave);
        } else {
          state.expandedBodegas.add(clave);
        }
        renderTree();
      });
      header.appendChild(toggleBtn);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "tree-toggle-spacer";
      header.appendChild(spacer);
    }

    const title = document.createElement("div");
    title.className = "tree-bodega-title";
    const nombreStrong = document.createElement("strong");
    nombreStrong.textContent = grupo.nombre;
    title.appendChild(nombreStrong);
    header.appendChild(title);

    const cantidad = document.createElement("span");
    cantidad.className = "tag";
    const basesCount = nodosGrupo.filter(
      (nodo) => esTipoNivelBase(nodo.tipo),
    ).length;
    const total = nodosGrupo.length;
    let etiquetaCantidad;
    let cantidadMostrar;
    if (basesCount === total) {
      cantidadMostrar = basesCount;
      etiquetaCantidad = basesCount === 1 ? "estante/estiba" : "estantes/estibas";
    } else {
      cantidadMostrar = total;
      etiquetaCantidad = total === 1 ? "ubicacion" : "ubicaciones";
    }
    cantidad.textContent = `${cantidadMostrar} ${etiquetaCantidad}`;
    header.appendChild(cantidad);

    li.appendChild(header);

    if (nodosGrupo.length) {
      const lista = document.createElement("ul");
      lista.className = "tree tree-bodega-estantes";
      if (!estaExpandida) {
        lista.style.display = "none";
      }
      nodosGrupo.forEach((nodo) => {
        lista.appendChild(crearNodoElemento(nodo, forceExpand));
      });
      li.appendChild(lista);
    }

    return li;
  }

  function renderTree() {
    if (!treeElement || !treeWrapper) return;

    const filtroTerm = state.filtro.trim();
    const hayFiltro = filtroTerm.length > 0;
    const fuente = hayFiltro ? filtrarArbol(state.arbol, filtroTerm) : state.arbol;
    const grupos = agruparRaicesPorBodega(fuente);

    treeElement.innerHTML = "";
    if (!grupos.length) {
      treeEmptyState.style.display = "block";
      actualizarBotonesColapso(0);
      return;
    }

    let totalNodos = 0;
    grupos.forEach((grupo) => {
      const nodosGrupo = Array.isArray(grupo.nodos) ? grupo.nodos : [];
      if (!nodosGrupo.length) {
        return;
      }
      totalNodos += nodosGrupo.length;
      treeElement.appendChild(crearBodegaElemento(grupo, hayFiltro));
    });

    if (!totalNodos) {
      treeEmptyState.style.display = "block";
      actualizarBotonesColapso(0);
      return;
    }

    treeEmptyState.style.display = "none";
    actualizarBotonesColapso(totalNodos);
    resaltarSeleccion();
  }

  function expandirAncestros(nodo) {
    if (!nodo) return;
    const bodegaClave =
      nodo.bodega === null || nodo.bodega === undefined ? null : nodo.bodega;
    state.expandedBodegas.add(bodegaClave);

    let actual = nodo;
    while (actual) {
      if (esTipoNivelBase(actual.tipo)) {
        state.expandedEstantes.add(actual.id);
      }
      if (!actual.padre) break;
      actual = state.mapa.get(actual.padre);
    }
  }

  function resaltarSeleccion() {
    const nodos = treeElement.querySelectorAll("[data-node-id]");
    nodos.forEach((elemento) => {
      elemento.dataset.selected =
        state.seleccionado &&
        Number.parseInt(elemento.dataset.nodeId, 10) ===
          state.seleccionado.id
          ? "true"
          : "false";
    });
  }

  function seleccionarNodo(id, ensureVisible = false) {
    const nodo = state.mapa.get(normalizarId(id));
    state.seleccionado = nodo || null;

    if (ensureVisible && nodo) {
      expandirAncestros(nodo);
      renderTree();
    } else {
      resaltarSeleccion();
    }

    actualizarDetalle(state.seleccionado);
  }

  function filtrarArbol(nodos, termino) {
    const term = termino.trim().toLowerCase();
    if (!term) return nodos;

    const resultado = [];

    nodos.forEach((nodo) => {
      const hijosFiltrados = filtrarArbol(nodo.hijos || [], term);
      const coincide =
        nodo.nombre.toLowerCase().includes(term) ||
        (nodo.tipo_display || "").toLowerCase().includes(term) ||
        (nodo.ruta || "").toLowerCase().includes(term) ||
        (nodo.nomenclatura || "").toLowerCase().includes(term);

      if (coincide || hijosFiltrados.length) {
        resultado.push({
          ...nodo,
          hijos: coincide ? nodo.hijos : hijosFiltrados,
        });
      }
    });

    return resultado;
  }

  function colapsarTodo() {
    if (!state.arbol.length) return;
    state.previousExpansion = {
      bodegas: new Set(state.expandedBodegas),
      estantes: new Set(state.expandedEstantes),
    };
    state.expandedBodegas = new Set();
    state.expandedEstantes = new Set();
    renderTree();
  }

  function restaurarVista() {
    if (!state.previousExpansion) return;
    state.expandedBodegas = new Set(state.previousExpansion.bodegas);
    state.expandedEstantes = new Set(state.previousExpansion.estantes);
    state.previousExpansion = null;
    renderTree();
  }

  function poblarSelectTipos() {
    if (!tipoSelect) return;

    tipoSelect.innerHTML =
      '<option value="">Selecciona un tipo</option>';
    state.tipos.forEach((tipo) => {
      const option = document.createElement("option");
      option.value = tipo.value;
      option.textContent = `${tipo.label} · Nivel ${tipo.nivel}`;
      tipoSelect.appendChild(option);
    });
  }

  function poblarSelectBodegas() {
    if (!bodegaSelect) return;

    bodegaSelect.innerHTML =
      '<option value="">Selecciona una bodega</option>';
    state.bodegas.forEach((bodega) => {
      const option = document.createElement("option");
      option.value = bodega.id;
      option.textContent = bodega.nombre;
      bodegaSelect.appendChild(option);
    });
  }

  function setFormBusy(isBusy) {
    if (!guardarBtn) return;
    guardarBtn.disabled = isBusy;
    guardarBtn.textContent = isBusy
      ? "Guardando..."
      : "Guardar ubicación";
  }

  async function cargarDatos() {

    try {
      treeEmptyState.style.display = "block";
      treeEmptyState.textContent = "Cargando ubicaciones...";
      state.previousExpansion = null;
      actualizarBotonesColapso(0);

      const response = await fetch(ubicacionesEndpoint, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("No fue posible obtener las ubicaciones.");
      }

      const data = await response.json();
      state.tipos = Array.isArray(data.tipos) ? data.tipos : [];
      state.tiposMap = state.tipos.reduce((acc, tipo) => {
        acc[tipo.value] = tipo;
        return acc;
      }, {});
      state.bodegas = Array.isArray(data.bodegas)
        ? data.bodegas.map((bodega) => ({
            ...bodega,
            id: normalizarId(bodega.id),
          }))
        : [];
      state.bodegasMap = new Map(
        state.bodegas.map((bodega) => [bodega.id, bodega]),
      );

      const arbol = Array.isArray(data.ubicaciones)
        ? data.ubicaciones
        : [];
      state.arbol = reconstruirMapa(arbol);
      state.seleccionado = null;
      sincronizarExpansiones();
      state.previousExpansion = null;

      poblarSelectTipos();
      poblarSelectBodegas();
      construirHintTipo(null);
      renderTree();
      actualizarDetalle(null);
    } catch (error) {
      console.error(error);
      treeEmptyState.style.display = "block";
      treeEmptyState.textContent =
        "No fue posible cargar el árbol de ubicaciones.";
      state.previousExpansion = null;
      actualizarBotonesColapso(0);
      if (typeof swalErr === "function") {
        swalErr(
          "No fue posible cargar la información de ubicaciones. Intenta nuevamente.",
        );
      }
    }
  }

  async function guardarUbicacion(event) {
    event.preventDefault();
    setFormBusy(true);

    const formData = new FormData(form);
    if (!formData.get("padre")) {
      formData.delete("padre");
    }

    try {
      const response = await fetch(ubicacionesEndpoint, {
        method: "POST",
        headers: {
          "X-CSRFToken": csrfToken,
        },
        body: formData,
        credentials: "same-origin",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        let mensaje =
          errorData?.detail ||
          "No fue posible guardar la ubicación.";
        if (
          !errorData?.detail &&
          errorData &&
          typeof errorData === "object"
        ) {
          const detalles = Object.values(errorData)
            .flat()
            .map((item) => item?.toString?.() || "")
            .filter(Boolean);
          if (detalles.length) {
            mensaje = detalles.join(" ");
          }
        }
        throw new Error(mensaje);
      }

      const nodo = await response.json();
      await cargarDatos();
      seleccionarNodo(nodo.id, true);

      if (typeof swalToast === "function") {
        swalToast("success", "Ubicación creada correctamente");
      }

      form.reset();
      limpiarPadre();
      construirHintTipo(null);
    } catch (error) {
      console.error(error);
      if (typeof swalErr === "function") {
        swalErr(error.message);
      }
    } finally {
      setFormBusy(false);
    }
  }

  function limpiarFormulario() {
    form.reset();
    limpiarPadre();
    construirHintTipo(null);
  }

  function initEventos() {
    form.addEventListener("submit", guardarUbicacion);
    if (limpiarBtn) {
      limpiarBtn.addEventListener("click", limpiarFormulario);
    }

    if (tipoSelect) {
      tipoSelect.addEventListener("change", () => {
        const tipoSeleccionado = obtenerTipo(tipoSelect.value);
        construirHintTipo(tipoSeleccionado);

        if (!esPadreValido(tipoSeleccionado, state.seleccionado)) {
          limpiarPadre();
        }
        actualizarDetalle(state.seleccionado);
      });
    }

    if (buscarInput) {
      buscarInput.addEventListener("input", (event) => {
        state.filtro = event.target.value || "";
        renderTree();
      });
    }

    if (limpiarBusquedaBtn) {
      limpiarBusquedaBtn.addEventListener("click", () => {
        state.filtro = "";
        if (buscarInput) {
          buscarInput.value = "";
        }
        renderTree();
      });
    }

    if (colapsarTodoBtn) {
      colapsarTodoBtn.addEventListener("click", colapsarTodo);
    }

    if (restaurarVistaBtn) {
      restaurarVistaBtn.addEventListener("click", restaurarVista);
    }

    actualizarBotonesColapso(0);
  }

  initEventos();
  cargarDatos();
})();
