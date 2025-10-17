(() => {
  const config = window.inventarioConfig || {};
  const endpoints = config.endpoints || {};
  const articulosEndpoint =
    endpoints.articulos || "/inventario/articulos/";
  const ubicacionesEndpoint =
    endpoints.ubicaciones || "/inventario/ubicaciones/api/";
  const bodegasEndpoint = endpoints.bodegas || "/inventario/bodegas/api/";
  const UBICACION_STORAGE_KEY = "inventario::seleccionUbicacion";

  const form = document.querySelector("#formArticulo");
  const panelFormulario = document.querySelector("#panelFormulario");
  const abrirFormularioBtn = document.querySelector("#mostrarFormulario");
  const cerrarFormularioBtn = document.querySelector("#cerrarFormulario");
  const guardarBtn = document.querySelector("#guardarArticulo");
  const fotoInput = document.querySelector("#foto");
  const previewFoto = document.querySelector("#previewFoto");
  const sinFotosHint = document.querySelector("#sinFotosHint");
  const abrirCamaraBtn = document.querySelector("#abrirCamara");
  const cerrarCamaraBtn = document.querySelector("#cerrarCamara");
  const capturarFotoBtn = document.querySelector("#capturarFoto");
  const cameraContainer = document.querySelector("#cameraContainer");
  const cameraVideo = document.querySelector("#cameraVideo");
  const cameraCanvas = document.querySelector("#cameraCanvas");
  const tablaBody = document.querySelector("#listaArticulos");
  const filaTemplate = document.querySelector("#filaArticuloTemplate");
  const searchInput = document.querySelector("#busquedaArticulo");
  const clearSearchBtn = document.querySelector("#limpiarBusqueda");
  const detalleCodigo = document.querySelector("#detalleCodigo");
  const detalleDescripcion = document.querySelector("#detalleDescripcion");
  const detalleMeta = document.querySelector("#detalleMeta");
  const detalleGaleria = document.querySelector("#detalleGaleria");
  const resumenWrapper = document.querySelector("#resumenInventario");
  const galeriaModal = document.querySelector("#galeriaModal");
  const cerrarModalGaleriaBtn = document.querySelector("#cerrarModalGaleria");
  const lightboxImagen = document.querySelector("#lightboxImagen");
  const lightboxDescripcion = document.querySelector("#lightboxDescripcion");
  const lightboxIndice = document.querySelector("#lightboxIndice");
  const prevImagenBtn = document.querySelector("#prevImagen");
  const nextImagenBtn = document.querySelector("#nextImagen");
  const detalleInventarioLista = document.querySelector("#detalleInventarioLista");
  const detalleInventarioVacio = document.querySelector("#detalleInventarioVacio");
  const inventarioForm = document.querySelector("#formInventario");
  const inventarioCantidadInput = document.querySelector("#inventarioCantidad");
  const inventarioSubmitBtn = document.querySelector("#agregarInventarioBtn");
  const bodegaSelect = document.querySelector("#selectorBodega");
  const ubicacionSelect = document.querySelector("#selectorUbicacion");
  const lockButton = document.querySelector("#bloquearUbicacionBtn");
  const seleccionResumen = document.querySelector("#inventarioSeleccionResumen");

  if (!form || !tablaBody || !filaTemplate) {
    return;
  }

  function getGaleriaFotos() {
    const seleccionado = state.seleccionado;
    return Array.isArray(seleccionado?.fotos) ? seleccionado.fotos : [];
  }

  function updateLightboxControls() {
    const fotos = getGaleriaFotos();
    const total = fotos.length;

    if (prevImagenBtn) {
      prevImagenBtn.disabled = total <= 1 || lightboxIndex <= 0;
    }
    if (nextImagenBtn) {
      nextImagenBtn.disabled = total <= 1 || lightboxIndex >= total - 1;
    }

    if (lightboxIndice) {
      lightboxIndice.textContent = total
        ? `${lightboxIndex + 1} de ${total}`
        : "";
    }
  }

  function showLightboxImage(index) {
    const fotos = getGaleriaFotos();
    if (!fotos.length) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(index, fotos.length - 1));
    lightboxIndex = nextIndex;
    const fotoUrl = fotos[nextIndex];

    if (lightboxImagen) {
      lightboxImagen.src = fotoUrl;
      lightboxImagen.alt = `Foto ${nextIndex + 1} del articulo ${state.seleccionado?.code ?? ""}`;
    }

    if (lightboxDescripcion) {
      const descripcion =
        state.seleccionado?.descripcion ||
        `Articulo ${state.seleccionado?.code ?? ""}`;
      lightboxDescripcion.textContent = descripcion;
    }

    updateLightboxControls();
  }

  function openLightbox(index = 0) {
    const fotos = getGaleriaFotos();
    if (!galeriaModal || !fotos.length) {
      return;
    }

    showLightboxImage(index);
    galeriaModal.dataset.visible = "true";
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleLightboxKeydown);
  }

  function closeLightbox() {
    if (!galeriaModal || galeriaModal.dataset.visible !== "true") {
      return;
    }
    galeriaModal.dataset.visible = "false";
    document.body.style.overflow = "";
    document.removeEventListener("keydown", handleLightboxKeydown);
    if (lightboxImagen) {
      lightboxImagen.src = "";
      lightboxImagen.alt = "";
    }
    updateLightboxControls();
  }

  function handleLightboxKeydown(event) {
    if (!galeriaModal || galeriaModal.dataset.visible !== "true") {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
      return;
    }

    const fotos = getGaleriaFotos();
    if (!fotos.length) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (lightboxIndex > 0) {
        showLightboxImage(lightboxIndex - 1);
      }
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (lightboxIndex < fotos.length - 1) {
        showLightboxImage(lightboxIndex + 1);
      }
    }
  }

  const state = {
    articulos: [],
    filtrados: [],
    seleccionado: null,
    resumen: {},
    bodegas: [],
    ubicacionesCache: new Map(),
    seleccionUbicacion: {
      bodegaId: null,
      ubicacionId: null,
      locked: false,
    },
  };

  const photoState = [];
  let cameraStream = null;
  let lightboxIndex = 0;
  let restoringSeleccion = false;

  const csrfToken =
    form.querySelector("[name=csrfmiddlewaretoken]")?.value ||
    document.querySelector("input[name=csrfmiddlewaretoken]")?.value ||
    "";

  function setFormBusy(isBusy) {
    if (!guardarBtn) return;
    guardarBtn.disabled = isBusy;
    guardarBtn.textContent = isBusy
      ? "Guardando..."
      : "Guardar articulo";
  }

  function generatePhotoId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `photo-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
  }

  function photoExists(file) {
    return photoState.some((item) => {
      const { name, size, lastModified } = item.file;
      return (
        name === file.name &&
        size === file.size &&
        lastModified === file.lastModified
      );
    });
  }

  function syncFileInput() {
    if (!fotoInput) return;
    const dataTransfer = new DataTransfer();
    photoState.forEach(({ file }) => dataTransfer.items.add(file));
    fotoInput.files = dataTransfer.files;
  }

  function renderPhotoPreview() {
    if (!previewFoto) return;
    previewFoto.innerHTML = "";

    if (sinFotosHint) {
      sinFotosHint.style.display = photoState.length ? "none" : "block";
    }

    const fragment = document.createDocumentFragment();
    photoState.forEach((item) => {
      const card = document.createElement("div");
      card.className = "preview-item";
      card.dataset.photoId = item.id;

      const img = document.createElement("img");
      img.src = item.url;
      img.alt = `Foto seleccionada ${item.file.name}`;
      card.appendChild(img);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-preview";
      removeBtn.dataset.removePhoto = item.id;
      removeBtn.setAttribute("aria-label", "Eliminar fotografia");
      removeBtn.textContent = "×";
      card.appendChild(removeBtn);

      fragment.appendChild(card);
    });

    previewFoto.appendChild(fragment);
  }

  function addPhotoFile(file) {
    if (!(file instanceof File)) {
      return;
    }

    if (photoExists(file)) {
      return;
    }

    const id = generatePhotoId();
    const url = URL.createObjectURL(file);
    photoState.push({ id, file, url });
    syncFileInput();
    renderPhotoPreview();
  }

  function handleFileSelection(event) {
    const files = Array.from(event.target.files || []);
    files.forEach((file) => addPhotoFile(file));
    event.target.value = "";
  }

  function removePhoto(photoId) {
    const index = photoState.findIndex((item) => item.id === photoId);
    if (index === -1) {
      return;
    }
    const [removed] = photoState.splice(index, 1);
    if (removed?.url) {
      URL.revokeObjectURL(removed.url);
    }
    syncFileInput();
    renderPhotoPreview();
  }

  function resetPhotoManager() {
    while (photoState.length) {
      const item = photoState.pop();
      if (item?.url) {
        URL.revokeObjectURL(item.url);
      }
    }
    if (fotoInput) {
      fotoInput.value = "";
    }
    syncFileInput();
    renderPhotoPreview();
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      if (typeof swalErr === "function") {
        swalErr("La camara no esta disponible en este dispositivo.");
      }
      return;
    }

    if (cameraStream) {
      cameraContainer?.setAttribute("data-visible", "true");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      cameraStream = stream;
      if (cameraVideo) {
        cameraVideo.srcObject = stream;
        await cameraVideo.play().catch(() => {});
      }
      cameraContainer?.setAttribute("data-visible", "true");
    } catch (error) {
      console.error(error);
      if (typeof swalErr === "function") {
        swalErr("No fue posible acceder a la camara.");
      }
      closeCamera();
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    if (cameraVideo) {
      cameraVideo.pause();
      cameraVideo.srcObject = null;
    }
    cameraContainer?.setAttribute("data-visible", "false");
  }

  function capturePhoto() {
    if (!cameraVideo || !cameraCanvas || !cameraStream) {
      return;
    }
    const settings =
      cameraStream.getVideoTracks()[0]?.getSettings?.() || {};
    const width =
      cameraVideo.videoWidth || settings.width || 1280;
    const height =
      cameraVideo.videoHeight || settings.height || 720;

    cameraCanvas.width = width;
    cameraCanvas.height = height;

    const context = cameraCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    context.drawImage(cameraVideo, 0, 0, width, height);

    cameraCanvas.toBlob(
      (blob) => {
        if (!blob) {
          if (typeof swalErr === "function") {
            swalErr("No se pudo capturar la fotografia.");
          }
          return;
        }
        const timestamp = new Date()
          .toISOString()
          .replace(/\D/g, "")
          .slice(0, 14);
        const file = new File([blob], `captura-${timestamp}.jpg`, {
          type: blob.type || "image/jpeg",
          lastModified: Date.now(),
        });
        addPhotoFile(file);
      },
      "image/jpeg",
      0.9,
    );
  }

  function formatValue(value, fallback = "No registrado") {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }
    return value;
  }

  function updateResumen(resumen, articulos) {
    if (!resumenWrapper) return;
    const metrics = {
      articulos: resumen?.articulos ?? articulos.length ?? 0,
      existencias:
        resumen?.existencias ??
        articulos.reduce(
          (total, item) => total + Number(item.existencias || 0),
          0,
        ),
      ubicaciones: resumen?.ubicaciones ?? 0,
      fotos: resumen?.fotos ?? 0,
    };

    Object.entries(metrics).forEach(([key, value]) => {
      const target = resumenWrapper.querySelector(
        `[data-metric="${key}"]`,
      );
      if (target) {
        target.textContent = Number.isFinite(value) ? value : 0;
      }
    });
  }

  function parsePositiveInt(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const numero = Number.parseInt(value, 10);
    return Number.isFinite(numero) && numero > 0 ? numero : null;
  }

  function buildUbicacionLabel(item) {
    if (!item) {
      return "";
    }
    const partes = [];
    if (item.nomenclatura) {
      partes.push(item.nomenclatura);
    }
    const ruta = item.ruta || item.nombre;
    if (ruta) {
      partes.push(ruta);
    }
    const base = partes.filter(Boolean).join(" — ") || `Ubicacion ${item.id}`;
    if (item.tipo_display) {
      return `${base} (${item.tipo_display})`;
    }
    return base;
  }

  function getBodegaName(id) {
    if (!id) return "";
    const encontrado = state.bodegas.find(
      (item) => Number(item.id) === Number(id),
    );
    return encontrado?.nombre || "";
  }

  function getUbicacionFromCache(bodegaId, ubicacionId) {
    const lista = state.ubicacionesCache.get(bodegaId);
    if (!lista) return null;
    return (
      lista.find((item) => Number(item.id) === Number(ubicacionId)) || null
    );
  }

  function setSelectDisabled(element, disabled) {
    if (!element) return;
    element.disabled = Boolean(disabled);
  }

  function populateBodegaOptions(selectedValue = null) {
    if (!bodegaSelect) return;

    const valorSeleccionado =
      selectedValue !== null && selectedValue !== undefined
        ? String(selectedValue)
        : state.seleccionUbicacion.bodegaId
        ? String(state.seleccionUbicacion.bodegaId)
        : "";

    bodegaSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "";
    bodegaSelect.appendChild(placeholder);

    state.bodegas.forEach((bodega) => {
      const option = document.createElement("option");
      option.value = String(bodega.id);
      option.textContent = bodega.nombre;
      bodegaSelect.appendChild(option);
    });

    bodegaSelect.value = valorSeleccionado || "";
  }

  function populateUbicacionOptions(lista, selectedValue = null) {
    if (!ubicacionSelect) return;

    const valorSeleccionado =
      selectedValue !== null && selectedValue !== undefined
        ? String(selectedValue)
        : state.seleccionUbicacion.ubicacionId
        ? String(state.seleccionUbicacion.ubicacionId)
        : "";

    console.log(
      "Ubicaciones disponibles",
      state.seleccionUbicacion.bodegaId,
      lista.map((item) => ({ id: item.id, etiqueta: buildUbicacionLabel(item) })),
    );

    ubicacionSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "";
    ubicacionSelect.appendChild(placeholder);

    lista.forEach((item) => {
      const option = document.createElement("option");
      option.value = String(item.id);
      option.textContent = buildUbicacionLabel(item);
      option.dataset.ruta = item.ruta || "";
      option.dataset.nomenclatura = item.nomenclatura || "";
      ubicacionSelect.appendChild(option);
    });

    ubicacionSelect.value = valorSeleccionado || "";
  }

  function flattenUbicaciones(raices) {
    const resultado = [];
    const pila = Array.isArray(raices) ? [...raices] : [];
    while (pila.length) {
      const nodo = pila.shift();
      if (!nodo || typeof nodo !== "object") {
        continue;
      }
      resultado.push({
        id: parsePositiveInt(nodo.id) ?? nodo.id,
        nombre: nodo.nombre,
        ruta: nodo.ruta,
        nomenclatura: nodo.nomenclatura,
        tipo: nodo.tipo,
        tipo_display: nodo.tipo_display || nodo.tipo,
        bodega: parsePositiveInt(nodo.bodega) ?? nodo.bodega,
      });
      if (Array.isArray(nodo.hijos) && nodo.hijos.length) {
        pila.push(...nodo.hijos);
      }
    }
    return resultado;
  }

  function updateSeleccionResumen() {
    if (!seleccionResumen) return;

    const { bodegaId, ubicacionId, locked } = state.seleccionUbicacion;
    if (!bodegaId || !ubicacionId) {
      seleccionResumen.textContent =
        "Selecciona una bodega y una ubicacion para registrar movimientos.";
      return;
    }
    const bodegaNombre = getBodegaName(bodegaId) || `Bodega ${bodegaId}`;
    const ubicacion = getUbicacionFromCache(bodegaId, ubicacionId);
    const ubicacionTexto = buildUbicacionLabel(ubicacion);
    seleccionResumen.textContent = `${locked ? "Seleccion actual" : "Seleccion preparada"}: ${bodegaNombre} • ${ubicacionTexto}`;
  }

  function persistSeleccion() {
    if (!window.localStorage) return;
    const { bodegaId, ubicacionId, locked } = state.seleccionUbicacion;
    if (locked && bodegaId && ubicacionId) {
      const payload = {
        bodegaId,
        ubicacionId,
      };
      try {
        window.localStorage.setItem(
          UBICACION_STORAGE_KEY,
          JSON.stringify(payload),
        );
      } catch (error) {
        console.error(error);
      }
    } else {
      window.localStorage.removeItem(UBICACION_STORAGE_KEY);
    }
  }

  function updateLockButtonUI() {
    if (!lockButton) return;

    if (state.seleccionUbicacion.locked) {
      lockButton.textContent = "Liberar";
      lockButton.classList.add("danger-button");
      lockButton.classList.remove("secondary-button");
      lockButton.disabled = false;
      setSelectDisabled(bodegaSelect, true);
      setSelectDisabled(ubicacionSelect, true);
    } else {
      lockButton.textContent = "Seleccionar ubicacion";
      lockButton.classList.remove("danger-button");
      if (!lockButton.classList.contains("secondary-button")) {
        lockButton.classList.add("secondary-button");
      }
      const puedeBloquear =
        Boolean(state.seleccionUbicacion.bodegaId) &&
        Boolean(state.seleccionUbicacion.ubicacionId);
      lockButton.disabled = !puedeBloquear;
      setSelectDisabled(bodegaSelect, false);
      const tieneUbicaciones =
        Boolean(state.seleccionUbicacion.bodegaId) &&
        (state.ubicacionesCache.get(state.seleccionUbicacion.bodegaId)?.length ||
          0) > 0;
      setSelectDisabled(ubicacionSelect, !tieneUbicaciones);
    }

    applyInventarioFormState();
    updateSeleccionResumen();
  }

  async function loadBodegas() {
    try {
      const response = await fetch(bodegasEndpoint, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("No fue posible cargar las bodegas.");
      }
      const data = await response.json();
      const bodegas = Array.isArray(data) ? data : [];
      state.bodegas = bodegas
        .map((item) => ({
          id: parsePositiveInt(item.id) ?? item.id,
          nombre: item.nombre || `Bodega ${item.id}`,
        }))
        .sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
        );
      populateBodegaOptions();
    } catch (error) {
      console.error(error);
      if (typeof swalErr === "function") {
        swalErr("No fue posible cargar el listado de bodegas.");
      }
    } finally {
      updateLockButtonUI();
    }
  }

  async function loadUbicacionesForBodega(bodegaId, options = {}) {
    const { preselect } = options;
    if (!ubicacionSelect || !bodegaId) {
      populateUbicacionOptions([]);
      return [];
    }

    if (state.ubicacionesCache.has(bodegaId)) {
      const listaCache = state.ubicacionesCache.get(bodegaId) || [];
      populateUbicacionOptions(listaCache, preselect);
      if (preselect) {
        state.seleccionUbicacion.ubicacionId = parsePositiveInt(preselect);
      }
      updateLockButtonUI();
      return listaCache;
    }

    try {
      setSelectDisabled(ubicacionSelect, true);
      populateUbicacionOptions([]);
      const response = await fetch(
        `${ubicacionesEndpoint}?bodega=${encodeURIComponent(bodegaId)}`,
        {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        },
      );
      if (!response.ok) {
        throw new Error("No fue posible cargar las ubicaciones.");
      }
      const data = await response.json();
      console.log(data);
      const listaFuente = Array.isArray(data)

        ? data
        : Array.isArray(data?.ubicaciones)
        ? data.ubicaciones
        : [];
      const lista = flattenUbicaciones(listaFuente).sort((a, b) =>
        buildUbicacionLabel(a).localeCompare(buildUbicacionLabel(b), "es", {
          sensitivity: "base",
        }),
      );
      state.ubicacionesCache.set(bodegaId, lista);
      populateUbicacionOptions(lista, preselect);
      if (preselect) {
        state.seleccionUbicacion.ubicacionId = parsePositiveInt(preselect);
      }
      return lista;
    } catch (error) {
      console.error(error);
      if (typeof swalErr === "function") {
        swalErr("No fue posible cargar las ubicaciones de la bodega seleccionada.");
      }
      populateUbicacionOptions([]);
      return [];
    } finally {
      updateLockButtonUI();
    }
  }

  async function restoreSeleccionDesdeStorage() {
    if (!window.localStorage) {
      updateLockButtonUI();
      return;
    }
    let almacenada = null;
    try {
      almacenada = JSON.parse(
        window.localStorage.getItem(UBICACION_STORAGE_KEY) || "null",
      );
    } catch (error) {
      almacenada = null;
    }
    if (
      !almacenada?.bodegaId ||
      !almacenada?.ubicacionId ||
      !state.bodegas.some(
        (item) => Number(item.id) === Number(almacenada.bodegaId),
      )
    ) {
      updateLockButtonUI();
      return;
    }
    restoringSeleccion = true;
    state.seleccionUbicacion.bodegaId = parsePositiveInt(almacenada.bodegaId);
    populateBodegaOptions(state.seleccionUbicacion.bodegaId);
    await loadUbicacionesForBodega(state.seleccionUbicacion.bodegaId, {
      preselect: parsePositiveInt(almacenada.ubicacionId),
    });
    state.seleccionUbicacion.ubicacionId = parsePositiveInt(
      almacenada.ubicacionId,
    );
    restoringSeleccion = false;
    toggleSelectionLock(true);
  }

  async function handleBodegaChange(event) {
    const valor = parsePositiveInt(event.target.value);
    state.seleccionUbicacion.bodegaId = valor;
    if (restoringSeleccion) {
      return;
    }
    state.seleccionUbicacion.ubicacionId = null;
    if (!valor) {
      populateUbicacionOptions([]);
      updateLockButtonUI();
      return;
    }
    await loadUbicacionesForBodega(valor);
  }

  function handleUbicacionChange(event) {
    const valor = parsePositiveInt(event.target.value);
    state.seleccionUbicacion.ubicacionId = valor;
    if (restoringSeleccion) {
      return;
    }
    updateLockButtonUI();
  }

  function toggleSelectionLock(force) {
    const nuevoEstado =
      typeof force === "boolean" ? force : !state.seleccionUbicacion.locked;
    state.seleccionUbicacion.locked = nuevoEstado;
    updateLockButtonUI();
    persistSeleccion();
    if (!nuevoEstado) {
      (bodegaSelect || ubicacionSelect)?.focus?.();
    }
  }

  function handleLockButtonClick() {
    if (state.seleccionUbicacion.locked) {
      toggleSelectionLock(false);
      return;
    }

    if (!state.seleccionUbicacion.bodegaId) {
      if (typeof swalErr === "function") {
        swalErr("Selecciona una bodega antes de bloquear la ubicacion.");
      }
      if (bodegaSelect) {
        bodegaSelect.focus();
      }
      return;
    }

    if (!state.seleccionUbicacion.ubicacionId) {
      if (typeof swalErr === "function") {
        swalErr("Selecciona una ubicacion antes de bloquear la seleccion.");
      }
      if (ubicacionSelect) {
        ubicacionSelect.focus();
      }
      return;
    }

    toggleSelectionLock(true);
  }

  function initUbicacionSelectors() {
    if (!bodegaSelect || !ubicacionSelect || !lockButton) {
      return;
    }

    populateBodegaOptions();
    populateUbicacionOptions([]);
    setSelectDisabled(ubicacionSelect, true);
    updateLockButtonUI();

    bodegaSelect.addEventListener("change", handleBodegaChange);
    ubicacionSelect.addEventListener("change", handleUbicacionChange);
    lockButton.addEventListener("click", handleLockButtonClick);

    (async () => {
      await loadBodegas();
      await restoreSeleccionDesdeStorage();
    })();
  }

  function renderTabla(articulos) {
    tablaBody.innerHTML = "";

    if (!articulos.length) {
      const row = document.createElement("tr");
      row.className = "empty-state";
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "No se encontraron articulos registrados.";
      row.appendChild(cell);
      tablaBody.appendChild(row);
      return;
    }

    const fragment = document.createDocumentFragment();
    articulos.forEach((item) => {
      const row = filaTemplate.content
        .firstElementChild.cloneNode(true);
      row.dataset.code = item.code;

      row
        .querySelector('[data-field="code"]')
        ?.append(document.createTextNode(formatValue(item.code, "—")));
      row
        .querySelector('[data-field="descripcion"]')
        ?.append(
          document.createTextNode(
            formatValue(item.descripcion, "Sin descripcion"),
          ),
        );
      row
        .querySelector('[data-field="marca"]')
        ?.append(document.createTextNode(formatValue(item.marca, "—")));
      row
        .querySelector('[data-field="unidad_de_medida"]')
        ?.append(
          document.createTextNode(
            formatValue(item.unidad_de_medida, "—"),
          ),
        );
      row
        .querySelector('[data-field="existencias"]')
        ?.append(
          document.createTextNode(
            Number(item.existencias || 0).toLocaleString("es-CO"),
          ),
        );

      if (state.seleccionado?.code === item.code) {
        row.setAttribute("aria-selected", "true");
      }

      row.addEventListener("click", () => {
        seleccionarArticulo(item.code);
      });

      fragment.appendChild(row);
    });

    tablaBody.appendChild(fragment);
  }

  function applyInventarioFormState() {
    if (!inventarioForm) {
      return;
    }

    const shouldDisableInputs =
      inventarioForm.dataset.busy === "true" ||
      inventarioForm.dataset.enabled !== "true";

    if (inventarioCantidadInput) {
      inventarioCantidadInput.disabled = shouldDisableInputs;
    }

    if (inventarioSubmitBtn) {
      const disableButton =
        shouldDisableInputs ||
        !state.seleccionUbicacion.locked ||
        !state.seleccionUbicacion.ubicacionId;
      inventarioSubmitBtn.disabled = disableButton;
    }
  }

  function toggleInventarioForm(enabled) {
    if (!inventarioForm) {
      return;
    }
    inventarioForm.dataset.enabled = enabled ? "true" : "false";
    applyInventarioFormState();
  }

  function setInventarioFormBusy(isBusy) {
    if (!inventarioForm) {
      return;
    }
    inventarioForm.dataset.busy = isBusy ? "true" : "false";

    if (inventarioSubmitBtn) {
      if (isBusy) {
        inventarioSubmitBtn.dataset.originalLabel =
          inventarioSubmitBtn.dataset.originalLabel ||
          inventarioSubmitBtn.textContent ||
          "";
        inventarioSubmitBtn.textContent = "Guardando...";
      } else if (inventarioSubmitBtn.dataset.originalLabel) {
        inventarioSubmitBtn.textContent = inventarioSubmitBtn.dataset.originalLabel;
      }
    }

    applyInventarioFormState();
  }

  function renderInventarioDetalle(inventario) {
    if (!detalleInventarioLista) {
      return;
    }

    const items = Array.isArray(inventario) ? inventario : [];
    detalleInventarioLista.innerHTML = "";

    if (!items.length) {
      if (detalleInventarioVacio) {
        detalleInventarioVacio.hidden = false;
      }
      return;
    }

    if (detalleInventarioVacio) {
      detalleInventarioVacio.hidden = true;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const ubicacion = item?.ubicacion || {};
      const li = document.createElement("li");
      li.className = "location-item";
      li.dataset.id = item?.id ?? "";

      const info = document.createElement("div");
      info.className = "location-item-info";

      const titulo = document.createElement("strong");
      titulo.textContent = formatValue(
        ubicacion.ruta || ubicacion.nombre,
        ubicacion.id ? `Ubicacion ${ubicacion.id}` : "Ubicacion sin nombre",
      );
      info.appendChild(titulo);

      const secundarios = [];
      if (ubicacion.id !== undefined && ubicacion.id !== null) {
        secundarios.push(`ID ${ubicacion.id}`);
      }
      if (ubicacion.nomenclatura) {
        secundarios.push(`Nom. ${ubicacion.nomenclatura}`);
      }
      if (ubicacion.bodega) {
        secundarios.push(ubicacion.bodega);
      }

      if (secundarios.length) {
        const detalle = document.createElement("span");
        detalle.textContent = secundarios.join(" · ");
        info.appendChild(detalle);
      }

      const badge = document.createElement("span");
      badge.className = "location-item-badge";
      badge.textContent = `${Number(item?.cantidad || 0).toLocaleString(
        "es-CO",
      )} unidades`;

      li.append(info, badge);
      fragment.appendChild(li);
    });

    detalleInventarioLista.appendChild(fragment);
  }

  function extraerMensajeError(data, fallback) {
    if (data?.detail) {
      return data.detail;
    }
    if (data && typeof data === "object") {
      const detalles = Object.values(data)
        .flat()
        .map((item) => item?.toString?.() || "")
        .filter(Boolean);
      if (detalles.length) {
        return detalles.join(" ");
      }
    }
    return fallback;
  }

  function sincronizarResumen() {
    const totalExistencias = state.articulos.reduce(
      (total, item) => total + Number(item.existencias || 0),
      0,
    );
    const totalFotos = state.articulos.reduce((total, item) => {
      const fotos = Array.isArray(item.fotos) ? item.fotos : [];
      return total + fotos.filter(Boolean).length;
    }, 0);

    state.resumen = {
      ...state.resumen,
      articulos: state.articulos.length,
      existencias: totalExistencias,
      fotos: totalFotos,
    };

    updateResumen(state.resumen, state.articulos);
  }

  function actualizarArticuloInventario(articulo, registro, cantidad) {
    if (!articulo) {
      return;
    }

    const inventario = Array.isArray(articulo.inventario)
      ? articulo.inventario
      : (articulo.inventario = []);
    const index = inventario.findIndex((item) => item.id === registro.id);
    if (index >= 0) {
      inventario[index] = registro;
    } else {
      inventario.push(registro);
    }

    if (Number.isFinite(Number(cantidad))) {
      articulo.existencias = Number(articulo.existencias || 0) + Number(cantidad);
    }

    sincronizarResumen();
  }

  async function registrarInventario(articulo, cantidad) {
    if (!articulo || !articulo.code) {
      throw new Error("Articulo invalido. Recarga la pagina e intenta de nuevo.");
    }

    if (
      !state.seleccionUbicacion.locked ||
      !state.seleccionUbicacion.ubicacionId
    ) {
      throw new Error(
        "Bloquea la bodega y la ubicacion antes de registrar existencias.",
      );
    }

    const url = `${articulosEndpoint}${articulo.code}/inventario/`;
    const headers = {
      "Content-Type": "application/json",
    };
    if (csrfToken) {
      headers["X-CSRFToken"] = csrfToken;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({
        ubicacion: state.seleccionUbicacion.ubicacionId,
        cantidad,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      throw new Error(
        extraerMensajeError(
          data,
          "No fue posible registrar el ingreso de inventario.",
        ),
      );
    }

    actualizarArticuloInventario(articulo, data, cantidad);
    return data;
  }

  function renderDetalle(articulo) {
    closeLightbox();
    lightboxIndex = 0;

    if (!articulo) {
      detalleCodigo.textContent = "Sin seleccionar";
      detalleDescripcion.textContent =
        "Selecciona un articulo del listado para revisar su informacion y fotografias.";
      detalleMeta.innerHTML = "";
      detalleGaleria.innerHTML = "";
      if (inventarioForm) {
        inventarioForm.reset();
        inventarioForm.dataset.articulo = "";
        toggleInventarioForm(false);
      }
      renderInventarioDetalle([]);
      return;
    }

    detalleCodigo.textContent = articulo.code || "Sin codigo";
    detalleDescripcion.textContent =
      formatValue(articulo.descripcion, "Sin descripcion registrada.");

    const metaData = [
      {
        label: "Marca",
        value: formatValue(articulo.marca),
      },
      {
        label: "Unidad de medida",
        value: formatValue(articulo.unidad_de_medida),
      },
      {
        label: "Existencias",
        value: `${Number(articulo.existencias || 0).toLocaleString(
          "es-CO",
        )} unidades`,
        highlight: true,
      },
      {
        label: "Observaciones",
        value: formatValue(articulo.observacion, "Sin observaciones"),
      },
    ];

    detalleMeta.innerHTML = metaData
      .map(
        (item) => `
        <div class="meta-item">
          <span>${item.label}</span>
          <span class="${item.highlight ? "stock-highlight" : ""}">
            ${item.value}
          </span>
        </div>
      `,
      )
      .join("");

    renderInventarioDetalle(articulo.inventario);

    if (inventarioForm) {
      const articuloId = String(articulo.code ?? "");
      const previo = inventarioForm.dataset.articulo;
      inventarioForm.dataset.articulo = articuloId;
      if (previo !== articuloId) {
        inventarioForm.reset();
      }
      toggleInventarioForm(true);
    }

    const fotos = Array.isArray(articulo.fotos) ? articulo.fotos : [];
    if (!fotos.length) {
      detalleGaleria.innerHTML =
        '<p class="form-description">Este articulo no tiene fotografias asociadas.</p>';
    } else {
      detalleGaleria.innerHTML = fotos
        .map(
          (url, index) => `
            <img
              src="${url}"
              alt="Foto ${index + 1} del articulo ${articulo.code}"
              data-gallery-index="${index}"
              loading="lazy"
            >
          `,
        )
        .join("");
    }
  }

  async function handleInventarioSubmit(event) {
    event.preventDefault();

    if (!inventarioForm || inventarioForm.dataset.busy === "true") {
      return;
    }

    if (!state.seleccionado) {
      return;
    }

    if (typeof inventarioForm.reportValidity === "function" && !inventarioForm.reportValidity()) {
      return;
    }

    if (
      !state.seleccionUbicacion.locked ||
      !state.seleccionUbicacion.ubicacionId
    ) {
      if (typeof swalErr === "function") {
        swalErr("Bloquea la bodega y la ubicacion antes de registrar ingresos.");
      }
      return;
    }

    const articulo = state.seleccionado;
    const cantidad = Number.parseInt(
      inventarioCantidadInput?.value ?? "",
      10,
    );

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      if (typeof swalErr === "function") {
        swalErr("Ingresa una cantidad valida mayor a cero.");
      }
      return;
    }

    setInventarioFormBusy(true);

    try {
      await registrarInventario(articulo, cantidad);
      inventarioForm.reset();
      inventarioCantidadInput?.focus();

      renderTabla(state.filtrados);
      seleccionarArticulo(articulo.code);

      if (typeof swalToast === "function") {
        swalToast("success", "Inventario actualizado correctamente");
      }
    } catch (error) {
      console.error(error);
      if (typeof swalErr === "function") {
        swalErr(error.message);
      }
    } finally {
      setInventarioFormBusy(false);
    }
  }

  function seleccionarArticulo(code) {
    const articulo = state.articulos.find((item) => item.code === code);
    if (!articulo) return;

    state.seleccionado = articulo;
    renderDetalle(articulo);

    tablaBody
      .querySelectorAll("tr[data-code]")
      .forEach((row) => {
        row.setAttribute(
          "aria-selected",
          row.dataset.code === code ? "true" : "false",
        );
      });
  }

  function filtrarArticulos(query) {
    const term = query.trim().toLowerCase();
    if (!term) {
      state.filtrados = [...state.articulos];
    } else {
      state.filtrados = state.articulos.filter((item) => {
        const hayCoincidencia = [item.code, item.descripcion, item.marca]
          .map((value) => (value || "").toString().toLowerCase())
          .some((value) => value.includes(term));
        return hayCoincidencia;
      });
    }
    renderTabla(state.filtrados);
  }

  async function cargarArticulos() {
    try {
      tablaBody.innerHTML = `
        <tr class="empty-state">
          <td colspan="5">Cargando articulos...</td>
        </tr>
      `;

      const response = await fetch(articulosEndpoint, {
        headers: {
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Error al cargar articulos");
      }

      const data = await response.json();
      const articulos = Array.isArray(data?.articulos)
        ? data.articulos
        : Array.isArray(data)
        ? data
        : [];

      state.articulos = articulos;
      state.filtrados = [...articulos];
      state.resumen = data?.resumen || {};

      updateResumen(state.resumen, articulos);
      renderTabla(articulos);

      if (articulos.length) {
        seleccionarArticulo(articulos[0].code);
      } else {
        renderDetalle(null);
      }
    } catch (error) {
      console.error(error);
      tablaBody.innerHTML = `
        <tr class="empty-state">
          <td colspan="5">
            No fue posible cargar la informacion del inventario.
          </td>
        </tr>
      `;
      if (typeof swalErr === "function") {
        swalErr("No fue posible cargar la informacion del inventario.");
      }
    }
  }

  async function enviarFormulario(event) {
    event.preventDefault();
    setFormBusy(true);

    const formData = new FormData(form);
    const cantidadInicialValor = Number.parseInt(
      formData.get("cantidad_inicial") ?? "",
      10,
    );
    formData.delete("cantidad_inicial");
    const cantidadInicial =
      Number.isFinite(cantidadInicialValor) && cantidadInicialValor > 0
        ? cantidadInicialValor
        : 0;
    try {
      const headers = csrfToken ? { "X-CSRFToken": csrfToken } : {};
      const response = await fetch(articulosEndpoint, {
        method: "POST",
        body: formData,
        headers,
        credentials: "same-origin",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        let mensaje =
          errorData?.detail ||
          "No fue posible guardar el articulo. Revisa la informacion ingresada.";

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

      const nuevoArticulo = await response.json();
      if (typeof swalToast === "function") {
        swalToast("success", "Articulo guardado correctamente");
      }

      form.reset();
      resetPhotoManager();
      closeCamera();

      if (!Array.isArray(nuevoArticulo.inventario)) {
        nuevoArticulo.inventario = Array.isArray(nuevoArticulo.inventario)
          ? nuevoArticulo.inventario
          : [];
      }

      if (Array.isArray(state.articulos)) {
        const existenteIndex = state.articulos.findIndex(
          (item) => item.code === nuevoArticulo.code,
        );
        if (existenteIndex >= 0) {
          state.articulos[existenteIndex] = nuevoArticulo;
        } else {
          state.articulos.unshift(nuevoArticulo);
        }
      } else {
        state.articulos = [nuevoArticulo];
      }

      const puedeRegistrarInventario =
        cantidadInicial > 0 &&
        state.seleccionUbicacion.locked &&
        state.seleccionUbicacion.ubicacionId;

      if (puedeRegistrarInventario) {
        try {
          await registrarInventario(nuevoArticulo, cantidadInicial);
        } catch (errorInventario) {
          console.error(errorInventario);
          if (typeof swalErr === "function") {
            swalErr(
              `El articulo se creo, pero no fue posible registrar inventario: ${errorInventario.message}`,
            );
          }
          sincronizarResumen();
        }
      } else {
        sincronizarResumen();
      }

      filtrarArticulos(searchInput?.value || "");
      seleccionarArticulo(nuevoArticulo.code);
    } catch (error) {
      console.error(error);
      if (typeof swalErr === "function") {
        swalErr(error.message);
      }
    } finally {
      setFormBusy(false);
    }
  }

  function toggleFormulario(visible) {
    if (!panelFormulario) return;
    panelFormulario.dataset.collapsed = visible ? "false" : "true";
    if (visible) {
      form.querySelector("#code")?.focus();
    }
  }

  function initEventos() {
    form.addEventListener("submit", enviarFormulario);

    initUbicacionSelectors();

    if (abrirFormularioBtn) {
      abrirFormularioBtn.addEventListener("click", () => {
        toggleFormulario(true);
      });
    }

    if (cerrarFormularioBtn) {
      cerrarFormularioBtn.addEventListener("click", () => {
        toggleFormulario(false);
      });
    }

    if (fotoInput) {
      fotoInput.addEventListener("change", handleFileSelection);
    }

    if (previewFoto) {
      previewFoto.addEventListener("click", (event) => {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          target.dataset?.removePhoto
        ) {
          removePhoto(target.dataset.removePhoto);
        }
      });
    }

    if (abrirCamaraBtn) {
      abrirCamaraBtn.addEventListener("click", openCamera);
    }

    if (cerrarCamaraBtn) {
      cerrarCamaraBtn.addEventListener("click", closeCamera);
    }

    if (capturarFotoBtn) {
      capturarFotoBtn.addEventListener("click", capturePhoto);
    }

    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        filtrarArticulos(event.target.value);
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        if (searchInput) {
          searchInput.value = "";
        }
        filtrarArticulos("");
        searchInput?.focus();
      });
    }

    if (inventarioForm) {
      inventarioForm.dataset.enabled = "false";
      inventarioForm.dataset.busy = "false";
      inventarioForm.addEventListener("submit", handleInventarioSubmit);
      renderInventarioDetalle([]);
      toggleInventarioForm(false);
    }

    if (detalleGaleria) {
      detalleGaleria.addEventListener("click", (event) => {
        const target = event.target;
        if (
          target instanceof HTMLImageElement &&
          target.dataset?.galleryIndex
        ) {
          const index = Number.parseInt(target.dataset.galleryIndex, 10);
          if (Number.isFinite(index)) {
            openLightbox(index);
          }
        }
      });
    }

    if (galeriaModal) {
      galeriaModal.addEventListener("click", (event) => {
        if (event.target === galeriaModal) {
          closeLightbox();
        }
      });
    }

    if (cerrarModalGaleriaBtn) {
      cerrarModalGaleriaBtn.addEventListener("click", closeLightbox);
    }

    if (prevImagenBtn) {
      prevImagenBtn.addEventListener("click", () => {
        if (lightboxIndex > 0) {
          showLightboxImage(lightboxIndex - 1);
        }
      });
    }

    if (nextImagenBtn) {
      nextImagenBtn.addEventListener("click", () => {
        const fotos = getGaleriaFotos();
        if (lightboxIndex < fotos.length - 1) {
          showLightboxImage(lightboxIndex + 1);
        }
      });
    }

    window.addEventListener("pagehide", closeCamera);
    window.addEventListener("beforeunload", closeCamera);
    window.addEventListener("pagehide", closeLightbox);
    window.addEventListener("beforeunload", closeLightbox);
  }

  initEventos();
  renderPhotoPreview();
  cargarArticulos();
})();
