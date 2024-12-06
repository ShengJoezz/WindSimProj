/*
 * @Description: print data to terminal
 * @Author: ekibun
 * @Date: 2020-01-02 18:45:03
 * @LastEditors  : ekibun
 * @LastEditTime : 2020-01-03 11:05:36
 */
const { PNG } = require('pngjs');
const terminalImage = require('terminal-image');

/**
 * @param { number[] | number[][] } data
 * @param { number[] } param1 [width, height]
 * @param { number[] } param2 [min, max]
 */
module.exports = async (data, [width, height], [min, max]) => {
  const png = new PNG({
    width, height,
  });

  png.data = [].concat(...data).map((v) => ((v - min) * 255) / (max - min))
    .reduce((acc, cur, index) => (acc.set([cur, cur, cur, 255], index * 4), acc),
      new Uint8Array(width * height * 4));
  // eslint-disable-next-line no-console
  console.log(await terminalImage.buffer(PNG.sync.write(png)));
};
