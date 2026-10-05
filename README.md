# Proyecto Inventario

## Propósito y estado

Aplicación web de inventario para registrar artículos, sus existencias por ubicación y la organización física de varias bodegas. Tiene una interfaz en español hecha con plantillas Django y JavaScript, una API JSON con Django REST Framework y administración mediante `/admin/`.

Este documento describe el código presente en el repositorio y el estado local comprobado el 5 de octubre de 2026. El menú incluye **Artículos** para gestión de productos, **Almacenar** para entradas, **Picking** para salidas, **Traslados** para mover cantidades entre ubicaciones y **Histórico de movimientos** para consultar las tres operaciones. Los contenedores completos tienen su propio historial de traslados.

## Estructura

| Ruta | Función |
| --- | --- |
| `inventario/manage.py` | Comandos de Django. |
| `inventario/inventario/settings.py` | Configuración, conexión a MariaDB, archivos estáticos y multimedia. |
| `inventario/inventario/urls.py` | Publica `/admin/` y las rutas de `/inventario/`. |
| `inventario/almacen/models.py` | Entidades y reglas de ubicaciones y distribución. |
| `inventario/almacen/views.py` | Páginas HTML y endpoints JSON. |
| `inventario/almacen/serializers.py` | Validación y representación de API. |
| `inventario/almacen/admin.py` | Gestión de catálogos y artículos en Django Admin. |
| `inventario/templates/` y `inventario/static/js/` | Interfaz de usuario y llamadas a la API. |
| `inventario/almacen/migrations/` | Esquema versionado hasta `0015_ubicaciones_entradas_salidas`. |
| `requeriments.txt` | Dependencias Python; el nombre del archivo tiene esa grafía. |

## Modelo de datos y reglas principales

- **Bodega** agrupa ubicaciones y tiene un único **PlanoDistribucion**.
- **Ubicacion** forma un árbol dentro de una bodega. Las ubicaciones fijas son `ESTANTE` y `ESTIBA` en la raíz, `PANEL` bajo estante y `DIVISION` bajo panel. Los nodos `CONTENEDOR` son móviles y pueden estar en la raíz, bajo una ubicación fija o dentro de otro contenedor. El modelo valida la bodega, impide ciclos, asigna nivel por tipo, renumera elementos de su grupo y calcula una nomenclatura de posición como `100_1_2`. Crear una división no mueve contenedores automáticamente.
- **Contenedores móviles:** siguen siendo nodos de `Ubicacion` para conservar las referencias existentes de inventario. Cada uno tiene un `codigo_contenedor` único y permanente, como `C4`, generado a partir de su ID; `es_movil` distingue su comportamiento. Su código identifica la caja y su `ruta`/`nomenclatura` muestran su posición actual. La migración `0018_nomenclatura_contenedores_corta` actualiza los códigos anteriores `CONT-000004` y recalcula las nomenclaturas existentes, conservando IDs, relaciones y cantidades. Los registros históricos conservan sus datos capturados originalmente. El nivel 4 identifica el tipo contenedor; no limita la profundidad de las cajas anidadas.
- **MovimientoContenedor** registra fecha, usuario (si inició sesión), rutas y bodegas de origen y destino. Cada traslado genera una entrada para la caja principal y para todas sus cajas internas; `contenedor_principal` identifica qué caja se movió explícitamente. El servicio `almacen/services.py` cambia el padre, actualiza la bodega de todo el subárbol en una transacción y conserva IDs, códigos y cantidades de inventario. Las operaciones de movimiento se serializan con bloqueos de bodegas para impedir cambios concurrentes incompatibles. Cambiar el padre/bodega de una caja desde Django Admin usa la misma operación.
- **DistribucionUbicacion** guarda fila, columna, ancho y alto de estantes o estibas en el plano; también admite pasillos sin ubicación vinculada. La API permite leer y guardar la distribución de cada bodega.
- **Marca** y **UnidadMedida** son catálogos opcionales de **Articulo**. `Articulo.code` es su clave numérica; `FotosArticulos` almacena rutas de imágenes en `media/fotos_articulos/` y reduce imágenes grandes al guardarlas.
- **Inventario** guarda una cantidad para un artículo en una ubicación. Las existencias mostradas por artículo suman sus filas de inventario; no se calculan a partir del historial.
- **Entradas** guarda cada incremento de inventario. `POST /inventario/articulos/<id>/inventario/` suma la cantidad a la fila existente para artículo y ubicación, o crea una nueva, y registra una entrada en la misma transacción. Se puede almacenar inventario en cualquier nodo de ubicación. Las entradas nuevas guardan su ubicación de destino.
- **Salidas** registra retiros mediante `POST /inventario/articulos/<id>/salidas/`. Descuenta solo de la ubicación indicada, valida cantidades positivas y saldo suficiente y guarda artículo, cantidad y ubicación de origen en la misma transacción. Las operaciones de stock bloquean primero las bodegas, después el artículo y finalmente las filas involucradas, conservando un orden compatible con los traslados de cajas. Las filas agotadas permanecen con cantidad cero.
- **TrasladoArticulo** registra una operación de traslado de cantidad entre origen y destino, con bodegas, fecha, usuario autenticado si existe, códigos, rutas y nombres capturados en ese momento. El servicio `almacen/traslados.py` descuenta del origen, incrementa una sola fila del destino o la crea y guarda el traslado en una transacción. El total de existencias del artículo se conserva. No genera entradas o salidas adicionales; el histórico muestra un único traslado.
- No hay una restricción única de base de datos para la pareja artículo/ubicación en `Inventario`. Las entradas nuevas se serializan por artículo y, si existen duplicados históricos, incrementan una sola fila; Picking suma y consume las filas de la ubicación hasta completar la cantidad solicitada.

## Pantallas y API

Todas las rutas siguientes cuelgan de `/inventario/`:

La raíz `/` redirige a la pantalla de Inicio en `/inventario/articulo/`.

El menú lateral conserva su estado en `localStorage` con la clave `inventario-sidebar-collapsed` (`1`: cerrado, `0`: abierto). La plantilla base lo restaura al inicio del cuerpo, antes de dibujar el menú, y no aplica transiciones de apertura/cierre. El botón, el fondo del menú móvil y Escape actualizan la preferencia. Sin una preferencia válida o si el almacenamiento está bloqueado, se inicia cerrado; el botón sigue funcionando. Se verificaron primer renderizado, recarga y navegación en Chrome para escritorio y móvil.

| Ruta | Método | Uso |
| --- | --- | --- |
| `articulo/` | GET | Pantalla de artículos y existencias. |
| `articulos/gestion/` | GET | Vista de gestión de artículos, enlazada desde «Artículos» del menú izquierdo: listado, búsqueda, creación con fotos y entradas por ubicación o contenedor. |
| `articulos/` | GET, POST | Lista con resumen; creación de artículo con fotos opcionales. |
| `articulos/<id>/inventario/` | POST | Entrada de cantidad a una ubicación. |
| `almacenar/` | GET | Formulario de entradas con bodega persistida, búsqueda de artículo y ubicación/caja de destino. |
| `picking/` | GET | Formulario de salidas; ofrece ubicaciones con stock del artículo en la bodega elegida. |
| `traslados/` | GET | Traslados individuales o preparación de varios movimientos en una tabla. La bodega seleccionada es el destino. |
| `trasladar/` | GET | Redirige a `traslados/` para conservar los enlaces anteriores. |
| `traslados/lote/` | POST | Registra de 1 a 100 filas en una transacción. JSON: `{"movimientos": [{"articulo": <id>, "origen": <id>, "destino": <id>, "cantidad": <entero positivo>}]}`. |
| `articulos/<id>/traslados/` | POST | JSON: `{"origen": <id>, "destino": <id>, "cantidad": <entero positivo>}`. |
| `movimientos/historial/` | GET | Consulta conjunta de entradas, salidas y traslados, filtros y paginación. |
| `articulos/historial/` | GET | Redirige al histórico de movimientos conservando los parámetros de consulta. |
| `articulos/<id>/salidas/` | POST | Retiro de stock. JSON: `{"ubicacion": <id>, "cantidad": <entero positivo>}`. |
| `marcas/api/`, `unidades-medida/api/`, `bodegas/api/` | GET | Catálogos para formularios. |
| `ubicaciones/` | GET | Gestión del árbol de ubicaciones. |
| `ubicaciones/api/` | GET, POST | Árbol y creación de ubicación. `GET` acepta `?bodega=<id>`. |
| `ubicaciones/<id>/mover/` | POST | Traslada un contenedor y su contenido. JSON: `{"destino": <id>}`; para dejarlo en la raíz: `{"destino": null, "bodega": <id>}`. |
| `ubicaciones/<id>/movimientos/` | GET | Historial propio, incluidos traslados realizados dentro de otra caja. |
| `ubicaciones/mapa/` | GET | Mapa físico y consulta de existencias. |
| `ubicaciones/<id>/inventario/detalle/` | GET | Existencias de una ubicación y sus descendientes. |
| `ubicaciones/estantes/lote/` | GET | Formulario de creación masiva. |
| `ubicaciones/estantes/lote/api/` | POST | Crea estantes, paneles y divisiones en una transacción. |
| `ubicaciones/distribucion/` | GET | Editor visual del plano. |
| `ubicaciones/distribucion/api/` | GET, POST | Lee o guarda celdas, dimensiones y pasillos de una bodega. |

Las páginas usan `base.html` y los archivos JavaScript de `inventario/static/js/` para llamar a esos endpoints. Los catálogos, fotos y planos también se pueden gestionar desde Django Admin. Las vistas de API no declaran permisos propios; revisar autenticación y autorización antes de publicar el servicio fuera de un entorno controlado.

## Ejecución local

1. Usar Python 3.11 y MariaDB 10.4 (versiones con las que se comprobó este entorno). El proyecto fija `django==4.2` en `requeriments.txt`. El entorno `venv/` que ya estaba en el directorio apunta a una instalación de Python que no existe aquí; se creó `.venv/` con Python 3.11.
2. Instalar dependencias: `uv pip install --python .venv/Scripts/python.exe -r requeriments.txt` (en Windows), o crear otro entorno de Python 3.11 e instalar ese archivo con `pip`.
3. Configurar `inventario/inventario/.env` a partir de `.env.example`. `settings.py` necesita al menos `SECRET_KEY`, `NAME_DB`, `USER_DB` y `PASS_DB`. La base usa `localhost:3306`. No subir secretos al repositorio.
4. Iniciar MariaDB, aplicar migraciones con `.venv/Scripts/python.exe inventario/manage.py migrate` y comprobarlas con `migrate --check`.
5. Ejecutar: `.venv/Scripts/python.exe inventario/manage.py runserver`. Abrir `http://localhost:8000/inventario/articulo/` o `/admin/`.

La configuración usa `TIME_ZONE='America/Bogota'` y `USE_TZ=False`. `db.sqlite3` existe como archivo vacío, pero **no** es la base configurada: la aplicación usa MariaDB. Las fotos son archivos del directorio `inventario/media/`, separados de las filas SQL.

## Respaldo SQL y restauración local

`inventario23-10-25.sql` es un volcado completo de la base `inventario`, realizado con MariaDB 10.4.20 el 23 de octubre de 2025. Incluye tablas de Django y de `almacen`, datos, usuarios y el registro de migraciones. Sus migraciones llegan a `almacen.0013_distribucionubicacion_es_pasillo_and_more`. Es compatible como base histórica: después de restaurarlo hay que aplicar las migraciones posteriores (`0014` y `0015`) con `manage.py migrate`.

El 4 de octubre de 2026, la base `inventario` configurada **no existía** en el servidor local. Se creó con `utf8mb4` y se importó el volcado sin reemplazar una base previa. El cliente MariaDB finalizó con código 0. Después se verificó:

- 21 tablas; todas las columnas de los 11 modelos de `almacen` coinciden con la base.
- `manage.py check --database default`, `migrate --check` y `makemigrations --check --dry-run` sin errores ni cambios pendientes usando Django 4.2.
- Respuestas HTTP 200 en las páginas de artículos, mapa y distribución, y en las API de artículos, bodegas y ubicaciones.
- Datos restaurados: 14 artículos, 3 bodegas, 109 ubicaciones, 8 filas de inventario (24 unidades), 8 entradas, 0 salidas, 3 planos y 20 elementos de distribución.

El SQL contiene 22 registros de fotos. La carpeta local `inventario/media/` solo contiene un archivo y al menos una ruta referida por la base no existe; el respaldo SQL no reemplaza los archivos multimedia. El volcado también contiene una cuenta de usuario y hashes de contraseña: tratarlo como dato sensible.

**Para otra restauración:** el SQL contiene `DROP TABLE IF EXISTS`; importarlo en una base existente reemplaza sus tablas. Guardar primero una copia de la base y del directorio `media/`, crear una base vacía y ejecutar la importación con un cliente MariaDB/MySQL usando las credenciales de `.env`. Luego ejecutar `migrate`, comprobar `migrate --check` y revisar las rutas de lectura.

## Uso de contenedores móviles

Abrir `/inventario/ubicaciones/` y seleccionar primero la **Bodega a consultar** del panel izquierdo; el árbol permanece vacío hasta elegirla y muestra solo sus ubicaciones. El selector, la búsqueda por nombre/código/tipo y los controles de colapso quedan fuera del área de desplazamiento; solo el árbol se desplaza. La bodega del formulario se sincroniza con la selección y los cambios de bodega limpian el padre y detalle anteriores.

Elegir **Contenedor móvil** en el formulario y seleccionar su padre en el árbol. El código se asigna automáticamente. Para trasladarlo, seleccionar la caja, elegir bodega y destino en **Mover contenedor** y pulsar **Mover con todo su contenido**. Los destinos excluyen la propia caja y sus descendientes. Al trasladar una caja a otra bodega, el panel muestra automáticamente la bodega de destino para mantener visible la caja. El historial aparece en el mismo panel. El mapa físico y los formularios de inventario muestran el código permanente; el mapa permite consultar el contenido de cajas anidadas.

La migración `0014` se aplicó a la base local tras guardar `.local-backups/inventario_antes_contenedores_20261004_200021.sql`. Asignó códigos a los cuatro contenedores existentes. Se compararon todos los registros de artículos, inventario, entradas y salidas con el estado anterior: permanecen iguales. El respaldo está excluido de Git. El historial comienza con los nuevos movimientos; no se inventa información histórica del volcado.

Pruebas: `.venv/Scripts/python.exe inventario/manage.py test almacen --noinput`. Se ejecutan en una base de pruebas independiente.

Además se comprobó el flujo en Chrome con una base desechable: traslado entre bodegas, creación de caja anidada desde el formulario, historial de movimientos incluidos en otra caja y consulta de su inventario en el mapa físico.

## Almacenar y Picking

**Bodega de trabajo:** Inicio y Artículos comparten la bodega guardada en `localStorage`, con la clave `inventario::bodegaSeleccionada`, y su confirmación en `inventario::bodegaBloqueada`. Se restauran al navegar y recargar. Se valida que la bodega todavía exista. La antigua clave `inventario::seleccionUbicacion` se migra conservando únicamente la bodega y se elimina. Si el navegador bloquea localStorage, se puede seguir usando los selectores durante la sesión de la página.

**Almacenar, Picking y Traslados** guardan por separado su bodega y su estado de retención/liberación. Las claves son `inventario::bodegaSeleccionada::<operacion>` e `inventario::bodegaBloqueada::<operacion>`, con operaciones `almacenar`, `picking` y `trasladar`. Se restauran al abrir o recargar cada módulo. No se hereda la selección compartida anterior; un módulo sin preferencia requiere seleccionar y confirmar su bodega. La ubicación se elige para cada movimiento.

En **Inicio y Artículos** se seleccionan **bodega y ubicación fija de trabajo** en la cabecera. Ambos selectores permiten buscar; la ubicación muestra código y ruta y solo ofrece opciones de la bodega elegida. **Seleccionar ubicación** confirma y bloquea ambos campos; **Liberar** los habilita para cambiar la selección. La ubicación se guarda separadamente en `inventario::ubicacionTrabajo`, se comparte entre estas dos vistas y se descarta si cambia la bodega o desaparece la ubicación. El catálogo sigue disponible completo y las cantidades, el resumen de existencias y el detalle se acotan a la selección. Se pueden registrar entradas desde el detalle del artículo y una cantidad inicial al crear su ficha, siempre con bodega y ubicación confirmadas.

En **Almacenar y Picking**, la cabecera incluye únicamente la **bodega de trabajo**, con búsqueda y botón **Seleccionar bodega / Liberar**. Se debe confirmar una bodega antes de operar. Liberarla habilita su selector, elimina la ubicación de la operación y deshabilita los movimientos hasta confirmar nuevamente. Estas vistas no recuperan la ubicación fija de Inicio y Artículos. Dentro de la bodega confirmada, el orden es **artículo → ubicación → cantidad**:

1. Elegir búsqueda por **ID** (exacto) o **Descripción**. La descripción muestra sugerencias desde tres caracteres, sin distinguir mayúsculas ni tildes. Pulsar **Buscar**, **Enter** o **Tab** confirma el artículo si hay un único resultado; si hay varios, se despliegan en el mismo campo para elegir con el ratón o con flechas y Enter. Las opciones incluyen ID y descripción para distinguir artículos con nombres repetidos.
   La última elección se guarda por separado en `localStorage` para cada operación: `inventario::modoBusquedaArticulo::almacenar`, `inventario::modoBusquedaArticulo::picking` e `inventario::modoBusquedaArticulo::trasladar`. Cambiarla en un módulo no afecta a los otros. Se restaura durante la construcción del formulario, antes de cargar sus bibliotecas y datos, incluyendo el modo del teclado, el texto del campo y las instrucciones. Si no existe una preferencia válida para ese módulo, se utiliza ID. La antigua preferencia compartida no se utiliza.
2. Elegir la ubicación. En **Picking**, el autocompletado ofrece exclusivamente ubicaciones con saldo positivo del artículo confirmado. En **Almacenar**, escribir al menos tres caracteres del código, nombre, bodega o ruta para buscar cualquier destino, incluidas cajas anidadas. Ambas búsquedas se limitan a la bodega de trabajo; cambiarla elimina la ubicación anterior. Cambiar de artículo conserva la bodega. En estas dos vistas las ubicaciones se eligen para cada operación y no se guardan en localStorage.
3. Indicar una cantidad entera positiva y registrar. Picking muestra el saldo disponible y limita la cantidad; el servidor vuelve a validar las existencias. Editar el artículo o cambiar el modo de búsqueda elimina la ubicación anterior para evitar selecciones incoherentes.

La tabla muestra las ubicaciones con existencias del artículo y permite seleccionarlas directamente. Los saldos corresponden a cada ubicación o caja; no incluyen automáticamente el contenido de sus descendientes.

La migración `0015` agrega una ubicación opcional a `Entradas` y `Salidas` y conserva sus fechas originales. Los registros históricos quedan sin ubicación porque el respaldo no contiene esa información. Se guardó `.local-backups/inventario_antes_picking_20261004_202618.sql` antes de aplicarla y se comprobaron los registros originales de artículos, inventario, entradas y salidas: permanecen iguales.

Se comprobaron ambos formularios en Chrome con una base desechable: búsqueda por ID con Tab, descripción con tres caracteres, coincidencias múltiples, confirmación única, selección con teclado, filtro de bodegas, almacenamiento en un destino sin existencias y exclusión de ubicaciones al agotar su saldo. La suite de backend incluye validación de cantidades, saldo insuficiente, agotamiento y tratamiento de filas duplicadas.

También se verificaron en Chrome los selectores con búsqueda de Inicio y Artículos, confirmación y liberación, persistencia de bodega y ubicación fija, entrada desde el detalle, cabeceras de Almacenar y Picking, entradas y salidas con bodega confirmada y eliminación de la ubicación fija al cambiar de bodega.

## Histórico de movimientos

Abrir **Histórico de movimientos** en el menú o **Ver histórico** en el detalle de un artículo de Inicio o Artículos. La URL es `/inventario/movimientos/historial/`; el enlace del detalle incluye `?modo=id&articulo=<id>` para consultar únicamente ese artículo. La URL anterior `/inventario/articulos/historial/` redirige a esta vista y conserva sus filtros.

La consulta une `Entradas`, `Salidas` y `TrasladoArticulo`, sin duplicar sus registros. Presenta referencia `E-<id>`, `S-<id>` o `T-<id>`, fecha, tipo, artículo, cantidad, bodega y ubicación/caja. Los traslados muestran origen y destino; el filtro de bodega incluye los traslados en los que participa como origen o destino, una sola vez. Ofrece filtros por ID exacto o descripción (mínimo tres caracteres), bodega, tipo y fechas inclusivas. Los resultados se ordenan del más reciente al más antiguo y se paginan de 50 en 50. Los totales corresponden a todos los registros filtrados, no solo a la página; no representan existencias actuales ni un saldo calculado.

La migración `0016_contexto_historico_articulos` añade contexto a las dos tablas existentes: bodega original, nombre de bodega, ruta y código de ubicación y descripción del artículo. Los movimientos nuevos capturan estos datos al guardarse, para conservar el contexto si después se traslada una caja o se renombra una bodega o un artículo. No se inventan estos datos para registros anteriores. Si un registro antiguo conserva ubicación, la vista identifica expresamente la bodega y ubicación como **actuales**, y el filtro de bodega utiliza esos datos como referencia. Si no conserva ubicación, muestra **Sin dato histórico / No registrada** y aparece al consultar todas las bodegas.

Antes de aplicar la migración se generó `.local-backups/inventario_antes_historial_20261004_213714.sql` y una copia JSON de control. Se compararon los campos originales de artículos, inventario, entradas y salidas después de migrar: permanecen iguales. Las 27 pruebas del proyecto pasaron, incluidas unión de movimientos, totales, filtros, fechas, paginación y conservación del contexto tras un traslado. Se verificaron en Chrome el enlace desde un artículo, filtros, datos antiguos, errores de búsqueda y visualización móvil.

## Traslados

Abrir **Traslados** desde el menú o el detalle del artículo:

1. Elegir y confirmar la **bodega de destino** en la cabecera. Guarda su propia selección y estado de retención, independientes de los otros módulos; en esta vista se interpreta como destino. **Liberar** permite cambiarla y elimina las ubicaciones del formulario, pero conserva las filas pendientes de la tabla.
2. Buscar el artículo por ID o descripción, con el mismo autocompletado y confirmación mediante Buscar, Enter o Tab.
3. Elegir una ubicación o caja de origen con existencias del artículo, **en cualquier bodega**. La bodega de origen se deduce de esa ubicación; no hay un selector independiente para ella.
4. Buscar el destino desde tres caracteres de código, nombre o ruta, entre las ubicaciones de la bodega confirmada. Se excluye la propia ubicación de origen.
5. En modo **Individual**, indicar una cantidad entera positiva y registrar. El servidor vuelve a validar el saldo; los duplicados históricos se consumen o incrementan sin multiplicar la cantidad. Si falla cualquier parte, se revierten el descuento, el incremento y el registro. Después de registrar se limpian ambas ubicaciones para la siguiente operación y se conserva la bodega de destino.

En modo **Individual** solo se muestran el formulario **Preparar traslado** y los **Orígenes con existencias**. En modo **Varios movimientos en tabla** solo se muestra la tabla pendiente; **Agregar movimiento** abre el formulario en un diálogo, y **Editar** permite modificar una fila en ese mismo diálogo. Guardar, cerrar, cancelar o pulsar Escape devuelve a la tabla. La tabla de orígenes oculta no se reconstruye mientras se usa este modo. **Agregar a la tabla** conserva artículo, bodegas, posiciones y cantidad sin escribir en la base de datos. Se puede **Editar**, **Guardar fila**, **Cancelar edición**, **Quitar** o **Vaciar tabla**. Cada fila conserva su propio destino, aunque se cambie la bodega para preparar otra. La selección de destinos permite componer un lote con distintas bodegas de destino.

**Registrar movimientos** envía todas las filas a `traslados/lote/`; se ejecutan en orden y en una única transacción. Si alguna falla, ninguna queda aplicada, la respuesta identifica la fila y la tabla se mantiene para corregirla. Si todas son válidas, cada traslado genera su propio registro histórico y se vacía la tabla. La vista muestra el saldo previsto considerando las filas anteriores, por lo que no permite comprometer repetidamente las mismas unidades y puede preparar una secuencia de traslados encadenados. El servidor revalida siempre el saldo real. Se admiten hasta 100 filas; los pendientes se mantienen únicamente mientras la página está abierta. Se puede alternar entre modos conservando las filas pendientes; el servidor vuelve a validar sus saldos al registrarlas.

Se permiten ubicación → ubicación, ubicación → contenedor, contenedor → ubicación y contenedor → contenedor, entre la misma bodega o bodegas diferentes. El movimiento afecta únicamente las unidades del artículo y de los nodos indicados; no agrega automáticamente el inventario de cajas descendientes. Mover una caja completa con todos sus artículos se opera desde **Gestionar ubicaciones** y conserva su propio historial.

La migración `0017_traslados_articulos` creó la tabla de traslados tras generar `.local-backups/inventario_antes_traslados_20261005_082944.sql`. Se conservaron los datos anteriores de artículos, inventario, entradas y salidas. Pasaron 35 pruebas de backend, incluidas conservación de cantidades, transferencias entre bodegas, cajas y ubicaciones, duplicados, datos inválidos, reversión completa ante fallos y consulta histórica por ambas bodegas. En Chrome se verificaron traslados dentro de una bodega y entre bodegas, autocompletado, persistencia de bodega, histórico y redirección de la URL antigua; también se verificaron nuevamente las entradas y salidas de las vistas existentes.

El ajuste a bodega de destino y tabla de movimientos no requiere una nueva migración. La suite pasó a 40 pruebas, con casos de lotes de varios artículos, saldo acumulado insuficiente, ejecución encadenada y validaciones del lote. En Chrome se comprobó destino en cabecera, origen en otra bodega, edición/cancelación/eliminación de filas, ausencia de escrituras al preparar, conservación de la tabla tras un rechazo, registro completo y aparición de cada fila en el histórico.

## Límites conocidos

- El entorno global de esta máquina tiene Django 5.2, que rechaza MariaDB 10.4; usar el entorno `.venv/` con Django 4.2 o uno equivalente.
- `inventario/almacen/tests.py` contiene pruebas de contenedores anidados, movimientos entre bodegas, conservación del inventario, validaciones e historial.
- `ALLOWED_HOSTS=['*']` y las API carecen de permisos explícitos; estas configuraciones deben revisarse para despliegue.
- Las imágenes faltantes deben recuperarse de un respaldo de `media/` si se necesitan todas las fotos históricas.

## Creación de ubicaciones y contenedores

El menú **Gestión de ubicaciones** incluye dos opciones en su submenú:

- **Nueva ubicación** (`/inventario/ubicaciones/nueva/`): crea estantes, estibas, paneles o divisiones. Elige la bodega, el tipo fijo y, cuando corresponda, una ubicación padre del mapa.
- **Nuevo contenedor** (`/inventario/ubicaciones/contenedores/nuevo/`): crea una caja o recipiente móvil. Indica el nombre y la bodega; selecciona una ubicación o caja en el mapa y pulsa **Usar como posición inicial**. Si no eliges una posición, se crea directamente en la bodega. El código `C<id>` y la nomenclatura se calculan automáticamente.

Ambas opciones muestran el mismo mapa de ubicaciones y contenedores. Los registros continúan en `Ubicacion`, conservando las relaciones con inventario e historial. Los endpoints de creación separados son `POST /inventario/ubicaciones/fijas/api/` y `POST /inventario/ubicaciones/contenedores/api/`; validan la clase de registro, el padre y la bodega. La API general sigue disponible para compatibilidad. No requiere una migración.

## Registro de artículos

En **Artículos**, el botón **Nuevo artículo** abre el formulario de registro en un modal. También está disponible desde Inicio. Puedes cerrarlo con la X o Escape; los datos se conservan mientras permanezcas en la página y la cámara se detiene al cerrar. Al guardar correctamente, el modal se cierra, el formulario se limpia y el nuevo artículo aparece en el listado. Los errores de registro se muestran dentro del modal y conservan la información ingresada. El listado y el detalle ocupan el espacio que antes tenía la tarjeta de registro.

## Guía de nomenclatura para usuarios

Disponible en el menú **Guía de nomenclatura**, en `/inventario/ayuda/nomenclatura/`.

La nomenclatura te indica el camino hasta la ubicación o caja donde está el artículo. Léela de izquierda a derecha: cada guion bajo separa un nivel. Los números identifican ubicaciones fijas y la letra **C** identifica un contenedor. La bodega se muestra por separado; confirma que estás mirando la correcta, porque dos bodegas pueden tener la misma nomenclatura de ubicación fija.

Por ejemplo, `100_1_2_C4` significa: **Estante 100 → Panel 1 → División 2 → Contenedor C4**. Si no hay panel o división, el camino tendrá menos segmentos.

### Cada caja conserva su código

**C4 significa contenedor con ID 4.** La aplicación lo asigna al crear la caja. Aunque la muevas a otra ubicación o bodega, seguirá siendo C4. Los códigos pueden tener saltos; no necesitas renumerarlos. Puedes darle un nombre como «Tornillos pequeños» para reconocerla fácilmente.

### Una caja dentro de otra

`100_1_2_C4_C9` significa que C9 está dentro de C4, en la división 2. El último código identifica la caja donde están registradas las existencias del artículo. Para encontrarlo, llega a la división, busca C4 y abre C9.

Si una caja está directamente en la bodega, sin ubicación padre, su nomenclatura será `C4`. Si tiene C9 dentro, será `C4_C9`.

### Cuando mueves una caja

Si llevas C4 con C9 dentro a `101_2_1`, las nomenclaturas se actualizan:

| Caja | Antes | Después |
| --- | --- | --- |
| C4 | `100_1_2_C4` | `101_2_1_C4` |
| C9, dentro de C4 | `100_1_2_C4_C9` | `101_2_1_C4_C9` |

El camino cambia, pero los códigos y las cantidades se conservan. También puede cambiar la parte numérica si se reorganizan las ubicaciones fijas.

### Qué operación utilizar

- **Almacenar:** ingresar unidades. Elige la bodega de trabajo.
- **Picking:** retirar unidades. Elige la bodega de trabajo.
- **Traslados:** mover unidades de un artículo entre ubicaciones o contenedores. Elige la bodega de destino; el origen puede estar en otra bodega.
- **Gestión de ubicaciones:** selecciona un contenedor y utiliza su opción de traslado para mover la caja completa, con todas las cajas y artículos que contiene.

En las tablas de existencias, **Ubicación / caja** muestra la nomenclatura completa y **Ruta** muestra el camino con nombres. Haz clic en una fila para seleccionar esa posición.

**Recuerda:** el código te dice qué caja es; la nomenclatura y la bodega te dicen dónde encontrarla.
