(() => {
  const config = window.inventarioConfig || {};
  const endpoints = config.endpoints || {};
  const articulosEndpoint =
    endpoints.articulos || "/inventario/articulos/";
  const bodegasEndpoint = endpoints.bodegas || "/inventario/bodegas/api/";
  const marcasEndpoint = endpoints.marcas || "/inventario/marcas/api/";
  const unidadesMedidaEndpoint =
    endpoints.unidades_medida || "/inventario/unidades-medida/api/";
  const $ = window.jQuery || null;
  const hasSelect2 = Boolean($ && $.fn && $.fn.select2);

  const form = document.querySelector("#formArticulo");
  const dialogoArticulo = document.querySelector("#dialogoArticulo");
  const errorFormulario = document.querySelector("#errorFormularioArticulo");
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
  const bodegaSelect = document.querySelector("#selectorBodega");
  const ubicacionSelect = document.querySelector("#selectorUbicacion");
  const lockButton = document.querySelector("#bloquearUbicacionBtn");
  const inventarioForm = document.querySelector("#formInventario");
  const inventarioCantidadInput = document.querySelector("#inventarioCantidad");
  const inventarioSubmitBtn = document.querySelector("#agregarInventarioBtn");
  const ubicacionStorageKey = "inventario::ubicacionTrabajo";
  const seleccionResumen = document.querySelector("#inventarioSeleccionResumen");
  const marcaSelect = document.querySelector("#marca");
  const unidadSelect = document.querySelector("#unidad_de_medida");

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
    marcas: [],
    unidades: [],
    bodegaId: null,
    ubicacionId: null,
    ubicaciones: [],
    contextoCargado: false,
    locked: false,
    ingresoBusy: false,
  };

  const photoState = [];
  let cameraStream = null;
  let lightboxIndex = 0;

  const csrfToken =
    form.querySelector("[name=csrfmiddlewaretoken]")?.value ||
    document.querySelector("input[name=csrfmiddlewaretoken]")?.value ||
    "";

  function setFormBusy(isBusy) {
    if (!guardarBtn) return;
    guardarBtn.disabled = isBusy;
    if (cerrarFormularioBtn) cerrarFormularioBtn.disabled = isBusy;
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
      removeBtn.textContent = "X";
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
      existencias: articulos.reduce((total, item) => total + existenciasBodega(item), 0),
      ubicaciones: new Set(articulos.flatMap((item) => inventarioBodega(item).map((registro) => registro.ubicacion?.id))).size,
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
    if (item.codigo_contenedor) partes.push(item.codigo_contenedor);
    if (item.nomenclatura) {
      partes.push(item.nomenclatura);
    }
    const ruta = item.ruta || item.nombre;
    if (ruta) {
      partes.push(ruta);
    }
    const base = partes.filter(Boolean).join(" - ") || `Ubicacion ${item.id}`;
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

  function isSelect2Active(element) {
    return Boolean(hasSelect2 && element && $(element).data("select2"));
  }

  function setOptionsForSelect(element, optionsList, selectedValue) {
    if (!element) {
      return;
    }
    const value =
      selectedValue !== undefined && selectedValue !== null
        ? String(selectedValue)
        : "";

    if (isSelect2Active(element)) {
      const $element = $(element);
      $element.empty();
      optionsList.forEach((option) => {
        const optionValue =
          option && option.value !== undefined && option.value !== null
            ? String(option.value)
            : "";
        const optionLabel =
          option && option.label !== undefined && option.label !== null
            ? String(option.label)
            : "";
        $element.append(new Option(optionLabel, optionValue, false, false));
      });
      $element.val(value || null).trigger("change.select2");
      return;
    }

    element.innerHTML = "";
    optionsList.forEach((option) => {
      const optionValue =
        option && option.value !== undefined && option.value !== null
          ? String(option.value)
          : "";
      const optionLabel =
        option && option.label !== undefined && option.label !== null
          ? String(option.label)
          : "";
      const optionElement = document.createElement("option");
      optionElement.value = optionValue;
      optionElement.textContent = optionLabel;
      if (option && option.dataset && typeof option.dataset === "object") {
        Object.entries(option.dataset).forEach(([key, dato]) => {
          if (key) {
            optionElement.dataset[key] = dato ?? "";
          }
        });
      }
      element.appendChild(optionElement);
    });
    element.value = value;
  }

  function setSelectDisabled(element, disabled) {
    if (!element) return;
    element.disabled = Boolean(disabled);
    if (isSelect2Active(element)) {
      const $element = $(element);
      $element.prop("disabled", Boolean(disabled));
      if (disabled) {
        $element.select2("close");
      }
    }
  }

  function populateBodegaOptions(selectedValue = null) {
    if (!bodegaSelect) return;

    const valorSeleccionado =
      selectedValue !== null && selectedValue !== undefined
        ? String(selectedValue)
        : state.bodegaId
        ? String(state.bodegaId)
        : "";

    const placeholderLabel = bodegaSelect.dataset.placeholder || "";
    const opciones = [
      { value: "", label: placeholderLabel },
      ...state.bodegas.map((bodega) => ({
        value: String(bodega.id),
        label: bodega.nombre,
      })),
    ];

    setOptionsForSelect(bodegaSelect, opciones, valorSeleccionado);
  }

  function populateMarcaOptions(selectedValue = null) {
    if (!marcaSelect) return;
    const placeholderLabel = marcaSelect.dataset.placeholder || "Selecciona una marca";
    const opciones = [
      { value: "", label: placeholderLabel },
      ...state.marcas.map((item) => ({
        value: String(item.id),
        label: item.nombre || "",
      })),
    ];
    setOptionsForSelect(marcaSelect, opciones, selectedValue);
  }

  function populateUnidadMedidaOptions(selectedValue = null) {
    if (!unidadSelect) return;
    const placeholderLabel = unidadSelect.dataset.placeholder || "Selecciona una unidad";
    const opciones = [
      { value: "", label: placeholderLabel },
      ...state.unidades.map((item) => ({
        value: String(item.id),
        label: item.nombre || "",
      })),
    ];
    setOptionsForSelect(unidadSelect, opciones, selectedValue);
  }

  function initFormularioSelects() {
    if (hasSelect2) {
      if (marcaSelect && !isSelect2Active(marcaSelect)) {
        $(marcaSelect).select2({
          placeholder: marcaSelect.dataset.placeholder || "Selecciona una marca",
          allowClear: true,
          width: "resolve",
          dropdownParent: $(dialogoArticulo),
        });
      }
      if (unidadSelect && !isSelect2Active(unidadSelect)) {
        $(unidadSelect).select2({
          placeholder: unidadSelect.dataset.placeholder || "Selecciona una unidad",
          allowClear: true,
          width: "resolve",
          dropdownParent: $(dialogoArticulo),
        });
      }
    }

    populateMarcaOptions(marcaSelect ? marcaSelect.value : "");
    populateUnidadMedidaOptions(unidadSelect ? unidadSelect.value : "");
  }
  function updateSeleccionResumen() {
    if (!seleccionResumen) return;
    const id = state.bodegaId;
    const ubicacion = state.ubicaciones.find((item) => item.id === state.ubicacionId);
    seleccionResumen.textContent = id
      ? `Existencias en ${getBodegaName(id)}${ubicacion ? ` · ${labelUbicacion(ubicacion)}` : ""}. ${state.locked ? "Seleccion confirmada." : "Confirma bodega y ubicacion para registrar entradas."}`
      : "Existencias de todas las bodegas. Elige una bodega para acotar la consulta.";
  }

  function inventarioBodega(articulo) {
    const id = state.bodegaId;
    return (articulo?.inventario || []).filter((item) => (!id || Number(item.ubicacion?.bodega_id) === Number(id))
      && (!state.ubicacionId || Number(item.ubicacion?.id) === state.ubicacionId));
  }

  function existenciasBodega(articulo) {
    return inventarioBodega(articulo).reduce((total, item) => total + Number(item.cantidad || 0), 0);
  }

  function refrescarBodega() {
    actualizarContextoUI();
    updateSeleccionResumen();
    filtrarArticulos(searchInput?.value || "");
    updateResumen(state.resumen, state.articulos);
    renderDetalle(state.seleccionado);
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
      return true;
    } catch (error) {
      console.error(error);
      if (typeof swalErr === "function") {
        swalErr("No fue posible cargar el listado de bodegas.");
      }
      return false;
    }
  }


  async function loadMarcas() {
    if (!marcaSelect) {
      return;
    }
    try {
      const response = await fetch(marcasEndpoint, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("No fue posible cargar las marcas.");
      }
      const data = await response.json();
      state.marcas = Array.isArray(data) ? data : [];
      populateMarcaOptions(marcaSelect.value);
    } catch (error) {
      console.error(error);
      if (typeof swalErr === "function") {
        swalErr("No fue posible cargar el listado de marcas.");
      }
    }
  }

  async function loadUnidadesMedida() {
    if (!unidadSelect) {
      return;
    }
    try {
      const response = await fetch(unidadesMedidaEndpoint, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("No fue posible cargar las unidades de medida.");
      }
      const data = await response.json();
      state.unidades = Array.isArray(data) ? data : [];
      populateUnidadMedidaOptions(unidadSelect.value);
    } catch (error) {
      console.error(error);
      if (typeof swalErr === "function") {
        swalErr("No fue posible cargar el listado de unidades de medida.");
      }
    }
  }
  function handleBodegaChange(eventOrValue) {
    if (state.locked || state.ingresoBusy) return;
    const valor = eventOrValue?.target ? eventOrValue.target.value : eventOrValue;
    state.bodegaId = parsePositiveInt(valor);
    state.ubicacionId = null;
    window.bodegaSeleccion.set(valor);
    guardarUbicacion();
    poblarUbicaciones();
    refrescarBodega();
  }

  function labelUbicacion(item) {
    return `${item.codigo_contenedor || item.nomenclatura || item.id} · ${item.ruta || item.nombre}`;
  }

  function poblarUbicaciones() {
    const opciones = [{ value: "", label: "Selecciona una ubicacion" },
      ...state.ubicaciones.filter((item) => Number(item.bodega) === state.bodegaId)
        .map((item) => ({ value: item.id, label: labelUbicacion(item) }))];
    setOptionsForSelect(ubicacionSelect, opciones, state.ubicacionId);
  }

  function guardarUbicacion() {
    try {
      localStorage.setItem(ubicacionStorageKey, JSON.stringify({ bodegaId: state.bodegaId, ubicacionId: state.ubicacionId, locked: state.locked }));
    } catch (_) { /* La seleccion sigue operativa sin almacenamiento. */ }
  }

  function actualizarContextoUI() {
    setSelectDisabled(bodegaSelect, !state.contextoCargado || state.locked || state.ingresoBusy);
    setSelectDisabled(ubicacionSelect, !state.contextoCargado || !state.bodegaId || state.locked || state.ingresoBusy);
    lockButton.textContent = state.locked ? "Liberar" : "Seleccionar ubicacion";
    lockButton.disabled = !state.contextoCargado || state.ingresoBusy || (!state.locked && !(state.bodegaId && state.ubicacionId));
    lockButton.classList.toggle("danger-button", state.locked);
    inventarioCantidadInput.disabled = !state.locked || !state.seleccionado || state.ingresoBusy;
    inventarioSubmitBtn.disabled = inventarioCantidadInput.disabled;
  }

  async function initBodegaSelector() {
    if (!bodegaSelect) return;
    setSelectDisabled(bodegaSelect, true);
    if (hasSelect2) {
      $(bodegaSelect).select2({ placeholder: "Todas las bodegas", allowClear: true, width: "resolve" });
      $(bodegaSelect).on("change.inventario", () => handleBodegaChange($(bodegaSelect).val()));
      $(ubicacionSelect).select2({ placeholder: "Selecciona una ubicacion", allowClear: true, width: "resolve" });
      $(ubicacionSelect).on("change.inventario", () => cambiarUbicacion($(ubicacionSelect).val()));
    } else {
      bodegaSelect.addEventListener("change", handleBodegaChange);
      ubicacionSelect.addEventListener("change", (event) => cambiarUbicacion(event.target.value));
    }
    function cambiarUbicacion(value) {
      if (state.locked || state.ingresoBusy) return;
      state.ubicacionId = parsePositiveInt(value);
      guardarUbicacion();
      refrescarBodega();
    }
    lockButton.addEventListener("click", () => {
      if (state.ingresoBusy) return;
      state.locked = !state.locked;
      window.bodegaSeleccion.set(state.bodegaId, state.locked);
      guardarUbicacion();
      refrescarBodega();
    });
    if (!await loadBodegas()) return;
    state.bodegaId = parsePositiveInt(window.bodegaSeleccion.get(state.bodegas));
    try {
      const response = await fetch(endpoints.ubicaciones || "/inventario/ubicaciones/api/", { credentials: "same-origin" });
      if (!response.ok) throw new Error("No fue posible cargar las ubicaciones.");
      const data = await response.json();
      const aplanar = (items) => items.flatMap((item) => [item, ...aplanar(item.hijos || [])]);
      state.ubicaciones = aplanar(data.ubicaciones || []);
      let anterior = null;
      try { anterior = JSON.parse(localStorage.getItem(ubicacionStorageKey) || "null"); } catch (_) { /* Ignorar datos invalidos. */ }
      if (Number(anterior?.bodegaId) === state.bodegaId
        && state.ubicaciones.some((item) => item.id === Number(anterior?.ubicacionId) && Number(item.bodega) === state.bodegaId)) {
        state.ubicacionId = Number(anterior.ubicacionId);
        state.locked = Boolean(anterior.locked && window.bodegaSeleccion.isLocked());
      }
      state.contextoCargado = true;
    } catch (error) {
      if (typeof swalErr === "function") swalErr(error.message);
    }
    populateBodegaOptions(state.bodegaId);
    poblarUbicaciones();
    guardarUbicacion();
    refrescarBodega();
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

      const marcaNombre = item?.marca_detalle?.nombre || "";
      const unidadNombre = item?.unidad_medida_detalle?.nombre || "";

      row
        .querySelector('[data-field="code"]')
        ?.append(document.createTextNode(formatValue(item.code, "-")));
      row
        .querySelector('[data-field="descripcion"]')
        ?.append(
          document.createTextNode(
            formatValue(item.descripcion, "Sin descripcion"),
          ),
        );
      row
        .querySelector('[data-field="marca"]')
        ?.append(
          document.createTextNode(
            formatValue(marcaNombre, "Sin marca"),
          ),
        );
      row
        .querySelector('[data-field="unidad_de_medida"]')
        ?.append(
          document.createTextNode(
            formatValue(unidadNombre, "Sin unidad"),
          ),
        );
      row
        .querySelector('[data-field="existencias"]')
        ?.append(
          document.createTextNode(
            existenciasBodega(item).toLocaleString("es-CO"),
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
      if (ubicacion.codigo_contenedor) secundarios.push(ubicacion.codigo_contenedor);
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
        detalle.textContent = secundarios.join(" - ");
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

  async function registrarInventario(articulo, cantidad) {
    if (!articulo || !state.locked || !state.ubicacionId) throw new Error("Selecciona primero la bodega y ubicacion.");
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) throw new Error("Indica una cantidad entera positiva.");
    const response = await fetch(`${articulosEndpoint}${articulo.code}/inventario/`, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
      body: JSON.stringify({ ubicacion: state.ubicacionId, cantidad }),
    });
    const registro = await response.json();
    if (!response.ok) throw new Error(extraerMensajeError(registro, "No fue posible registrar la entrada."));
    const existente = (articulo.inventario || []).find((item) => item.id === registro.id);
    if (existente) Object.assign(existente, registro);
    else (articulo.inventario ||= []).push(registro);
    articulo.existencias = Number(articulo.existencias || 0) + cantidad;
    sincronizarResumen();
  }

  function renderDetalle(articulo) {
    const historialLink = document.querySelector("#historialArticuloLink");
    historialLink.href = articulo ? `${config.endpoints.historial}?modo=id&articulo=${encodeURIComponent(articulo.code)}` : config.endpoints.historial;
    actualizarContextoUI();
    closeLightbox();
    lightboxIndex = 0;

    if (!articulo) {
      detalleCodigo.textContent = "Sin seleccionar";
      detalleDescripcion.textContent =
        "Selecciona un articulo del listado para revisar su informacion y fotografias.";
      detalleMeta.innerHTML = "";
      detalleGaleria.innerHTML = "";
      renderInventarioDetalle([]);
      return;
    }

    detalleCodigo.textContent = articulo.code || "Sin codigo";
    detalleDescripcion.textContent =
      formatValue(articulo.descripcion, "Sin descripcion registrada.");

    const metaData = [
      {
        label: "Marca",
        value: formatValue(articulo?.marca_detalle?.nombre, "Sin marca"),
      },
      {
        label: "Unidad de medida",
        value: formatValue(
          articulo?.unidad_medida_detalle?.nombre,
          "Sin unidad",
        ),
      },
      {
        label: "Existencias",
        value: `${existenciasBodega(articulo).toLocaleString(
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

    renderInventarioDetalle(inventarioBodega(articulo));


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
        const campos = [
          item.code,
          item.descripcion,
          item.observacion,
          item?.marca_detalle?.nombre,
          item?.unidad_medida_detalle?.nombre,
        ];
        return campos
          .map((value) => (value || "").toString().toLowerCase())
          .some((value) => value.includes(term));
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
    if (state.ingresoBusy) return;
    errorFormulario.hidden = true;
    if (!form.reportValidity()) return;
    setFormBusy(true);

    const formData = new FormData(form);
    const cantidadInicial = Number(formData.get("cantidad_inicial") || 0);
    formData.delete("cantidad_inicial");
    if (!Number.isSafeInteger(cantidadInicial) || cantidadInicial < 0 || (cantidadInicial > 0 && !state.locked)) {
      errorFormulario.textContent = "Para ingresar una cantidad inicial, confirma primero la bodega y ubicacion. La cantidad debe ser un entero positivo.";
      errorFormulario.hidden = false;
      setFormBusy(false);
      return;
    }
    if (cantidadInicial > 0) {
      state.ingresoBusy = true;
      actualizarContextoUI();
    }
    if (!formData.get("marca")) {
      formData.delete("marca");
    }
    if (!formData.get("unidad_de_medida")) {
      formData.delete("unidad_de_medida");
    }
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
      dialogoArticulo.close();
      if (typeof swalToast === "function") {
        swalToast("success", "Articulo guardado correctamente");
      }

      form.reset();
      resetFormularioSelects();
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

      if (cantidadInicial > 0) {
        try { await registrarInventario(nuevoArticulo, cantidadInicial); }
        catch (error) { if (typeof swalErr === "function") swalErr(`Articulo creado. No se pudo registrar la entrada: ${error.message}`); }
      }
      sincronizarResumen();
      filtrarArticulos(searchInput?.value || "");
      seleccionarArticulo(nuevoArticulo.code);
    } catch (error) {
      console.error(error);
      if (dialogoArticulo.open) {
        errorFormulario.textContent = error.message;
        errorFormulario.hidden = false;
      } else if (typeof swalErr === "function") {
        swalErr(error.message);
      }
    } finally {
      setFormBusy(false);
      state.ingresoBusy = false;
      actualizarContextoUI();
    }
  }

  function resetFormularioSelects() {
    const selects = [marcaSelect, unidadSelect];
    selects.forEach((select) => {
      if (!select) {
        return;
      }
      if (isSelect2Active(select)) {
        $(select).val(null).trigger("change.select2");
      } else {
        select.value = "";
      }
    });
  }

  function toggleFormulario(visible) {
    if (!dialogoArticulo) return;
    if (visible) {
      errorFormulario.hidden = true;
      if (!dialogoArticulo.open) dialogoArticulo.showModal();
      form.querySelector("#descripcion")?.focus();
    } else if (!guardarBtn.disabled) {
      dialogoArticulo.close();
    }
  }

  function initEventos() {
    form.addEventListener("submit", enviarFormulario);
    dialogoArticulo.addEventListener("cancel", (event) => {
      if (guardarBtn.disabled) event.preventDefault();
    });
    dialogoArticulo.addEventListener("close", () => {
      closeCamera();
      abrirFormularioBtn?.focus();
    });

    initBodegaSelector();
    inventarioForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.ingresoBusy || !inventarioForm.reportValidity()) return;
      state.ingresoBusy = true;
      actualizarContextoUI();
      try {
        await registrarInventario(state.seleccionado, Number(inventarioCantidadInput.value));
        inventarioForm.reset();
        refrescarBodega();
        if (typeof swalToast === "function") swalToast("success", "Inventario actualizado correctamente");
      } catch (error) {
        if (typeof swalErr === "function") swalErr(error.message);
      } finally {
        state.ingresoBusy = false;
        actualizarContextoUI();
      }
    });
    initFormularioSelects();
    loadMarcas();
    loadUnidadesMedida();

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



