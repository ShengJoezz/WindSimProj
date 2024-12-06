from PIL import Image
import numpy as np

def dataPreview(data, size):
    print(np.uint8(np.asarray(data).reshape(size)))

    img = Image.fromarray(np.uint8(np.asarray(data).reshape(size)))
    img.save("test.jpg")
    pass

if __name__ == '__main__':
    dataPreview(range(100), (10, 10))