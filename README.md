# Tetris 5 Minutos — Colegio Teresiano de Rivera

Edición especial de Tetris optimizada para PC, tablets y celulares, desarrollada para el **Colegio Teresiano de Rivera (Uruguay)**. El juego tiene una duración estricta de 5 minutos, cuenta con obstáculos dinámicos en tiempo real, persistencia de records en base de datos SQLite y una cola de espera con límite estricto de 5 jugadores simultáneos.

Diseñado con un estilo premium en base a los nuevos colores institucionales (Azul Marino, Blanco y Bordeau) y dotado de una cabina de control administrativa en tiempo real.

---

## 🚀 Características Clave

1.  **⏳ Partida de 5 Minutos**: El juego tiene una cuenta regresiva estricta de 5:00 minutos. Si el tablero se llena antes o el tiempo expira, la partida finaliza y guarda el puntaje.
2.  **👾 Obstáculos Dinámicos**: Cada 45 segundos, se activa un obstáculo aleatorio durante 15 segundos:
    *   **Controles Invertidos**: Izquierda mueve a la derecha y viceversa.
    *   **Niebla de Rivera**: Una nube densa que oscurece el centro del tablero de juego.
    *   **Velocidad Extrema**: La gravedad del juego se acelera al máximo.
    *   **Terremoto**: El tablero se sacude y genera bloques de basura en el fondo.
    *   **Gravedad Zero**: Los bloques no caen solos; debes posicionarlos y bajarlos manualmente.
3.  **👥 Control de Concurrencia (Máx. 6 Jugadores)**:
    *   Un máximo de 6 jugadores activos pueden estar en partida al mismo tiempo.
    *   Cualquier jugador adicional es colocado en una **cola de espera en tiempo real** que indica su turno de juego exacto.
    *   **Periodo de Gracia por Desconexión (10 segundos)**: Si un jugador activo sufre una caída de señal o cierra el navegador accidentalmente, el servidor congela su sesión y le permite reconectarse en un lapso de 10 segundos sin perder su puesto ni su puntuación actual.
4.  **📊 Panel Administrativo (`/admin`)**:
    *   Monitoreo en tiempo real de los puntajes y tiempos de las sesiones activas en vivo.
    *   Expulsión (Kick) inmediata de jugadores inactivos.
    *   Lista de records completa con posibilidad de eliminar permanentemente registros no deseados.
5.  **🕹️ Selector de Modo Retro**:
    *   Alterna instantáneamente entre la interfaz moderna/premium y una **interfaz retro (tributo a Elektronika 60)**.
    *   En modo retro, el juego adquiere una estética de terminal clásica fósforo verde sobre negro absoluto, añade scanlines de tipo CRT y dibuja las piezas usando corchetes `[]` en la grilla.

---

## 🛠️ Controles de Juego

### En Computadora (Teclado)
*   `◄` / `A` / `a`: Mover a la izquierda.
*   `►` / `D` / `d`: Mover a la derecha.
*   `▲` / `W` / `w` o `Espacio`: Rotar pieza.
*   `▼` / `S` / `s`: Caída suave (bajar rápido).
*   `Enter` / `Control`: Caída dura (instantánea).

### En Tablet o Celular (Pantalla Táctil)
*   **Rotar**: Botón **GIRAR** en el sector izquierdo.
*   **Caída**: Botón **CAÍDA** en el centro.
*   **Movimiento**: Cruzeta direccional compacta en el sector derecho (`◀`, `▶`, `▼`).
*   *Optimizado para celulares:* El tamaño del canvas se reduce y adapta automáticamente en pantallas verticales para que la grilla y los botones quepan simultáneamente sin necesidad de hacer scroll.

---

## 🐳 Despliegue con Docker y Docker Compose

### Requisitos Previos
*   Docker y Docker Compose instalados.

### Instrucciones de Arranque
1.  Clona el repositorio en tu servidor.
2.  Levanta el contenedor utilizando el archivo de composición:
    ```bash
    docker compose up -d --build
    ```
3.  La aplicación estará corriendo y disponible en los puertos:
    *   🎮 **Juego**: `http://IP-SERVIDOR:3002`
    *   📊 **Dashboard Admin**: `http://IP-SERVIDOR:3002/admin`

*La base de datos SQLite se almacena en el volumen local `./data` mapeado en `docker-compose.yml`, asegurando que no se pierdan los récords al reiniciar el contenedor.*

---

## 🖥️ Instalación en ZIMA OS (CasaOS)

ZIMA OS gestiona las aplicaciones a través de la interfaz de CasaOS, lo que permite un despliegue visual sumamente sencillo. Sigue estos pasos para instalar el juego:

### Método A: Importando Docker Compose (Recomendado)
1. Abre tu panel de control de **ZIMA OS**.
2. En la sección **App Store**, haz clic en el botón **Instalar aplicación personalizada** (Custom Install) en la esquina superior derecha.
3. En la parte superior de la ventana emergente, haz clic en el botón de **Importar** (icono de archivo de texto o código `</>`).
4. Copia y pega el contenido completo del archivo [docker-compose.yml](file:///c:/Users/Alan/Canto/Desktop/ACDEV/tetris5minutes/docker-compose.yml) en el recuadro y haz clic en **Importar**. CasaOS rellenará automáticamente todos los parámetros.
5. Haz clic en **Instalar** (Save) y la aplicación se compilará y se agregará a tu pantalla de inicio.

### Método B: Configuración Manual en ZIMA OS
Si prefieres rellenar el formulario de instalación personalizada de CasaOS de forma manual:
*   **Imagen Docker**: `tetris-teresiano` o la ruta de compilación local del directorio.
*   **Nombre de la App**: `Tetris Teresiano 5 Min`
*   **Puerto de Red**: Mapear el puerto Host `3002` al puerto del contenedor `3002` (TCP).
*   **Volumen (Persistencia del Leaderboard)**:
    *   Ruta del Host (servidor): Un directorio de tu disco en ZIMA OS (ej. `/DATA/AppData/tetris/data`).
    *   Ruta del Contenedor: `/app/data`
*   **Puerto de Interfaz Web**: `3002`
*   **Icono de la aplicación**: Puedes usar el icono del juego apuntando a `http://IP-DE-TU-ZIMA:3002/assets/icon.png` una vez levantada la app, para que se muestre con el ícono redondeado personalizado en el dashboard de Zima.

---

## 📁 Estructura del Proyecto

*   `server.js`: Servidor Express + WebSockets (Socket.io) para concurrencia, cola y eventos.
*   `database.js`: Conexión persistente y control de queries en SQLite.
*   `public/`: Archivos estáticos servidos en el cliente.
    *   `index.html`: Estructura HTML de la app de juego.
    *   `admin.html`: Dashboard administrativo en tiempo real.
    *   `style.css`: Estética, animaciones (terremoto, niebla, scanlines) y adaptabilidad móvil.
    *   `game.js`: Motor del cliente de Tetris, controles táctiles y sincronización.
    *   `assets/logo.png`: Logotipo del Colegio Teresiano de Rivera.
*   `Dockerfile` y `docker-compose.yml`: Empaquetamiento y volumen persistente.
*   `.dockerignore`: Exclusiones para compilar de manera nativa en Linux Alpine.

---

## 📝 Créditos y Licencia

*   **Derechos Reservados**: © 2026 Lic. Prof. Alan Canto - Taller de Economía para Jóvenes.
*   **Desarrollo**: Creado por **Alan Canto ACDEV**.
