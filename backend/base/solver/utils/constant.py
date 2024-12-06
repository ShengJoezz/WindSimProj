CxyFormat = {
    'head': r'''/*--------------------------------*- C++ -*----------------------------------*\
  =========                 |
  \\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox
   \\    /   O peration     | Website:  https://openfoam.org
    \\  /    A nd           | Version:  6
     \\/     M anipulation  |
\*---------------------------------------------------------------------------*/
FoamFile
{
    version         2;
    format          ascii;
    class           volVectorField;
    location        "1";
    object          Cxy;
}

dimensions      [ 0 0 0 0 0 0 0 ];

internalField   nonuniform List<vector> 
''',
    'end': r''')
;

boundaryField
{
    inlet
    {
        type            fixedValue;
        value           uniform ( 0 0 0 );
    }
    outlet
    {
        type            fixedValue;
        value           uniform ( 0 0 0 );
    }
    back
    {
        type            symmetryPlane;
    }
    front
    {
        type            symmetryPlane;
    }
    bot
    {
        type            fixedValue;
        value           uniform ( 0 0 0 );
    }
    top
    {
        type            symmetryPlane;
    }
}


// ************************************************************************* //
'''
}
