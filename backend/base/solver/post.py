import os
import numpy as np
from scipy.interpolate import griddata
import json

info = json.load(open("../info.json", 'r'))
numh = info['post']['numh']
lt = info['domain']['lt'] * info['mesh']['scale']
dh = info['post']['dh']
size = [info['post']['width'], info['post']['height'], numh]

print(f"{numh} {lt} {dh}")

out = np.zeros([numh, size[0], size[1]], dtype=np.float32)

for i in range(numh):
    data = np.loadtxt(os.path.join('Output/plt', str(dh*(i+1))))
    
    x = data[:, 0]
    y = data[:, 1]
    z = data[:, 2]
    U = np.sqrt(np.sum(data[:, 3:6]**2, axis=1)) # 风速

    x_range = np.linspace(-lt/2, lt/2, size[0])
    y_range = np.linspace(-lt/2, lt/2, size[1])

    X, Y = np.meshgrid(x_range, y_range)

    # 使用 griddata 进行插值
    U_interp = griddata((x, y), U, (X, Y), method="cubic", fill_value=np.nan)

    # 使用最近邻插值填充 NaN 值
    U_interp_nn = griddata((x, y), U, (X, Y), method="nearest")

    isnan_U_interp = np.isnan(U_interp)
    U_interp[isnan_U_interp] = U_interp_nn[isnan_U_interp]

    out[i,:,:] = U_interp

out.tofile(f"../speed.bin")

json.dump(
    {
        "file": "speed.bin",
        "size": size,
        "range": [0, info['wind']['speed'] * 1.5],
        "dh": info['post']['dh']
    },
    open("../output.json", 'w')
)
print("FINISHED")