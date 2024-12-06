import math
import os
import numpy as np
import json
import rasterio


def writeGeo(input):
    # EARTH_RADIUS = 6371
    # RAD_PER_DEG = math.pi / 180

    # georaster = rasterio.open("../terrain.tif")

    # lon = (georaster.bounds.left + georaster.bounds.right) / 2.0
    # lat = (georaster.bounds.bottom + georaster.bounds.top) / 2.0

    # METER_PER_DEG_LAT = 1000 * EARTH_RADIUS * RAD_PER_DEG
    # LONG_LAT_RATIO = math.cos(lat * RAD_PER_DEG)

    # xmin, xmax = [(v - lon) * METER_PER_DEG_LAT * LONG_LAT_RATIO
    #               for v in [georaster.bounds.left, georaster.bounds.right]]
    # ymin, ymax = [(v - lat) * METER_PER_DEG_LAT
    #               for v in [georaster.bounds.bottom, georaster.bounds.top]]

    data = {
        'h': input['domain']['h'],
        'lt': input['domain']['lt'],
        'lc1': input['mesh']['lc1'],
        'lc2': input['mesh']['lc2'],
        'lc3': input['mesh']['lc3'],
        'h1': input['mesh']['h1'],
        'ceng': input['mesh']['ceng'],
        'r1': input['mesh']['r1'],
        'r2': input['mesh']['r2'],
        'q1': input['mesh']['q1']
    }

    windAngle = -(input['wind']['angle'] + 90) * math.pi / 180
    wakeL = input['mesh']['wakeL']
    wakeB = input['mesh']['wakeB']

    turbines = input['turbines']
    numTurbine = len(turbines)

    with open('modeling.geo', 'w', encoding='utf-8') as geo:
        geo.write('\n'.join(['%s=%s;' % (k, data[k])
                 for k in data]) + "\n")

        for i in range(numTurbine):
            tempX = turbines[i]["x"]
            tempY = turbines[i]["y"]
            turbines[i]["x"] = tempX*math.cos(windAngle)+tempY*math.sin(windAngle)
            turbines[i]["y"] = -tempX*math.sin(windAngle)+tempY*math.cos(windAngle)
            geo.write('Point(%d) = {%f,%f,0,lc2};\n' %
                      (i, turbines[i]["x"], turbines[i]["y"]))
        geo.write('Point(%d) = {-lt/2,-lt/2,0,lc1};\n' % (i+1))
        geo.write('Point(%d) = {lt/2,-lt/2,0,lc1};\n' % (i+2))
        geo.write('Point(%d) = {lt/2,lt/2,0,lc1};\n' % (i+3))
        geo.write('Point(%d) = {-lt/2,lt/2,0,lc1};\n' % (i+4))
        geo.write('Line(%d) = {%d,%d};\n' % (i+1, i+1, i+2))
        geo.write('Line(%d) = {%d,%d};\n' % (i+2, i+2, i+3))
        geo.write('Line(%d) = {%d,%d};\n' % (i+3, i+3, i+4))
        geo.write('Line(%d) = {%d,%d};\n' % (i+4, i+4, i+1))
        geo.write('Line Loop(5) = {%d, %d, %d, %d};\n' % (i+1, i+2, i+3, i+4))
        geo.write('Plane Surface(6) = {5};\n')
        for j in range(numTurbine):
            geo.write("Field[%d] = Box;\n" % j)
            geo.write("Field[%d].VIn = lc3;\n" %
                      (j))   # 尾流区网格尺寸，约3~4倍最小网格尺寸
            geo.write("Field[%d].VOut = lc1;\n" % j)
            geo.write("Field[%d].XMin = %f;\n" % (j, turbines[j]["x"]))
            geo.write("Field[%d].XMax = %f;\n" %
                      (j, turbines[j]["x"]+wakeL))  # 尾流区长度，大于10倍风轮直径
            geo.write("Field[%d].YMin = %f;\n" %
                      (j, turbines[j]["y"]-wakeB*0.5))   # 尾流区宽度，约3倍风轮半径
            geo.write("Field[%d].YMax = %f;\n" %
                      (j, turbines[j]["y"]+wakeB*0.5))   # 尾流区宽度，约3倍风轮半径

        # for k in range(len(lc2)):
        geo.write('Field[%d] = Attractor;\n' % (j+1))
        squence1 = ",".join([str(i) for i in range(numTurbine)])
        geo.write('Field[%d].NodesList = {%s};\n' % (j+1, squence1))
        geo.write("Field[%d] = Threshold;\n" % (j+2))
        geo.write("Field[%d].IField = %d;\n" % (j+2, j+1))
        geo.write("Field[%d].LcMin = lc2;\n" % (j+2))
        geo.write("Field[%d].LcMax = lc1;\n" % (j+2))
        geo.write("Field[%d].DistMin = r1;\n" % (j+2))
        geo.write("Field[%d].DistMax = r2;\n" % (j+2))

        squence2 = ",".join([str(i) for i in range(numTurbine)])

        geo.write("Field[%d] = Min;\n" % (j+3))
        geo.write("Field[%d].FieldsList = {%s};\n" % (
            j+3, squence2+","+str(j+2)))
        geo.write("Background Field = %d;\n" % (j+3))
        geo.write("m = 6;\n")
        # geo.write(content)
        geo.write("h0 = h1 / ceng;\n")
        geo.write("V[] = Extrude{0, 0, h0} {\n")
        geo.write("  Surface{m};\n")
        geo.write("  Layers{1};\n")
        geo.write("  Recombine;\n")
        geo.write("};\n")
        geo.write("m = m + %d;\n" % (numTurbine+19))
        geo.write("For(2 : ceng)\n")
        geo.write("  V[] = Extrude{0, 0, h0} {\n")
        geo.write("    Surface{m};\n")
        geo.write("    Layers{1};\n")
        geo.write("    Recombine;\n")
        geo.write("  };\n")
        geo.write("  m = m + 22;\n")
        geo.write("EndFor\n")
        geo.write("h2 = h-h1;\n")
        geo.write("N = Ceil(Log(h2 * (q1 - 1) / h0 / q1 + 1) / Log(q1)) - 1;\n")
        geo.write("sum = 0;\n")
        geo.write("For(1 : N)\n")
        geo.write("  h0 = h0 * q1;\n")
        geo.write("  s[] = Extrude{0, 0, h0} {\n")
        geo.write("    Surface{m};\n")
        geo.write("    Layers{1};\n")
        geo.write("    Recombine;\n")
        geo.write("  };\n")
        geo.write("  m = m + 22;\n")
        geo.write("  sum = h0 + sum;\n")
        geo.write("EndFor\n")
        geo.write("sumC = 6 + %d + 22 * (ceng-1) + 22 * N;\n" %
                  (numTurbine+19))
        geo.write("Extrude Surface{sumC, {0, 0, h2 - sum}} {\n")
        geo.write("  Recombine;\n")
        geo.write("  Layers {1};\n")
        geo.write("};\n")


if __name__ == '__main__':
    with open('../info.json', 'r') as f:
        data = json.load(f)
    writeGeo(data)
