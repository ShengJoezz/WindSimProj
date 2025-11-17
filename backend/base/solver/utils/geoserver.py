'''
Description: 
Author: ekibun
Date: 2020-01-07 15:40:44
LastEditors: ekibun
LastEditTime: 2020-09-28 20:27:49
'''
import math
import rasterio
import requests

def serverUrl(path: str) -> str:
    host = 'localhost'
    port = 8080
    return 'http://%s:%d%s' % (host, port, path)


def getMap(lon: [float, float], lat: [float, float], coverageId: str):
    rsp = requests.get(serverUrl('/geoserver/ows'), params = {
        'Service': 'WCS',
        'Request': 'GetCoverage',
        'Version': '2.0.0',
        'coverageId': coverageId,
        'format': 'image/tiff',
        'subset': ['Long(%f,%f)' % (*lon,), 'Lat(%f,%f)' % (*lat,)],
    })
    open("map.tif", "wb").write(rsp.content)
    return rasterio.open("map.tif")


def getUrban(lon: [float, float], lat: [float, float]):
    rsp = requests.get(serverUrl('/geoserver/ows'), params = {
        'Service': 'WFS',
        'Request': 'GetFeature',
        'Version': '1.0.0',
        'typeName': 'SRTM:beijing',
        'outputFormat': 'application/json',
        'srsName': 'urn:ogc:def:crs:EPSG::4326',
        'bbox': '%f,%f,%f,%f' % (lon[0], lat[0], lon[1], lat[1]),
    })
    return rsp.json()


if __name__ == '__main__':
    # getMap([116.19140625, 116.3671875], [40.60546875, 40.78125])
    print(getUrban([116.3715595010681, 116.3757776618919],
             [39.865933514289345, 39.86917107207065]))
