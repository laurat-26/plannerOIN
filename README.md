# Panel de Seguimiento OIN — Fase 1

## Archivos
- `index.html`: página principal.
- `styles.css`: diseño.
- `script.js`: filtros, reuniones, histórico temporal, carga de Excel y actas.
- `data.js`: base actual de tickets.
- `assets/logo-gelsa-oin.png`: logo GELSA + OIN.

## Publicar en GitHub Pages
1. Crea un repositorio, por ejemplo `panel-seguimiento-oin`.
2. Sube **todos los archivos y la carpeta assets** respetando esta estructura.
3. En GitHub: `Settings > Pages`.
4. En `Build and deployment`, elige `Deploy from a branch`.
5. Selecciona `main` y `/ (root)`.
6. Guarda y espera a que GitHub muestre la URL.

## Actualizar tickets
Dentro del sitio existe `Actualizar base`.
- Puedes cargar un Excel actualizado.
- Debe contener la hoja `Tickets` o una hoja con las columnas `Ticket` y `Tarea Planner`.
- El sitio actualiza la sesión y conserva el histórico guardado en ese navegador.
- Puedes descargar un `data.js` nuevo y reemplazarlo en GitHub para publicar permanentemente la nueva base.
- Alternativamente, puedes enviar el Excel actualizado en ChatGPT y volver a generar el proyecto.

## Reunión
El selector de reunión muestra tickets cuyo estado/bucket corresponde a:
Demoras, Qué hacer, Vencido/Vencida, En curso, Haciendo, En progreso, No iniciada o Pendiente.

## Acta
El acta sigue como referencia la plantilla institucional:
- Código SDG-GC-R-06
- Versión 06
- Acta Nro., Reunión, Fecha, Hora
- Asistentes
- Procesos
- Seguimiento
- Objetivo
- Agenda
- Desarrollo de objetivos
- Tareas de la reunión
- Elaboró / Aprobó

`Vista previa / imprimir acta` permite guardarla como PDF desde el navegador.
`Descargar acta` crea una copia HTML de la reunión.
