/*
 * @Description: geoserver api
 * @Author: ekibun
 * @Date: 2019-12-27 15:59:13
 * @LastEditors  : ekibun
 * @LastEditTime : 2020-01-06 14:54:50
 */
const axios = require('axios');
const parseGeoraster = require('georaster');
const dataPreview = require('./dataPreview');

const server = {
  host: '0.0.0.0',
  port: 8080,
  /**
   * @param { string } path
   * @param { { [key: string]: any } } query
   */
  makeUrl: (path, query) => `http://${server.host}:${server.port}${path}?${
    [].concat(...Object.keys(query).map(
      (k) => [].concat(...[query[k]]).map((v) => `${k}=${v}`),
    )).join('&')}`,
};

const GeoServer = {
  server,
  /**
   * get map of given long lat
   * @param { [number, number] } long
   * @param { [number, number] } lat
   */
  getMap: async (long, lat) => {
    const response = await axios.get(server.makeUrl('/geoserver/ows', {
      Service: 'WCS',
      Request: 'GetCoverage',
      Version: '2.0.0',
      coverageId: 'SRTM:globcover',
      format: 'image/tiff',
      subset: [`Long(${long.join(',')})`, `Lat(${lat.join(',')})`],
    }), {
      responseType: 'arraybuffer',
    });
    return parseGeoraster(response.data);
    // console.log(georaster);
  },
};

module.exports = GeoServer;

/* eslint-disable no-console */
if (!module.parent) (async () => {
  const [long, lat] = [113.2536, 21.9167];
  const EARTH_RADIUS = 6371; // kM
  const RAD_PER_DEG = Math.PI / 180; // rad/deg
  const METER_PER_DEG_LAT = 1000 * EARTH_RADIUS * RAD_PER_DEG;
  const LONG_LAT_RATIO = Math.cos(lat * RAD_PER_DEG);
  const dlat = 4500 / METER_PER_DEG_LAT;
  const dlong = dlat / LONG_LAT_RATIO;

  const georaster = await GeoServer.getMap([long - dlong, long + dlong], [lat - dlat, lat + dlat]);
  console.log([georaster.width, georaster.height],
    [georaster.mins[0], georaster.maxs[0]]);

  await dataPreview(georaster.values[0].map((v) => Array.from(v)),
    [georaster.width, georaster.height],
    [georaster.mins[0], georaster.maxs[0]]);
})().catch((e) => console.log(e));
