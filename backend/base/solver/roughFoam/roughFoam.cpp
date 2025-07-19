/*---------------------------------------------------------------------------*\
  =========                 |
  \\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox
   \\    /   O peration     |
    \\  /    A nd           | www.openfoam.com
     \\/     M anipulation  |
-------------------------------------------------------------------------------
    Copyright (C) 2011-2017 OpenFOAM Foundation
-------------------------------------------------------------------------------
License
    This file is part of OpenFOAM.

    OpenFOAM is free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    OpenFOAM is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
    FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
    for more details.

    You should have received a copy of the GNU General Public License
    along with OpenFOAM.  If not, see <http://www.gnu.org/licenses/>.

Application
    simpleFoam

Group
    grpIncompressibleSolvers

Description
    Steady-state solver for incompressible, turbulent flows.

    \heading Solver details
    The solver uses the SIMPLE algorithm to solve the continuity equation:

        \f[
            \div \vec{U} = 0
        \f]

    and momentum equation:

        \f[
            \div \left( \vec{U} \vec{U} \right) - \div \gvec{R}
          = - \grad p + \vec{S}_U
        \f]

    Where:
    \vartable
        \vec{U} | Velocity
        p       | Pressure
        \vec{R} | Stress tensor
        \vec{S}_U | Momentum source
    \endvartable

    \heading Required fields
    \plaintable
        U       | Velocity [m/s]
        p       | Kinematic pressure, p/rho [m2/s2]
        \<turbulence fields\> | As required by user selection
    \endplaintable

\*---------------------------------------------------------------------------*/
#include "fvCFD.H"
#include "singlePhaseTransportModel.H"
#include "turbulentTransportModel.H"
#include "simpleControl.H"
#include "fvOptions.H"
#include <iostream>
#include <stdio.h>
#include <math.h>
#include <fstream>
#include "cJSON.h"
using namespace std;

// some variables about adm
FILE *file0, *file1;
static long int i, j, k;
static int numTurbine, numUPCt[10] = {0}, botID = 6, numType;
static int onNode[200] = {0}, numU[200] = {0}, tempNumU[200] = {0};
static double XY[200][5] = {0}, UPCt[10][200][3] = {0}, realXYZ[200][3] = {0}, realHigh[200] = {0};
static double sumU[200] = {0}, windU[200] = {0};
static double Power[200] = {0}, Ct[200] = {0}, fn[200] = {0};
static double angle, vInlet, scale, dx[200] = {0}, botHigh;
static const double pi = 3.141592654, p_air = 1.225;
static int iUnit[200][10000] = {0}, cUnit[200][5000];

// some variables about roughness
ifstream in;
ofstream out;
// static double lat, lon, utmX = 33643138.77, utmY = 2830869.606, cee = 250.0;
static double lat, lon, utmX = 0.0, utmY = 0.0, cee = 100.0;
static double lt, h, h1, ceng, q1, r1, r2, r12, Cd, lad_max, vege_times;

static void read_Turbines()
{
    char line[1024];
    numTurbine = 0;
    file0 = fopen("Input/Turbines.txt", "r");
    while (fgets(line, sizeof(line), file0))
    {
        numTurbine++;
    }
    fclose(file0);
    file0 = fopen("Input/Turbines.txt", "r");
    for (i = 0; i < numTurbine; i++)
    {
        fscanf(file0, "%lf%lf%lf%lf%lf", &XY[i][0], &XY[i][1], &XY[i][2], &XY[i][3], &XY[i][4]);
    }
    fclose(file0);
}

static void read_InputJSON()
{
    numType = XY[0][4];
    for (i = 0; i < numTurbine; i++)
    {
        if (XY[i][4] > numType)
        {
            numType = XY[i][4];
        }
    }
    file0 = fopen("Input/input.json", "r");
    fseek(file0, 0, SEEK_END);
    long file_size = ftell(file0);
    fseek(file0, 0, SEEK_SET);
    char *json_str = (char *)malloc(file_size + 1);
    fread(json_str, 1, file_size, file0);
    fclose(file0);

    cJSON *cjson = cJSON_Parse(json_str);
    // 读取计算域信息
    cJSON *cjson_domain = cJSON_GetObjectItem(cjson, "domain");
    cJSON *cjson_domain_long = cJSON_GetObjectItem(cjson_domain, "long");
    cJSON *cjson_domain_lat = cJSON_GetObjectItem(cjson_domain, "lat");
    cJSON *cjson_domain_lt = cJSON_GetObjectItem(cjson_domain, "lt");
    cJSON *cjson_domain_h = cJSON_GetObjectItem(cjson_domain, "h");
    lon = cjson_domain_long->valuedouble;
    lat = cjson_domain_lat->valuedouble;
    lt = cjson_domain_lt->valuedouble;
    h = cjson_domain_h->valuedouble;
    // 读取风向角与初始风速
    cJSON *cjson_wind = cJSON_GetObjectItem(cjson, "wind");
    cJSON *cjson_wind_angle = cJSON_GetObjectItem(cjson_wind, "angle");
    cJSON *cjson_wind_speed = cJSON_GetObjectItem(cjson_wind, "speed");
    angle = cjson_wind_angle->valuedouble;
    angle = -(90 + angle) * pi / 180;
    vInlet = cjson_wind_speed->valuedouble;
    // 读取竖直与水平网格参数
    cJSON *cjson_mesh = cJSON_GetObjectItem(cjson, "mesh");
    cJSON *cjson_mesh_h1 = cJSON_GetObjectItem(cjson_mesh, "h1");
    cJSON *cjson_mesh_ceng = cJSON_GetObjectItem(cjson_mesh, "ceng");
    cJSON *cjson_mesh_q1 = cJSON_GetObjectItem(cjson_mesh, "q1");
    cJSON *cjson_mesh_lc2 = cJSON_GetObjectItem(cjson_mesh, "lc2");
    cJSON *cjson_mesh_scale = cJSON_GetObjectItem(cjson_mesh, "scale");
    cJSON *cjson_dx = cJSON_GetArrayItem(cjson_mesh_lc2, 0);
    h1 = cjson_mesh_h1->valuedouble;
    ceng = cjson_mesh_ceng->valuedouble;
    q1 = cjson_mesh_q1->valuedouble;
    ceng = cjson_mesh_ceng->valuedouble;
    scale = cjson_mesh_scale->valuedouble;
    botHigh = scale * h1 / ceng;
    for (i = 0; i < numTurbine; i++)
    {
        k = (int)XY[i][4] - 1;
        cjson_dx = cJSON_GetArrayItem(cjson_mesh_lc2, k);
        dx[i] = scale * cjson_dx->valuedouble;
    }
    printf("angle = %f vInlet = %f scale = %f dx = %f\n", angle, vInlet, scale, dx[0]);
    // 读取地形半径
    cJSON *cjson_terrain = cJSON_GetObjectItem(cjson, "terrain");
    cJSON *cjson_terrain_r1 = cJSON_GetObjectItem(cjson_terrain, "r1");
    cJSON *cjson_terrain_r2 = cJSON_GetObjectItem(cjson_terrain, "r2");
    r1 = cjson_terrain_r1->valuedouble;
    r2 = cjson_terrain_r2->valuedouble;
    r12 = (r1 + r2) / 2.0;
    // 读取粗糙度参数
    cJSON *cjson_roughness = cJSON_GetObjectItem(cjson, "roughness");
    cJSON *cjson_roughness_Cd = cJSON_GetObjectItem(cjson_roughness, "Cd");
    cJSON *cjson_roughness_lad_max = cJSON_GetObjectItem(cjson_roughness, "lad_max");
    cJSON *cjson_roughness_vege_times = cJSON_GetObjectItem(cjson_roughness, "vege_times");
    Cd = cjson_roughness_Cd->valuedouble;
    lad_max = cjson_roughness_lad_max->valuedouble;
    vege_times = cjson_roughness_vege_times->valuedouble;
    // 释放指针
    free(json_str);
    cJSON_Delete(cjson);

    for (i = 0; i < numTurbine; i++)
    {
        // windU[i] = vInlet;
        for (j = 0; j < 4; j++)
        {
            XY[i][j] = XY[i][j] * scale;
        }
        // printf("%f\t%f\t%f\t%f\n", XY[i][0], XY[i][1], XY[i][2], XY[i][3]);
    }

    file1 = fopen("Output/Output01-XY", "w");
    double tempX, tempY;
    for (i = 0; i < numTurbine; i++)
    {
        tempX = XY[i][0];
        tempY = XY[i][1];
        XY[i][0] = tempX * Foam::cos(angle) + tempY * Foam::sin(angle);
        XY[i][1] = -tempX * Foam::sin(angle) + tempY * Foam::cos(angle);
        fprintf(file1, "%f\t%f\t%f\t%f\t%f\n", XY[i][0], XY[i][1], XY[i][2], XY[i][3], XY[i][4]);
    }
    fclose(file1);
}

static char *numToStr(int num, char *str, int radix)
{
    char index[] = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    unsigned unum;
    int i = 0, j, k;
    if (radix == 10 && num < 0)
    {
        unum = (unsigned)-num;
        str[i++] = '-';
    }
    else
        unum = (unsigned)num;
    do
    {
        str[i++] = index[unum % (unsigned)radix];
        unum /= radix;
    } while (unum);
    str[i] = '\0';
    if (str[0] == '-')
        k = 1;
    else
        k = 0;
    char temp;
    for (j = k; j <= (i - 1) / 2; j++)
    {
        temp = str[j];
        str[j] = str[i - 1 + k - j];
        str[i - 1 + k - j] = temp;
    }
    return str;
}

static void read_U_P_Ct()
{
    char strPath[50], strNum[30], line[1024];
    for (i = 0; i < numType; i++)
    {
        strcpy(strPath, "Input/");
        numToStr(i + 1, strNum, 10);
        strcat(strPath, strcat(strNum, "-U-P-Ct.txt"));
        /*Message("%s\n", strPath);*/

        numUPCt[i] = 0;
        file0 = fopen(strPath, "r");
        while (fgets(line, sizeof(line), file0))
        {
            numUPCt[i]++;
        }
        fclose(file0);
        /*Message("%d\n", numUPCt[i]);*/

        file0 = fopen(strPath, "r");
        for (j = 0; j < numUPCt[i]; j++)
        {
            fscanf(file0, "%lf%lf%lf\n", &UPCt[i][j][0], &UPCt[i][j][1], &UPCt[i][j][2]);
            /*Message("%f\t%f\t%f\n", UPCt[i][j][0], UPCt[i][j][1], UPCt[i][j][2]);*/
        }
        fclose(file0);
    }
}

static void update_vInlet()
{
    vInlet = (int)(windU[0] + 0.5);
    // Message("angle = %f vInlet = %d scale = %f dx = %f\n", angle, vInlet, scale, dx[0]);
    Info << "angle = " << angle << " vInlet = " << vInlet
         << " scale = " << scale << " dx = " << dx[0] << endl;
}

static void LonLat2UTM(double longitude, double latitude, double &UTME, double &UTMN)
{
    double DEG_TO_RAD_LOCAL = 3.1415926535897932 / 180.0;
    double lon = longitude;
    double lat = latitude;
    // unit: km
    // variable
    double a = 6378.137;
    double e = 0.0818192;
    double k0 = 0.9996;
    double E0 = 500;
    double N0 = 0;
    // calc zoneNumber
    double zoneNumber = floor(lon / 6) + 31;
    // calc lambda0
    double lambda0 = (zoneNumber - 1) * 6 - 180 + 3; // deg
    lambda0 = lambda0 * DEG_TO_RAD_LOCAL;            // radian
    // calc phi and lambda (lat and lon)
    double phi = lat * DEG_TO_RAD_LOCAL;
    double lambda = lon * DEG_TO_RAD_LOCAL;

    // Formula START
    double v = 1 / Foam::sqrt(1 - pow(e * Foam::sin(phi), 2));
    double A = (lambda - lambda0) * Foam::cos(phi);
    double T = pow(Foam::tan(phi), 2);
    double C = pow(e, 2) / (1 - pow(e, 2)) * pow(Foam::cos(phi), 2);
    double s = (1 - pow(e, 2) / 4 - 3 * pow(e, 4) / 64 - 5 * pow(e, 6) / 256) * phi - (3 * pow(e, 2) / 8 + 3 * pow(e, 4) / 32 + 45 * pow(e, 6) / 1024) * Foam::sin(2 * phi) + (15 * pow(e, 4) / 256 + 45 * pow(e, 6) / 1024) * Foam::sin(4 * phi) - 35 * pow(e, 6) / 3072 * Foam::sin(6 * phi);

    UTME = E0 + k0 * a * v * (A + (1 - T + C) * pow(A, 3) / 6 + (5 - 18 * T + T * T) * pow(A, 5) / 120);
    UTMN = N0 + k0 * a * (s + v * Foam::tan(phi) * (pow(A, 2) / 2 + (5 - T + 9 * C + 4 * C * C) * pow(A, 4) / 24 + (61 - 58 * T + T * T) * pow(A, 6) / 720));

    UTME *= 1000;
    UTMN *= 1000;
}

int main(int argc, char *argv[])
{
    read_Turbines();
    read_InputJSON();
    read_U_P_Ct();

#include "setRootCase.H"
#include "createTime.H"
#include "createMesh.H"
#include "postProcess.H"
#include "addCheckCaseOptions.H"
#include "createControl.H"
#include "createFields.H"
#include "initContinuityErrs.H"

/*******************************calc_RealHigh()*******************************/
#pragma region
    botID = mesh.boundaryMesh().findPatchID("bot");

    for (i = 0; i < numTurbine; i++)
    {
        onNode[i] = 0;
        realXYZ[i][0] = 0;
        realXYZ[i][1] = 0;
        realXYZ[i][2] = 0;
        realHigh[i] = 0;
    }

    long int sumUnits = 0;
    double Dxy[200], tempDxy, botFaceX, botFaceY, botFaceZ;
    for (i = 0; i < numTurbine; i++)
    {
        Dxy[i] = dx[i];
        sumUnits = 0;
        forAll(mesh.boundaryMesh()[botID], faceI)
        {
            sumUnits++;
            botFaceX = mesh.C()[faceI].x();
            botFaceY = mesh.C()[faceI].y();
            tempDxy = Foam::sqrt(Foam::pow(XY[i][0] - botFaceX, 2) + Foam::pow(XY[i][1] - botFaceY, 2));
            if (tempDxy <= Dxy[i])
            {
                Dxy[i] = tempDxy;
            }
        }
    }

    Info << "整体网格数量:" << returnReduce(mesh.nCells(), sumOp<label>()) << endl;
    Info << "底层网格数量:" << returnReduce(sumUnits, sumOp<int>()) << endl;

    for (i = 0; i < numTurbine; i++)
    {
        Dxy[i] = returnReduce(Dxy[i], minOp<double>());
        forAll(mesh.boundary()[botID], faceI)
        {
            botFaceX = mesh.C()[faceI].x();
            botFaceY = mesh.C()[faceI].y();
            botFaceZ = mesh.C()[faceI].z();
            tempDxy = Foam::sqrt(Foam::pow(XY[i][0] - botFaceX, 2) + Foam::pow(XY[i][1] - botFaceY, 2));
            if (tempDxy == Dxy[i])
            {
                onNode[i] = Pstream::myProcNo();
                realXYZ[i][0] = botFaceX;
                realXYZ[i][1] = botFaceY;
                realXYZ[i][2] = botFaceZ;
                realHigh[i] = XY[i][2] + botFaceZ;
            }
        }
    }

    file1 = fopen("Output/Output02-realHigh", "w");
    for (i = 0; i < numTurbine; i++)
    {
        onNode[i] = returnReduce(onNode[i], sumOp<int>());
        realXYZ[i][0] = returnReduce(realXYZ[i][0], sumOp<double>());
        realXYZ[i][1] = returnReduce(realXYZ[i][1], sumOp<double>());
        realXYZ[i][2] = returnReduce(realXYZ[i][2], sumOp<double>());
        realHigh[i] = returnReduce(realHigh[i], sumOp<double>());
        fprintf(file1, "WT-%d on Node-%d\t%f\t%f\t%f\t%f\t%f\n", i + 1, onNode[i], Dxy[i], realXYZ[i][0], realXYZ[i][1], realXYZ[i][2], realHigh[i]);
    }
    fclose(file1);
#pragma endregion

/*******************************calc_windU_INIT()************************************/
#pragma region
    double Dyz, xyz[3] = {0};

    for (i = 0; i < numTurbine; i++)
    {
        sumU[i] = 0;
        numU[i] = 0;
        forAll(mesh.cells(), cellI)
        {
            xyz[0] = mesh.C()[cellI].x();
            xyz[1] = mesh.C()[cellI].y();
            xyz[2] = mesh.C()[cellI].z();
            Dyz = Foam::sqrt(Foam::pow(XY[i][1] - xyz[1], 2) + Foam::pow(realHigh[i] - xyz[2], 2));
            if (xyz[0] >= XY[i][0] - XY[i][3] - 3 * dx[i] && xyz[0] <= XY[i][0] - XY[i][3] + 3 * dx[i] && Dyz <= XY[i][3] * 0.25)
            {
                iUnit[i][numU[i]] = Pstream::myProcNo();
                cUnit[i][numU[i]] = cellI;
                // tUnit[i][numU[i]] = t;
                sumU[i] = sumU[i] + U[cellI].x();
                numU[i] = numU[i] + 1;
            }
        }
    }

    for (i = 0; i < numTurbine; i++)
    {
        tempNumU[i] = numU[i];
        numU[i] = returnReduce(numU[i], sumOp<int>());
        sumU[i] = returnReduce(sumU[i], sumOp<double>());
        if (numU[i] == 0)
        {
            continue;
        }
        windU[i] = sumU[i] / numU[i];
    }

    file1 = fopen("Output/Output03-sumU-numU-windU(INIT)", "w");
    for (i = 0; i < numTurbine; i++)
    {
        fprintf(file1, "%f\t%d\t%f\n", sumU[i], numU[i], windU[i]);
    }
    fclose(file1);
#pragma endregion

/*******************************update_vInlet()**************************************/
#pragma region
    update_vInlet();
#pragma endregion

/*******************************calc_P_Ct_fn()***************************************/
#pragma region
    for (i = 0; i < numTurbine; i++)
    {
        k = (int)XY[i][4] - 1;
        if (windU[i] < UPCt[k][0][0] || windU[i] > UPCt[k][numUPCt[k] - 1][0])
        {
            Power[i] = 0;
            Ct[i] = 0;
        }
        else
        {
            for (j = 0; j < numUPCt[k]; j++)
            {
                if (windU[i] >= UPCt[k][j][0] && windU[i] < UPCt[k][j + 1][0])
                {
                    Power[i] = UPCt[k][j][1] + (UPCt[k][j + 1][1] - UPCt[k][j][1]) * (windU[i] - UPCt[k][j][0]) / (UPCt[k][j + 1][0] - UPCt[k][j][0]);
                    Ct[i] = UPCt[k][j][2] + (UPCt[k][j + 1][2] - UPCt[k][j][2]) * (windU[i] - UPCt[k][j][0]) / (UPCt[k][j + 1][0] - UPCt[k][j][0]);
                    /*Message("%f\t%f\n", UPCt[k][j][0], UPCt[k][j][2]);*/
                }
            }
        }
        fn[i] = 0.25 / dx[i] * p_air * Ct[i] * windU[i] * windU[i];
    }
#pragma endregion

/*******************************write_U_P_Ct_fn_INIT()*******************************/
#pragma region
    file1 = fopen("Output/Output04-U-P-Ct-fn(INIT)", "w");
    for (i = 0; i < numTurbine; i++)
    {
        fprintf(file1, "%f\t%f\t%f\t%f\n", windU[i], Power[i], Ct[i], fn[i]);
    }
    fclose(file1);
#pragma endregion

/*******************************calc_CUDMI_ADM_INIT()*************************************/
#pragma region
    volVectorField SourceT(
        IOobject(
            "SourceT",
            runTime.timeName(),
            mesh,
            IOobject::MUST_READ,
            IOobject::AUTO_WRITE),
        mesh);

    forAll(mesh.cells(), cellI)
    {
        SourceT[cellI].x() = 0;
        SourceT[cellI].y() = 0;
        SourceT[cellI].z() = 0;
    }

    for (i = 0; i < numTurbine; i++)
    {
        forAll(mesh.cells(), cellI)
        {
            xyz[0] = mesh.C()[cellI].x();
            xyz[1] = mesh.C()[cellI].y();
            xyz[2] = mesh.C()[cellI].z();
            Dyz = Foam::sqrt(Foam::pow(XY[i][1] - xyz[1], 2) + Foam::pow(realHigh[i] - xyz[2], 2));
            if (xyz[0] >= XY[i][0] - dx[i] && xyz[0] <= XY[i][0] + dx[i] && Dyz <= XY[i][3] * 0.5)
            {
                SourceT[cellI].x() = -fn[i];
            }
        }
    }
#pragma endregion

/*******************************add_Roughness()**************************************/
/******************read_Rou()********************/
#pragma region
    // LonLat2UTM(lon, lat, utmX, utmY);
    Info << "utmX = " << fixed << utmX << "; utmY = " << fixed << utmY << endl;

    std::string line;
    in.open("Input/rou");
    for (i = 0; i < 4; i++)
    {
        getline(in, line);
    }
    long int validrou = 0, num_roughness = 0, s = 0, rou[6];
    while (getline(in, line))
    {
        std::istringstream items(line);
        i = 0;
        double item1;
        while (items >> item1)
        {
            rou[i] = item1;
            i = i + 1;
        }
        if (i == 1)
            break;
        if (i == 3)
        {
            num_roughness = num_roughness + rou[2];
            s = s + 1;
            // Info << "group= " << s << "  " << rou[0] << "  " << rou[1] << "  " << rou[2] << endl;
        }
    }
    in.close();
    Info << "rou文件中数据总数: " << num_roughness << endl;

    long double *nx, *ny, *nh, rou_x, rou_y, roua, roub, rou1, rou2;
    long int rou3;
    nx = new long double[num_roughness];
    ny = new long double[num_roughness];
    nh = new long double[num_roughness];
    in.open("Input/rou");
    for (i = 0; i < 4; i++)
    {
        getline(in, line);
    }
    file1 = fopen("Output/Output7-rou_x-rou_y-roua-roub", "w");
    for (i = 0; i < s; i++)
    {
        in >> rou1 >> rou2 >> rou3;
        for (j = 0; j < rou3; j++)
        {
            in >> rou_x >> rou_y;
            roua = (rou_x - utmX) * Foam::cos(angle) + (rou_y - utmY) * Foam::sin(angle);
            roub = -(rou_x - utmX) * Foam::sin(angle) + (rou_y - utmY) * Foam::cos(angle);
            // cout << rou_x <<"  "<< rou_y <<"  "<< roua <<"  "<< roub << endl;
            fprintf(file1, "%Lf\t%Lf\t%Lf\t%Lf\n", rou_x, rou_y, roua, roub);
            if (fabs(roua) <= lt / 2.0 && fabs(roub) <= lt / 2.0)
            {
                nx[validrou] = roua;
                ny[validrou] = roub;
                nh[validrou] = rou2 * vege_times; // roughness height calc
                validrou = validrou + 1;
                // cout << nx[i] <<"  "<< ny[i] <<"  "<< nh[i] << endl;
            }
        }
    }
    fclose(file1);
    in.close();
    Info << "rou文件在计算域中的数据个数: " << validrou << endl;
#pragma endregion
/******************regular_Data()****************/
#pragma region
    int mr, mm;
    double DT_R = lt + cee - fmod(lt, cee);
    long int null_m = DT_R / cee, null_n = null_m, actual_nodes = (null_m + 1) * (null_n + 1);
    long double *n1, *n2, *n3;
    n1 = new long double[actual_nodes];
    n2 = new long double[actual_nodes];
    n3 = new long double[actual_nodes];

    for (i = 0; i < actual_nodes; i++)
    {
        n1[i] = (i - i / (null_m + 1) * (null_n + 1)) * cee - DT_R / 2.0;
        n2[i] = i / (null_n + 1) * cee - DT_R / 2.0;
        n3[i] = 0;
    }

    for (mr = 0; mr < validrou; mr++)
    {
        long double mini = lt * lt;
        for (i = 0; i < actual_nodes; i++)
        {
            long double length_square = (n1[i] - nx[mr]) * (n1[i] - nx[mr]) + (n2[i] - ny[mr]) * (n2[i] - ny[mr]);
            if (length_square < mini)
            {
                mini = length_square;
                mm = i;
            }
        }
        n3[mm] = nh[mr];
        // cout << n1[i] <<"  "<< n2[i] <<"  "<< n3[i] << endl;
    }

    file1 = fopen("Output/Output8-n1-n2-n3", "w");
    for (i = 0; i < actual_nodes; i++)
    {
        fprintf(file1, "%Lf\t%Lf\t%Lf\n", n1[i], n2[i], n3[i]);
    }
    fclose(file1);

#pragma endregion
/******************calc_Cxy()********************/
#pragma region
    double h0, hf, hh = h1 / ceng;
    long int num1 = 0, num3, num;
    int num_ceng = ceil(Foam::log((h - h1) * (q1 - 1) / (h1 / ceng) / q1 + 1) / Foam::log(q1)) + ceng;

    forAll(mesh.cells(), cellI)
    {
        Cxy[cellI].x() = 0.0;
        Cxy[cellI].y() = 0.0;
        Cxy[cellI].z() = 0.0;
        RoughT[cellI].x() = 0.0;
        RoughT[cellI].y() = 0.0;
        RoughT[cellI].z() = 0.0;
        num1 = num1 + 1;
        if (num1 <= 50)
        {
            // Pout << "This is No." << Pstream::myProcNo() << ", Grid Num: " << cellI << endl;
            Pout << "Grid Num: " << cellI << "  Coordinate:" << mesh.C()[num1].x() << "  " << mesh.C()[num1].y() << "  " << mesh.C()[num1].z() << endl;
        }
    }

    num3 = num1 / num_ceng;

    Info << "全局总网格数: " << returnReduce(num1, sumOp<int>()) << endl;
    Pout << "网格单元总数: " << num1 << endl
         << "纵向划分网格数: " << num_ceng << endl
         << "每层网格数: " << num3 << endl;

    double *faceX, *faceY, *faceZ, px, py;
    long int aa, bb, k1, k2, k3, k4, numFace = 0;
    double cel = cee * scale, linear, maxFaceZ = -h * scale;
    faceX = new double[num1];
    faceY = new double[num1];
    faceZ = new double[num1];

    forAll(mesh.boundaryMesh()[botID], faceI)
    {
        faceX[numFace] = mesh.C()[faceI].x();
        faceY[numFace] = mesh.C()[faceI].y();
        faceZ[numFace] = mesh.C()[faceI].z();
        if (faceZ[numFace] > maxFaceZ)
        {
            maxFaceZ = faceZ[numFace];
        } 
        numFace = numFace + 1;
    }
    Pout << maxFaceZ << endl;
    for (i = 0; i < numFace; i++)
    {
        if (Foam::pow(faceX[i], 2) + Foam::pow(faceY[i], 2) < r12 * scale * r12 * scale)
        {
            aa = ceil((faceX[i] + DT_R / 2.0 * scale) / cel);
            bb = ceil((faceY[i] + DT_R / 2.0 * scale) / cel); /*!!!*/
            k1 = (bb - 1) * (null_n + 1) + aa - 1;
            k2 = k1 + 1;
            k3 = k1 + null_n;
            k4 = k1 + null_n + 1;
            px = faceX[i] - n1[k1] * scale;
            py = faceY[i] - n2[k1] * scale;
            linear = fabs(aa - (faceX[i] + DT_R / 2.0) / cel) + fabs(bb - (faceY[i] + DT_R / 2.0) / cel);
            if (linear < 1.0)
            {
                hf = scale * (n3[k1] - (n3[k1] - n3[k2]) / cel * px - (n3[k1] - n3[k3]) / cel * py);
            }
            else
            {
                hf = scale * (n3[k3] + n3[k2] - n3[k4] - (n3[k3] - n3[k4]) / cel * px - (n3[k2] - n3[k4]) / cel * py);
            }
        }
        else
        {
            hf = 0.0;
        }

        forAll(mesh.cells(), cellI)
        {
            if (mesh.C()[cellI].z() - maxFaceZ > 0.1)
            {
                continue;
            }
            if (fabs(mesh.C()[cellI].x() - faceX[i]) < 0.00001 && fabs(mesh.C()[cellI].y() - faceY[i]) < 0.00001)
            {
                h0 = mesh.C()[cellI].z() - (2.0 * faceZ[i] - hh * scale) * h / (2.0 * h - hh); // 距离地表高度
                if (h0 >= 0 && h0 <= hf && hf != 0.0)
                {
                    Cxy[cellI].x() = 1.0 / scale * Cd * lad_max * Foam::exp(-(h0 / hf - 0.5) * (h0 / hf - 0.5) * 10.0);
                    if (Cxy[cellI].x() < 0)
                    {
                        Cxy[cellI].x() = 0.0;
                    }
                    Cxy[cellI].y() = Cxy[cellI].x();
                    Cxy[cellI].z() = Cxy[cellI].x();
                    // cout << num << "  " << h0 << "  " << Cxy[num].x() << endl;
                }
            }
        }
    }
    delete[] n1, delete[] n2, delete[] n3;
    delete[] nx, delete[] ny, delete[] nh;
    delete[] faceX, delete[] faceY, delete[] faceZ;

#pragma endregion

    argList::addNote(
        "Steady-state solver for incompressible, turbulent flows.");
    turbulence->validate();

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    Info << "\nStarting time loop\n"
         << endl;

    while (simple.loop())
    {
        Info << "Time = " << runTime.timeName() << nl << endl;

        // --- Pressure-velocity SIMPLE corrector
        {
/*******************************calc_CUDMI_ROUGH()*************************************/
#pragma region
            forAll(mesh.cells(), cellI)
            {
                U_mag[cellI] = Foam::sqrt(U[cellI].x() * U[cellI].x() + U[cellI].y() * U[cellI].y() + U[cellI].z() * U[cellI].z());
                RoughT[cellI].x() = -0.5 * 1.22 * U[cellI].x() * U_mag[cellI] * Cxy[cellI].x();
                RoughT[cellI].y() = -0.5 * 1.22 * U[cellI].y() * U_mag[cellI] * Cxy[cellI].y();
                RoughT[cellI].z() = -0.5 * 1.22 * U[cellI].z() * U_mag[cellI] * Cxy[cellI].z();
            }
#pragma endregion

/*******************************calc_windU_ADJUST()************************************/
#pragma region
            for (i = 0; i < numTurbine; i++)
            {
                sumU[i] = 0;
                for (j = 0; j < tempNumU[i]; j++)
                {
                    if (Pstream::myProcNo() == iUnit[i][j])
                    {
                        sumU[i] = sumU[i] + U[cUnit[i][j]].x();
                    }
                }
                sumU[i] = returnReduce(sumU[i], sumOp<double>());
                if (numU[i] == 0)
                {
                    continue;
                }
                windU[i] = sumU[i] / numU[i];
            }
            file1 = fopen("Output/Output05-sumU-numU-windU(ADJUST)", "w");
            for (i = 0; i < numTurbine; i++)
            {
                fprintf(file1, "%f\t%d\t%f\n", sumU[i], numU[i], windU[i]);
            }
            fclose(file1);
#pragma endregion

/*******************************calc_P_Ct_fn()*****************************************/
#pragma region
            for (i = 0; i < numTurbine; i++)
            {
                k = (int)XY[i][4] - 1;
                if (windU[i] < UPCt[k][0][0] || windU[i] > UPCt[k][numUPCt[k] - 1][0])
                {
                    Power[i] = 0;
                    Ct[i] = 0;
                }
                else
                {
                    for (j = 0; j < numUPCt[k]; j++)
                    {
                        if (windU[i] >= UPCt[k][j][0] && windU[i] < UPCt[k][j + 1][0])
                        {
                            Power[i] = UPCt[k][j][1] + (UPCt[k][j + 1][1] - UPCt[k][j][1]) * (windU[i] - UPCt[k][j][0]) / (UPCt[k][j + 1][0] - UPCt[k][j][0]);
                            Ct[i] = UPCt[k][j][2] + (UPCt[k][j + 1][2] - UPCt[k][j][2]) * (windU[i] - UPCt[k][j][0]) / (UPCt[k][j + 1][0] - UPCt[k][j][0]);
                            /*Message("%f\t%f\n", UPCt[k][j][0], UPCt[k][j][2]);*/
                        }
                    }
                }
                fn[i] = 0.25 / dx[i] * p_air * Ct[i] * windU[i] * windU[i];
            }
#pragma endregion

/*******************************write_U_P_Ct_fn_ADJUST()*******************************/
#pragma region
            file1 = fopen("Output/Output06-U-P-Ct-fn(ADJUST)", "w");
            for (i = 0; i < numTurbine; i++)
            {
                fprintf(file1, "%f\t%f\t%f\t%f\n", windU[i], Power[i], Ct[i], fn[i]);
            }
            fclose(file1);
#pragma endregion

/*******************************calc_CUDMI_ADM()***************************************/
#pragma region
            forAll(mesh.cells(), cellI)
            {
                SourceT[cellI].x() = 0;
                SourceT[cellI].y() = 0;
                SourceT[cellI].z() = 0;
            }

            for (i = 0; i < numTurbine; i++)
            {
                forAll(mesh.cells(), cellI)
                {
                    xyz[0] = mesh.C()[cellI].x();
                    xyz[1] = mesh.C()[cellI].y();
                    xyz[2] = mesh.C()[cellI].z();
                    Dyz = Foam::sqrt(Foam::pow(XY[i][1] - xyz[1], 2) + Foam::pow(realHigh[i] - xyz[2], 2));
                    if (xyz[0] >= XY[i][0] - dx[i] && xyz[0] <= XY[i][0] + dx[i] && Dyz <= XY[i][3] * 0.5)
                    {
                        SourceT[cellI].x() = -fn[i];
                    }
                }
            }
#pragma endregion

#include "UEqn.H"
#include "pEqn.H"
        }

        laminarTransport.correct();
        turbulence->correct();
        runTime.write();
        runTime.printExecutionTime(Info);
    }

/*******************************write_U_P_Ct_fn_END()*******************************/
#pragma region
    char strPath[50], strNum[30];
    strcpy(strPath, "Output/txt/");
    numToStr(vInlet, strNum, 10);
    strcat(strPath, strcat(strNum, ".txt"));

    file1 = fopen(strPath, "w");
    for (i = 0; i < numTurbine; i++)
    {
        fprintf(file1, "%f\t%f\t%f\t%f\n", windU[i], Power[i], Ct[i], fn[i]);
    }
    fclose(file1);
#pragma endregion

    Info << "End\n"
         << endl;

    return 0;
}

// ************************************************************************* //