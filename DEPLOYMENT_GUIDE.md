# WindSimProj Deployment Guide

This guide outlines the steps to deploy the WindSimProj application, which consists of a Node.js backend and a Vue.js frontend.

## 1. Prerequisites

Before deployment, ensure the following are installed on your system:

*   **Node.js:** Version 18 or higher (LTS recommended). You can download it from [nodejs.org](https://nodejs.org/).
*   **npm (Node Package Manager):** Usually comes bundled with Node.js.
*   **Git:** For cloning the repository.
*   **OpenFOAM (or compatible CFD solver):** The backend relies on external CFD solvers. Ensure OpenFOAM (or a similar compatible solver) is installed and configured correctly on your system, as the `backend/base/solver` and `backend/base/initcase` directories contain components that interact with it. The specific version and installation method will depend on your operating system and requirements.
*   **GDAL (Geospatial Data Abstraction Library):** The `gdal-async` Node.js package has native dependencies on GDAL. Ensure GDAL is installed and properly configured on your system. Refer to the `gdal-async` documentation or GDAL's official website for installation instructions specific to your OS.
*   **Python 3:** Some backend utilities and solver components (e.g., `backend/base/solver/*.py`) are written in Python.

## 2. Deployment Steps

### 2.1. Clone the Repository

First, clone the WindSimProj repository to your deployment server:

```bash
git clone <repository_url>
cd WindSimProj
```

Replace `<repository_url>` with the actual URL of your Git repository.

### 2.2. Backend Setup

Navigate to the `backend` directory and install its dependencies:

```bash
cd backend
npm install
```

### 2.3. Frontend Setup

Navigate to the `frontend` directory and install its dependencies:

```bash
cd ../frontend
npm install
```

### 2.4. Build Frontend for Production

Build the frontend application for production. This will create optimized static assets in the `dist` directory within the `frontend` folder.

```bash
npm run build
```

### 2.5. Configure Environment Variables (Optional but Recommended)

Both the backend and frontend might require environment variables for configuration (e.g., API keys, database connections, port numbers). While not explicitly shown in the `package.json` files, it's common practice. Check the application's source code (e.g., `app.js` in backend, `main.js` or `vite.config.js` in frontend) for any required environment variables. You can set these using a `.env` file or directly in your deployment environment.

For example, for the backend, you might create a `.env` file in the `backend` directory:

```
PORT=3000
# Other backend specific variables
```

For the frontend, you might use `.env` files as supported by Vite (e.g., `.env.production`).

### 2.6. Start the Application

The project includes a `start.sh` script in the root directory designed to start both the backend and frontend services. This script is convenient for local development or simple deployments.

From the root directory of the project (`WindSimProj`):

```bash
bash start.sh
```

**What `start.sh` does:**

*   It typically navigates to the `backend` directory and starts the Node.js server (e.g., `node app.js` or `npm start`).
*   It then navigates to the `frontend` directory and serves the built frontend assets (e.g., using `npm run preview` or a simple static file server if `npm run build` created a `dist` folder).

**Note on Production Deployment:**

For a robust production environment, it is recommended to use a process manager (like PM2) for the Node.js backend and a dedicated web server (like Nginx or Apache) to serve the static frontend files and proxy requests to the backend API. This provides better performance, reliability, and security.

#### Example using PM2 (for Backend) and Nginx (for Frontend & Proxy)

1.  **Install PM2:**
    ```bash
npm install -g pm2
    ```
2.  **Start Backend with PM2 (from `backend` directory):**
    ```bash
pm2 start app.js --name windsim-backend
    ```
3.  **Configure Nginx:**
    *   Serve the `frontend/dist` directory.
    *   Proxy API requests (e.g., `/api/*`) to your backend server (e.g., `http://localhost:3000`).

    An example Nginx configuration snippet:
    ```nginx
    server {
        listen 80;
        server_name your_domain.com;

        location / {
            root /path/to/WindSimProj/frontend/dist;
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
    Remember to replace `your_domain.com` and `/path/to/WindSimProj` with your actual values.

## 3. Post-Deployment

After starting the application, you should be able to access the frontend in your web browser at the configured address (e.g., `http://localhost:5173` if using `npm run dev` or `http://your_domain.com` if using Nginx).

Monitor logs (`backend/combined.log`, `backend/error.log` or PM2 logs) for any issues.

## 4. Troubleshooting

*   **Dependency Issues:** If `npm install` fails, ensure you have the correct Node.js version and check for any specific error messages related to native module compilation (e.g., `gdal-async`).
*   **Port Conflicts:** If the application fails to start, check if the default ports (e.g., 3000 for backend, 5173 for frontend dev server) are already in use.
*   **Solver Issues:** If simulations fail, verify your OpenFOAM/CFD solver installation and ensure the backend has the necessary permissions to execute the solver scripts and binaries.
*   **GDAL Issues:** If geospatial operations fail, ensure GDAL is correctly installed and its libraries are accessible to the `gdal-async` package.
*   **413 Request Entity Too Large (GeoTIFF/DEM 上传/裁切失败):** If you see a 413 error from Nginx, increase Nginx `client_max_body_size` (Docker frontend uses `frontend/nginx.conf`) and rebuild/restart the frontend container. If you have an additional reverse proxy in front of Docker (e.g., host Nginx), that proxy must be updated too. Note the backend upload route also enforces a file-size limit via Multer (see `backend/routes/demClipper.js`).

This guide provides a general overview. Specific deployment environments may require additional configurations (e.g., firewall rules, SSL certificates, database setup if applicable).
