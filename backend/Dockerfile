# Step 1: Base Image
FROM microfluidica/openfoam:2212

# Set a non-interactive frontend to prevent prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# ====================================================================================
# Optimization 1: Switch APT sources to a domestic mirror (Alibaba Cloud)
# This MUST be the first step before any `apt-get update` or `apt-get install`
# ====================================================================================
RUN sed -i 's/archive.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list && \
    sed -i 's/security.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list

# Step 2: Install System Dependencies for OS, Tools, and Gmsh (now much faster)
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core build/scripting tools
    python3 python3-pip build-essential gdal-bin libgdal-dev jq gettext-base bc python3-pyproj \
    # Gmsh GUI-related runtime libraries
    libglu1-mesa libgl1 libglx0 \
    libxcursor1 libxfixes3 libxft2 libxinerama1 libsm6 libice6 \
    fontconfig \
    # Chinese fonts for compatibility
    fonts-wqy-microhei \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Step 3: Copy and setup custom Gmsh binary
COPY ./bin/gmsh-* /usr/local/gmsh/
RUN chmod +x /usr/local/gmsh/bin/gmsh
ENV PATH="/usr/local/gmsh/bin:${PATH}"

# Set the working directory for subsequent commands
WORKDIR /app

# ====================================================================================
# Optimization 2: Install Python Dependencies using Tsinghua University mirror
# ====================================================================================
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --break-system-packages

# ====================================================================================
# Optimization 3: Install Node.js Dependencies using Taobao mirror
# ====================================================================================
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm install

# Step 6: Copy the rest of the application source code
# This is done last to leverage Docker cache for dependencies
COPY . .

# Step 7: Compile custom OpenFOAM utilities with wmake
RUN cd ./base/solver/roughFoam && wmake && \
    cd ../postFoam && wmake

# Step 8: Make scripts and binaries executable
RUN chmod +x ./base/run.sh
RUN find . -name "*.py" -exec chmod +x {} \;

# Step 9: Define the container's default command
CMD ["node", "app.js"]