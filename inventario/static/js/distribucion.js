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
    draggingId: null,
    cargando: false,
    pasilloCounter: 1,
  };

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
      event.dataTransfer?.setData("text/plain", String(item.id));
      event.dataTransfer?.setDragImage?.(nodo, 30, 30);
      nodo.classList.add("is-dragging");
    });

    nodo.addEventListener("dragend", () => {
      state.draggingId = null;
      nodo.classList.remove("is-dragging");
      const activos = gridInner.querySelectorAll(".grid-cell[data-drop='true']");
      activos.forEach((celda) => {
        celda.removeAttribute("data-drop");
      });
    });

    nodo.addEventListener("click", (event) => {
      const boton = event.target.closest("[data-action='remove']");
      if (boton) {
        event.stopPropagation();
        eliminarPasillo(item.id);
      }
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
    renderGrid();
  }

  function renderGrid() {
    limpiarLienzo();
    setCanvasVariables();

    const mapa = new Map();
    state.items.forEach((item) => {
      mapa.set(`${item.fila}-${item.columna}`, item);
    });

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
          celda.appendChild(crearElementoItem(item));
        }
        gridInner.appendChild(celda);
      }
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
          es_pasillo: Boolean(item.es_pasillo),
        }))
        .sort((a, b) => (a.fila === b.fila ? a.columna - b.columna : a.fila - b.fila));

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
          };
        }

        return {
          ubicacion: item.id,
          fila: item.fila,
          columna: item.columna,
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

  async function crearPasillo() {
    if (typeof Swal === "undefined") {
      const nombreManual = window.prompt("Nombre del pasillo:", `Pasillo ${state.pasilloCounter}`);
      if (!nombreManual) return;
      agregarPasilloAlFinal(nombreManual);
      return;
    }

    const { value: nombre } = await Swal.fire({
      title: "Nuevo pasillo",
      html: `<input id="pasilloNombre" class="swal2-input" placeholder="Nombre del pasillo" value="Pasillo ${state.pasilloCounter}" />`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Crear",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const input = document.getElementById("pasilloNombre");
        return input?.value?.trim() || "";
      },
    });

    if (!nombre) return;
    agregarPasilloAlFinal(nombre);
  }

  function agregarPasilloAlFinal(nombre) {
    const tempId = `pasillo-temp-${Date.now()}-${state.pasilloCounter}`;
    state.pasilloCounter += 1;
    const index = findNextAvailableIndex(state.items.length);
    const { fila, columna } = indexToRowCol(index);
    state.items.push({
      id: tempId,
      nombre,
      tipo: "PASILLO",
      fila,
      columna,
      es_pasillo: true,
    });
    renderGrid();
  }

  selectorBodega.addEventListener("change", (event) => {
    const valor = event.target.value || "";
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

  renderGrid();
})();
