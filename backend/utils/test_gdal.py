#!/usr/bin/env python3
"""
Simple script to test if GDAL is working properly
"""

import sys
import json

try:
    from osgeo import gdal
    gdal.UseExceptions()
    
    # Print GDAL version
    version_info = gdal.VersionInfo()
    
    # Check if specific modules are available
    has_geotiff = "GTiff" in gdal.GetDriverByName("GTiff").GetMetadata()
    
    result = {
        "success": True,
        "gdal_version": version_info,
        "has_geotiff_support": has_geotiff,
        "drivers": [gdal.GetDriver(i).ShortName for i in range(gdal.GetDriverCount())][:10]  # List first 10 drivers
    }
    
    print(json.dumps(result))
    sys.exit(0)
    
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": "GDAL import error: " + str(e)
    }))
    sys.exit(1)
    
except Exception as e:
    print(json.dumps({
        "success": False,
        "error": str(e)
    }))
    sys.exit(1)