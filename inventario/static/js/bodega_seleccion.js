(() => {
  const legacyKey = "inventario::seleccionUbicacion";
  const idValido = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
  function crearSeleccion(operacion = "") {
    const sufijo = operacion ? `::${operacion}` : "";
    const key = `inventario::bodegaSeleccionada${sufijo}`;
    const lockKey = `inventario::bodegaBloqueada${sufijo}`;
    return {
      get(bodegas) {
        try {
          let value = localStorage.getItem(key);
          // Recuperar solo la bodega de la antigua seleccion fija.
          if (!operacion && value === null) {
            const anterior = JSON.parse(localStorage.getItem(legacyKey) || "null");
            value = anterior?.bodegaId == null ? "" : String(anterior.bodegaId);
          }
          if (!operacion) localStorage.removeItem(legacyKey);
          if (!idValido(value) || !bodegas.some((item) => Number(item.id) === Number(value))) {
            value = "";
            localStorage.removeItem(lockKey);
          }
          localStorage.setItem(key, value);
          return value;
        } catch (_) {
          return "";
        }
      },
      set(value, locked = false) {
        try {
          localStorage.setItem(key, idValido(value) ? String(Number(value)) : "");
          localStorage.setItem(lockKey, locked && idValido(value) ? "1" : "0");
          if (!operacion) localStorage.removeItem(legacyKey);
        } catch (_) {
          // La seleccion sigue funcionando si el navegador bloquea el almacenamiento.
        }
      },
      isLocked() {
        try { return localStorage.getItem(lockKey) === "1"; } catch (_) { return false; }
      },
    };
  }
  window.bodegaSeleccion = crearSeleccion();
  window.bodegaSeleccion.paraOperacion = crearSeleccion;
})();
