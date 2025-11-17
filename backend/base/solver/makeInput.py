# @Author: joe 847304926@qq.com
# @Date: 2024-09-28 21:36:52
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-07-21 21:02:08
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\base\solver\makeInput.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

if __name__ == '__main__':
  import json
  info = json.load(open("../info.json", 'r'))
  with open("Input/Turbines.txt", "w") as f:
    f.write('\n'.join([
      '\t'.join(map(str, [t['x'], t['y'], t['hub'], t['d'], 1]))
      for t in info['turbines']
    ]))
  info['mesh']['lc2'] = [info['mesh']['lc2']]
  numh = info['post']['numh']
  dh = info['post']['dh']
  json.dump({
    'domain': info['domain'],
    'wind': info['wind'],
    'mesh': info['mesh'],
    "terrain": info["terrain"],
    "roughness": info["roughness"],
    'post': {
      'num_udh': numh,
      'udh': [dh*(v+1) for v in range(numh)],
      'meshSize': info['post']['width']
    }
  },
    open("Input/input.json", 'w')
  )