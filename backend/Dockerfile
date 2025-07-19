# Step 1: Base Image
FROM microfluidica/openfoam:2212

# Set a non-interactive frontend
ENV DEBIAN_FRONTEND=noninteractive

# Step 2: Install System Dependencies for OS, Tools, and Gmsh
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs
# FIX: Replaced 'libgl1-mesa-glx' with 'libgl1' and 'libglx0' for Ubuntu 24.04 compatibility.
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core build/scripting tools
    python3 python3-pip build-essential gdal-bin libgdal-dev jq gettext-base bc \
    # Gmsh GUI-related runtime libraries
    libglu1-mesa libgl1 libglx0 \
    libxcursor1 libxfixes3 libxft2 libxinerama1 libsm6 libice6 \
    fontconfig \
    # fonts-wqy-microhei: 兼容性好的中文字体
    fonts-wqy-microhei \
    # fonts-noto-cjk: 覆盖面极广的Google CJK字体，强烈推荐
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Step 3: Copy and setup custom Gmsh binary
COPY ./bin/gmsh-* /usr/local/gmsh/
RUN chmod +x /usr/local/gmsh/bin/gmsh
ENV PATH="/usr/local/gmsh/bin:${PATH}"

# Set the working directory
WORKDIR /app

# Step 4: Install Python Dependencies
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Step 5: Install Node.js Dependencies
COPY package*.json ./
RUN npm install

# Step 6: Copy the rest of the application source code
COPY . .

# Step 7: Compile custom OpenFOAM utilities with wmake
RUN cd ./base/solver/admFoam && wmake && \
    cd ../postFoam && wmake

# Step 8: Make scripts and binaries executable
RUN chmod +x ./base/run.sh
RUN find . -name "*.py" -exec chmod +x {} \;

# Step 9: Define the container's command
CMD ["node", "app.js"]