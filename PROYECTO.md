# TaskTracker

## Descripción del proyecto

TaskTracker es una aplicación web que le permite al usuario registrar tareas que debe realizar de manera rutinaria,
de forma que pueda tener un registro de las actividades que realiza cada día, brindando metricas de progreso.
La aplicación busca proveer una experiencia de agenda avanzada, con funcionalidades que incrementen la capacidad del
usuario para administrar los distintos tipos de tareas que debe (o desee) realizar a lo largo de su día.

Para la gestión de metricas es importante almacenar datos como la hora de inicio, la hora de finalización, el
estado de la tarea, el nombre de la tarea, la descripción, etc. Para tareas que no se registran con un horario especifico
es necesario almacenar la cantidad de veces que se ha realizado la tarea durante el día.
Queremos mantener un registro (o historial) de las tareas que el usuario ya ha realizado, organizado por dias, mostrando
cuál es la rutina que el usuario mantiene actualmente.

## Detalles

### Tareas y Rutinas

El proyecto separa *tasks* y *schedules*. Las *schedules* son la base sobre la cual la aplicación crea las *tasks* cada día
(o cada intervalo de tiempo según la configuración de la *schedule*).

Las *tasks* son la instancia individual de una *schedule*, que puede ser repetida o no repetida, y tiene un estado que
indica si la tarea ha sido completada o no en esa instancia específica.

### Sobre las rutinas

Las rutinas (schedules) continen la configuración de las tareas que habrán de realizarse. En cierta forma son los "default settings"
de las tareas. Pero también gestionan parametros como la frecuencia de repetición, el estado de la tarea (si esta activa, si se cancelo, etc.)

Para tareas de una sola instancia también se crea una rutina, de forma que podria ser utilizada para registrar la misma tarea en un futuro.
(Esto podría ser eliminado en caso no resulte util para el usuario).

### Sobre las tareas

Las tareas se pueden categorizar por horario:

-   **Rango de horarios**: Se puede seleccionar un rango de horarios para la tarea, por ejemplo, de 9:00 a 17:00.
-   **Duración**: Se puede especificar la duración de la tarea, por ejemplo, de 5 minutos.
-   **Repetición**: Se puede especificar la frecuencia de repetición de la tarea, por ejemplo, cada día.
-   **Fecha de inicio**: Se puede especificar la fecha de inicio de la tarea, por ejemplo, el día de hoy.
-   **Fecha de finalización**: Se puede especificar la fecha de finalización de la tarea, por ejemplo, el día de mañana.

Las tareas también pueden ser separadas entre tareas requeridas y no requeridas:

-   **Requeridas** son las tareas que el usuario ha marcado como "vitales" y que deben ser resaltadas en la interfaz de usuario.
-   **No requeridas** son el resto de tareas que tienen un importancia "normal".

Las tareas tienen una prioridad, la cual solo sirve para ordenar las tareas en la interfaz de usuario (de momento):

-   **Urgente**
-   **Alta**
-   **Media**
-   **Baja**

### Sobre la interfaz de usuario

La interfaz de usuario consistirá en las siguientes secciones/pantallas:

-   **Inicio (/tasks)**: es la pantalla principal de la aplicación que muestra un listado de tareas, agrupadas por hora, que
    deben ser realizadas en la fecha actual.
        -   El listado consiste en dos columnas, la izquierda muestra la hora (en formato de 12h y solo la "hora en punto"),
            y la derecha una tarjeta con la proxima tarea (no completada) que debe ser realizada en esa hora, respetando el
            orden de prioridad de las tareas.
        -   Las etiquetas con la hora son también botones que alternan el estado de despliegue de la lista de tareas para esa hora.
        -   Al ser desplegada la lista de tareas, esta muestra una mayor cantidad de tarjetas de tareas, limitada a un número
            razonable de tareas por hora y mostrando un botón para ver todas las tareas de esa hora (en caso de que la lista
            de tareas sea demasiado larga).
        -   La tarjeta de tarea debe mostrar la información mínima necesaria para el usuario, como el título de la tarea, la
            hora de inicio y un botón para marcar la tarea como completada.
-   **Lista de tareas (/tasks/new)**: es la pantalla de creación de nuevas tareas. En ella se muestra un formulario con los campos
    necesarios para crear una nueva rutina, desde la cual se generará la nueva tarea la próxima vez que esta pueda ser realizada.
    (Esto significa que una tarea que se registra con un horario en el pasado, esperara al proximo día o intervalo de tiempo
    adecuado).
-   **Detalle de tarea (/tasks/new/id)**: es la pantalla de detalle de una tarea. En ella se muestran los detalles de la tarea
    y se le da al usuario la posibilidad de modificar los campos de la tarea (por defecto, solo se modifica la instancia siguiente
    instancia de la tarea, el usuario debe marcar las modificaciones como "globales" para que se apliquen a la configuración de la
    rutina).

### Funcionalidades específicas

El usuario desea tener un apartado que muestre gráficamente la tarea de tomar agua. De forma que se muestre un icono de botella
de agua por cada vez que el usuario desee tomar agua al día (representando cada botella 1L de agua). Cada icono tendra 2 estados:

-   **Pendiente**: el usuario no ha tomado agua en esa cantidad de L de agua.
-   **Completado**: el usuario ha tomado agua en esa cantidad de L de agua.

El estado pendiente mostrará un el icono una paleta "apagada", de baja opacidad o desaturada. Mientras que el estado completado
mostrará un icono con una paleta "encendida", de alta opacidad o saturada.

### Web Push

La aplicación debe ser capaz de enviar notificaciones push a los usuarios cuando se aproxime una tarea que debe realizarse.

## Tecnologías usadas

-   [Go](https://go.dev/)
-   [PostgreSQL](https://www.postgresql.org/)
-   [PGX](https://github.com/jackc/pgx/)
-   [Tailwind CSS](https://tailwindcss.com/)
-   [React](https://reactjs.org/)
-   [TanStack Router](https://tanstack.com/router/latest)
-   [TanStack Router](https://tanstack.com/query/latest)
-   [TypeScript](https://www.typescriptlang.org/)
-   [Vite](https://vitejs.dev/)
-   [Bun](https://bun.sh/)
-   [Air](https://github.com/cosmtrek/air)

