(() => {
  const config = window.movimientoInventarioConfig;
  const claveModoBusqueda = `inventario::modoBusquedaArticulo::${config.operacion}`;
  const seleccionBodega = window.bodegaSeleccion.paraOperacion(config.operacion);
  const esPicking = config.operacion === "picking";
  const esTraslado = config.operacion === "trasladar";
  const requiereExistencias = esPicking || esTraslado;
  const form = document.querySelector("#formMovimientoStock");
  const articuloId = document.querySelector("#articuloStock");
  const ubicacionId = document.querySelector("#ubicacionStock");
  const bodegaSelect = document.querySelector("#bodegaStock");
  const bodegaButton = document.querySelector("#seleccionarBodegaStock");
  const bodegaStatus = document.querySelector("#estadoBodegaStock");
  const bodegaDestino = esTraslado ? bodegaSelect : null;
  const destinoId = document.querySelector("#destinoStock");
  let destinoLookup = null;
  const $ = window.jQuery;
  const hasSelect2 = Boolean($?.fn?.select2);
  const modos = [...document.querySelectorAll('[name="modoBusquedaArticulo"]')];
  const cantidadInput = document.querySelector("#cantidadStock");
  const guardar = document.querySelector("#registrarMovimientoStock");
  const resumen = document.querySelector("#existenciasStock");
  const tabla = document.querySelector("#tablaStock");
  const ruta = document.querySelector("#rutaStock");
  const mensaje = document.querySelector("#mensajeMovimiento");
  const articuloElegido = document.querySelector("#articuloElegidoStock");
  const ubicacionElegida = document.querySelector("#ubicacionElegidaStock");
  const csrf = form.querySelector("[name=csrfmiddlewaretoken]").value;
  const state = { articulos: [], ubicaciones: [], bodegas: [], loaded: false, busy: false, bodegaLocked: false, pendientes: [], editIndex: null };
  const modosTraslados = [...document.querySelectorAll('[name="modoTraslados"]')];
  const dialogoTraslado = document.querySelector("#dialogoMovimientoTraslado");
  const modoTabla = () => esTraslado && modosTraslados.some((item) => item.checked && item.value === "tabla");
  const normalizar = (texto) => String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const modo = () => modos.find((item) => item.checked).value;

  // Combobox editable: escribir no equivale a confirmar una seleccion.
  class Autocompletado {
    constructor(options) {
      Object.assign(this, options);
      this.selected = null;
      this.results = [];
      this.active = -1;
      this.input.addEventListener("input", () => {
        this.selected = null;
        this.input.setCustomValidity("Busca y selecciona una opcion de la lista.");
        this.onClear();
        if (this.automatico() && this.canSearch(this.input.value)) this.search(false);
        else {
          this.close();
          this.hint.textContent = this.instruccion();
        }
        this.syncButton();
      });
      this.input.addEventListener("focus", () => {
        if (!this.selected && this.canSearch(this.input.value) && this.automatico()) this.search(false);
      });
      this.input.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
          if (!event.shiftKey && !this.selected && this.canSearch(this.input.value)) this.search(true);
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (!this.list.hidden && this.active >= 0) this.select(this.results[this.active]);
          else this.search(true);
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (this.list.hidden) this.search(false);
          if (!this.results.length || this.list.hidden) return;
          this.active = this.active < 0
            ? event.key === "ArrowDown" ? 0 : this.results.length - 1
            : (this.active + (event.key === "ArrowDown" ? 1 : -1) + this.results.length) % this.results.length;
          [...this.list.children].forEach((item, index) => item.setAttribute("aria-selected", String(index === this.active)));
          const opcion = this.list.children[this.active];
          this.input.setAttribute("aria-activedescendant", opcion.id);
          opcion.scrollIntoView({ block: "nearest" });
        } else if (event.key === "Escape") {
          if (!this.list.hidden) {
            event.preventDefault();
            this.close();
          }
        }
      });
      this.button.addEventListener("click", () => {
        this.search(true);
        if (!this.selected) this.input.focus();
      });
      this.wrapper.addEventListener("focusout", (event) => {
        if (!this.wrapper.contains(event.relatedTarget)) this.close();
      });
    }

    syncButton() {
      this.button.disabled = this.input.disabled || Boolean(this.selected) || !this.canSearch(this.input.value);
    }

    setDisabled(disabled) {
      this.input.disabled = disabled;
      if (disabled) this.close();
      this.syncButton();
    }

    close() {
      this.list.hidden = true;
      this.active = -1;
      this.input.setAttribute("aria-expanded", "false");
      this.input.removeAttribute("aria-activedescendant");
    }

    clear(notify = true) {
      this.selected = null;
      this.results = [];
      this.list.replaceChildren();
      this.input.value = "";
      this.hint.textContent = this.instruccion();
      this.input.setCustomValidity("");
      this.close();
      this.syncButton();
      if (notify) this.onClear();
    }

    select(item, notify = true) {
      this.selected = item;
      this.input.value = this.format(item).label;
      this.input.setCustomValidity("");
      this.close();
      this.syncButton();
      if (notify) this.onSelect(item);
    }

    search(confirmar) {
      if (this.input.disabled || this.selected) return;
      if (!this.canSearch(this.input.value)) {
        this.close();
        this.hint.textContent = this.instruccion();
        return;
      }
      this.results = this.find(this.input.value);
      if (confirmar && this.results.length === 1) {
        this.select(this.results[0]);
        return;
      }
      this.list.replaceChildren();
      this.active = -1;
      this.input.removeAttribute("aria-activedescendant");
      if (!this.results.length) {
        const vacio = document.createElement("li");
        vacio.setAttribute("role", "presentation");
        vacio.textContent = "No se encontraron coincidencias.";
        this.list.appendChild(vacio);
      }
      this.results.forEach((item, index) => {
        const datos = this.format(item);
        const opcion = document.createElement("li");
        opcion.id = `${this.list.id}-${index}`;
        opcion.setAttribute("role", "option");
        opcion.setAttribute("aria-selected", "false");
        const titulo = document.createElement("strong");
        titulo.textContent = datos.label;
        const detalle = document.createElement("small");
        detalle.textContent = datos.detail;
        opcion.append(titulo, detalle);
        opcion.addEventListener("mousedown", (event) => event.preventDefault());
        opcion.addEventListener("click", () => this.select(item));
        this.list.appendChild(opcion);
      });
      this.list.hidden = false;
      this.input.setAttribute("aria-expanded", "true");
      this.hint.textContent = this.results.length
        ? `${this.results.length} resultado(s). Usa las flechas y Enter o selecciona una opcion.`
        : "No hay resultados para esta busqueda.";
    }
  }

  function informar(texto, tipo = "error") {
    mensaje.textContent = texto;
    mensaje.dataset.type = tipo;
  }

  async function pedir(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const data = await response.json();
    if (!response.ok) {
      const describir = (valor) => Array.isArray(valor) ? valor.map(describir).join(" ")
        : valor && typeof valor === "object" ? Object.entries(valor).map(([key, value]) => `${key}: ${describir(value)}`).join(". ") : String(valor);
      throw new Error(describir(data.detail || data) || "No fue posible completar la operacion.");
    }
    return data;
  }

  const articuloActual = () => state.articulos.find((item) => String(item.code) === articuloId.value);
  const ubicacionActual = () => state.ubicaciones.find((item) => String(item.id) === ubicacionId.value);
  function disponible(ubicacion) {
    const articulo = articuloActual();
    let saldo = (articulo?.inventario || [])
      .filter((registro) => Number(registro.ubicacion?.id) === Number(ubicacion.id))
      .reduce((total, registro) => total + registro.cantidad, 0);
    if (modoTabla()) {
      const filas = state.editIndex === null ? state.pendientes : state.pendientes.slice(0, state.editIndex);
      filas.filter((item) => item.articulo === articulo?.code).forEach((item) => {
        if (item.origen === ubicacion.id) saldo -= item.cantidad;
        if (item.destino === ubicacion.id) saldo += item.cantidad;
      });
    }
    return saldo;
  }
  function ubicacionesPermitidas(filtrarBodega = true) {
    if (!articuloActual() || !state.bodegaLocked) return [];
    return state.ubicaciones.filter((item) => (!requiereExistencias || disponible(item) > 0)
      && (esTraslado || !filtrarBodega || !bodegaSelect.value || String(item.bodega) === bodegaSelect.value));
  }
  function etiquetaUbicacion(item) {
    return `${item.codigo_contenedor || item.nomenclatura || item.id} · ${item.bodega_nombre} · ${item.ruta}`;
  }
  function limpiarUbicacion() {
    ubicacionId.value = "";
    ubicacionLookup.clear(false);
    ubicacionElegida.textContent = "";
    cantidadInput.value = 1;
    limpiarDestino();
  }
  function limpiarDestino() {
    if (!esTraslado) return;
    destinoId.value = "";
    destinoLookup?.clear(false);
  }
  function destinosPermitidos() {
    return state.ubicaciones.filter((item) => String(item.bodega) === bodegaDestino.value && String(item.id) !== ubicacionId.value);
  }

  const articuloLookup = new Autocompletado({
    wrapper: document.querySelector("#lookupArticuloStock"),
    input: document.querySelector("#buscarArticuloStock"),
    list: document.querySelector("#opcionesArticuloStock"),
    button: document.querySelector("#buscarArticuloStockBtn"),
    hint: document.querySelector("#ayudaArticuloStock"),
    automatico: () => modo() === "descripcion",
    instruccion: () => modo() === "id" ? "Escribe un ID y pulsa Buscar, Enter o Tab." : "Escribe al menos 3 caracteres. Buscar, Enter o Tab confirman un resultado unico.",
    canSearch: (texto) => modo() === "id" ? /^\d+$/.test(texto.trim()) && Number.isSafeInteger(Number(texto)) && Number(texto) > 0 : normalizar(texto).length >= 3,
    find: (texto) => state.articulos.filter((item) => modo() === "id" ? Number(item.code) === Number(texto) : normalizar(item.descripcion).includes(normalizar(texto))),
    format: (item) => ({ label: `${item.code} · ${item.descripcion}`, detail: `${item.marca_detalle?.nombre || "Sin marca"} · ${item.unidad_medida_detalle?.nombre || "Sin unidad"}` }),
    onClear: () => {
      articuloId.value = "";
      articuloElegido.textContent = "";
      limpiarUbicacion();
      informar("");
      render();
    },
    onSelect: (item) => {
      articuloId.value = String(item.code);
      articuloElegido.textContent = `Articulo seleccionado: ${item.code} · ${item.descripcion}`;
      limpiarUbicacion();
      poblarBodegas();
      informar("");
      render();
      articuloLookup.hint.textContent = "Articulo confirmado. Ahora selecciona su ubicacion.";
    },
  });
  const ubicacionLookup = new Autocompletado({
    wrapper: document.querySelector("#lookupUbicacionStock"),
    input: document.querySelector("#buscarUbicacionStock"),
    list: document.querySelector("#opcionesUbicacionStock"),
    button: document.querySelector("#buscarUbicacionStockBtn"),
    hint: document.querySelector("#ayudaUbicacionStock"),
    automatico: () => true,
    instruccion: () => requiereExistencias ? "Solo se muestran ubicaciones que contienen este articulo." : "Escribe al menos 3 caracteres del codigo, nombre, bodega o ruta.",
    canSearch: (texto) => requiereExistencias || normalizar(texto).length >= 3,
    find: (texto) => ubicacionesPermitidas().filter((item) => normalizar(etiquetaUbicacion(item)).includes(normalizar(texto))),
    format: (item) => ({ label: etiquetaUbicacion(item), detail: `Disponible: ${disponible(item)} ${articuloActual()?.unidad_medida_detalle?.nombre || "unidades"}` }),
    onClear: () => {
      ubicacionId.value = "";
      limpiarDestino();
      ubicacionElegida.textContent = "";
      cantidadInput.value = 1;
      informar("");
      render();
    },
    onSelect: (item) => {
      ubicacionId.value = String(item.id);
      limpiarDestino();
      ubicacionElegida.textContent = `Ubicacion seleccionada: ${etiquetaUbicacion(item)}`;
      cantidadInput.value = 1;
      informar("");
      render();
      ubicacionLookup.hint.textContent = esTraslado ? "Origen confirmado. Selecciona una ubicacion en la bodega de destino." : "Ubicacion confirmada. Indica la cantidad.";
    },
  });

  if (esTraslado) {
    destinoLookup = new Autocompletado({
      wrapper: document.querySelector("#lookupDestinoStock"),
      input: document.querySelector("#buscarDestinoStock"),
      list: document.querySelector("#opcionesDestinoStock"),
      button: document.querySelector("#buscarDestinoStockBtn"),
      hint: document.querySelector("#ayudaDestinoStock"),
      automatico: () => true,
      instruccion: () => "Escribe al menos 3 caracteres del codigo, nombre o ruta del destino.",
      canSearch: (texto) => normalizar(texto).length >= 3,
      find: (texto) => destinosPermitidos().filter((item) => normalizar(etiquetaUbicacion(item)).includes(normalizar(texto))),
      format: (item) => ({ label: etiquetaUbicacion(item), detail: `Disponible en destino: ${disponible(item)} unidades` }),
      onClear: () => { destinoId.value = ""; informar(""); render(); },
      onSelect: (item) => { destinoId.value = String(item.id); informar(""); render(); },
    });
  }

  function poblarBodegas() {
    const previo = bodegaSelect.value;
    bodegaSelect.replaceChildren(new Option("Selecciona una bodega", ""));
    state.bodegas.forEach((item) => bodegaSelect.add(new Option(item.nombre, String(item.id))));
    if ([...bodegaSelect.options].some((item) => item.value === previo)) bodegaSelect.value = previo;
    if (hasSelect2) $(bodegaSelect).trigger("change.select2");
  }

  function aplicarTraslado(data) {
    const articulo = state.articulos.find((item) => item.code === data.articulo);
    const origen = state.ubicaciones.find((item) => item.id === data.origen);
    articulo.inventario = (articulo.inventario || []).filter((item) => item.ubicacion?.id !== data.origen);
    articulo.inventario.push({ cantidad: data.cantidad_disponible_origen, ubicacion: origen });
    const existente = articulo.inventario.find((item) => item.id === data.inventario_destino.id);
    if (existente) Object.assign(existente, data.inventario_destino);
    else articulo.inventario.push(data.inventario_destino);
  }

  function agregarFila(articulo, origen, destino, cantidad) {
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0 || cantidad > disponible(origen)) {
      informar("Indica una cantidad entera positiva que no supere las existencias disponibles.");
      return;
    }
    if (state.editIndex === null && state.pendientes.length >= 100) { informar("La tabla admite hasta 100 movimientos por registro."); return; }
    const fila = {
      articulo: articulo.code, origen: origen.id, destino: destino.id, cantidad,
      articulo_label: `${articulo.code} · ${articulo.descripcion}`,
      origen_bodega: origen.bodega_nombre, destino_bodega: destino.bodega_nombre,
      destino_bodega_id: destino.bodega,
      origen_label: `${origen.codigo_contenedor || origen.nomenclatura || origen.id} · ${origen.ruta}`,
      destino_label: `${destino.codigo_contenedor || destino.nomenclatura || destino.id} · ${destino.ruta}`,
    };
    if (state.editIndex === null) state.pendientes.push(fila);
    else state.pendientes[state.editIndex] = fila;
    state.editIndex = null;
    articuloLookup.clear();
    if (dialogoTraslado.open) dialogoTraslado.close();
    informar("Movimiento preparado en la tabla. Pulsa Registrar movimientos para aplicarlo.", "success");
    render();
    document.querySelector("#nuevoMovimientoTraslado").focus();
  }

  function editarFila(index) {
    const fila = state.pendientes[index];
    const articulo = state.articulos.find((item) => item.code === fila.articulo);
    const origen = state.ubicaciones.find((item) => item.id === fila.origen);
    const destino = state.ubicaciones.find((item) => item.id === fila.destino);
    if (!articulo || !origen || !destino) { informar("No se pudo recuperar esta fila. Revisa sus ubicaciones."); return; }
    state.editIndex = index;
    bodegaSelect.value = String(fila.destino_bodega_id);
    state.bodegaLocked = true;
    seleccionBodega.set(bodegaSelect.value, true);
    if (hasSelect2) $(bodegaSelect).trigger("change.select2");
    articuloLookup.select(articulo);
    ubicacionLookup.select(origen);
    destinoLookup.select(destino);
    cantidadInput.value = fila.cantidad;
    informar(`Editando la fila ${index + 1}. Guarda la fila o cancela la edicion.`);
    render();
    if (!dialogoTraslado.open) dialogoTraslado.showModal();
    cantidadInput.focus();
  }

  function cerrarEditorTraslado() {
    dialogoTraslado.close();
    state.editIndex = null;
    articuloLookup.clear();
    informar("");
    render();
  }

  function renderLote() {
    const individual = document.querySelector("#panelMovimientoIndividual");
    const editor = document.querySelector("#editorMovimientoStock");
    const editorHost = modoTabla() ? document.querySelector("#contenidoEditorTraslado") : individual;
    if (editor.parentElement !== editorHost) editorHost.prepend(editor);
    individual.hidden = modoTabla();
    document.querySelector("#tituloEditorMovimiento").textContent = modoTabla() ? (state.editIndex === null ? "Agregar movimiento" : `Editar movimiento ${state.editIndex + 1}`) : "Preparar traslado";
    document.querySelector("#nuevoMovimientoTraslado").disabled = !state.loaded || !state.bodegaLocked || state.busy || state.pendientes.length >= 100;
    const panel = document.querySelector("#panelLoteTraslados");
    panel.hidden = !modoTabla();
    modosTraslados.forEach((item) => { item.disabled = !state.loaded || state.busy; });
    const body = document.querySelector("#tablaLoteTraslados");
    body.replaceChildren();
    state.pendientes.forEach((fila, index) => {
      const row = body.insertRow();
      row.dataset.selected = String(index === state.editIndex);
      [index + 1, fila.articulo_label, fila.origen_bodega, fila.origen_label, fila.destino_bodega, fila.destino_label, fila.cantidad]
        .forEach((value) => { row.insertCell().textContent = value; });
      const acciones = row.insertCell();
      const editar = document.createElement("button");
      editar.type = "button"; editar.textContent = "Editar"; editar.disabled = state.busy;
      editar.addEventListener("click", () => editarFila(index));
      const quitar = document.createElement("button");
      quitar.type = "button"; quitar.textContent = "Quitar"; quitar.disabled = state.busy;
      quitar.addEventListener("click", () => {
        state.pendientes.splice(index, 1);
        if (state.editIndex === index) { state.editIndex = null; articuloLookup.clear(); }
        else if (state.editIndex !== null && state.editIndex > index) state.editIndex -= 1;
        render();
      });
      acciones.append(editar, quitar);
    });
    if (!state.pendientes.length) { const cell = body.insertRow().insertCell(); cell.colSpan = 8; cell.textContent = "Agrega un movimiento para comenzar."; }
    document.querySelector("#resumenLoteTraslados").textContent = `${state.pendientes.length} movimiento(s) pendiente(s). Si falla una fila, no se registra ningun movimiento del lote.`;
    const registrar = document.querySelector("#registrarLoteTraslados");
    registrar.disabled = state.busy || !state.bodegaLocked || !state.pendientes.length || state.editIndex !== null;
    registrar.textContent = state.busy ? "Registrando..." : `Registrar movimientos (${state.pendientes.length})`;
    document.querySelector("#vaciarLoteTraslados").disabled = state.busy || !state.pendientes.length;
    document.querySelector("#cancelarEdicionTraslado").hidden = state.editIndex === null;
    document.querySelector("#cancelarEdicionTraslado").disabled = state.busy;
  }

  if (esTraslado) {
    document.querySelector("#nuevoMovimientoTraslado").addEventListener("click", () => {
      state.editIndex = null;
      articuloLookup.clear();
      informar(""); render();
      dialogoTraslado.showModal();
      articuloLookup.input.focus();
    });
    document.querySelector("#cerrarEditorTraslado").addEventListener("click", cerrarEditorTraslado);
    dialogoTraslado.addEventListener("cancel", (event) => { event.preventDefault(); cerrarEditorTraslado(); });
    modosTraslados.forEach((item) => item.addEventListener("change", () => { state.editIndex = null; articuloLookup.clear(); informar(""); render(); }));
    document.querySelector("#cancelarEdicionTraslado").addEventListener("click", cerrarEditorTraslado);
    document.querySelector("#vaciarLoteTraslados").addEventListener("click", () => { state.pendientes = []; state.editIndex = null; articuloLookup.clear(); informar(""); render(); });
    document.querySelector("#registrarLoteTraslados").addEventListener("click", async () => {
      if (state.busy || !state.bodegaLocked || !state.pendientes.length || state.editIndex !== null) return;
      state.busy = true;
      informar(""); render();
      try {
        const data = await pedir(config.lote, {
          method: "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
          body: JSON.stringify({ movimientos: state.pendientes.map(({ articulo, origen, destino, cantidad }) => ({ articulo, origen, destino, cantidad })) }),
        });
        data.movimientos.forEach(aplicarTraslado);
        state.pendientes = [];
        articuloLookup.clear();
        informar(`${data.registrados} movimientos registrados correctamente.`, "success");
        try { state.articulos = (await pedir(config.articulos)).articulos || []; }
        catch (_) { mensaje.textContent += " Recarga la pagina para consultar todas las existencias actualizadas."; }
      } catch (error) { informar(`No se registro el lote. ${error.message}`); }
      finally { state.busy = false; render(); }
    });
  }

  function render() {
    const articulo = articuloActual();
    const ubicacion = ubicacionActual();
    const seleccion = Boolean(articulo && ubicacion && (!esTraslado || destinoId.value));
    articuloLookup.setDisabled(!state.loaded || !state.bodegaLocked || state.busy);
    modos.forEach((item) => { item.disabled = state.busy; });
    bodegaSelect.disabled = !state.loaded || state.bodegaLocked || state.busy;
    bodegaButton.disabled = !state.loaded || state.busy || (!state.bodegaLocked && !bodegaSelect.value);
    bodegaButton.textContent = state.bodegaLocked ? "Liberar" : "Seleccionar bodega";
    bodegaStatus.textContent = state.bodegaLocked ? `Bodega seleccionada: ${state.bodegas.find((item) => String(item.id) === bodegaSelect.value)?.nombre}.` : "Elige y confirma la bodega para comenzar.";
    if (hasSelect2) $(bodegaSelect).prop("disabled", bodegaSelect.disabled);
    ubicacionLookup.setDisabled(!articulo || !state.bodegaLocked || state.busy);
    ubicacionLookup.input.placeholder = !articulo ? "Selecciona primero el articulo" : requiereExistencias ? "Elige una ubicacion con existencias" : "Escribe al menos 3 caracteres";
    if (esTraslado) {
      destinoLookup.setDisabled(!ubicacion || !bodegaDestino.value || !state.bodegaLocked || state.busy);
    }
    if (!ubicacionLookup.selected && ubicacionLookup.list.hidden) {
      ubicacionLookup.hint.textContent = !articulo ? "Selecciona primero el articulo." : ubicacionLookup.instruccion();
    }
    cantidadInput.disabled = !seleccion || state.busy;
    guardar.disabled = !seleccion || !state.bodegaLocked || state.busy || (requiereExistencias && disponible(ubicacion) <= 0);
    guardar.textContent = state.busy ? "Registrando..." : modoTabla() ? (state.editIndex === null ? "Agregar a la tabla" : "Guardar fila") : esTraslado ? "Registrar traslado" : esPicking ? "Registrar salida" : "Registrar entrada";
    cantidadInput.removeAttribute("max");
    if (requiereExistencias && ubicacion) cantidadInput.max = disponible(ubicacion);
    resumen.textContent = seleccion ? `Disponible aqui: ${disponible(ubicacion)} ${articulo.unidad_medida_detalle?.nombre || "unidades"}.` : "Selecciona primero un articulo y luego su ubicacion.";
    ruta.textContent = articulo ? `${articulo.code} · ${articulo.descripcion}${ubicacion ? ` — ${etiquetaUbicacion(ubicacion)}` : ""}` : "Busca y selecciona primero un articulo para consultar sus existencias.";
    if (!modoTabla()) {
      tabla.replaceChildren();
      const lista = ubicacionesPermitidas().filter((item) => disponible(item) > 0);
      if (!lista.length) {
        const celda = tabla.insertRow().insertCell();
        celda.colSpan = 4;
        celda.textContent = !articulo ? "No hay un articulo seleccionado." : requiereExistencias ? "No hay existencias disponibles para este articulo en las bodegas seleccionadas." : "No hay existencias registradas. Busca una ubicacion de destino para almacenar el articulo.";
      }
      lista.forEach((item) => {
        const fila = tabla.insertRow();
        fila.className = "stock-location-row";
        fila.tabIndex = state.busy ? -1 : 0;
        fila.setAttribute("aria-disabled", String(state.busy));
        fila.dataset.selected = String(String(item.id) === ubicacionId.value);
        fila.setAttribute("aria-selected", fila.dataset.selected);
        const seleccionar = () => {
          if (state.busy || !state.bodegaLocked) return;
          ubicacionLookup.select(item);
          if (esTraslado) destinoLookup.input.focus();
          else cantidadInput.focus();
        };
        fila.addEventListener("click", seleccionar);
        fila.addEventListener("keydown", (event) => {
          if (event.target === fila && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            seleccionar();
          }
        });
        const nomenclatura = item.nomenclatura || item.codigo_contenedor || "Sin nomenclatura";
        [nomenclatura, item.bodega_nombre, item.ruta, `${disponible(item)} ${articulo.unidad_medida_detalle?.nombre || "unidades"}`]
          .forEach((valor) => { fila.insertCell().textContent = valor; });
      });
    }
    if (esTraslado) renderLote();
  }

  modos.forEach((radio) => radio.addEventListener("change", () => {
    try { localStorage.setItem(claveModoBusqueda, modo()); }
    catch (_) { /* La busqueda sigue funcionando sin almacenamiento. */ }
    articuloLookup.clear();
    articuloLookup.input.inputMode = modo() === "id" ? "numeric" : "text";
    articuloLookup.input.placeholder = modo() === "id" ? "Escribe el ID del articulo" : "Escribe al menos 3 caracteres de su descripcion";
    articuloLookup.hint.textContent = articuloLookup.instruccion();
    articuloLookup.input.focus();
  }));
  function cambiarBodega() {
    if (state.bodegaLocked || state.busy) return;
    seleccionBodega.set(bodegaSelect.value);
    limpiarUbicacion();
    informar("");
    render();
  }
  if (hasSelect2) {
    $(bodegaSelect).select2({ placeholder: "Selecciona una bodega", allowClear: true, width: "resolve" });
    $(bodegaSelect).on("change.inventario", cambiarBodega);
  } else bodegaSelect.addEventListener("change", cambiarBodega);
  bodegaButton.addEventListener("click", () => {
    if (state.busy || (!state.bodegaLocked && !bodegaSelect.value)) return;
    state.bodegaLocked = !state.bodegaLocked;
    seleccionBodega.set(bodegaSelect.value, state.bodegaLocked);
    limpiarUbicacion();
    informar("");
    render();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.busy || !state.bodegaLocked || !form.reportValidity()) return;
    const articulo = articuloActual();
    const ubicacion = ubicacionActual();
    const destino = esTraslado ? destinosPermitidos().find((item) => String(item.id) === destinoId.value) : null;
    if (!articulo || !ubicacion || !ubicacionesPermitidas().some((item) => item.id === ubicacion.id)) {
      informar("Confirma un articulo y una ubicacion valida antes de registrar.");
      return;
    }
    if (esTraslado && !destino) { informar("Selecciona un destino valido, distinto del origen."); return; }
    const cantidad = Number(cantidadInput.value);
    if (esTraslado && modoTabla()) {
      agregarFila(articulo, ubicacion, destino, cantidad);
      return;
    }
    state.busy = true;
    informar("");
    render();
    try {
      const data = await pedir(config.movimiento.replace("/0/", `/${articulo.code}/`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
        body: JSON.stringify(esTraslado ? { origen: ubicacion.id, destino: destino.id, cantidad } : { ubicacion: ubicacion.id, cantidad }),
      });
      if (esTraslado) {
        aplicarTraslado(data);
      } else if (esPicking) {
        articulo.inventario = (articulo.inventario || []).filter((item) => item.ubicacion?.id !== ubicacion.id);
        articulo.inventario.push({ cantidad: data.cantidad_disponible, ubicacion });
      } else {
        const existente = (articulo.inventario || []).find((item) => item.id === data.id);
        if (existente) Object.assign(existente, data);
        else (articulo.inventario ||= []).push(data);
      }
      cantidadInput.value = 1;
      informar(esTraslado ? `Traslado registrado: ${cantidad} de ${articulo.descripcion}. Origen: ${etiquetaUbicacion(ubicacion)}. Destino: ${etiquetaUbicacion(destino)}.` : `${esPicking ? "Salida" : "Entrada"} registrada: ${cantidad} de ${articulo.descripcion}.`, "success");
      try {
        const actualizado = await pedir(config.articulos);
        state.articulos = actualizado.articulos || [];
      } catch (_) {
        mensaje.textContent += " Recarga la pagina para consultar todas las existencias actualizadas.";
      }
      poblarBodegas();
      if (esTraslado) limpiarUbicacion();
      if (!ubicacionesPermitidas().some((item) => item.id === ubicacion.id)) limpiarUbicacion();
    } catch (error) {
      informar(error.message);
    } finally {
      state.busy = false;
      render();
    }
  });

  const aplanar = (raices) => raices.flatMap((item) => [item, ...aplanar(item.hijos || [])]);
  Promise.all([pedir(config.bodegas), pedir(config.articulos), pedir(config.ubicaciones)])
    .then(([bodegas, data, ubicaciones]) => {
      state.bodegas = bodegas;
      state.articulos = data.articulos || [];
      state.ubicaciones = aplanar(ubicaciones.ubicaciones || []);
      state.loaded = true;
      poblarBodegas();
      bodegaSelect.value = seleccionBodega.get(state.bodegas);
      state.bodegaLocked = Boolean(bodegaSelect.value && seleccionBodega.isLocked());
      if (hasSelect2) $(bodegaSelect).trigger("change.select2");
      render();
    })
    .catch((error) => informar(`No se pudieron cargar los datos. ${error.message} Recarga la pagina para intentar nuevamente.`));
})();
