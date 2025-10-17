(() => {
  const config = window.estantesLoteConfig || {};
  const endpoint =
    config.endpoints?.crear ||
    "/inventario/ubicaciones/estantes/lote/api/";
  const bodegas = Array.isArray(config.bodegas) ? config.bodegas : [];

  const form = document.querySelector("#formEstantesLote");
  if (!form) {
    return;
  }

  const bodegaSelect = form.querySelector("#bodega");
  const nombreBaseInput = form.querySelector("#nombreBase");
  const cantidadInput = form.querySelector("#cantidadEstantes");
  const panelesInput = form.querySelector("#panelesPorEstante");
  const divisionesInput = form.querySelector("#divisionesPorPanel");
  const descripcionInput = form.querySelector("#descripcionEstante");
  const submitBtn = form.querySelector("#crearLoteBtn");
  const limpiarBtn = form.querySelector("#limpiarFormularioLote");

  const previewList = document.querySelector("#previewEstantes");
  const statsWrapper = document.querySelector("#statsResumen");
  const statEstantes = document.querySelector("#statEstantes");
  const statPaneles = document.querySelector("#statPaneles");
  const statDivisiones = document.querySelector("#statDivisiones");
  const resultados = document.querySelector("#resultadoEstantes");

  const csrfToken =
    form.querySelector("[name=csrfmiddlewaretoken]")?.value ||
    document.querySelector("input[name=csrfmiddlewaretoken]")?.value ||
    "";

  function poblarBodegas() {
    const fragment = document.createDocumentFragment();
    bodegas
      .slice()
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""))
      .forEach((bodega) => {
        const option = document.createElement("option");
        option.value = bodega.id ?? "";
        option.textContent = bodega.nombre || `Bodega ${bodega.id}`;
        fragment.appendChild(option);
      });
    bodegaSelect.appendChild(fragment);
  }

  function clamp(valor, min, max) {
    const numero = Number.parseInt(valor, 10);
    if (Number.isNaN(numero)) return min;
    return Math.min(Math.max(numero, min), max);
  }

  function calcularPadding(total) {
    return total >= 100 ? 3 : total >= 10 ? 2 : 1;
  }

  function generarNombre(base, indice, padding) {
    const sufijo = String(indice).padStart(padding, "0");
    return padding > 1 ? `${base} ${sufijo}` : `${base} ${indice}`;
  }

  function actualizarPreview() {
    if (!previewList) return;
    const base = (nombreBaseInput.value || "").trim();
    const cantidad = clamp(cantidadInput.value, 1, 200);
    const paneles = clamp(panelesInput.value, 0, 50);
    const divisiones = clamp(divisionesInput.value, 0, 50);

    previewList.innerHTML = "";

    if (!base || !cantidad) {
      const item = document.createElement("li");
      item.innerHTML = `
        <strong>-</strong>
        <span>Completa los campos para ver un ejemplo.</span>
      `;
      previewList.appendChild(item);
      statsWrapper.hidden = true;
      return;
    }

    const padding = calcularPadding(cantidad);
    const ejemplos = Math.min(cantidad, 3);

    for (let i = 1; i <= ejemplos; i += 1) {
      const nombre = generarNombre(base, i, padding);
      const item = document.createElement("li");
      item.innerHTML = `
        <strong>${nombre}</strong>
        <span>${paneles} panel(es) - ${divisiones} division(es) por panel</span>
      `;
      previewList.appendChild(item);
    }

    if (cantidad > ejemplos) {
      const extra = document.createElement("li");
      extra.innerHTML = `
        <strong>...</strong>
        <span>y ${cantidad - ejemplos} estante(s) adicionales</span>
      `;
      previewList.appendChild(extra);
    }

    statEstantes.textContent = cantidad;
    statPaneles.textContent = cantidad * paneles;
    statDivisiones.textContent = cantidad * paneles * divisiones;
    statsWrapper.hidden = false;
  }

  function limpiarResultados() {
    resultados.innerHTML = `
      <div class="results-empty">
        Aun no se han creado estantes en esta sesion.
      </div>
    `;
    statsWrapper.hidden = true;
  }

  function renderResultados(data) {
    if (!data || !Array.isArray(data.estantes) || !data.estantes.length) {
      limpiarResultados();
      return;
    }
    resultados.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "results-list";
    data.estantes.forEach((item) => {
      const tarjeta = document.createElement("div");
      tarjeta.className = "result-item";
      tarjeta.innerHTML = `
        <strong>${item.nombre}</strong>
        <span>Nomenclatura: ${item.nomenclatura || "-"}</span>
        <span>Paneles: ${item.paneles}</span>
        <span>Divisiones por panel: ${item.divisiones}</span>
      `;
      grid.appendChild(tarjeta);
    });
    resultados.appendChild(grid);

    if (data.resumen) {
      statEstantes.textContent = data.resumen.estantes || data.estantes.length;
      statPaneles.textContent =
        data.resumen.paneles ?? data.estantes.length * data.estantes[0].paneles;
      statDivisiones.textContent =
        data.resumen.divisiones ??
        data.estantes.length *
          data.estantes[0].paneles *
          data.estantes[0].divisiones;
      statsWrapper.hidden = false;
    }
  }

  function resetFormulario() {
    form.reset();
    if (bodegaSelect) {
      bodegaSelect.selectedIndex = 0;
    }
    if (cantidadInput) cantidadInput.value = 1;
    if (panelesInput) panelesInput.value = 0;
    if (divisionesInput) divisionesInput.value = 0;
    descripcionInput.value = "";
    actualizarPreview();
  }

  function toggleLoading(estaCargando) {
    if (!submitBtn) return;
    submitBtn.disabled = estaCargando;
    submitBtn.textContent = estaCargando
      ? "Creando estantes..."
      : "Crear estantes";
  }

  async function enviarFormulario() {
    const base = (nombreBaseInput.value || "").trim();
    const payload = {
      bodega: bodegaSelect.value || null,
      nombre_base: base,
      descripcion: (descripcionInput.value || "").trim(),
      cantidad_estantes: clamp(cantidadInput.value, 1, 200),
      paneles_por_estante: clamp(panelesInput.value, 0, 50),
      divisiones_por_panel: clamp(divisionesInput.value, 0, 50),
    };

    if (!payload.bodega) {
      await swalErr("Selecciona una bodega destino.");
      return;
    }
    if (!payload.nombre_base) {
      await swalErr("Ingresa un nombre base para los estantes.");
      return;
    }
    if (!Number.isInteger(payload.cantidad_estantes) || payload.cantidad_estantes < 1) {
      await swalErr("La cantidad de estantes debe ser un numero positivo.");
      return;
    }
    if (
      payload.paneles_por_estante === 0 &&
      payload.divisiones_por_panel > 0
    ) {
      await swalErr(
        "Para agregar divisiones, primero asigna al menos un panel por estante.",
      );
      return;
    }

    toggleLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const resultado = await response.json().catch(() => ({}));

      if (!response.ok) {
        const mensaje =
          resultado?.detail ||
          Object.entries(resultado || {})
            .map(([clave, valor]) =>
              Array.isArray(valor)
                ? `${clave}: ${valor.join(", ")}`
                : `${clave}: ${valor}`,
            )
            .join("\n") ||
          "No fue posible completar la creacion en lote.";
        await swalErr(mensaje);
        return;
      }

      await swalTrue(
        `Se crearon ${resultado?.resumen?.estantes || payload.cantidad_estantes} estantes.`,
      );
      renderResultados(resultado);
    } catch (error) {
      console.error(error);
      await swalErr("Ocurrio un error inesperado al crear los estantes.");
    } finally {
      toggleLoading(false);
    }
  }

  poblarBodegas();
  actualizarPreview();
  limpiarResultados();

  nombreBaseInput.addEventListener("input", actualizarPreview);
  cantidadInput.addEventListener("input", actualizarPreview);
  panelesInput.addEventListener("input", actualizarPreview);
  divisionesInput.addEventListener("input", actualizarPreview);

  limpiarBtn.addEventListener("click", () => {
    resetFormulario();
    limpiarResultados();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    enviarFormulario();
  });
})();
