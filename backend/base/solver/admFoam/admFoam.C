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
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
FILE *file0, *file1;
static int i, j, k, numTurbine, numUPCt[10] = {0}, botID = 6, numType;
static int onNode[200] = {0}, numU[200] = {0}, tempNumU[200] = {0};
static double XY[200][5] = {0}, UPCt[10][200][3] = {0}, realXYZ[200][3] = {0}, realHigh[200] = {0};
static double sumU[200] = {0}, windU[200] = {0};
static double Power[200] = {0}, Ct[200] = {0}, fn[200] = {0};
static double angle, vInlet, scale, dx[200] = {0}, botHigh;
static const double pi = 3.141592654, p_air = 1.225;
static int iUnit[200][10000] = {0}, cUnit[200][5000];
// Thread *tUnit[200][5000];
// cell_t cUnit[200][5000];

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

    cJSON *cjson_wind = cJSON_GetObjectItem(cjson, "wind");
    cJSON *cjson_wind_angle = cJSON_GetObjectItem(cjson_wind, "angle");
    cJSON *cjson_wind_speed = cJSON_GetObjectItem(cjson_wind, "speed");
    cJSON *cjson_mesh = cJSON_GetObjectItem(cjson, "mesh");
    cJSON *cjson_mesh_h1 = cJSON_GetObjectItem(cjson_mesh, "h1");
    cJSON *cjson_mesh_ceng = cJSON_GetObjectItem(cjson_mesh, "ceng");
    cJSON *cjson_mesh_lc2 = cJSON_GetObjectItem(cjson_mesh, "lc2");
    cJSON *cjson_mesh_scale = cJSON_GetObjectItem(cjson_mesh, "scale");
    cJSON *cjson_dx = cJSON_GetArrayItem(cjson_mesh_lc2, 0);

    
    angle = cjson_wind_angle->valuedouble;
    angle = -(90 + angle) * pi / 180;
    vInlet = cjson_wind_speed->valuedouble;
    scale = cjson_mesh_scale->valuedouble;
    botHigh = scale * cjson_mesh_h1->valuedouble / cjson_mesh_ceng->valuedouble;

    for (i = 0; i < numTurbine; i++)
    {
        k = (int)XY[i][4] - 1;
        cjson_dx = cJSON_GetArrayItem(cjson_mesh_lc2, k);
        dx[i] = scale * cjson_dx->valuedouble;
    }
    /*Message("angle = %f vInlet = %f scale = %f dx = %f\n", angle, vInlet, scale, dx[0]);*/

    free(json_str);
    cJSON_Delete(cjson);

    for (i = 0; i < numTurbine; i++)
    {
        /*windU[i] = vInlet;*/
        for (j = 0; j < 4; j++)
        {
            XY[i][j] = XY[i][j] * scale;
        }
        /*Message("%f\t%f\t%f\t%f\n", XY[i][0], XY[i][1], XY[i][2], XY[i][3]);*/
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
    Info<< "angle = " << angle << " vInlet = " << vInlet 
        << " scale = " << scale << " dx = " << dx[0] << endl;
}

int main(int argc, char *argv[])
{
    read_Turbines();
    read_InputJSON();
    read_U_P_Ct();

    #include "setRootCase.H"
    #include "createTime.H"
    #include "createMesh.H"

    /*******************************calc_RealHigh()*******************************/
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
            sumUnits ++;
            botFaceX = mesh.C()[faceI].x();
            botFaceY = mesh.C()[faceI].y();
            tempDxy = Foam::sqrt(Foam::pow(XY[i][0] - botFaceX, 2) + Foam::pow(XY[i][1] - botFaceY, 2));
            if (tempDxy <= Dxy[i])
            {
                Dxy[i] = tempDxy;
            }
        }
    }

    Info<< "整体网格数量:" << returnReduce(mesh.nCells(), sumOp<label>()) << endl;
    Info<< "底层网格数量:" << returnReduce(sumUnits, sumOp<int>()) << endl;

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

    /*******************************calc_windU_INIT()*******************************/
    #include "postProcess.H"
    #include "addCheckCaseOptions.H"
    #include "createControl.H"
    #include "createFields.H"
    #include "initContinuityErrs.H"

    double Dyz, xyz[3] = {0};

    for (i = 0; i < numTurbine; i++)
    {
        sumU[i] = 0;
        numU[i] = 0;
        forAll(mesh.cells(),cellI)
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

    /*******************************update_vInlet()*******************************/
    update_vInlet();

    /*******************************calc_P_Ct_fn()*******************************/
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

    /*******************************write_U_P_Ct_fn_INIT()*******************************/
    file1 = fopen("Output/Output04-U-P-Ct-fn(INIT)", "w");
    for (i = 0; i < numTurbine; i++)
    {
        fprintf(file1, "%f\t%f\t%f\t%f\n", windU[i], Power[i], Ct[i], fn[i]);
    }
    fclose(file1);

    /*******************************calc_CUDMI_ADM()*******************************/
    volVectorField SourceT
    (
        IOobject
        (
            "SourceT",
            runTime.timeName(),
            mesh,
            IOobject::MUST_READ,
            IOobject::AUTO_WRITE
        ),
        mesh
    );

    forAll(mesh.cells(),cellI)
    {
        SourceT[cellI].x() = 0;
        SourceT[cellI].y() = 0;
        SourceT[cellI].z() = 0;
    }

    for (i = 0; i < numTurbine; i++)
    {
        forAll(mesh.cells(),cellI)
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


    argList::addNote
    (
        "Steady-state solver for incompressible, turbulent flows."
    );

    
    turbulence->validate();

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    Info<< "\nStarting time loop\n" << endl;

    while (simple.loop())
    {
        Info<< "Time = " << runTime.timeName() << nl << endl;

        // --- Pressure-velocity SIMPLE corrector
        {
            /*******************************calc_windU_ADJUST()*******************************/
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

            /*******************************calc_P_Ct_fn()*******************************/
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

            /*******************************write_U_P_Ct_fn_ADJUST()*******************************/
            file1 = fopen("Output/Output06-U-P-Ct-fn(ADJUST)", "w");
            for (i = 0; i < numTurbine; i++)
            {
                fprintf(file1, "%f\t%f\t%f\t%f\n", windU[i], Power[i], Ct[i], fn[i]);
            }
            fclose(file1);

            /*******************************calc_CUDMI_ADM()*******************************/
            forAll(mesh.cells(),cellI)
            {
                SourceT[cellI].x() = 0;
                SourceT[cellI].y() = 0;
                SourceT[cellI].z() = 0;
            }

            for (i = 0; i < numTurbine; i++)
            {
                forAll(mesh.cells(),cellI)
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

            #include "UEqn.H"
            #include "pEqn.H"
        }

        laminarTransport.correct();
        turbulence->correct();
        runTime.write();
        runTime.printExecutionTime(Info);
    }

    /*******************************write_U_P_Ct_fn_END()*******************************/
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

    Info<< "End\n" << endl;

    return 0;
}

// ************************************************************************* //
