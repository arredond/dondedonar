# Puntos de Donación de Sangre de la Comunidad de Madrid

## [El Mapa](https://arredond.github.io/dondedonar/)

## El _qué_

Este es un pequeño proyecto para extraer automáticamente los puntos de donación de sangre
fijos y móviles de la Comunidad de Madrid y plasmarlos en un mapa, junto con otra información
de interés.

## El _porqué_

Si quieres donar sangre en la Comunidad de Madrid, lo más probable es que hayas acudido a
[esta página web](https://www.comunidad.madrid/servicios/salud/donacion-sangre). Aunque ha
mejorado con los años, hay una cosa que no cambia: _las listas_.

Si quieres encontrar dónde puedes donar, acabarás deambulando por listas de
[puntos fijos](http://donarsangre.sanidadmadrid.org/fijos.aspx) y
[puntos móviles](http://donarsangre.sanidadmadrid.org/moviles.aspx) con direcciones, fechas
y horarios.

Entrando en la tercera década del siglo XXI, nos vamos mereciendo un mapa.

## El _cómo_

Usamos [Supabase](https://supabase.io/) como _backend_, [MapLibre GL](https://maplibre.org/)
para el mapa y [React](https://react.dev/) + [Vite](https://vitejs.dev/) para el _front_,
además de un poco de código en Python para extraer los datos y Google Maps para geocodificar
las direcciones de los puntos móviles.

El ETL se ejecuta como un job en [Google Cloud Run](https://cloud.google.com/run), programado
mediante Cloud Scheduler para actualizar los datos todos los lunes a las 6:00 (hora de Madrid).
Cada `push` a `main` reconstruye y despliega una nueva imagen automáticamente vía Cloud Build.
Toda la infraestructura (el job, sus permisos, los secretos, el trigger de Cloud Build y el
propio scheduler) está definida como código en [`terraform/`](terraform/) — nada se configura
a mano en la consola de GCP salvo la conexión inicial con GitHub.

## Peticiones / ruegos / dudas

Simplemente abre [un _issue_](https://github.com/arredond/dondedonar/issues/new) e intentaré
atenderte lo antes posible.

## Desarrollo local

**Frontend:**
```bash
bin/dondedonar start  # instala dependencias si hace falta y arranca Vite en segundo plano
bin/dondedonar stop
```

**ETL:**
```bash
cp .env.example .env  # rellenar variables de entorno
uv run python etl/main.py
```

Los tests del ETL (unitarios, sin red):
```bash
uv run python -m pytest etl/tests/
```

Tests de integración (tocan las URLs reales de la Comunidad de Madrid):
```bash
uv run python -m pytest etl/tests/ -m integration
```

## Infraestructura

Ver [`terraform/README.md`](terraform/README.md) para el setup inicial (una sola vez) y cómo
aplicar cambios a la infraestructura.
