#!/usr/bin/env python3
"""
terrain_clipper.py - GeoTIFF Terrain Cropping Utility

This script crops a GeoTIFF file based on geographic coordinates.
It supports both decimal degree and DMS coordinate formats.

Usage:
    python terrain_clipper.py [options] <input_file> <output_file>

Options:
    --bbox MINLON,MINLAT,MAXLON,MAXLAT   Bounding box in decimal degrees
    --bbox-dms "MINLON MINLAT MAXLON MAXLAT"  Bounding box in DMS format (e.g., "74°15'28.8\"W 40°42'51.6\"N 73°58'33.6\"W 40°51'50.4\"N")
    --preview-only                       Only calculate crop dimensions without writing file
    --preserve-reference                 Preserve georeference information in output
    --format FORMAT                      Output format (geotiff or asc), default: geotiff
    --backup                             Create a backup of the original file if it doesn't exist

Example:
    python terrain_clipper.py --bbox -74.25,40.715,-73.976,40.864 input.tif output.tif
    python terrain_clipper.py --bbox-dms "74°15'28.8\"W 40°42'51.6\"N 73°58'33.6\"W 40°51'50.4\"N" input.tif output.tif
    python terrain_clipper.py --preview-only --bbox -74.25,40.715,-73.976,40.864 input.tif
"""

import os
import sys
import json
import argparse
import re
from osgeo import gdal
import numpy as np

# Ensure GDAL uses exceptions instead of error codes
gdal.UseExceptions()

def parse_dms(dms_str):
    """Parse a DMS (Degrees, Minutes, Seconds) string to decimal degrees."""
    # Regex pattern to match DMS format
    pattern = r'(\d+)°(\d+)\'(\d+(\.\d+)?)\"([NSEW])'
    match = re.match(pattern, dms_str.strip())
    
    if not match:
        raise ValueError(f"Invalid DMS format: {dms_str}")
    
    degrees = int(match.group(1))
    minutes = int(match.group(2))
    seconds = float(match.group(3))
    direction = match.group(5)
    
    # Convert to decimal degrees
    decimal = degrees + minutes/60 + seconds/3600
    
    # Adjust sign based on direction
    if direction in ['S', 'W']:
        decimal = -decimal
        
    return decimal

def parse_bbox_dms(bbox_str):
    """Parse a bounding box string in DMS format to decimal degrees."""
    # Expected format: "74°15'28.8\"W 40°42'51.6\"N 73°58'33.6\"W 40°51'50.4\"N"
    parts = bbox_str.strip().split()
    
    if len(parts) != 4:
        raise ValueError("DMS bbox should contain 4 coordinates: minLon, minLat, maxLon, maxLat")
    
    # Parse each coordinate
    min_lon = parse_dms(parts[0])
    min_lat = parse_dms(parts[1])
    max_lon = parse_dms(parts[2])
    max_lat = parse_dms(parts[3])
    
    return min_lon, min_lat, max_lon, max_lat

def get_geotiff_info(input_file):
    """Get basic information about a GeoTIFF file."""
    ds = gdal.Open(input_file)
    geo_transform = ds.GetGeoTransform()
    projection = ds.GetProjection()
    width = ds.RasterXSize
    height = ds.RasterYSize
    
    # Calculate bounding box
    min_x = geo_transform[0]
    max_y = geo_transform[3]
    max_x = min_x + width * geo_transform[1]
    min_y = max_y + height * geo_transform[5]  # Note: geo_transform[5] is usually negative
    
    info = {
        'width': width,
        'height': height,
        'geo_transform': geo_transform,
        'projection': projection,
        'bbox': [min_x, min_y, max_x, max_y]
    }
    
    # Get statistics from first band
    band = ds.GetRasterBand(1)
    min_val, max_val, mean, stddev = band.GetStatistics(True, True)
    info['statistics'] = {
        'min': min_val,
        'max': max_val,
        'mean': mean,
        'stddev': stddev
    }
    
    ds = None  # Close dataset
    return info

def preview_crop(input_file, min_lon, min_lat, max_lon, max_lat):
    """Calculate crop dimensions without performing the actual crop."""
    ds = gdal.Open(input_file)
    geo_transform = ds.GetGeoTransform()
    
    # Convert geographic coordinates to pixel coordinates
    # For standard GeoTIFF:
    # geo_transform[0] = top left x (longitude)
    # geo_transform[1] = w-e pixel resolution (positive)
    # geo_transform[2] = rotation (0 if north up)
    # geo_transform[3] = top left y (latitude)
    # geo_transform[4] = rotation (0 if north up)
    # geo_transform[5] = n-s pixel resolution (negative)
    
    # Calculate pixel coordinates
    x_min = int((min_lon - geo_transform[0]) / geo_transform[1])
    y_max = int((min_lat - geo_transform[3]) / geo_transform[5])
    x_max = int((max_lon - geo_transform[0]) / geo_transform[1])
    y_min = int((max_lat - geo_transform[3]) / geo_transform[5])
    
    # Ensure coordinates are within image bounds
    x_min = max(0, x_min)
    y_min = max(0, y_min)
    x_max = min(ds.RasterXSize, x_max)
    y_max = min(ds.RasterYSize, y_max)
    
    # Calculate crop dimensions
    width = x_max - x_min
    height = y_max - y_min
    
    # Calculate number of data points
    data_points = width * height
    
    preview = {
        'pixel_coordinates': {
            'x_min': x_min,
            'y_min': y_min,
            'x_max': x_max,
            'y_max': y_max
        },
        'dimensions': {
            'width': width,
            'height': height
        },
        'estimated_data_points': data_points,
        'valid': width > 0 and height > 0
    }
    
    ds = None  # Close dataset
    return preview

def crop_geotiff(input_file, output_file, min_lon, min_lat, max_lon, max_lat, output_format='GTiff', preserve_reference=True):
    """Crop a GeoTIFF using gdal_translate."""
    # Create the output format string
    format_ext = 'GTiff' if output_format.lower() == 'geotiff' else 'AAIGrid'
    
    # Set up the gdal_translate options
    translate_options = gdal.TranslateOptions(
        format=format_ext,
        projWin=[min_lon, max_lat, max_lon, min_lat],  # [ulx, uly, lrx, lry]
        creationOptions=['COMPRESS=LZW', 'PREDICTOR=2'] if format_ext == 'GTiff' else None
    )
    
    # Execute the crop operation
    result = gdal.Translate(output_file, input_file, options=translate_options)
    
    # If we need to remove georeferencing for ASCII Grid output
    if format_ext == 'AAIGrid' and not preserve_reference:
        # For AAIGrid, the .prj file contains georeferencing
        prj_file = os.path.splitext(output_file)[0] + '.prj'
        if os.path.exists(prj_file):
            os.remove(prj_file)
    
    result = None  # Close dataset
    return True

def create_backup(file_path):
    """Create a backup of the original file if it doesn't exist."""
    backup_path = os.path.splitext(file_path)[0] + '_original' + os.path.splitext(file_path)[1]
    if not os.path.exists(backup_path):
        print(f"Creating backup: {backup_path}")
        gdal.Translate(backup_path, file_path)
    return backup_path

def main():
    parser = argparse.ArgumentParser(description='Crop a GeoTIFF based on geographic coordinates.')
    parser.add_argument('--bbox', type=str, help='Bounding box in decimal degrees (minLon,minLat,maxLon,maxLat)')
    parser.add_argument('--bbox-dms', type=str, help='Bounding box in DMS format ("minLon minLat maxLon maxLat")')
    parser.add_argument('--preview-only', action='store_true', help='Only calculate crop dimensions without writing file')
    parser.add_argument('--preserve-reference', action='store_true', help='Preserve georeference information in output')
    parser.add_argument('--format', type=str, default='geotiff', choices=['geotiff', 'asc'], help='Output format')
    parser.add_argument('--backup', action='store_true', help='Create a backup of the original file')
    parser.add_argument('input_file', type=str, help='Input GeoTIFF file')
    parser.add_argument('output_file', type=str, nargs='?', help='Output file (required unless --preview-only)')
    
    # Parse arguments
    args = parser.parse_args()
    
    # Validate arguments
    if not args.preview_only and not args.output_file:
        parser.error("output_file is required unless --preview-only is specified")
    
    if not (args.bbox or args.bbox_dms):
        parser.error("Either --bbox or --bbox-dms must be provided")
    
    try:
        # Parse the bounding box
        if args.bbox:
            try:
                min_lon, min_lat, max_lon, max_lat = map(float, args.bbox.split(','))
            except ValueError:
                parser.error("Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat")
        else:  # using bbox-dms
            try:
                min_lon, min_lat, max_lon, max_lat = parse_bbox_dms(args.bbox_dms)
            except ValueError as e:
                parser.error(f"Invalid bbox-dms format: {e}")
        
        # Check if input file exists
        if not os.path.exists(args.input_file):
            parser.error(f"Input file not found: {args.input_file}")
        
        # Create backup if requested
        if args.backup:
            backup_path = create_backup(args.input_file)
            print(f"Created backup at: {backup_path}")
        
        # If preview only, output the information and exit
        if args.preview_only:
            preview = preview_crop(args.input_file, min_lon, min_lat, max_lon, max_lat)
            print(json.dumps(preview, indent=2))
            return 0
        
        # Perform the actual crop
        success = crop_geotiff(
            args.input_file, 
            args.output_file, 
            min_lon, min_lat, max_lon, max_lat,
            args.format,
            args.preserve_reference
        )
        
        if success:
            print(json.dumps({
                "success": True,
                "message": "Terrain successfully cropped",
                "output_file": args.output_file
            }))
            return 0
        else:
            print(json.dumps({
                "success": False,
                "message": "Failed to crop terrain"
            }))
            return 1
            
    except Exception as e:
        print(json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))
        return 1

if __name__ == "__main__":
    sys.exit(main())