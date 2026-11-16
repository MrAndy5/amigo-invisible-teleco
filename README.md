# Amigo Invisible - 1º Máster de Teleco 🎄📡

Aplicación web estática, serverless y 100% privada para la organización del Amigo Invisible de la promoción del 1º Máster en Ingeniería de Telecomunicación.

Construida como una aplicación de archivo único (**Single-File HTML + Vanilla JavaScript + Tailwind CSS vía CDN**), sin necesidad de compilación, servidor backend ni base de datos. Todo el estado del sorteo se codifica y autentica de forma segura en la URL del participante.

---

## Características Principales

- **Arquitectura Stateless & Serverless**: Cero almacenamiento en backend. No requiere bases de datos ni registro de cuentas.
- **Privacidad Absoluta (Zero-Knowledge Display)**: La pantalla del organizador **nunca** muestra quién le regala a quién al generar los enlaces. Solo genera enlaces privados individuales (*bearer tokens*).
- **Algoritmo de Derangement Matemático**:
  - Detección determinista en tiempo polinomial ($O(N^3)$) de configuraciones irresolubles mediante el **Algoritmo de Caminos Aumentantes de Kuhn** y el **Teorema del Matrimonio de Hall** ($|S| > |N(S)|$), mostrando al usuario el conflicto exacto de exclusiones en español.
  - Sorteo uniforme mediante muestreo por rechazo de Fisher-Yates con retroceso aleatorizado de mínimo número de valores remanentes (**MRV Backtracking**) como salvaguarda ante restricciones densas.
  - Cero auto-asignaciones y cumplimiento riguroso de exclusiones de parejas o compañeros de piso.
- **Experiencia de Usuario Interactiva & Temática Teleco**:
  - Diseño responsive *mobile-first* optimizado para el navegador integrado de WhatsApp en smartphones.
  - Modo oscuro de alta tecnología inspirado en telecomunicaciones (Slate 950, Emerald 500, toques de circuito).
  - Animación 3D de caja de regalo misteriosa para desvelar el destinatario con motor de confeti en Canvas puro (~40 líneas, cero librerías externas) y botón de ocultación rápida para entornos públicos.
  - Copia de enlace al portapapeles con fallback de doble capa (`navigator.clipboard` y `document.execCommand('copy')`).
- **Resistencia a Manipulación y Enrutamiento Resiliente**:
  - Enrutamiento dual que prioriza fragmento de URL (`#p=...`) para que los datos nunca viajen en los registros HTTP de servidores/CDNs, con soporte completo para parámetros de consulta (`?p=...`).
  - Detección de corrupción y alteración de bits mediante cabecera con suma de verificación y estructura JSON validada, mostrando pantallas amigables de error sin romper la app.

---

## Guía de Despliegue Gratuito (≤ 5 líneas)

### Opción 1: GitHub Pages (Recomendada)
1. En la carpeta del proyecto, ejecuta: `gh repo create amigo-invisible --public --source=. --push`
2. En GitHub, ve a **Settings** > **Pages** y en **Branch** elige `main` y carpeta `/ (root)`. Pulsa **Save**.
3. ¡Listo! Tu web estará online gratis en segundos con HTTPS en: `https://<tu-usuario>.github.io/amigo-invisible/`

### Opción 2: Netlify Drop (Sin consola / Arrastrar y Soltar)
1. Abre [app.netlify.com/drop](https://app.netlify.com/drop) en tu navegador e inicia sesión gratis.
2. Arrastra la carpeta `amigo_invisible` al recuadro de subida.
3. ¡Listo! Se publicará al instante en una URL con HTTPS tipo `https://<nombre-aleatorio>.netlify.app`.

### Opción 3: Vercel
1. Ejecuta `npx vercel` en la terminal (o importa el repositorio en vercel.com/new).
2. Confirma las opciones por defecto (`./` como root directory, preset `Other`).
3. ¡Listo! Tu web quedará desplegada de inmediato en `https://<proyecto>.vercel.app`.

---

## Verificación y Pruebas Automatizadas

El proyecto incluye suites de pruebas independientes que validan el 100% de los algoritmos y esquemas criptográficos:

### Ejecución inmediata con Python 3
```bash
python tests/verify.py
```

### Ejecución con Node.js (opcional)
```bash
node tests/verify.test.js
```

### Ejecución visual en navegador
Abre el archivo `tests/runner.html` en cualquier navegador web moderno para ejecutar la suite de pruebas completa en tiempo real de forma visual.
