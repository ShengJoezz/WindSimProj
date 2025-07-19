# @Author: joe 847304926@qq.com
# @Date: 2024-09-28 21:36:52
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-02-16 20:39:58
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\base\solver\buildTerrain.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

import math
import numpy
from shapely.geometry import Point
from utils.interpolate import linearInterpolate
import rasterio


def binarySearch(arr, l, r, x):
    if r >= l:
        mid = int(l + (r - l)/2)
        if arr[mid] == x: 
            return mid
        elif arr[mid] > x: 
            return binarySearch(arr, l, mid-1, x)
        else: 
            return binarySearch(arr, mid+1, r, x)
    else:
        return -1

# @jit
def buildTerrain(inp):
    EARTH_RADIUS = 6371
    RAD_PER_DEG = math.pi / 180

    # 输入文件参数
    # lat = inp['domain']['lat']
    # lon = inp['domain']['long']
    lt = inp['domain']['lt']
    h = inp['domain']['h']
    r1 = inp['mesh']['tr1']
    r2 = inp['mesh']['tr2']
    windAngle = (inp['wind']['angle'] + 90) * RAD_PER_DEG
    scale = inp['mesh']['scale']
    center = Point(0, 0)
    num_center = len(inp['turbines'])

    georaster = rasterio.open("../terrain.tif")
    geodata = georaster.read(1)

    lon = (georaster.bounds.left + georaster.bounds.right) / 2.0
    lat = (georaster.bounds.bottom + georaster.bounds.top) / 2.0

    # 地形
    METER_PER_DEG_LAT = 1000 * EARTH_RADIUS * RAD_PER_DEG
    LONG_LAT_RATIO = math.cos(lat * RAD_PER_DEG)
    
    zeroElevation = numpy.average(geodata)
    xmin, xmax = [(v - lon) * METER_PER_DEG_LAT * LONG_LAT_RATIO
                  for v in [georaster.bounds.left, georaster.bounds.right]]
    ymin, ymax = [(v - lat) * METER_PER_DEG_LAT
                  for v in [georaster.bounds.bottom, georaster.bounds.top]]
    xnum, ynum = georaster.width, georaster.height
    # print('loaded terrian:', [xnum, ynum], [xmin, xmax], [ymin, ymax], zeroElevation)

    # 读写文件
    out = open('output.neu', 'w+', newline='')
    with open('flat.msh') as msh:
        head = ''.join(['        CONTROL INFO 2.4.6\n',
                        '** GAMBIT NEUTRAL FILE\n',
                        'example\n',
                        'PROGRAM :                Gambit     VERSION :  2.4.6\n\n',
                        '     NUMNP     NELEM     NGRPS    NBSETS     NDFCD     NDFVL\n'])
        out.write(head)
        out.writelines(['%30d%10d%10d%10d\n' % (1, 6, 3, 3),
                        'ENDOFSECTION\n'])
        while True:
            line = msh.readline()
            if line.startswith('$Nodes'):
                break
        out.write('   NODAL COORDINATES 2.4.6\n')
        np = int(msh.readline()) - num_center
        for i in range(num_center):
            msh.readline()  # 跳过加密区中心
        p_bot = {}   # 底层节点 { (x, y) ： (el, flr) }
        aa = lt / 2  # 半边长，最大（边界）xy坐标值
        # 边界编号（原msh文件）
        p_inlet, p_outlet, p_front, p_back = numpy.empty((4,0))
        # 建筑编号（原msh文件）
        p_building = []
        for ip in range(0, np):
            if ip % 10000 == 0: print('writting points %dw/%dw' % (ip / 10000, np / 10000), end='\r')
            i, x, y, oz = map(float, msh.readline().split())
            i = int(i)
            if oz == 0:
                p = Point(x, y)
                distance = p.distance(center)
                # 计算高程
                if distance < r2:
                    px = x * math.cos(windAngle) + y * math.sin(windAngle)
                    py = y * math.cos(windAngle) - x * math.sin(windAngle)
                    el = linearInterpolate([
                        ((px - xmin) / (xmax - xmin)) * (xnum - 1),
                        ((ymax - py) / (ymax - ymin)) * (ynum - 1),
                    ], lambda ix, iy: geodata[iy][ix] if ix >= 0 and ix < xnum and iy >= 0 and iy < ynum else zeroElevation) - zeroElevation
                else:
                    el = 0
                if distance > r1 and distance < r2:
                    el = el * (r2 - distance) / (r2 - r1)
                # 建筑层数
                flr = 0
                p_bot.update({(float(x), float(y)):  (el, flr)})   # 统计底层节点
            else:
                el, flr = p_bot[(float(x), float(y))]
            # 保存边界点编号
            if x == -aa:
                p_inlet = numpy.append(p_inlet, i)
            if x == aa:
                p_outlet = numpy.append(p_outlet, i)
            if y == aa:
                p_back = numpy.append(p_back, i)
            if y == -aa:
                p_front = numpy.append(p_front, i)
            z = (oz * (h - el)) / h + el
            # 保存建筑编号
            if flr > 0 and z - el < flr * FLOOR_HEIGHT:
                p_building.append(i)
            # 写入节点
            out.write('%10d%20.11e%20.11e%20.11e\n' %
                      (i - 1, *[v * scale for v in (x, y, z)]))
        out.write('ENDOFSECTION\n')
        print('written points:', np, '. ')

        # 写单元
        while True:
            line = msh.readline()
            if line.startswith('$Elements'):
                break
        out.write('      ELEMENTS/CELLS 2.4.6\n')
        nele = int(msh.readline())
        numtri = 0  # 统计单元个数
        # 边界单元（原msh文件）
        e_inlet, e_outlet, e_front, e_back = [], [], [], []
        for iele in range(0, nele):
            if iele % 10000 == 0: print('writting elemnets %dw/%dw' % (iele / 10000, nele / 10000), end='\r')
            data = [*map(int, msh.readline().split())]
            if data[1] != 6:
                continue
            numtri = numtri + 1
            out.write('%8d%3d%3d' % (numtri, 5, 6) +
                      ''.join(['%8d' % (data[k] - 1) for k in (8, 10, 9, 5, 7, 6)]) + '\n')
            # 判断单元是否在边界上
            for p_bound, e_bound in [(p_inlet, e_inlet), (p_outlet, e_outlet),
                                     (p_front, e_front), (p_back, e_back)]:
                a1, a2, a3 = [binarySearch(p_bound, 0, p_bound.size - 1, data[k]) >= 0 for k in (8, 10, 9)]
                numface = 1 if a1 and a2 else \
                    3 if a1 and a3 else \
                    2 if a2 and a3 else 0
                if numface > 0:
                    e_bound.append((numtri, numface))

        out.write('ENDOFSECTION\n')
        print('written elements:', numtri, '. ')

        # 回到文件开头，更新节点数、单元数
        out.seek(len(head), 0)
        out.write(' %9d %9d' % (np, numtri))
        out.seek(0, 2)

        # 输出domain1
        out.writelines([
            '       ELEMENT GROUP 2.4.6\n',
            'GROUP:          1 ELEMENTS: %10d MATERIAL:          2 NFLAGS:          1\n' % numtri,
            '%32s\n' % 'all',
            '%8d' % 0
        ])
        for i in range(0, numtri):
            if i % 10 == 0:
                out.write('\n')
            out.write('%8d' % (i+1))
        out.write('\nENDOFSECTION\n')

        # 输出侧边
        for e_tag, e_bound in [('inlet', e_inlet), ('outlet', e_outlet),
                               ('front', e_front), ('back', e_back)]:
            out.writelines([' BOUNDARY CONDITIONS 2.4.6\n',
                            '%32s%8d%8d%8d%8d\n' % (e_tag, 1, len(e_bound), 0, 6)])
            for e_index, e_face in e_bound:
                out.write('%10d %4d %4d\n' % (e_index, 5, e_face))
            out.write('ENDOFSECTION\n')

        # 输出bottom
        # 单元层数 = 节点数 / 底层节点数 - 1
        num_bot_p = len(p_bot)
        num_ceng = np / num_bot_p - 1
        num_bot = int(numtri / num_ceng)
        # print(numtri, num_bot)
        out.writelines([' BOUNDARY CONDITIONS 2.4.6\n',
                        '%32s%8d%8d%8d%8d\n' % ('bot', 1, num_bot, 0, 6)])
        for e_index in range(1, num_bot + 1):
            out.write('%10d %4d %4d\n' % (e_index, 5, 5))
        out.write('ENDOFSECTION\n')

        # 输出top
        out.writelines([' BOUNDARY CONDITIONS 2.4.6\n',
                        '%32s%8d%8d%8d%8d\n' % ('top', 1, num_bot, 0, 6)])
        for e_index in range(numtri - num_bot + 1, numtri + 1):
            out.write('%10d %4d %4d\n' % (e_index, 5, 4))
        out.write('ENDOFSECTION\n')
    out.close()
    print("底层结点数:",num_bot_p,"层数:", num_ceng, "底层网格数:",numtri / num_ceng)

if __name__ == '__main__':
    import json
    with open("../info.json", 'r') as f:
        buildTerrain(json.load(f))

