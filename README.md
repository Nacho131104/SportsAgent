DESCRIPCION: Agente deportivo inteligente conversacional, capaz de responder a consultas
realizadas por el usuario. 



1. Requisitos previos
  *Backend: -Python 3.10 o superior, -uv (gestor de entornos y dependencias) -API key: tavily, gemini
  *Frontend: -Node.js 18+, -npm o pnpm, -API key: gemini

   
3. Instalación del Backend
  -Debes crear un .env en la raíz, con las siguientes API key: 
           - API_KEY_GEMINI= .....
           -API_KEY_TAVILY= .....

   
  -Instalar dependencias: En la terminal de la raíz deberás instalar las dependencias con el siguiente comando (cmd): uv sync
  -Ejecutar el servidor: Deberás ejecutar el siguiente comdando desde la raíz del backend(cmd): uv run uvicorn app.api:app –reload

  Backend disponible en: http://localhost:8000
  
3. Instalación del Frontend
  -Crear .env: Deberás crear un .env en la raíz del proyecto. Debe de contener las  siguientes API KEY: API_KEY= ....
  -Instalar dependencias: Deberás ejecutar en la terminal, en la raíz del frontend (cmd):  npm install
  -Ejecutar modo desarrollo: Deberás ejecutar en la terminal, en la raíz del frontend (cmd): npm run dev

  Frontend disponible en: http://localhost:3000

  
5. Endpoints principales del Backend
- GET /health → Comprueba conexión
- GET /search → Obtiene datos mediante Tavily
- GET /wikipedia → Obtiene extractos de entidad
