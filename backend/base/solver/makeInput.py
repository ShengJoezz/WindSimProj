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
    'post': {
      'num_udh': numh,
      'udh': [dh*(v+1) for v in range(numh)],
      'meshSize': info['post']['width']
    }
  },
    open("Input/input.json", 'w')
  )